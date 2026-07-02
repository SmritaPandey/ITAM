import { Controller, Get, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ComplianceService } from './compliance.service';
import { Response } from 'express';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private complianceService: ComplianceService) {}

  @Get('compliance/full')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Generate full compliance report' })
  async fullComplianceReport(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const cisBenchmark = await this.complianceService.getCisBenchmarkReport(tenantId);
    const policies = await this.complianceService.listPolicies(tenantId);
    const templates = await this.complianceService.getTemplates();

    return {
      reportType: 'FULL_COMPLIANCE',
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.email || req.user.id,
      organization: tenantId,
      sections: [
        {
          title: 'CIS Benchmark Assessment',
          summary: {
            totalAgents: cisBenchmark.totalAgents,
            averageScore: cisBenchmark.averageScore,
            assessedAt: cisBenchmark.assessedAt,
          },
          agents: cisBenchmark.agents,
        },
        {
          title: 'Active Compliance Policies',
          totalPolicies: policies.length,
          policies: policies.map((p: any) => ({
            name: p.name, category: p.category, severity: p.severity,
            action: p.action, enabled: p.enabled, violationCount: p.violationCount || 0,
          })),
        },
        {
          title: 'Available Policy Templates',
          templates: templates.map((t: any) => ({
            name: t.name, description: t.description, category: t.category,
            severity: t.severity, action: t.action,
          })),
        },
      ],
    };
  }

  @Get('compliance/cis/:agentId')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Generate CIS report for specific agent' })
  async agentCisReport(@Request() req: any, @Param('agentId') agentId: string) {
    const assessment = await this.complianceService.assessCisBenchmark(req.user.tenantId, agentId);
    return {
      reportType: 'CIS_AGENT_ASSESSMENT',
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.email || req.user.id,
      ...assessment,
    };
  }

  @Get('security/summary')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Generate executive security summary' })
  async securitySummary(@Request() req: any) {
    const tenantId = req.user.tenantId;
    const cisBenchmark = await this.complianceService.getCisBenchmarkReport(tenantId);
    const policies = await this.complianceService.listPolicies(tenantId);

    // Calculate risk score
    const avgCis = cisBenchmark.averageScore || 0;
    const criticalPolicies = policies.filter((p: any) => p.severity === 'CRITICAL' && p.violationCount > 0).length;
    const riskScore = Math.max(0, 100 - avgCis + (criticalPolicies * 10));
    const riskLevel = riskScore <= 20 ? 'LOW' : riskScore <= 50 ? 'MEDIUM' : riskScore <= 75 ? 'HIGH' : 'CRITICAL';

    return {
      reportType: 'EXECUTIVE_SECURITY_SUMMARY',
      generatedAt: new Date().toISOString(),
      generatedBy: req.user.email || req.user.id,
      overallRiskScore: riskScore,
      overallRiskLevel: riskLevel,
      cisBenchmarkAverage: avgCis,
      totalEndpoints: cisBenchmark.totalAgents,
      activePolicies: policies.length,
      criticalViolations: criticalPolicies,
      recommendations: [
        ...(avgCis < 70 ? ['Improve CIS benchmark scores across fleet — current average is ' + avgCis + '%'] : []),
        ...(criticalPolicies > 0 ? [`Address ${criticalPolicies} critical policy violation(s) immediately`] : []),
        'Review and enable all recommended CIS Benchmark templates',
        'Ensure RADIUS/802.1X is configured for network access control',
        'Schedule regular compliance assessments',
      ],
    };
  }
}
