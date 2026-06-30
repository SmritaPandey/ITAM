/**
 * ITAM Training Data Preparation Script
 * 
 * Exports data from the ITAM database and converts it into
 * JSONL training format for fine-tuning Gemma 4.
 * 
 * Usage:
 *   cd apps/api
 *   npx ts-node ../../ai/training/prepare-data.ts
 * 
 * Output: ai/training/data/training-data.jsonl
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const OUTPUT_DIR = path.join(__dirname, 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'training-data.jsonl');

interface TrainingConversation {
  conversations: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

const SYSTEM_PROMPT = `You are an expert IT Asset Management (ITAM) assistant for an enterprise organization. You have deep knowledge of:
- Hardware and software asset lifecycle management
- Network device management and monitoring
- Vulnerability assessment and patch management
- IT compliance frameworks (ISO 27001, NIST CSF, CIS Controls)
- ITSM processes (incident, problem, change management)
- Risk assessment and security posture analysis

Provide clear, actionable responses. When analyzing assets or risks, be specific about threats and remediation steps. Use structured formatting with headers, bullet points, and severity levels.`;

async function main() {
  console.log('ITAM Training Data Generator');
  console.log('===========================\n');

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const examples: TrainingConversation[] = [];

  // ─── 1. Asset Classification Examples ──────────────────────
  console.log('📦 Generating asset classification examples...');
  const assets = await prisma.asset.findMany({
    take: 200,
    include: { assetType: true, assignedTo: true },
    orderBy: { createdAt: 'desc' },
  });

  for (const asset of assets) {
    examples.push({
      conversations: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Classify this asset and assess its management status:\nName: ${asset.name}\nType: ${asset.assetType?.name || 'Unknown'}\nStatus: ${asset.status}\nSerial: ${asset.serialNumber || 'N/A'}\nPurchase Date: ${asset.purchaseDate || 'Unknown'}\nAssigned To: ${asset.assignedTo ? `${asset.assignedTo.firstName} ${asset.assignedTo.lastName}` : 'Unassigned'}` },
        { role: 'assistant', content: generateAssetAnalysis(asset) },
      ],
    });
  }
  console.log(`  Generated ${assets.length} asset examples`);

  // ─── 2. Ticket Resolution Examples ─────────────────────────
  console.log('🎫 Generating ticket resolution examples...');
  const tickets = await prisma.ticket.findMany({
    take: 200,
    where: { status: { in: ['RESOLVED', 'CLOSED'] } },
    include: { requester: true, assignee: true, comments: { take: 5 } },
    orderBy: { updatedAt: 'desc' },
  });

  for (const ticket of tickets) {
    const resolution = ticket.comments?.find((c: any) => 
      c.content?.toLowerCase().includes('resolved') || 
      c.content?.toLowerCase().includes('fixed') ||
      c.content?.toLowerCase().includes('solution')
    );

    examples.push({
      conversations: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `A user submitted this ticket:\nSubject: ${ticket.subject}\nDescription: ${ticket.description || 'No description'}\nType: ${ticket.type}\nPriority: ${ticket.priority}\n\nClassify this ticket and suggest a resolution approach.` },
        { role: 'assistant', content: generateTicketClassification(ticket, resolution) },
      ],
    });
  }
  console.log(`  Generated ${tickets.length} ticket examples`);

  // ─── 3. Risk Assessment Examples ───────────────────────────
  console.log('🛡️  Generating risk assessment examples...');
  const discoveredDevices = await prisma.discoveredDevice.findMany({
    take: 100,
    orderBy: { lastSeen: 'desc' },
  });

  for (const device of discoveredDevices) {
    const metadata = device.metadata as any;
    if (metadata?.openPorts?.length > 0) {
      examples.push({
        conversations: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze the security risk of this discovered network device:\nIP: ${device.ipAddress}\nHostname: ${device.hostname || 'Unknown'}\nMAC: ${device.macAddress || 'Unknown'}\nOS: ${metadata?.osGuess || 'Unknown'}\nOpen Ports: ${metadata.openPorts.map((p: any) => `${p.port}/${p.service || 'unknown'}`).join(', ')}\nVendor: ${metadata?.vendor || 'Unknown'}` },
          { role: 'assistant', content: generateRiskAnalysis(device, metadata) },
        ],
      });
    }
  }
  console.log(`  Generated ${discoveredDevices.length} risk examples`);

  // ─── 4. Knowledge Base Q&A Examples ────────────────────────
  console.log('📚 Generating KB Q&A examples...');
  const articles = await prisma.knowledgeArticle.findMany({
    take: 100,
    where: { status: 'PUBLISHED' },
    orderBy: { viewCount: 'desc' },
  });

  for (const article of articles) {
    examples.push({
      conversations: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Answer this question based on our knowledge base:\n${generateQuestionFromArticle(article)}` },
        { role: 'assistant', content: `Based on our knowledge base article "${article.title}":\n\n${article.content?.substring(0, 2000) || 'No content available.'}\n\n*Source: Knowledge Base — ${article.title} (${article.category || 'General'})*` },
      ],
    });
  }
  console.log(`  Generated ${articles.length} KB Q&A examples`);

  // ─── Write Output ──────────────────────────────────────────
  console.log(`\n📝 Writing ${examples.length} total examples to ${OUTPUT_FILE}`);

  const output = examples.map(ex => JSON.stringify(ex)).join('\n');
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');

  const fileSizeMB = (Buffer.byteLength(output) / 1024 / 1024).toFixed(2);
  console.log(`   File size: ${fileSizeMB} MB`);
  console.log('\n✅ Training data generation complete!');
  console.log(`\nNext steps:`);
  console.log(`  1. Review and edit: ${OUTPUT_FILE}`);
  console.log(`  2. Fine-tune: python ai/training/fine-tune.py --data ${OUTPUT_FILE}`);

  await prisma.$disconnect();
}

// ─── Helper Functions ──────────────────────────────────────────

function generateAssetAnalysis(asset: any): string {
  const lines: string[] = [];
  lines.push(`## Asset Analysis: ${asset.name}\n`);
  lines.push(`**Classification:** ${asset.assetType?.name || 'Unclassified'}`);
  lines.push(`**Lifecycle Stage:** ${formatStatus(asset.status)}\n`);

  if (asset.status === 'ACTIVE') {
    lines.push('**Status Assessment:** This asset is actively deployed and operational.');
    if (!asset.assignedTo) {
      lines.push('⚠️ **Warning:** Active asset with no assigned owner — recommend assigning an owner for accountability.');
    }
  } else if (asset.status === 'DISCOVERED') {
    lines.push('**Status Assessment:** Recently discovered asset pending inventory review.');
    lines.push('**Recommendation:** Review and classify this asset, then assign to an owner.');
  } else if (asset.status === 'RETIRED') {
    lines.push('**Status Assessment:** Asset is retired from active service.');
    lines.push('**Recommendation:** Ensure data has been wiped and asset is properly decommissioned.');
  }

  if (asset.purchaseDate) {
    const ageYears = Math.floor((Date.now() - new Date(asset.purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (ageYears >= 5) {
      lines.push(`\n⚠️ **Age Alert:** This asset is ${ageYears} years old. Consider replacement planning.`);
    }
  }

  return lines.join('\n');
}

function generateTicketClassification(ticket: any, resolution: any): string {
  const lines: string[] = [];
  lines.push(`## Ticket Classification\n`);
  lines.push(`**Type:** ${ticket.type}`);
  lines.push(`**Suggested Priority:** ${ticket.priority}`);
  lines.push(`**Category:** ${ticket.category || 'General IT Support'}\n`);
  lines.push(`### Analysis`);
  lines.push(`This appears to be a ${ticket.type.toLowerCase()} ticket related to ${ticket.category || 'general IT support'}.`);
  lines.push(`\n### Suggested Resolution`);
  if (resolution) {
    lines.push(resolution.content.substring(0, 500));
  } else {
    lines.push(`1. Acknowledge the ticket and gather additional details from the requester`);
    lines.push(`2. Investigate the root cause`);
    lines.push(`3. Apply fix or workaround`);
    lines.push(`4. Verify with the requester and close the ticket`);
  }
  return lines.join('\n');
}

function generateRiskAnalysis(device: any, metadata: any): string {
  const lines: string[] = [];
  const openPorts = metadata?.openPorts || [];
  let riskScore = 0;

  // Calculate risk
  const portNumbers = openPorts.map((p: any) => p.port);
  if (portNumbers.includes(23)) riskScore += 35;
  if (portNumbers.includes(3389)) riskScore += 20;
  if (portNumbers.includes(5900)) riskScore += 30;
  if (portNumbers.includes(445)) riskScore += 15;
  if (!device.hostname) riskScore += 15;
  riskScore = Math.min(riskScore, 100);

  const level = riskScore >= 70 ? 'CRITICAL' : riskScore >= 40 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW';

  lines.push(`## Security Risk Analysis\n`);
  lines.push(`**Risk Score:** ${riskScore}/100 (${level})\n`);
  lines.push(`### Findings\n`);

  for (const port of openPorts) {
    const svc = port.service || `port ${port.port}`;
    if (port.port === 23) lines.push(`- 🔴 **CRITICAL:** Telnet (${svc}) is open — unencrypted remote access`);
    else if (port.port === 3389) lines.push(`- 🟡 **HIGH:** RDP (${svc}) exposed — potential brute-force target`);
    else if (port.port === 5900) lines.push(`- 🔴 **CRITICAL:** VNC (${svc}) exposed — often unencrypted`);
    else if (port.port === 445) lines.push(`- 🟡 **HIGH:** SMB (${svc}) exposed — check for EternalBlue patches`);
    else lines.push(`- ℹ️ ${svc} on port ${port.port}`);
  }

  lines.push(`\n### Recommendations\n`);
  if (portNumbers.includes(23)) lines.push(`1. **Disable Telnet** and migrate to SSH for remote access`);
  if (portNumbers.includes(3389)) lines.push(`2. **Restrict RDP** access via firewall rules or VPN`);
  if (portNumbers.includes(5900)) lines.push(`3. **Disable or secure VNC** with encryption and strong authentication`);
  lines.push(`4. Ensure this device is enrolled in asset management`);

  return lines.join('\n');
}

function generateQuestionFromArticle(article: any): string {
  const title = article.title || 'this topic';
  // Generate a natural question from the article title
  if (title.toLowerCase().includes('how to')) return title.replace(/^how to /i, 'How do I ') + '?';
  if (title.toLowerCase().includes('setup') || title.toLowerCase().includes('install')) return `How do I ${title.toLowerCase()}?`;
  if (title.toLowerCase().includes('troubleshoot')) return `I'm having issues with ${title.replace(/troubleshoot/i, '').trim()}. What should I do?`;
  return `Tell me about ${title.toLowerCase()}`;
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

main().catch(console.error);
