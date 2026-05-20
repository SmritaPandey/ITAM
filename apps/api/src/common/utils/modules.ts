import { TenantPlan } from '@prisma/client';

export const MODULE_CATALOG = {
  // Core / Starter Modules
  DASHBOARD: 'Dashboard',
  MY_PORTAL: 'My Portal',
  ALL_ASSETS: 'All Assets',
  IT_ASSETS: 'IT Assets',
  NON_IT_ASSETS: 'Non-IT Assets',
  TICKETS: 'Tickets',
  SERVICE_CATALOG: 'Service Catalog',
  USERS: 'Users',
  SETTINGS: 'Settings',
  HELP: 'Help & Docs',

  // Professional Modules
  CMDB: 'CMDB',
  WORK_ORDERS: 'Work Orders',
  DISCOVERY: 'Discovery',
  PATCH_MGMT: 'Patch Mgmt',
  NETWORK: 'Network (NMS)',
  SECURITY_SCAN: 'Security Scan',
  LICENSES: 'Licenses',
  KNOWLEDGE_BASE: 'Knowledge Base',
  REPORTS: 'Reports',
  AUDIT_LOGS: 'Audit Logs',
  CCTV: 'CCTV',

  // Enterprise / On-Premise Modules
  COMPLIANCE: 'Compliance',
  PROCUREMENT: 'Procurement',
  CHANGES: 'Changes',
  PROBLEMS: 'Problems',
  FLEET: 'Fleet / GPS',
  VDI: 'VDI',
  AUTOMATION: 'Automation',
};

export type ModuleKey = keyof typeof MODULE_CATALOG;

const STARTER_MODULES: ModuleKey[] = [
  'DASHBOARD',
  'MY_PORTAL',
  'ALL_ASSETS',
  'IT_ASSETS',
  'NON_IT_ASSETS',
  'TICKETS',
  'SERVICE_CATALOG',
  'USERS',
  'SETTINGS',
  'HELP',
];

const PROFESSIONAL_MODULES: ModuleKey[] = [
  ...STARTER_MODULES,
  'CMDB',
  'WORK_ORDERS',
  'DISCOVERY',
  'PATCH_MGMT',
  'NETWORK',
  'SECURITY_SCAN',
  'LICENSES',
  'KNOWLEDGE_BASE',
  'REPORTS',
  'AUDIT_LOGS',
  'CCTV',
];

const ENTERPRISE_MODULES: ModuleKey[] = [
  ...PROFESSIONAL_MODULES,
  'COMPLIANCE',
  'PROCUREMENT',
  'CHANGES',
  'PROBLEMS',
  'FLEET',
  'VDI',
  'AUTOMATION',
];

/**
 * Resolves the final list of allowed modules for a tenant based on their subscription plan
 * and any platform-owner-configured custom allowances or custom blocks.
 */
export function getResolvedModules(plan: TenantPlan, settings: any): ModuleKey[] {
  let defaultModules: ModuleKey[] = [];

  if (plan === TenantPlan.STARTER) {
    defaultModules = STARTER_MODULES;
  } else if (plan === TenantPlan.PROFESSIONAL) {
    defaultModules = PROFESSIONAL_MODULES;
  } else if (plan === TenantPlan.ENTERPRISE || plan === TenantPlan.ON_PREMISE) {
    defaultModules = ENTERPRISE_MODULES;
  } else {
    defaultModules = STARTER_MODULES;
  }

  // Parse owner settings overrides
  const customAllowed = Array.isArray(settings?.customAllowedModules) ? settings.customAllowedModules : [];
  const customBlocked = Array.isArray(settings?.customBlockedModules) ? settings.customBlockedModules : [];

  const resolved = new Set<ModuleKey>([
    ...defaultModules,
    ...(customAllowed as ModuleKey[]).filter(m => MODULE_CATALOG[m]),
  ]);

  for (const blocked of customBlocked) {
    resolved.delete(blocked as ModuleKey);
  }

  return Array.from(resolved);
}

/**
 * Resolves the final active modules for a tenant user workspace,
 * filtering out any modules they have self-disabled.
 */
export function getActiveModules(plan: TenantPlan, settings: any): ModuleKey[] {
  const allowed = getResolvedModules(plan, settings);
  const userDisabled = Array.isArray(settings?.userDisabledModules) ? settings.userDisabledModules : [];
  
  return allowed.filter(m => !userDisabled.includes(m));
}
