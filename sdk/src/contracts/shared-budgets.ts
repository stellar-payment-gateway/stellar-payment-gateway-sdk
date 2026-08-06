/**
 * Typed client for the `SharedBudgetsContract` (multi-member budgets).
 *
 * Contract methods (see `contracts/shared-budgets/src/lib.rs`):
 *   initialize(admin), create_budget(creator, name, members, token, rules),
 *   contribute_to_budget(contributor, budget_id, amount, memo),
 *   spend_from_budget(spender, budget_id, recipient, amount),
 *   transfer_budget_ownership, add_member_to_budget, add_spending_rule,
 *   set_archive_retention_period, deactivate_budget, archive_inactive_budgets,
 *   get_budget, get_archived_budget, is_budget_member, get_member_role,
 *   get_budget_utilization, get_budget_utilization_band,
 *   get_budget_utilization_summary, get_contribution,
 *   get_contributions_paginated, get_contributions, get_admin, set_admin,
 *   get_total_budgets_created, get_total_contributions_processed,
 *   get_archive_retention_period
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  bool,
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

export interface BudgetSpendingRuleInput {
  applicableTo: string;
  percentageThreshold: number;
  requiresApproval: boolean;
  description: string;
}

export type BudgetUtilizationBand = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface BudgetRecord {
  id: bigint;
  name: string;
  creator: string;
  token: string;
  members: string[];
  balance: bigint;
  totalContributed: bigint;
}

export interface BudgetUtilizationSummaryRecord {
  utilizationPercent: number;
  totalSpent: bigint;
  avgSpendingPerMember: bigint;
  remainingBalance: bigint;
  utilizationBand: BudgetUtilizationBand;
}

export interface BudgetContributionRecord {
  budgetId: bigint;
  contributor: string;
  amount: bigint;
  memo: string | null;
  timestamp: bigint;
}

export interface ArchivedBudgetRecord {
  budget: BudgetRecord;
  deactivatedAt: bigint;
  archivedAt: bigint;
  contributionIds: bigint[];
}

// ── Client ───────────────────────────────────────────────────────────────────

export class SharedBudgetsClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async createBudget(
    creator: string,
    budgetName: string,
    members: string[],
    token: string,
    spendingRules: BudgetSpendingRuleInput[],
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'create_budget',
      [
        address(creator),
        symbol(budgetName),
        vec(members.map(address)),
        address(token),
        vec(spendingRules.map(encodeSpendingRule)),
      ],
      decodeU64,
    );
    return assertResult(result, 'create_budget');
  }

  contributeToBudget(
    contributor: string,
    budgetId: bigint,
    amount: bigint,
    memo: string | null,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'contribute_to_budget', [
      address(contributor),
      u64(budgetId),
      i128(amount),
      memo ? symbol(memo) : voidScVal(),
    ]);
  }

  spendFromBudget(
    spender: string,
    budgetId: bigint,
    recipient: string,
    amount: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'spend_from_budget', [
      address(spender),
      u64(budgetId),
      address(recipient),
      i128(amount),
    ]);
  }

  transferBudgetOwnership(
    currentOwner: string,
    budgetId: bigint,
    newOwner: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'transfer_budget_ownership', [
      address(currentOwner),
      u64(budgetId),
      address(newOwner),
    ]);
  }

  addMemberToBudget(
    caller: string,
    budgetId: bigint,
    newMember: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'add_member_to_budget', [
      address(caller),
      u64(budgetId),
      address(newMember),
    ]);
  }

  addSpendingRule(
    caller: string,
    budgetId: bigint,
    rule: BudgetSpendingRuleInput,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'add_spending_rule', [
      address(caller),
      u64(budgetId),
      encodeSpendingRule(rule),
    ]);
  }

  setArchiveRetentionPeriod(
    caller: string,
    retentionSeconds: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_archive_retention_period', [
      address(caller),
      u64(retentionSeconds),
    ]);
  }

  getArchiveRetentionPeriod(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_archive_retention_period',
      [],
      decodeU64,
    );
  }

  deactivateBudget(caller: string, budgetId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'deactivate_budget', [
      address(caller),
      u64(budgetId),
    ]);
  }

  async archiveInactiveBudgets(caller: string, maxToArchive: number): Promise<number> {
    const result = await this.gateway.submit(
      this.contractId,
      'archive_inactive_budgets',
      [address(caller), u32(maxToArchive)],
      decodeU32,
    );
    return assertResult(result, 'archive_inactive_budgets');
  }

  getBudget(budgetId: bigint): Promise<BudgetRecord> {
    return this.gateway.read(
      this.contractId,
      'get_budget',
      [u64(budgetId)],
      decodeBudget,
    );
  }

  getArchivedBudget(budgetId: bigint): Promise<ArchivedBudgetRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_archived_budget',
      [u64(budgetId)],
      decodeArchivedBudgetOrNull,
    );
  }

  isBudgetMember(budgetId: bigint, member: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'is_budget_member',
      [u64(budgetId), address(member)],
      decodeBool,
    );
  }

  getMemberRole(budgetId: bigint, account: string): Promise<string> {
    return this.gateway.read(
      this.contractId,
      'get_member_role',
      [u64(budgetId), address(account)],
      decodeSymbol,
    );
  }

  getBudgetUtilization(budgetId: bigint): Promise<{
    utilizationPercent: number;
    totalSpent: bigint;
    avgSpendingPerMember: bigint;
    remainingBalance: bigint;
  }> {
    return this.gateway.read(
      this.contractId,
      'get_budget_utilization',
      [u64(budgetId)],
      decodeUtilizationTuple,
    );
  }

  getBudgetUtilizationBand(budgetId: bigint): Promise<BudgetUtilizationBand> {
    return this.gateway.read(
      this.contractId,
      'get_budget_utilization_band',
      [u64(budgetId)],
      decodeUtilizationBand,
    );
  }

  getBudgetUtilizationSummary(
    budgetId: bigint,
  ): Promise<BudgetUtilizationSummaryRecord> {
    return this.gateway.read(
      this.contractId,
      'get_budget_utilization_summary',
      [u64(budgetId)],
      decodeUtilizationSummary,
    );
  }

  getContribution(contributionId: bigint): Promise<BudgetContributionRecord> {
    return this.gateway.read(
      this.contractId,
      'get_contribution',
      [u64(contributionId)],
      decodeContribution,
    );
  }

  getContributionsPaginated(
    budgetId: bigint,
    offset: number,
    limit: number,
  ): Promise<BudgetContributionRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_contributions_paginated',
      [u64(budgetId), u32(offset), u32(limit)],
      decodeContributionVec,
    );
  }

  getContributions(budgetId: bigint): Promise<BudgetContributionRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_contributions',
      [u64(budgetId)],
      decodeContributionVec,
    );
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  setAdmin(currentAdmin: string, newAdmin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_admin', [
      address(currentAdmin),
      address(newAdmin),
    ]);
  }

  getTotalBudgetsCreated(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_budgets_created', [], decodeU64);
  }

  getTotalContributionsProcessed(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_contributions_processed',
      [],
      decodeU64,
    );
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodeSpendingRule = (r: BudgetSpendingRuleInput): ScVal =>
  struct({
    applicable_to: address(r.applicableTo),
    percentage_threshold: u32(r.percentageThreshold),
    requires_approval: bool(r.requiresApproval),
    description: symbol(r.description),
  });

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeU32 = (scVal: ScVal): number => Number(decode(scVal));
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));
const decodeSymbol = (scVal: ScVal): string => String(decode(scVal));

const decodeBudgetRaw = (raw: Record<string, unknown>): BudgetRecord => ({
  id: BigInt(raw.id as bigint),
  name: String(raw.name ?? ''),
  creator: String(raw.creator),
  token: String(raw.token),
  members: ((raw.members as unknown[]) ?? []).map(String),
  balance: BigInt(raw.balance as bigint),
  totalContributed: BigInt(raw.total_contributed as bigint),
});

const decodeBudget = (scVal: ScVal): BudgetRecord =>
  decodeBudgetRaw(decode(scVal) as Record<string, unknown>);

const decodeUtilizationBand = (scVal: ScVal): BudgetUtilizationBand => {
  const band = String(decode(scVal));
  return band as BudgetUtilizationBand;
};

const decodeUtilizationSummary = (scVal: ScVal): BudgetUtilizationSummaryRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    utilizationPercent: Number(raw.utilization_percent as number),
    totalSpent: BigInt(raw.total_spent as bigint),
    avgSpendingPerMember: BigInt(raw.avg_spending_per_member as bigint),
    remainingBalance: BigInt(raw.remaining_balance as bigint),
    utilizationBand: String(raw.utilization_band) as BudgetUtilizationBand,
  };
};

const decodeUtilizationTuple = (scVal: ScVal): {
  utilizationPercent: number;
  totalSpent: bigint;
  avgSpendingPerMember: bigint;
  remainingBalance: bigint;
} => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) {
    return { utilizationPercent: 0, totalSpent: 0n, avgSpendingPerMember: 0n, remainingBalance: 0n };
  }
  const [percent, totalSpent, avg, remaining] = raw as unknown[];
  return {
    utilizationPercent: Number(percent as number),
    totalSpent: BigInt(totalSpent as bigint),
    avgSpendingPerMember: BigInt(avg as bigint),
    remainingBalance: BigInt(remaining as bigint),
  };
};

const decodeContributionRaw = (raw: Record<string, unknown>): BudgetContributionRecord => ({
  budgetId: BigInt(raw.budget_id as bigint),
  contributor: String(raw.contributor),
  amount: BigInt(raw.amount as bigint),
  memo: raw.memo ? String(raw.memo) : null,
  timestamp: BigInt(raw.timestamp as bigint),
});

const decodeContribution = (scVal: ScVal): BudgetContributionRecord =>
  decodeContributionRaw(decode(scVal) as Record<string, unknown>);

const decodeContributionVec = (scVal: ScVal): BudgetContributionRecord[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]).map(decodeContributionRaw) : [];
};

const decodeArchivedBudgetOrNull = (scVal: ScVal): ArchivedBudgetRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    budget: decodeBudgetRaw((raw.budget as Record<string, unknown>) ?? {}),
    deactivatedAt: BigInt(raw.deactivated_at as bigint),
    archivedAt: BigInt(raw.archived_at as bigint),
    contributionIds: ((raw.contribution_ids as unknown[]) ?? []).map((id) =>
      BigInt(id as bigint),
    ),
  };
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
