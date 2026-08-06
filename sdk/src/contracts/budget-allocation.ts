/**
 * Typed client for the `BudgetAllocationContract` (monthly budget assignment).
 *
 * Contract methods (see `contracts/budget-allocation/src/lib.rs`):
 *   initialize(admin), batch_allocate_budget(admin, Vec<BudgetRequest>),
 *   allocate_budget_by_category(admin, CategoryBudgetRequest),
 *   get_budget_categories(user), get_category_budget(user, category),
 *   get_budget(user), get_budget_allocation_summary(user),
 *   create_budget_snapshot(user), get_budget_snapshot(user, timestamp),
 *   get_all_budget_snapshots(user), reset_monthly_budget(user),
 *   needs_monthly_reset(user), get_admin,
 *   schedule_budget_renewal(admin, user, frequency_seconds, renewal_amount),
 *   execute_budget_renewal(user), get_budget_renewal_config(user),
 *   disable_budget_renewal(admin, user), get_budget_version(user, version),
 *   get_all_budget_versions(user)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  i128,
  symbol,
  u64,
  vec,
  struct,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BudgetRequestInput {
  user: string;
  amount: bigint;
}

export interface CategoryAllocationInput {
  name: string;
  amount: bigint;
}

export interface CategoryBudgetRequestInput {
  user: string;
  totalAmount: bigint;
  categories: CategoryAllocationInput[];
}

export interface BatchBudgetResult {
  successful: number;
  failed: number;
  totalAmount: bigint;
}

export interface BudgetRecord {
  user: string;
  amount: bigint;
  lastUpdated: bigint;
}

export interface UserBudgetCategoriesRecord {
  user: string;
  categories: Record<string, bigint>;
  totalAmount: bigint;
  lastUpdated: bigint;
}

export interface BudgetAllocationSummaryRecord {
  remainingAllocation: bigint;
  totalAllocation: bigint;
  usagePercentage: number;
}

export interface BudgetRenewalConfigRecord {
  user: string;
  frequencySeconds: bigint;
  enabled: boolean;
  renewalAmount: bigint;
  lastRenewedAt: bigint;
  renewalCount: bigint;
}

export interface BudgetVersionRecord {
  version: bigint;
  user: string;
  amount: bigint;
  createdAt: bigint;
  renewalId: bigint;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class BudgetAllocationClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async batchAllocateBudget(
    admin: string,
    requests: BudgetRequestInput[],
  ): Promise<BatchBudgetResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_allocate_budget',
        [
          address(admin),
          vec(requests.map((r) => struct({ user: address(r.user), amount: i128(r.amount) }))),
        ],
        decodeBatchBudgetResult,
      ),
      'batch_allocate_budget',
    );
  }

  async allocateBudgetByCategory(
    admin: string,
    request: CategoryBudgetRequestInput,
  ): Promise<boolean> {
    const result = await this.gateway.submit(
      this.contractId,
      'allocate_budget_by_category',
      [address(admin), encodeCategoryBudgetRequest(request)],
      decodeBool,
    );
    return assertResult(result, 'allocate_budget_by_category');
  }

  getBudgetCategories(user: string): Promise<UserBudgetCategoriesRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_budget_categories',
      [address(user)],
      decodeUserBudgetCategoriesOrNull,
    );
  }

  getCategoryBudget(user: string, category: string): Promise<bigint | null> {
    return this.gateway.read(
      this.contractId,
      'get_category_budget',
      [address(user), symbol(category)],
      decodeI128OrNull,
    );
  }

  getBudget(user: string): Promise<BudgetRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_budget',
      [address(user)],
      decodeBudgetOrNull,
    );
  }

  getBudgetAllocationSummary(user: string): Promise<BudgetAllocationSummaryRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_budget_allocation_summary',
      [address(user)],
      decodeAllocationSummaryOrNull,
    );
  }

  createBudgetSnapshot(user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'create_budget_snapshot', [
      address(user),
    ]);
  }

  getBudgetSnapshot(user: string, timestamp: bigint): Promise<BudgetRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_budget_snapshot',
      [address(user), u64(timestamp)],
      decodeBudgetOrNull,
    );
  }

  getAllBudgetSnapshots(user: string): Promise<Array<{ timestamp: bigint; budget: BudgetRecord }>> {
    return this.gateway.read(
      this.contractId,
      'get_all_budget_snapshots',
      [address(user)],
      decodeSnapshotVec,
    );
  }

  resetMonthlyBudget(user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'reset_monthly_budget', [address(user)]);
  }

  needsMonthlyReset(user: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'needs_monthly_reset',
      [address(user)],
      decodeBool,
    );
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  scheduleBudgetRenewal(
    admin: string,
    user: string,
    frequencySeconds: bigint,
    renewalAmount: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'schedule_budget_renewal', [
      address(admin),
      address(user),
      u64(frequencySeconds),
      i128(renewalAmount),
    ]);
  }

  async executeBudgetRenewal(user: string): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'execute_budget_renewal',
      [address(user)],
      decodeU64,
    );
    return assertResult(result, 'execute_budget_renewal');
  }

  getBudgetRenewalConfig(user: string): Promise<BudgetRenewalConfigRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_budget_renewal_config',
      [address(user)],
      decodeRenewalConfigOrNull,
    );
  }

  disableBudgetRenewal(
    admin: string,
    user: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'disable_budget_renewal', [
      address(admin),
      address(user),
    ]);
  }

  getBudgetVersion(user: string, version: bigint): Promise<BudgetVersionRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_budget_version',
      [address(user), u64(version)],
      decodeBudgetVersionOrNull,
    );
  }

  getAllBudgetVersions(user: string): Promise<BudgetVersionRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_all_budget_versions',
      [address(user)],
      decodeBudgetVersionVec,
    );
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodeCategoryBudgetRequest = (r: CategoryBudgetRequestInput): ScVal =>
  struct({
    user: address(r.user),
    total_amount: i128(r.totalAmount),
    categories: vec(
      r.categories.map((c) => struct({ name: symbol(c.name), amount: i128(c.amount) })),
    ),
  });

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeI128OrNull = (scVal: ScVal): bigint | null => {
  if (isVoid(scVal)) return null;
  return decode(scVal) as bigint;
};

const decodeBatchBudgetResult = (scVal: ScVal): BatchBudgetResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    totalAmount: BigInt(raw.total_amount as bigint),
  };
};

const decodeBudgetRaw = (raw: Record<string, unknown>): BudgetRecord => ({
  user: String(raw.user),
  amount: BigInt(raw.amount as bigint),
  lastUpdated: BigInt(raw.last_updated as bigint),
});

const decodeBudgetOrNull = (scVal: ScVal): BudgetRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeBudgetRaw(decode(scVal) as Record<string, unknown>);
};

const decodeUserBudgetCategoriesOrNull = (
  scVal: ScVal,
): UserBudgetCategoriesRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  const categories: Record<string, bigint> = {};
  const map = raw.categories;
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
      categories[key] = BigInt(value as bigint);
    }
  }
  return {
    user: String(raw.user),
    categories,
    totalAmount: BigInt(raw.total_amount as bigint),
    lastUpdated: BigInt(raw.last_updated as bigint),
  };
};

const decodeAllocationSummaryOrNull = (
  scVal: ScVal,
): BudgetAllocationSummaryRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    remainingAllocation: BigInt(raw.remaining_allocation as bigint),
    totalAllocation: BigInt(raw.total_allocation as bigint),
    usagePercentage: Number(raw.usage_percentage as number),
  };
};

const decodeSnapshotVec = (
  scVal: ScVal,
): Array<{ timestamp: bigint; budget: BudgetRecord }> => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Array<[unknown, Record<string, unknown>]>).map(([ts, record]) => ({
    timestamp: BigInt(ts as bigint),
    budget: decodeBudgetRaw(record),
  }));
};

const decodeRenewalConfigOrNull = (scVal: ScVal): BudgetRenewalConfigRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    user: String(raw.user),
    frequencySeconds: BigInt(raw.frequency_seconds as bigint),
    enabled: Boolean(raw.enabled),
    renewalAmount: BigInt(raw.renewal_amount as bigint),
    lastRenewedAt: BigInt(raw.last_renewed_at as bigint),
    renewalCount: BigInt(raw.renewal_count as bigint),
  };
};

const decodeBudgetVersionRaw = (raw: Record<string, unknown>): BudgetVersionRecord => ({
  version: BigInt(raw.version as bigint),
  user: String(raw.user),
  amount: BigInt(raw.amount as bigint),
  createdAt: BigInt(raw.created_at as bigint),
  renewalId: BigInt(raw.renewal_id as bigint),
});

const decodeBudgetVersionOrNull = (scVal: ScVal): BudgetVersionRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeBudgetVersionRaw(decode(scVal) as Record<string, unknown>);
};

const decodeBudgetVersionVec = (scVal: ScVal): BudgetVersionRecord[] => {
  const raw = decode(scVal);
  return Array.isArray(raw)
    ? (raw as Record<string, unknown>[]).map(decodeBudgetVersionRaw)
    : [];
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
