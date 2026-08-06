/**
 * Typed client for the `TransactionAnalyticsContract`.
 *
 * Contract methods (see `contracts/transaction-analytics/src/lib.rs`):
 *   initialize(admin), process_batch(caller, Vec<Transaction>,
 *     high_value_threshold), batch_audit_log(caller, Vec<AuditLog>),
 *   get_batch_metrics, get_batch_metrics_paginated, get_last_batch_id,
 *   get_total_transactions_processed, get_audit_log, get_total_audit_logs,
 *   simulate_batch, update_transaction_statuses(caller, Vec<Update>),
 *   submit_ratings(user, Vec<RatingInput>), bundle_transactions(caller,
 *     Vec<BundledTransaction>), get_bundle_result, get_last_bundle_id,
 *   refund_batch(caller, Vec<RefundRequest>, Map<u64, Transaction>),
 *   simulate_refund_batch, get_refund_batch_metrics,
 *   get_last_refund_batch_id, get_total_refund_amount,
 *   is_transaction_refunded, update_monthly_analytics, get_monthly_analytics,
 *   get_user_spending_summary, get_total_tracked_users,
 *   get_last_analytics_update, update_fee_config, update_operation_fee_config,
 *   get_current_fee_config, calculate_transaction_fee, calculate_batch_fees,
 *   pause_fees, resume_fees, spending_by_category_in_window,
 *   recategorize_transaction, recategorize_and_aggregate, get_admin, set_admin,
 *   get_transaction_status
 */
import { xdr } from '@stellar/stellar-sdk';
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

export interface TransactionInput {
  txId: bigint;
  from: string;
  to: string;
  amount: bigint;
  timestamp: bigint;
  category: string;
}

export interface AuditLogInput {
  actor: string;
  operation: string;
  timestamp: bigint;
  status: string;
}

export interface BundledTransactionInput {
  transaction: TransactionInput;
  memo?: string | null;
}

export interface RatingInput {
  txId: bigint;
  score: number;
}

export type TransactionStatus = 'Pending' | 'Completed' | 'Failed' | 'Refunded';

export interface TransactionStatusUpdateInput {
  txId: bigint;
  status: TransactionStatus;
}

export interface RefundRequestInput {
  txId: bigint;
  reason?: string | null;
}

export type FeeModelInput =
  | { variant: 'Flat'; amount: bigint }
  | { variant: 'Percentage'; bps: number }
  | { variant: 'Tiered'; tiers: FeeTierInput[] };

export interface FeeTierInput {
  threshold: bigint;
  feeModel: FeeModelInput;
  defaultPercentageBps: number;
}

export interface FeeConfigInput {
  feeModel: FeeModelInput;
  minFee?: bigint | null;
  maxFee?: bigint | null;
  enabled: boolean;
  description?: string | null;
}

export interface TransactionEventInput {
  txId: bigint;
  from: string;
  to: string;
  amount: bigint;
  timestamp: bigint;
  category: string;
  currency: string;
}

// ── Result types ─────────────────────────────────────────────────────────────

export interface BatchMetricsRecord {
  txCount: number;
  totalVolume: bigint;
  avgAmount: bigint;
  minAmount: bigint;
  maxAmount: bigint;
  uniqueSenders: number;
  uniqueRecipients: number;
  totalFees: bigint;
  processedAt: bigint;
}

export interface BundleResultRecord {
  bundleId: bigint;
  totalCount: number;
  validCount: number;
  invalidCount: number;
  validationResults: Array<{ txId: bigint; isValid: boolean; error: string }>;
  canBundle: boolean;
  totalVolume: bigint;
  createdAt: bigint;
}

export interface BatchStatusUpdateResultRecord {
  totalRequests: number;
  successful: number;
  failed: number;
  results: Array<{ txId: bigint; isValid: boolean }>;
}

export interface RatingResultRecord {
  txId: bigint;
  score: number;
  status: string;
}

export interface FeeCalculationResultRecord {
  grossAmount: bigint;
  feeAmount: bigint;
  netAmount: bigint;
  feePercentageBps: number;
}

export interface RefundBatchMetricsRecord {
  requestCount: number;
  successfulRefunds: number;
  failedRefunds: number;
  totalRefundedAmount: bigint;
  avgRefundAmount: bigint;
  processedAt: bigint;
}

export interface PaginatedBatchMetricsRecord {
  metrics: BatchMetricsRecord[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface MonthlyAnalyticsRecord {
  year: number;
  month: number;
  user: string;
  totalSpending: bigint;
  categorySpending: Array<{ category: string; amount: bigint }>;
  transactionCount: number;
}

export interface UserSpendingSummaryRecord {
  user: string;
  totalSpending: bigint;
  totalTransactions: number;
  primaryCategory: string;
  avgMonthlySpending: bigint;
}

export interface CategorySpendWindowRecord {
  category: string;
  totalVolume: bigint;
  txCount: number;
  currency: string;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class TransactionAnalyticsClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async processBatch(
    caller: string,
    transactions: TransactionInput[],
    highValueThreshold: bigint | null,
  ): Promise<BatchMetricsRecord> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'process_batch',
        [
          address(caller),
          vec(transactions.map(encodeTransaction)),
          highValueThreshold !== null ? i128(highValueThreshold) : voidScVal(),
        ],
        decodeBatchMetrics,
      ),
      'process_batch',
    );
  }

  batchAuditLog(
    caller: string,
    logs: AuditLogInput[],
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'batch_audit_log', [
      address(caller),
      vec(logs.map(encodeAuditLog)),
    ]);
  }

  getBatchMetrics(batchId: bigint): Promise<BatchMetricsRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_batch_metrics',
      [u64(batchId)],
      decodeBatchMetricsOrNull,
    );
  }

  getBatchMetricsPaginated(page: number, pageSize: number): Promise<PaginatedBatchMetricsRecord> {
    return this.gateway.read(
      this.contractId,
      'get_batch_metrics_paginated',
      [u32(page), u32(pageSize)],
      decodePaginatedMetrics,
    );
  }

  getLastBatchId(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_last_batch_id', [], decodeU64);
  }

  getTotalTransactionsProcessed(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_transactions_processed',
      [],
      decodeU64,
    );
  }

  getAuditLog(index: bigint): Promise<AuditLogInput | null> {
    return this.gateway.read(
      this.contractId,
      'get_audit_log',
      [u64(index)],
      decodeAuditLogOrNull,
    );
  }

  getTotalAuditLogs(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_audit_logs', [], decodeU64);
  }

  simulateBatch(transactions: TransactionInput[]): Promise<BatchMetricsRecord> {
    return this.gateway.read(
      this.contractId,
      'simulate_batch',
      [vec(transactions.map(encodeTransaction))],
      decodeBatchMetrics,
    );
  }

  async updateTransactionStatuses(
    caller: string,
    updates: TransactionStatusUpdateInput[],
  ): Promise<BatchStatusUpdateResultRecord> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'update_transaction_statuses',
        [
          address(caller),
          vec(
            updates.map((u) =>
              struct({ tx_id: u64(u.txId), status: symbol(u.status) }),
            ),
          ),
        ],
        decodeStatusUpdateResult,
      ),
      'update_transaction_statuses',
    );
  }

  async submitRatings(
    user: string,
    ratings: RatingInput[],
  ): Promise<RatingResultRecord[]> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'submit_ratings',
        [
          address(user),
          vec(ratings.map((r) => struct({ tx_id: u64(r.txId), score: u32(r.score) }))),
        ],
        decodeRatingResultVec,
      ),
      'submit_ratings',
    );
  }

  async bundleTransactions(
    caller: string,
    bundledTransactions: BundledTransactionInput[],
  ): Promise<BundleResultRecord> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'bundle_transactions',
        [
          address(caller),
          vec(
            bundledTransactions.map((b) =>
              struct({
                transaction: encodeTransaction(b.transaction),
                memo: b.memo ? symbol(b.memo) : voidScVal(),
              }),
            ),
          ),
        ],
        decodeBundleResult,
      ),
      'bundle_transactions',
    );
  }

  getBundleResult(bundleId: bigint): Promise<BundleResultRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_bundle_result',
      [u64(bundleId)],
      decodeBundleResultOrNull,
    );
  }

  getLastBundleId(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_last_bundle_id', [], decodeU64);
  }

  async refundBatch(
    caller: string,
    refundRequests: RefundRequestInput[],
    transactionLookup: Record<string, TransactionInput>,
  ): Promise<RefundBatchMetricsRecord> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'refund_batch',
        [
          address(caller),
          vec(refundRequests.map(encodeRefundRequest)),
          encodeTransactionMap(transactionLookup),
        ],
        decodeRefundBatchMetrics,
      ),
      'refund_batch',
    );
  }

  simulateRefundBatch(
    refundRequests: RefundRequestInput[],
  ): Promise<RefundBatchMetricsRecord> {
    return this.gateway.read(
      this.contractId,
      'simulate_refund_batch',
      [vec(refundRequests.map(encodeRefundRequest))],
      decodeRefundBatchMetrics,
    );
  }

  getRefundBatchMetrics(batchId: bigint): Promise<RefundBatchMetricsRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_refund_batch_metrics',
      [u64(batchId)],
      decodeRefundBatchMetricsOrNull,
    );
  }

  getLastRefundBatchId(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_last_refund_batch_id', [], decodeU64);
  }

  getTotalRefundAmount(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_refund_amount', [], decodeI128);
  }

  isTransactionRefunded(txId: bigint): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'is_transaction_refunded',
      [u64(txId)],
      decodeBool,
    );
  }

  updateMonthlyAnalytics(
    caller: string,
    user: string,
    transactions: TransactionInput[],
    year: number,
    month: number,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_monthly_analytics', [
      address(caller),
      address(user),
      vec(transactions.map(encodeTransaction)),
      u32(year),
      u32(month),
    ]);
  }

  getMonthlyAnalytics(
    year: number,
    month: number,
    user: string,
  ): Promise<MonthlyAnalyticsRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_monthly_analytics',
      [u32(year), u32(month), address(user)],
      decodeMonthlyOrNull,
    );
  }

  getUserSpendingSummary(user: string): Promise<UserSpendingSummaryRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_user_spending_summary',
      [address(user)],
      decodeUserSummaryOrNull,
    );
  }

  getTotalTrackedUsers(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_tracked_users', [], decodeU64);
  }

  getLastAnalyticsUpdate(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_last_analytics_update', [], decodeU64);
  }

  updateFeeConfig(
    admin: string,
    newConfig: FeeConfigInput,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_fee_config', [
      address(admin),
      encodeFeeConfig(newConfig),
    ]);
  }

  updateOperationFeeConfig(
    admin: string,
    operation: string,
    newConfig: FeeConfigInput,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_operation_fee_config', [
      address(admin),
      symbol(operation),
      encodeFeeConfig(newConfig),
    ]);
  }

  getCurrentFeeConfig(): Promise<Record<string, unknown> | null> {
    return this.gateway.read(
      this.contractId,
      'get_current_fee_config',
      [],
      decodeGenericOrNull,
    );
  }

  calculateTransactionFee(amount: bigint): Promise<FeeCalculationResultRecord> {
    return this.gateway.read(
      this.contractId,
      'calculate_transaction_fee',
      [i128(amount)],
      decodeFeeCalculation,
    );
  }

  calculateBatchFees(amounts: bigint[]): Promise<FeeCalculationResultRecord[]> {
    return this.gateway.read(
      this.contractId,
      'calculate_batch_fees',
      [vec(amounts.map(i128))],
      decodeFeeCalculationVec,
    );
  }

  pauseFees(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'pause_fees', [address(admin)]);
  }

  resumeFees(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'resume_fees', [address(admin)]);
  }

  spendingByCategoryInWindow(
    events: TransactionEventInput[],
    windowStart: bigint,
    windowEnd: bigint,
  ): Promise<CategorySpendWindowRecord[]> {
    return this.gateway.read(
      this.contractId,
      'spending_by_category_in_window',
      [vec(events.map(encodeAnalyticsEvent)), u64(windowStart), u64(windowEnd)],
      decodeCategorySpendWindowVec,
    );
  }

  recategorizeTransaction(
    caller: string,
    events: TransactionEventInput[],
    txId: bigint,
    newCategory: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'recategorize_transaction', [
      address(caller),
      vec(events.map(encodeAnalyticsEvent)),
      u64(txId),
      symbol(newCategory),
    ]);
  }

  async recategorizeAndAggregate(
    caller: string,
    events: TransactionEventInput[],
    txId: bigint,
    newCategory: string,
    windowStart: bigint,
    windowEnd: bigint,
  ): Promise<CategorySpendWindowRecord[]> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'recategorize_and_aggregate',
        [
          address(caller),
          vec(events.map(encodeAnalyticsEvent)),
          u64(txId),
          symbol(newCategory),
          u64(windowStart),
          u64(windowEnd),
        ],
        decodeCategorySpendWindowVec,
      ),
      'recategorize_and_aggregate',
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

  getTransactionStatus(txId: bigint): Promise<TransactionStatus | null> {
    return this.gateway.read(
      this.contractId,
      'get_transaction_status',
      [u64(txId)],
      decodeStatusOrNull,
    );
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodeTransaction = (t: TransactionInput): ScVal =>
  struct({
    tx_id: u64(t.txId),
    from: address(t.from),
    to: address(t.to),
    amount: i128(t.amount),
    timestamp: u64(t.timestamp),
    category: symbol(t.category),
  });

const encodeAuditLog = (a: AuditLogInput): ScVal =>
  struct({
    actor: address(a.actor),
    operation: symbol(a.operation),
    timestamp: u64(a.timestamp),
    status: symbol(a.status),
  });

const encodeRefundRequest = (r: RefundRequestInput): ScVal =>
  struct({
    tx_id: u64(r.txId),
    reason: r.reason ? symbol(r.reason) : voidScVal(),
  });

const encodeAnalyticsEvent = (e: TransactionEventInput): ScVal =>
  struct({
    tx_id: u64(e.txId),
    from: address(e.from),
    to: address(e.to),
    amount: i128(e.amount),
    timestamp: u64(e.timestamp),
    category: symbol(e.category),
    currency: symbol(e.currency),
  });

const encodeFeeModel = (m: FeeModelInput): ScVal => {
  switch (m.variant) {
    case 'Flat':
      return vec([symbol('Flat'), i128(m.amount)]);
    case 'Percentage':
      return vec([symbol('Percentage'), u32(m.bps)]);
    case 'Tiered':
      return vec([
        symbol('Tiered'),
        vec(
          m.tiers.map((t) =>
            struct({
              threshold: i128(t.threshold),
              fee_model: encodeFeeModel(t.feeModel),
              default_percentage_bps: u32(t.defaultPercentageBps),
            }),
          ),
        ),
      ]);
  }
};

const encodeFeeConfig = (c: FeeConfigInput): ScVal =>
  struct({
    fee_model: encodeFeeModel(c.feeModel),
    min_fee: c.minFee !== null && c.minFee !== undefined ? u64(c.minFee) : voidScVal(),
    max_fee: c.maxFee !== null && c.maxFee !== undefined ? u64(c.maxFee) : voidScVal(),
    enabled: bool(c.enabled),
    description: c.description ? symbol(c.description) : voidScVal(),
  });

/** Encode `Map<u64, Transaction>` from a Record keyed by transaction id. */
const encodeTransactionMap = (lookup: Record<string, TransactionInput>): ScVal =>
  xdr.ScVal.scvMap(
    Object.entries(lookup).map(
      ([id, tx]) => new xdr.ScMapEntry({ key: u64(BigInt(id)), val: encodeTransaction(tx) }),
    ),
  );

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeBatchMetricsRaw = (raw: Record<string, unknown>): BatchMetricsRecord => ({
  txCount: Number(raw.tx_count as number),
  totalVolume: BigInt(raw.total_volume as bigint),
  avgAmount: BigInt(raw.avg_amount as bigint),
  minAmount: BigInt(raw.min_amount as bigint),
  maxAmount: BigInt(raw.max_amount as bigint),
  uniqueSenders: Number(raw.unique_senders as number),
  uniqueRecipients: Number(raw.unique_recipients as number),
  totalFees: BigInt(raw.total_fees as bigint),
  processedAt: BigInt(raw.processed_at as bigint),
});

const decodeBatchMetrics = (scVal: ScVal): BatchMetricsRecord =>
  decodeBatchMetricsRaw(decode(scVal) as Record<string, unknown>);

const decodeBatchMetricsOrNull = (scVal: ScVal): BatchMetricsRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeBatchMetrics(scVal);
};

const decodePaginatedMetrics = (scVal: ScVal): PaginatedBatchMetricsRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    metrics: ((raw.metrics as unknown[]) ?? []).map(
      (m) => decodeBatchMetricsRaw(m as Record<string, unknown>),
    ),
    totalCount: Number(raw.total_count as number),
    pageNumber: Number(raw.page_number as number),
    pageSize: Number(raw.page_size as number),
    hasNext: Boolean(raw.has_next),
    hasPrevious: Boolean(raw.has_previous),
  };
};

const decodeAuditLogOrNull = (scVal: ScVal): AuditLogInput | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    actor: String(raw.actor),
    operation: String(raw.operation ?? ''),
    timestamp: BigInt(raw.timestamp as bigint),
    status: String(raw.status ?? ''),
  };
};

const decodeStatusUpdateResult = (scVal: ScVal): BatchStatusUpdateResultRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    results: ((raw.results as unknown[]) ?? []).map((r) => {
      const item = r as Record<string, unknown>;
      return { txId: BigInt(item.tx_id as bigint), isValid: Boolean(item.is_valid) };
    }),
  };
};

const decodeRatingResultVec = (scVal: ScVal): RatingResultRecord[] => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((r) => ({
    txId: BigInt(r.tx_id as bigint),
    score: Number(r.score as number),
    status: String(r.status ?? ''),
  }));
};

const decodeBundleResultRaw = (raw: Record<string, unknown>): BundleResultRecord => ({
  bundleId: BigInt(raw.bundle_id as bigint),
  totalCount: Number(raw.total_count as number),
  validCount: Number(raw.valid_count as number),
  invalidCount: Number(raw.invalid_count as number),
  validationResults: ((raw.validation_results as unknown[]) ?? []).map((v) => {
    const item = v as Record<string, unknown>;
    return {
      txId: BigInt(item.tx_id as bigint),
      isValid: Boolean(item.is_valid),
      error: String(item.error ?? ''),
    };
  }),
  canBundle: Boolean(raw.can_bundle),
  totalVolume: BigInt(raw.total_volume as bigint),
  createdAt: BigInt(raw.created_at as bigint),
});

const decodeBundleResult = (scVal: ScVal): BundleResultRecord =>
  decodeBundleResultRaw(decode(scVal) as Record<string, unknown>);

const decodeBundleResultOrNull = (scVal: ScVal): BundleResultRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeBundleResult(scVal);
};

const decodeRefundBatchMetricsRaw = (raw: Record<string, unknown>): RefundBatchMetricsRecord => ({
  requestCount: Number(raw.request_count as number),
  successfulRefunds: Number(raw.successful_refunds as number),
  failedRefunds: Number(raw.failed_refunds as number),
  totalRefundedAmount: BigInt(raw.total_refunded_amount as bigint),
  avgRefundAmount: BigInt(raw.avg_refund_amount as bigint),
  processedAt: BigInt(raw.processed_at as bigint),
});

const decodeRefundBatchMetrics = (scVal: ScVal): RefundBatchMetricsRecord =>
  decodeRefundBatchMetricsRaw(decode(scVal) as Record<string, unknown>);

const decodeRefundBatchMetricsOrNull = (scVal: ScVal): RefundBatchMetricsRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeRefundBatchMetrics(scVal);
};

const decodeMonthlyOrNull = (scVal: ScVal): MonthlyAnalyticsRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    year: Number(raw.year as number),
    month: Number(raw.month as number),
    user: String(raw.user),
    totalSpending: BigInt(raw.total_spending as bigint),
    categorySpending: ((raw.category_spending as unknown[]) ?? []).map((entry) => {
      const [category, amount] = entry as [unknown, unknown];
      return { category: String(category), amount: BigInt(amount as bigint) };
    }),
    transactionCount: Number(raw.transaction_count as number),
  };
};

const decodeUserSummaryOrNull = (scVal: ScVal): UserSpendingSummaryRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    user: String(raw.user),
    totalSpending: BigInt(raw.total_spending as bigint),
    totalTransactions: Number(raw.total_transactions as number),
    primaryCategory: String(raw.primary_category ?? ''),
    avgMonthlySpending: BigInt(raw.avg_monthly_spending as bigint),
  };
};

const decodeFeeCalculation = (scVal: ScVal): FeeCalculationResultRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    grossAmount: BigInt(raw.gross_amount as bigint),
    feeAmount: BigInt(raw.fee_amount as bigint),
    netAmount: BigInt(raw.net_amount as bigint),
    feePercentageBps: Number(raw.fee_percentage_bps as number),
  };
};

const decodeFeeCalculationVec = (scVal: ScVal): FeeCalculationResultRecord[] => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((r) => ({
    grossAmount: BigInt(r.gross_amount as bigint),
    feeAmount: BigInt(r.fee_amount as bigint),
    netAmount: BigInt(r.net_amount as bigint),
    feePercentageBps: Number(r.fee_percentage_bps as number),
  }));
};

const decodeCategorySpendWindowVec = (scVal: ScVal): CategorySpendWindowRecord[] => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((w) => ({
    category: String(w.category ?? ''),
    totalVolume: BigInt(w.total_volume as bigint),
    txCount: Number(w.tx_count as number),
    currency: String(w.currency ?? ''),
  }));
};

const decodeStatusOrNull = (scVal: ScVal): TransactionStatus | null => {
  if (isVoid(scVal)) return null;
  return String(decode(scVal)) as TransactionStatus;
};

const decodeGenericOrNull = (scVal: ScVal): Record<string, unknown> | null => {
  if (isVoid(scVal)) return null;
  return decode(scVal) as Record<string, unknown>;
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
