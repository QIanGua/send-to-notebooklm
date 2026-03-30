export type PlanTier = 'free' | 'pro';

export type Capability =
  | 'batch_import'
  | 'dedupe'
  | 'auto_routing'
  | 'import_history'
  | 'presets';

export interface EntitlementState {
  plan: PlanTier;
  capabilities: Capability[];
  source: 'anonymous' | 'local' | 'remote';
  updatedAt: string;
}

export const PRO_CAPABILITIES: Capability[] = [
  'batch_import',
  'dedupe',
  'auto_routing',
  'import_history',
  'presets',
];

export const FREE_ENTITLEMENTS: EntitlementState = {
  plan: 'pro',
  capabilities: [...PRO_CAPABILITIES],
  source: 'local',
  updatedAt: new Date().toISOString(),
};

export function createEntitlements(plan: PlanTier, source: EntitlementState['source']): EntitlementState {
  return {
    plan,
    capabilities: plan === 'pro' ? [...PRO_CAPABILITIES] : [],
    source,
    updatedAt: new Date().toISOString(),
  };
}

export function hasCapability(entitlements: EntitlementState, capability: Capability): boolean {
  return entitlements.capabilities.includes(capability);
}

