/**
 * Typed client for the `BudgetContract` (per-user category budgets).
 *
 * Contract methods (see `contracts/budget/src/lib.rs`): initialize(admin),
 * update_budget(admin, user, amount, asset), set_category_budget(admin, user,
 * category, limit), spend_from_category(user, category, amount),
 * suspend_budget / resume_budget / is_budget_suspended,
 * transfer_between_categories(user, from, to, amount),
 * delegated_update_budget(manager, owner, amount),
 * execute_deletion, add_global_rule, add_user_rule,
 * distribute_remaining_funds(caller, owner),
 * configure_expiration, mark_inactive, deactivate_if_expired, unfreeze_budget,
 * schedule_deletion, cancel_deletion,
 * delegate_manager, revoke_manager, get_delegation, get_owner_delegates,
 * set_inactivity_timeout, get_inactivity_timeout, get_last_activity,
 * set_inheritance_bens, get_inheritance_beneficiaries,
 * register_beneficiaries, get_beneficiaries, claim_ownership,
 * get_category_balance, get_user_budget, get_transfer, get_transfer_history,
 * get_budget_history, get_budget_version, is_frozen, get_freeze_state,
 * get_suspicious_activity_count, get_pending_deletion, get_budget,
 * get_budget_by_asset, get_user_assets, get_admin, get_total_allocated
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  i128,
  symbol,
  u32,
  u64,
  vec,
  struct,
  voidScVal,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BeneficiaryInput {
  address: string;
  percentage: number;
}

export type BudgetRuleInput =
  | { variant: 'MaxAmount'; amount: bigint }
  | { variant: 'MinAmount'; amount: bigint };

export interface BudgetRecord {
  user: string;
  amount: bigint;
  asset: string | null;
  lastUpdated: bigint;
  expiresAt: bigint | null;
  isActive: boolean;
  isArchived: boolean;
}

export interface CategoryBudgetRecord {
  name: string;
  limit: bigint;
  spent: bigint;
}

export interface UserBudgetRecord {
  user: string;
  categories: Record<string, CategoryBudgetRecord>;
  lastUpdated: bigint;
}

export interface CategoryTransferRecord {
  transferId: bigint;
  user: string;
  fromCategory: string;
  toCategory: string;
  amount: bigint;
  timestamp: bigint;
}

export interface BudgetFreezeRecord {
  isFrozen: boolean;
  frozenAt: bigint;
  autoUnfreezeAt: bigint;
}

export interface BudgetConfigVersionRecord {
  version: number;
  categories: Record<string, CategoryBudgetRecord>;
  updatedAt: bigint;
}

export interface PendingDeletionRecord {
  user: string;
  cooldownExpiry: bigint;
}

export interface DelegationPermissionRecord {
  maxAmount: bigint;
  createdAt: bigint;
  isActive: boolean;
}

export interface BeneficiaryRecord {
  address: string;
  percentage: number;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class BudgetClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  updateBudget(
    admin: string,
    user: string,
    amount: bigint,
    asset: string | null,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_budget', [
      address(admin),
      address(user),
      i128(amount),
      asset ? address(asset) : voidScVal(),
    ]);
  }

  setCategoryBudget(
    admin: string,
    user: string,
    category: string,
    limit: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_category_budget', [
      address(admin),
      address(user),
      symbol(category),
      i128(limit),
    ]);
  }

  async spendFromCategory(
    user: string,
    category: string,
    amount: bigint,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'spend_from_category',
      [address(user), symbol(category), i128(amount)],
      decodeI128,
    );
    return assertResult(result, 'spend_from_category');
  }

  suspendBudget(
    admin: string,
    user: string,
    durationSeconds: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'suspend_budget', [
      address(admin),
      address(user),
      u64(durationSeconds),
    ]);
  }

  resumeBudget(admin: string, user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'resume_budget', [
      address(admin),
      address(user),
    ]);
  }

  isBudgetSuspended(user: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'is_budget_suspended',
      [address(user)],
      decodeBool,
    );
  }

  async transferBetweenCategories(
    user: string,
    fromCategory: string,
    toCategory: string,
    amount: bigint,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'transfer_between_categories',
      [address(user), symbol(fromCategory), symbol(toCategory), i128(amount)],
      decodeU64,
    );
    return assertResult(result, 'transfer_between_categories');
  }

  delegatedUpdateBudget(
    manager: string,
    owner: string,
    amount: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'delegated_update_budget', [
      address(manager),
      address(owner),
      i128(amount),
    ]);
  }

  executeDeletion(admin: string, user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'execute_deletion', [
      address(admin),
      address(user),
    ]);
  }

  addGlobalRule(admin: string, rule: BudgetRuleInput): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'add_global_rule', [
      address(admin),
      encodeBudgetRule(rule),
    ]);
  }

  addUserRule(
    admin: string,
    user: string,
    rule: BudgetRuleInput,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'add_user_rule', [
      address(admin),
      address(user),
      encodeBudgetRule(rule),
    ]);
  }

  distributeRemainingFunds(
    caller: string,
    owner: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'distribute_remaining_funds', [
      address(caller),
      address(owner),
    ]);
  }

  configureExpiration(
    admin: string,
    user: string,
    expiresAt: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'configure_expiration', [
      address(admin),
      address(user),
      u64(expiresAt),
    ]);
  }

  markInactive(admin: string, user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'mark_inactive', [
      address(admin),
      address(user),
    ]);
  }

  deactivateIfExpired(user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'deactivate_if_expired', [
      address(user),
    ]);
  }

  unfreezeBudget(caller: string, user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'unfreeze_budget', [
      address(caller),
      address(user),
    ]);
  }

  scheduleDeletion(admin: string, user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'schedule_deletion', [
      address(admin),
      address(user),
    ]);
  }

  cancelDeletion(admin: string, user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'cancel_deletion', [
      address(admin),
      address(user),
    ]);
  }

  delegateManager(
    owner: string,
    manager: string,
    maxAmount: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'delegate_manager', [
      address(owner),
      address(manager),
      i128(maxAmount),
    ]);
  }

  revokeManager(owner: string, manager: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'revoke_manager', [
      address(owner),
      address(manager),
    ]);
  }

  getDelegation(owner: string, manager: string): Promise<DelegationPermissionRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_delegation',
      [address(owner), address(manager)],
      decodeDelegationOrNull,
    );
  }

  getOwnerDelegates(owner: string): Promise<string[]> {
    return this.gateway.read(
      this.contractId,
      'get_owner_delegates',
      [address(owner)],
      decodeAddressVec,
    );
  }

  setInactivityTimeout(
    user: string,
    timeout: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_inactivity_timeout', [
      address(user),
      u64(timeout),
    ]);
  }

  getInactivityTimeout(user: string): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_inactivity_timeout',
      [address(user)],
      decodeU64,
    );
  }

  getLastActivity(user: string): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_last_activity',
      [address(user)],
      decodeU64,
    );
  }

  setInheritanceBens(
    user: string,
    beneficiaries: string[],
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_inheritance_bens', [
      address(user),
      vec(beneficiaries.map(address)),
    ]);
  }

  getInheritanceBeneficiaries(user: string): Promise<string[]> {
    return this.gateway.read(
      this.contractId,
      'get_inheritance_beneficiaries',
      [address(user)],
      decodeAddressVec,
    );
  }

  registerBeneficiaries(
    user: string,
    beneficiaries: BeneficiaryInput[],
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'register_beneficiaries', [
      address(user),
      vec(
        beneficiaries.map((b) =>
          struct({ address: address(b.address), percentage: u32(b.percentage) }),
        ),
      ),
    ]);
  }

  getBeneficiaries(user: string): Promise<BeneficiaryRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_beneficiaries',
      [address(user)],
      decodeBeneficiaryVec,
    );
  }

  claimOwnership(beneficiary: string, owner: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'claim_ownership', [
      address(beneficiary),
      address(owner),
    ]);
  }

  getCategoryBalance(user: string, category: string): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_category_balance',
      [address(user), symbol(category)],
      decodeI128,
    );
  }

  getUserBudget(user: string): Promise<UserBudgetRecord> {
    return this.gateway.read(
      this.contractId,
      'get_user_budget',
      [address(user)],
      decodeUserBudget,
    );
  }

  getTransfer(transferId: bigint): Promise<CategoryTransferRecord> {
    return this.gateway.read(
      this.contractId,
      'get_transfer',
      [u64(transferId)],
      decodeCategoryTransfer,
    );
  }

  getTransferHistory(user: string): Promise<CategoryTransferRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_transfer_history',
      [address(user)],
      decodeCategoryTransferVec,
    );
  }

  getBudgetHistory(user: string): Promise<BudgetConfigVersionRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_budget_history',
      [address(user)],
      decodeConfigVersionVec,
    );
  }

  getBudgetVersion(user: string, version: number): Promise<BudgetConfigVersionRecord> {
    return this.gateway.read(
      this.contractId,
      'get_budget_version',
      [address(user), u32(version)],
      decodeConfigVersion,
    );
  }

  isFrozen(user: string): Promise<boolean> {
    return this.gateway.read(this.contractId, 'is_frozen', [address(user)], decodeBool);
  }

  getFreezeState(user: string): Promise<BudgetFreezeRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_freeze_state',
      [address(user)],
      decodeFreezeOrNull,
    );
  }

  getSuspiciousActivityCount(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_suspicious_activity_count',
      [],
      decodeU64,
    );
  }

  getPendingDeletion(user: string): Promise<PendingDeletionRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_pending_deletion',
      [address(user)],
      decodePendingDeletionOrNull,
    );
  }

  getBudget(user: string): Promise<BudgetRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_budget',
      [address(user)],
      decodeBudgetRecordOrNull,
    );
  }

  getBudgetByAsset(user: string, asset: string): Promise<BudgetRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_budget_by_asset',
      [address(user), address(asset)],
      decodeBudgetRecordOrNull,
    );
  }

  getUserAssets(user: string): Promise<string[]> {
    return this.gateway.read(
      this.contractId,
      'get_user_assets',
      [address(user)],
      decodeAddressVec,
    );
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  getTotalAllocated(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_allocated', [], decodeI128);
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodeBudgetRule = (rule: BudgetRuleInput): ScVal =>
  vec([symbol(rule.variant), i128(rule.amount)]);

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeAddressVec = (scVal: ScVal): string[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as unknown[]).map(String) : [];
};

const decodeCategoryBudget = (raw: Record<string, unknown>): CategoryBudgetRecord => ({
  name: String(raw.name ?? ''),
  limit: BigInt(raw.limit as bigint),
  spent: BigInt(raw.spent as bigint),
});

/** Decode a `Map<Symbol, CategoryBudget>` into a plain object keyed by category name. */
const decodeCategoryMap = (val: unknown): Record<string, CategoryBudgetRecord> => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return {};
  const result: Record<string, CategoryBudgetRecord> = {};
  for (const [key, value] of Object.entries(val as Record<string, unknown>)) {
    result[key] = decodeCategoryBudget(value as Record<string, unknown>);
  }
  return result;
};

const decodeUserBudget = (scVal: ScVal): UserBudgetRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    user: String(raw.user),
    categories: decodeCategoryMap(raw.categories),
    lastUpdated: BigInt(raw.last_updated as bigint),
  };
};

const decodeCategoryTransferRaw = (raw: Record<string, unknown>): CategoryTransferRecord => ({
  transferId: BigInt(raw.transfer_id as bigint),
  user: String(raw.user),
  fromCategory: String(raw.from_category),
  toCategory: String(raw.to_category),
  amount: BigInt(raw.amount as bigint),
  timestamp: BigInt(raw.timestamp as bigint),
});

const decodeCategoryTransfer = (scVal: ScVal): CategoryTransferRecord =>
  decodeCategoryTransferRaw(decode(scVal) as Record<string, unknown>);

const decodeCategoryTransferVec = (scVal: ScVal): CategoryTransferRecord[] => {
  const raw = decode(scVal);
  return Array.isArray(raw)
    ? (raw as Record<string, unknown>[]).map(decodeCategoryTransferRaw)
    : [];
};

const decodeConfigVersionRaw = (raw: Record<string, unknown>): BudgetConfigVersionRecord => ({
  version: Number(raw.version as number),
  categories: decodeCategoryMap(raw.categories),
  updatedAt: BigInt(raw.updated_at as bigint),
});

const decodeConfigVersion = (scVal: ScVal): BudgetConfigVersionRecord =>
  decodeConfigVersionRaw(decode(scVal) as Record<string, unknown>);

const decodeConfigVersionVec = (scVal: ScVal): BudgetConfigVersionRecord[] => {
  const raw = decode(scVal);
  return Array.isArray(raw)
    ? (raw as Record<string, unknown>[]).map(decodeConfigVersionRaw)
    : [];
};

const decodeFreezeOrNull = (scVal: ScVal): BudgetFreezeRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    isFrozen: Boolean(raw.is_frozen),
    frozenAt: BigInt(raw.frozen_at as bigint),
    autoUnfreezeAt: BigInt(raw.auto_unfreeze_at as bigint),
  };
};

const decodePendingDeletionOrNull = (scVal: ScVal): PendingDeletionRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    user: String(raw.user),
    cooldownExpiry: BigInt(raw.cooldown_expiry as bigint),
  };
};

const decodeBudgetRecord = (raw: Record<string, unknown>): BudgetRecord => ({
  user: String(raw.user),
  amount: BigInt(raw.amount as bigint),
  asset: raw.asset ? String(raw.asset) : null,
  lastUpdated: BigInt(raw.last_updated as bigint),
  expiresAt: raw.expires_at ? BigInt(raw.expires_at as bigint) : null,
  isActive: Boolean(raw.is_active ?? true),
  isArchived: Boolean(raw.is_archived ?? false),
});

const decodeBudgetRecordOrNull = (scVal: ScVal): BudgetRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeBudgetRecord(decode(scVal) as Record<string, unknown>);
};

const decodeDelegationOrNull = (scVal: ScVal): DelegationPermissionRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    maxAmount: BigInt(raw.max_amount as bigint),
    createdAt: BigInt(raw.created_at as bigint),
    isActive: Boolean(raw.is_active),
  };
};

const decodeBeneficiaryVec = (scVal: ScVal): BeneficiaryRecord[] => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((b) => ({
    address: String(b.address),
    percentage: Number(b.percentage as number),
  }));
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
