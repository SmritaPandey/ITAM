import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { SYSTEM_PROMPT_COPILOT, SYSTEM_PROMPT_RISK_ANALYST, SYSTEM_PROMPT_TICKET_CLASSIFIER, SYSTEM_PROMPT_PATCH_ADVISOR, SYSTEM_PROMPT_COMPLIANCE_AUDITOR } from './ai.prompts';
import { AI_TOOLS } from './ai.tools';
import OpenAI from 'openai';
import Redis from 'ioredis';

const MAX_TOOL_ROUNDS = 5; // Prevent infinite tool-calling loops

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly enabled: boolean;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventBus: EventBusService,
  ) {
    const baseURL = this.config.get<string>('AI_BASE_URL', 'http://localhost:11434/v1');
    const apiKey = this.config.get<string>('AI_API_KEY', 'not-needed');
    this.model = this.config.get<string>('AI_MODEL', 'gemma3:4b');
    this.enabled = this.config.get<string>('AI_ENABLED', 'false') === 'true';
    this.maxTokens = parseInt(this.config.get<string>('AI_MAX_TOKENS', '4096'), 10);
    this.temperature = parseFloat(this.config.get<string>('AI_TEMPERATURE', '0.3'));

    this.client = new OpenAI({ baseURL, apiKey });

    const redisUrl = this.config.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          connectTimeout: 5000,
        });
        this.redis.on('error', (err) => {
          this.logger.warn(`Redis connection error: ${err.message}`);
        });
      } catch (err: any) {
        this.logger.warn(`Failed to initialize Redis client: ${err.message}`);
      }
    }

    if (this.enabled) {
      this.logger.log(`AI engine enabled — model=${this.model} base=${baseURL}`);
    } else {
      this.logger.warn('AI engine disabled — set AI_ENABLED=true to activate');
    }
  }

  // ─── Health ──────────────────────────────────────────────────

  async getHealth() {
    if (!this.enabled) {
      return { available: false, model: this.model, provider: 'none', message: 'AI engine not enabled. Set AI_ENABLED=true in .env' };
    }
    const start = Date.now();
    try {
      const models = await this.client.models.list();
      const latency = Date.now() - start;
      const modelList = [];
      for await (const m of models) modelList.push(m.id);
      return { available: true, model: this.model, latency, provider: 'vllm/ollama', message: `${modelList.length} model(s) loaded` };
    } catch (err: any) {
      return { available: false, model: this.model, latency: Date.now() - start, provider: 'vllm/ollama', message: err.message || 'Connection failed' };
    }
  }

  // ─── Chat ────────────────────────────────────────────────────

  async chat(tenantId: string, userId: string, message: string, history?: Array<{ role: string; content: string }>) {
    if (!this.enabled) return { response: 'AI Copilot is not enabled. Ask your administrator to set AI_ENABLED=true.', toolsUsed: [] };

    try {
      this.eventBus.emitDomainEvent({
        type: 'ai.chat_started',
        tenantId,
        payload: { userId, messageLength: message.length, streaming: false },
        timestamp: new Date(),
      });
    } catch {}

    // Build context via RAG
    const ragContext = await this.buildRagContext(tenantId, message);

    // Build messages array
    const systemMsg = `${SYSTEM_PROMPT_COPILOT}\n\n## Current Data Context\n${ragContext}`;
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemMsg },
    ];

    // Add history (last 20 messages)
    if (history?.length) {
      for (const h of history.slice(-20)) {
        messages.push({ role: h.role as 'user' | 'assistant', content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });

    const toolsUsed: string[] = [];

    try {
      // Tool-calling loop
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const completion = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: AI_TOOLS as any,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
        });

        const choice = completion.choices[0];
        if (!choice) return { response: 'No response from AI model.', toolsUsed };

        // If the model wants to call tools
        if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
          messages.push(choice.message);

          for (const toolCall of choice.message.tool_calls) {
            const fn = (toolCall as any).function;
            const name = fn.name;
            toolsUsed.push(name);
            let args: Record<string, any> = {};
            try { args = JSON.parse(fn.arguments); } catch { /* empty */ }
            this.logger.debug(`Tool call: ${name}(${JSON.stringify(args)})`);

            const result = await this.executeTool(name, args, tenantId);
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
          }
          continue; // Next round with tool results
        }

        // Final text response
        return { response: choice.message.content || 'No response generated.', toolsUsed };
      }

      return { response: 'Reached maximum tool-calling rounds. Please try a simpler question.', toolsUsed };
    } catch (err: any) {
      this.logger.error(`AI chat error: ${err.message}`);
      return { response: `AI service error: ${err.message}. The AI engine may be unavailable.`, toolsUsed };
    }
  }

  async *chatStream(tenantId: string, userId: string, message: string, history?: Array<{ role: string; content: string }>) {
    if (!this.enabled) {
      yield { content: 'AI Copilot is not enabled. Ask your administrator to set AI_ENABLED=true.' };
      return;
    }

    try {
      this.eventBus.emitDomainEvent({
        type: 'ai.chat_started',
        tenantId,
        payload: { userId, messageLength: message.length, streaming: true },
        timestamp: new Date(),
      });
    } catch {}

    const ragContext = await this.buildRagContext(tenantId, message);
    const systemMsg = `${SYSTEM_PROMPT_COPILOT}\n\n## Current Data Context\n${ragContext}`;
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemMsg },
    ];

    if (history?.length) {
      for (const h of history.slice(-20)) {
        messages.push({ role: h.role as 'user' | 'assistant', content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });

    const toolsUsed: string[] = [];

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const stream = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: AI_TOOLS as any,
          max_tokens: this.maxTokens,
          temperature: this.temperature,
          stream: true,
        });

        let toolCallsAccumulator: any[] = [];
        let textAccumulator = '';
        let isToolCall = false;

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          if (!choice) continue;

          if (choice.delta?.tool_calls?.length) {
            isToolCall = true;
            for (const tc of choice.delta.tool_calls) {
              const idx = tc.index;
              if (!toolCallsAccumulator[idx]) {
                toolCallsAccumulator[idx] = { id: tc.id, type: 'function', function: { name: '', arguments: '' } };
              }
              if (tc.id) toolCallsAccumulator[idx].id = tc.id;
              if (tc.function?.name) toolCallsAccumulator[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCallsAccumulator[idx].function.arguments += tc.function.arguments;
            }
          }

          if (choice.delta?.content) {
            textAccumulator += choice.delta.content;
            yield { content: choice.delta.content };
          }
        }

        if (isToolCall && toolCallsAccumulator.length > 0) {
          const toolCalls = toolCallsAccumulator.filter(Boolean);
          
          messages.push({
            role: 'assistant',
            content: textAccumulator || null,
            tool_calls: toolCalls,
          });

          for (const toolCall of toolCalls) {
            const name = toolCall.function.name;
            toolsUsed.push(name);
            let args: Record<string, any> = {};
            try { args = JSON.parse(toolCall.function.arguments); } catch { /* empty */ }
            this.logger.debug(`Tool call: ${name}(${JSON.stringify(args)})`);

            const result = await this.executeTool(name, args, tenantId);
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
          }
          continue;
        }

        yield { done: true, toolsUsed };
        return;
      }

      yield { content: '\nReached maximum tool-calling rounds. Please try a simpler question.', done: true, toolsUsed };
    } catch (err: any) {
      this.logger.error(`AI chat stream error: ${err.message}`);
      yield { content: `\nAI service error: ${err.message}. The AI engine may be unavailable.`, done: true, toolsUsed };
    }
  }

  // ─── Analyze Asset ───────────────────────────────────────────

  async analyzeAsset(tenantId: string, assetId: string) {
    if (!this.enabled) return { riskScore: 0, riskLevel: 'UNKNOWN', analysis: 'AI not enabled.', recommendations: [], threats: [] };

    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
      include: {
        assetType: true,
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
        hardwareDetails: true,
        osDetails: true,
        securityPosture: true,
        softwareInstalls: { take: 20, include: { software: true } },
      },
    });

    if (!asset) return { riskScore: 0, riskLevel: 'UNKNOWN', analysis: 'Asset not found.', recommendations: [], threats: [] };

    const assetContext = JSON.stringify(asset, null, 2);

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_RISK_ANALYST },
          { role: 'user', content: `Analyze the security risk of this asset and return a JSON response with: riskScore (0-100), riskLevel (CRITICAL/HIGH/MEDIUM/LOW), analysis (detailed narrative), recommendations (array of {action, priority, details}), threats (array of {threat, severity, details}).\n\nAsset data:\n${assetContext}` },
        ],
        max_tokens: this.maxTokens,
        temperature: 0.2,
      });

      const text = completion.choices[0]?.message?.content || '';
      return this.parseJsonResponse(text, { riskScore: 50, riskLevel: 'MEDIUM', analysis: text, recommendations: [], threats: [] });
    } catch (err: any) {
      this.logger.error(`Asset analysis error: ${err.message}`);
      return { riskScore: 0, riskLevel: 'UNKNOWN', analysis: `Analysis failed: ${err.message}`, recommendations: [], threats: [] };
    }
  }

  // ─── Classify Ticket ─────────────────────────────────────────

  async classifyTicket(tenantId: string, ticketId: string) {
    if (!this.enabled) return { classification: 'UNKNOWN', suggestedPriority: 'MEDIUM', suggestedCategory: 'General', resolution: 'AI not enabled.', similarTickets: [] };

    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        requester: { select: { firstName: true, lastName: true, department: { select: { name: true } } } },
        comments: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!ticket) return { classification: 'UNKNOWN', suggestedPriority: 'MEDIUM', suggestedCategory: 'General', resolution: 'Ticket not found.', similarTickets: [] };

    // Find similar resolved tickets for context
    const similarTickets = await this.prisma.ticket.findMany({
      where: {
        tenantId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        id: { not: ticketId },
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { ticketNumber: true, subject: true, type: true, priority: true, category: true },
    });

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_TICKET_CLASSIFIER },
          { role: 'user', content: `Classify this ticket and suggest resolution. Return JSON with: classification, suggestedPriority, suggestedCategory, resolution, similarTickets[].\n\nTicket:\nSubject: ${ticket.subject}\nDescription: ${ticket.description || 'None'}\nType: ${ticket.type}\nCurrent Priority: ${ticket.priority}\nRequester: ${ticket.requester?.firstName} ${ticket.requester?.lastName}\nDepartment: ${ticket.requester?.department?.name || 'Unknown'}\n\nSimilar resolved tickets:\n${JSON.stringify(similarTickets, null, 2)}` },
        ],
        max_tokens: this.maxTokens,
        temperature: 0.2,
      });

      const text = completion.choices[0]?.message?.content || '';
      return this.parseJsonResponse(text, { classification: ticket.type, suggestedPriority: ticket.priority, suggestedCategory: ticket.category || 'General', resolution: text, similarTickets: [] });
    } catch (err: any) {
      this.logger.error(`Ticket classification error: ${err.message}`);
      return { classification: ticket.type, suggestedPriority: ticket.priority, suggestedCategory: 'General', resolution: `Classification failed: ${err.message}`, similarTickets: [] };
    }
  }

  // ─── Dashboard Insights ──────────────────────────────────────

  async getDashboardInsights(tenantId: string) {
    if (!this.enabled) return { insights: [{ title: 'AI Not Enabled', description: 'Enable AI_ENABLED=true for intelligent insights.', severity: 'INFO', action: 'Configure AI engine' }] };

    const cacheKey = `ai:insights:${tenantId}`;
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          this.logger.log(`Dashboard insights cache hit for tenant=${tenantId}`);
          return JSON.parse(cached);
        }
      } catch (err: any) {
        this.logger.warn(`Redis get failed: ${err.message}`);
      }
    }

    // Gather key metrics
    const [assetCount, openTickets, discoveredDevices, criticalPatches] = await Promise.all([
      this.prisma.asset.count({ where: { tenantId } }),
      this.prisma.ticket.count({ where: { tenantId, status: { in: ['NEW', 'OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.discoveredDevice.count({ where: { tenantId, status: 'PENDING' } }),
      this.prisma.patch.count({ where: { tenantId, severity: 'CRITICAL', status: { not: 'DEPLOYED' } } }).catch(() => 0),
    ]);

    const metricsContext = `Organization metrics:\n- Total assets: ${assetCount}\n- Open tickets: ${openTickets}\n- Pending discovered devices: ${discoveredDevices}\n- Critical undeployed patches: ${criticalPatches}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an ITAM analytics engine. Generate exactly 3 actionable insights based on the metrics. Return JSON array: [{title, description, severity (CRITICAL/HIGH/MEDIUM/LOW/INFO), action}].' },
          { role: 'user', content: metricsContext },
        ],
        max_tokens: 1024,
        temperature: 0.4,
      });

      const text = completion.choices[0]?.message?.content || '';
      const parsed = this.parseJsonResponse(text, { insights: [] });
      const result = { insights: parsed.insights || parsed };

      if (this.redis && result.insights && result.insights.length > 0) {
        try {
          await this.redis.setex(cacheKey, 300, JSON.stringify(result));
        } catch (err: any) {
          this.logger.warn(`Redis set failed: ${err.message}`);
        }
      }

      try {
        this.eventBus.emitDomainEvent({
          type: 'ai.insights_generated',
          tenantId,
          payload: { count: result.insights.length },
          timestamp: new Date(),
        });
      } catch {}

      return result;
    } catch (err: any) {
      this.logger.error(`Dashboard insights error: ${err.message}`);
      return { insights: [{ title: 'AI Unavailable', description: err.message, severity: 'INFO', action: 'Check AI engine' }] };
    }
  }

  // ─── Patch Prioritization ────────────────────────────────────

  async prioritizePatches(tenantId: string) {
    if (!this.enabled) return { plan: [] };

    const patches = await this.prisma.patch.findMany({
      where: { tenantId, status: { not: 'DEPLOYED' } },
      take: 30,
      orderBy: { createdAt: 'desc' },
    });

    if (patches.length === 0) return { plan: [] };

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_PATCH_ADVISOR },
          { role: 'user', content: `Prioritize these patches for deployment. Return JSON: {plan: [{patch, priority, affectedAssets, risk, recommendation}]}.\n\nPatches:\n${JSON.stringify(patches.map(p => ({ id: p.id, title: p.title, severity: p.severity, status: p.status, category: p.category })), null, 2)}` },
        ],
        max_tokens: this.maxTokens,
        temperature: 0.2,
      });

      const text = completion.choices[0]?.message?.content || '';
      return this.parseJsonResponse(text, { plan: [] });
    } catch (err: any) {
      this.logger.error(`Patch prioritization error: ${err.message}`);
      return { plan: [] };
    }
  }

  // ─── Compliance Review ───────────────────────────────────────

  async reviewCompliance(tenantId: string) {
    if (!this.enabled) return { overallScore: 0, gaps: [], recommendations: [], frameworks: {} };

    const [assetCount, encryptedCount, agentCount, patchCompliance] = await Promise.all([
      this.prisma.asset.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.securityPosture.count({ where: { asset: { tenantId }, encryptionEnabled: true } }).catch(() => 0),
      this.prisma.agent.count({ where: { tenantId, status: 'ONLINE' } }).catch(() => 0),
      this.prisma.patch.count({ where: { tenantId, status: 'DEPLOYED' } }).catch(() => 0),
    ]);

    const context = `Compliance data:\n- Total active assets: ${assetCount}\n- Assets with encryption: ${encryptedCount}\n- Online agents: ${agentCount}\n- Deployed patches: ${patchCompliance}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_COMPLIANCE_AUDITOR },
          { role: 'user', content: `Review our compliance posture and return JSON: {overallScore (0-100), gaps: [{control, framework, severity, finding, remediation}], recommendations: [{action, priority}], frameworks: {name: score}}.\n\n${context}` },
        ],
        max_tokens: this.maxTokens,
        temperature: 0.2,
      });

      const text = completion.choices[0]?.message?.content || '';
      return this.parseJsonResponse(text, { overallScore: 0, gaps: [], recommendations: [], frameworks: {} });
    } catch (err: any) {
      this.logger.error(`Compliance review error: ${err.message}`);
      return { overallScore: 0, gaps: [], recommendations: [], frameworks: {} };
    }
  }

  // ─── Tool Execution ──────────────────────────────────────────

  async executeTool(name: string, args: Record<string, any>, tenantId: string): Promise<string> {
    try {
      switch (name) {
        case 'search_assets': {
          const results = await this.prisma.asset.findMany({
            where: {
              tenantId,
              OR: [
                { name: { contains: args.query, mode: 'insensitive' } },
                { serialNumber: { contains: args.query, mode: 'insensitive' } },
                { assetTag: { contains: args.query, mode: 'insensitive' } },
                { ipAddress: { contains: args.query, mode: 'insensitive' } },
                { hostname: { contains: args.query, mode: 'insensitive' } },
              ],
              ...(args.status ? { status: args.status } : {}),
            },
            take: args.limit || 10,
            include: { assetType: { select: { name: true } } },
          });
          return JSON.stringify(results.map(a => ({ id: a.id, name: a.name, type: a.assetType?.name, status: a.status, serialNumber: a.serialNumber, assetTag: a.assetTag })));
        }

        case 'get_asset_details': {
          const asset = await this.prisma.asset.findFirst({
            where: { id: args.assetId, tenantId },
            include: { assetType: true, assignedTo: { select: { firstName: true, lastName: true, email: true } }, hardwareDetails: true, osDetails: true, securityPosture: true },
          });
          return asset ? JSON.stringify(asset) : '{"error": "Asset not found"}';
        }

        case 'search_tickets': {
          const tickets = await this.prisma.ticket.findMany({
            where: {
              tenantId,
              OR: [
                { subject: { contains: args.query, mode: 'insensitive' } },
                { description: { contains: args.query, mode: 'insensitive' } },
                { ticketNumber: { contains: args.query, mode: 'insensitive' } },
              ],
              ...(args.status ? { status: args.status } : {}),
              ...(args.priority ? { priority: args.priority } : {}),
            },
            take: args.limit || 10,
            orderBy: { createdAt: 'desc' },
            select: { id: true, ticketNumber: true, subject: true, status: true, priority: true, type: true, createdAt: true },
          });
          return JSON.stringify(tickets);
        }

        case 'get_ticket_details': {
          const ticket = await this.prisma.ticket.findFirst({
            where: { id: args.ticketId, tenantId },
            include: { requester: { select: { firstName: true, lastName: true } }, assignedTo: { select: { firstName: true, lastName: true } }, comments: { take: 10, orderBy: { createdAt: 'desc' } } },
          });
          return ticket ? JSON.stringify(ticket) : '{"error": "Ticket not found"}';
        }

        case 'search_knowledge_base': {
          const articles = await this.prisma.knowledgeArticle.findMany({
            where: {
              tenantId,
              status: 'PUBLISHED',
              OR: [
                { title: { contains: args.query, mode: 'insensitive' } },
                { content: { contains: args.query, mode: 'insensitive' } },
              ],
            },
            take: 5,
            select: { id: true, title: true, category: true, content: true },
          });
          // Truncate content for context window
          return JSON.stringify(articles.map(a => ({ ...a, content: a.content?.substring(0, 500) })));
        }

        case 'check_patch_compliance': {
          const where: any = { tenantId };
          if (args.assetId) {
            where.deployments = { some: { assetId: args.assetId } };
          }
          const [total, deployed, critical] = await Promise.all([
            this.prisma.patch.count({ where }),
            this.prisma.patch.count({ where: { ...where, status: 'DEPLOYED' } }),
            this.prisma.patch.count({ where: { ...where, severity: 'CRITICAL', status: { not: 'DEPLOYED' } } }),
          ]);
          return JSON.stringify({ total, deployed, pending: total - deployed, criticalPending: critical, compliancePercent: total > 0 ? Math.round((deployed / total) * 100) : 100 });
        }

        case 'get_network_devices': {
          const devices = await this.prisma.monitoredDevice.findMany({
            where: { tenantId, ...(args.subnet ? { ipAddress: { startsWith: args.subnet } } : {}) },
            take: 20,
            select: { id: true, name: true, ipAddress: true, type: true, status: true, lastSeen: true },
          });
          return JSON.stringify(devices);
        }

        case 'get_compliance_status': {
          const [totalAssets, activeAgents, encryptedDevices] = await Promise.all([
            this.prisma.asset.count({ where: { tenantId, status: 'ACTIVE' } }),
            this.prisma.agent.count({ where: { tenantId, status: 'ONLINE' } }),
            this.prisma.securityPosture.count({ where: { asset: { tenantId }, encryptionEnabled: true } }).catch(() => 0),
          ]);
          return JSON.stringify({ totalAssets, activeAgents, encryptedDevices, agentCoverage: totalAssets > 0 ? Math.round((activeAgents / totalAssets) * 100) : 0 });
        }

        case 'create_ticket': {
          // Find a default requester for auto-created tickets
          const systemUser = await this.prisma.user.findFirst({ where: { tenantId }, select: { id: true } });
          if (!systemUser) return '{"error": "No users found in tenant"}';
          const ticket = await this.prisma.ticket.create({
            data: {
              tenantId,
              subject: args.subject,
              description: args.description || '',
              priority: args.priority || 'MEDIUM',
              type: args.type || 'INCIDENT',
              status: 'NEW',
              ticketNumber: `AI-${Date.now().toString(36).toUpperCase()}`,
              requesterId: systemUser.id,
            },
          });
          return JSON.stringify({ id: ticket.id, ticketNumber: ticket.ticketNumber, message: 'Ticket created successfully' });
        }

        case 'get_recent_alerts': {
          const alerts = await this.prisma.notification.findMany({
            where: { tenantId, type: { in: ['ALERT', 'WARNING', 'CRITICAL'] } },
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true, message: true, type: true, createdAt: true, isRead: true },
          });
          return JSON.stringify(alerts);
        }

        case 'search_vulnerabilities': {
          const results = await this.prisma.scanResult.findMany({
            where: {
              tenantId,
              OR: [
                { scanType: { contains: args.query, mode: 'insensitive' } },
                { target: { contains: args.query, mode: 'insensitive' } },
              ],
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: { id: true, scanType: true, target: true, status: true, summary: true },
          });
          return JSON.stringify(results);
        }

        default:
          return `{"error": "Unknown tool: ${name}"}`;
      }
    } catch (err: any) {
      this.logger.error(`Tool execution error (${name}): ${err.message}`);
      return `{"error": "Failed to retrieve information due to a tool execution error."}`;
    }
  }

  // ─── RAG Context Builder ─────────────────────────────────────

  private async buildRagContext(tenantId: string, query: string): Promise<string> {
    const parts: string[] = [];

    try {
      // Get high-level org stats
      const [assetCount, ticketCount, agentCount] = await Promise.all([
        this.prisma.asset.count({ where: { tenantId } }),
        this.prisma.ticket.count({ where: { tenantId, status: { in: ['NEW', 'OPEN', 'IN_PROGRESS'] } } }),
        this.prisma.agent.count({ where: { tenantId } }),
      ]);
      parts.push(`Organization: ${assetCount} assets, ${ticketCount} open tickets, ${agentCount} agents deployed.`);

      // Search for relevant assets
      const assets = await this.prisma.asset.findMany({
        where: { tenantId, OR: [{ name: { contains: query.substring(0, 50), mode: 'insensitive' } }] },
        take: 5,
        select: { name: true, status: true, assetTag: true },
      });
      if (assets.length > 0) {
        parts.push(`Relevant assets: ${assets.map(a => `${a.name} (${a.status})`).join(', ')}`);
      }
    } catch {
      // Non-critical, continue without RAG
    }

    return parts.length > 0 ? parts.join('\n') : 'No additional context available.';
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private parseJsonResponse(text: string, fallback: any): any {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (jsonMatch) return JSON.parse(jsonMatch[1]);

      // Try to parse the whole text as JSON
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);

      // If it's just text, use it as the analysis/response field
      return { ...fallback, analysis: text, description: text };
    } catch {
      return { ...fallback, analysis: text, description: text };
    }
  }
}
