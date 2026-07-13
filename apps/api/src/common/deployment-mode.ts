/**
 * Deployment mode helpers for SaaS vs on-prem installs.
 */

export type DeploymentMode = 'saas' | 'onprem';

export function getDeploymentMode(): DeploymentMode {
  const raw = (process.env.DEPLOYMENT_MODE || 'saas').toLowerCase().trim();
  return raw === 'onprem' || raw === 'on-prem' || raw === 'on_premise' ? 'onprem' : 'saas';
}

export function isOnPrem(): boolean {
  return getDeploymentMode() === 'onprem';
}

export function isPublicSignupDisabled(): boolean {
  if (isOnPrem()) return true;
  const flag = (process.env.DISABLE_PUBLIC_SIGNUP || '').toLowerCase().trim();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

export function getLicenseServerUrl(): string | null {
  const url = (process.env.LICENSE_SERVER_URL || '').trim();
  return url || null;
}
