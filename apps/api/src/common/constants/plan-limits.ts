/**
 * Unified plan limits — single source of truth for all plan-limit checks.
 *
 * `maxAssets`, `maxUsers`, `maxScansPerMonth` are used by TenantMeteringService
 * for hard enforcement.  `modules` and `price` are used by SettingsService for
 * the billing / account UI.
 *
 * Use `Infinity` (or `-1` in the UI-facing shape) to indicate "unlimited".
 */
export const PLAN_LIMITS: Record<
  string,
  {
    maxAssets: number;
    maxUsers: number;
    maxScansPerMonth: number;
    modules: number;
    price: number;
  }
> = {
  STARTER: {
    maxAssets: 5,
    maxUsers: 4,
    maxScansPerMonth: 10,
    modules: 4,
    price: 0,
  },
  PROFESSIONAL: {
    maxAssets: Infinity,
    maxUsers: 50,
    maxScansPerMonth: Infinity,
    modules: 12,
    price: 4999,
  },
  ENTERPRISE: {
    maxAssets: Infinity,
    maxUsers: Infinity,
    maxScansPerMonth: Infinity,
    modules: 12,
    price: 14999,
  },
  ON_PREMISE: {
    maxAssets: Infinity,
    maxUsers: Infinity,
    maxScansPerMonth: Infinity,
    modules: 12,
    price: 0,
  },
};
