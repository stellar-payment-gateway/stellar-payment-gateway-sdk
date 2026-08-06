/**
 * Typed client for the `SpendingLimitsContract`.
 *
 * Contract methods (see `contracts/spending-limits/src/lib.rs`):
 *   initialize(admin), batch_update_spending_limits(caller, Vec<SpendingLimitRequest>),
 *   configure_escalation_rules(admin, small, medium, enabled),
 *   approve_escalated_spend(admin, user, amount),
 *   enforce_spending_limit(user, amount, category),
 *   check_spending_limit(user, amount, category),
 *   emergency_override(admin, user, amount), adjust_limits(admin, user, limit),
 *   whitelist_destination / remove_from_whitelist / is_destination_whitelisted,
 *   add_approved_category / remove_approved_category / get_approved_categories,
 *   grant_category_exception / remove_category_exception / get_category_exception /
 *   is_category_exempt,
 *   get_escalation_config, get_spending_limit, get_admin, set_admin,
 *   get_last_batch_id, get_total_limits_updated, get_total_batches_processed
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  bool,
  decode,
  decodeEnumItem,
  i128,
  symbol,
  u64,
  vec,
  struct,
  voidScVal,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpendingLimitRequestInput {
  user: string;
  monthlyLimit: bigint;
  dailyLimit: bigint;
  hourlyLimit: bigint;
  resetWindowSeconds: bigint;
  category?: string | null;
  strategy?: 'Static' | 'Adaptive';
}

export interface EscalationConfigRecord {
  smallThreshold: bigint;
  mediumThreshold: bigint;
  enabled: boolean;
}

export interface SpendingLimitRecord {
  user: string;
  monthlyLimit: bigint;
  dailyLimit: bigint;
  hourlyLimit: bigint;
  resetWindowSeconds: bigint;
  currentSpending: bigint;
}

export interface ExceptionRuleRecord {
  user: string;
  category: string;
  createdAt: bigint;
  isActive: boolean;
}

export interface BatchLimitMetricsRecord {
  totalRequests: number;
  successfulUpdates: number;
  failedUpdates: number;
  totalLimitsValue: bigint;
  avgLimitAmount: bigint;
  processedAt: bigint;
}

export type LimitUpdateResultItem =
  | { status: 'success'; limit: SpendingLimitRecord }
  | { status: 'failure'; user: string; errorCode: number };

export interface BatchLimitResult {
  batchId: bigint;
  totalRequests: number;
  successful: number;
  failed: number;
  results: LimitUpdateResultItem[];
  metrics: BatchLimitMetricsRecord;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class SpendingLimitsClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async batchUpdateSpendingLimits(
    caller: string,
    requests: SpendingLimitRequestInput[],
  ): Promise<BatchLimitResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_update_spending_limits',
        [address(caller), vec(requests.map(encodeLimitRequest))],
        decodeBatchLimitResult,
      ),
      'batch_update_spending_limits',
    );
  }

  configureEscalationRules(
    admin: string,
    smallThreshold: bigint,
    mediumThreshold: bigint,
    enabled: boolean,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'configure_escalation_rules', [
      address(admin),
      i128(smallThreshold),
      i128(mediumThreshold),
      bool(enabled),
    ]);
  }

  getEscalationConfig(): Promise<EscalationConfigRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_escalation_config',
      [],
      decodeEscalationConfigOrNull,
    );
  }

  approveEscalatedSpend(
    admin: string,
    user: string,
    amount: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'approve_escalated_spend', [
      address(admin),
      address(user),
      i128(amount),
    ]);
  }

  enforceSpendingLimit(
    user: string,
    amount: bigint,
    category: string | null,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'enforce_spending_limit', [
      address(user),
      i128(amount),
      category ? symbol(category) : voidScVal(),
    ]);
  }

  checkSpendingLimit(user: string, amount: bigint, category: string | null): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'check_spending_limit',
      [address(user), i128(amount), category ? symbol(category) : voidScVal()],
      decodeBool,
    );
  }

  emergencyOverride(
    admin: string,
    user: string,
    amount: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'emergency_override', [
      address(admin),
      address(user),
      i128(amount),
    ]);
  }

  adjustLimits(
    admin: string,
    user: string,
    newMonthlyLimit: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'adjust_limits', [
      address(admin),
      address(user),
      i128(newMonthlyLimit),
    ]);
  }

  getSpendingLimit(user: string): Promise<SpendingLimitRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_spending_limit',
      [address(user)],
      decodeSpendingLimitOrNull,
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

  whitelistDestination(
    caller: string,
    destination: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'whitelist_destination', [
      address(caller),
      address(destination),
    ]);
  }

  removeFromWhitelist(
    caller: string,
    destination: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'remove_from_whitelist', [
      address(caller),
      address(destination),
    ]);
  }

  isDestinationWhitelisted(destination: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'is_destination_whitelisted',
      [address(destination)],
      decodeBool,
    );
  }

  addApprovedCategory(
    caller: string,
    category: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'add_approved_category', [
      address(caller),
      symbol(category),
    ]);
  }

  removeApprovedCategory(
    caller: string,
    category: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'remove_approved_category', [
      address(caller),
      symbol(category),
    ]);
  }

  getApprovedCategories(): Promise<string[]> {
    return this.gateway.read(
      this.contractId,
      'get_approved_categories',
      [],
      decodeSymbolVec,
    );
  }

  grantCategoryException(
    caller: string,
    user: string,
    category: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'grant_category_exception', [
      address(caller),
      address(user),
      symbol(category),
    ]);
  }

  removeCategoryException(
    caller: string,
    user: string,
    category: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'remove_category_exception', [
      address(caller),
      address(user),
      symbol(category),
    ]);
  }

  getCategoryException(user: string, category: string): Promise<ExceptionRuleRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_category_exception',
      [address(user), symbol(category)],
      decodeExceptionRuleOrNull,
    );
  }

  isCategoryExempt(user: string, category: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'is_category_exempt',
      [address(user), symbol(category)],
      decodeBool,
    );
  }

  getLastBatchId(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_last_batch_id', [], decodeU64);
  }

  getTotalLimitsUpdated(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_limits_updated', [], decodeU64);
  }

  getTotalBatchesProcessed(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_batches_processed',
      [],
      decodeU64,
    );
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodeLimitRequest = (r: SpendingLimitRequestInput): ScVal =>
  struct({
    user: address(r.user),
    monthly_limit: i128(r.monthlyLimit),
    daily_limit: i128(r.dailyLimit),
    hourly_limit: i128(r.hourlyLimit),
    reset_window_seconds: u64(r.resetWindowSeconds),
    category: r.category ? symbol(r.category) : voidScVal(),
    strategy: symbol(r.strategy ?? 'Static'),
  });

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeSymbolVec = (scVal: ScVal): string[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as unknown[]).map(String) : [];
};

const decodeEscalationConfigOrNull = (scVal: ScVal): EscalationConfigRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    smallThreshold: BigInt(raw.small_threshold as bigint),
    mediumThreshold: BigInt(raw.medium_threshold as bigint),
    enabled: Boolean(raw.enabled),
  };
};

const decodeSpendingLimitRaw = (raw: Record<string, unknown>): SpendingLimitRecord => ({
  user: String(raw.user),
  monthlyLimit: BigInt(raw.monthly_limit as bigint),
  dailyLimit: BigInt(raw.daily_limit as bigint),
  hourlyLimit: BigInt(raw.hourly_limit as bigint),
  resetWindowSeconds: BigInt(raw.reset_window_seconds as bigint),
  currentSpending: BigInt(raw.current_spending as bigint ?? 0n),
});

const decodeSpendingLimitOrNull = (scVal: ScVal): SpendingLimitRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeSpendingLimitRaw(decode(scVal) as Record<string, unknown>);
};

const decodeExceptionRuleOrNull = (scVal: ScVal): ExceptionRuleRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    user: String(raw.user),
    category: String(raw.category),
    createdAt: BigInt(raw.created_at as bigint),
    isActive: Boolean(raw.is_active ?? true),
  };
};

const decodeLimitMetrics = (raw: Record<string, unknown>): BatchLimitMetricsRecord => ({
  totalRequests: Number(raw.total_requests as number),
  successfulUpdates: Number(raw.successful_updates as number),
  failedUpdates: Number(raw.failed_updates as number),
  totalLimitsValue: BigInt(raw.total_limits_value as bigint),
  avgLimitAmount: BigInt(raw.avg_limit_amount as bigint),
  processedAt: BigInt(raw.processed_at as bigint),
});

const decodeLimitResultItem = (item: unknown): LimitUpdateResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  if (variant === 'Success') {
    return {
      status: 'success' as const,
      limit: decodeSpendingLimitRaw(fields[0] as Record<string, unknown>),
    };
  }
  const [user, errorCode] = fields as unknown[];
  return { status: 'failure' as const, user: String(user), errorCode: Number(errorCode) };
};

const decodeBatchLimitResult = (scVal: ScVal): BatchLimitResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    batchId: BigInt(raw.batch_id as bigint),
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    results: ((raw.results as unknown[]) ?? []).map(decodeLimitResultItem),
    metrics: decodeLimitMetrics((raw.metrics as Record<string, unknown>) ?? {}),
  };
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
