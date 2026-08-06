/**
 * Typed client for the `CategoryAnalyticsContract`.
 *
 * Contract methods (see `contracts/category-analytics/src/lib.rs`):
 *   init(admin), record_spending(user, category, amount),
 *   record_spending_batch(user, Vec<CategorySpend>),
 *   process_events(caller, Vec<TransactionEvent>),
 *   spending_by_category_in_window(user, category, start, end),
 *   get_current_spending(user, category), get_category_metrics(year, month,
 *     user, category), get_yearly_trend(user, category, year),
 *   get_category_metrics_filtered(year, month, user, category, TimeFilter),
 *   get_yearly_trend_filtered(user, category, year, TimeFilter)
 */
import { type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  i128,
  symbol,
  u32,
  u64,
  vec,
  struct,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CategorySpendInput {
  category: string;
  amount: bigint;
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

export interface TimeFilterInput {
  startTimestamp: bigint;
  endTimestamp: bigint;
}

export interface CategorySpendingRecord {
  count: number;
  volume: bigint;
}

export interface MonthlyAnalyticsRecord {
  user: string;
  category: string;
  year: number;
  month: number;
  volume: bigint;
  count: number;
  lastUpdated: bigint;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class CategoryAnalyticsClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  init(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'init', [address(admin)]);
  }

  recordSpending(
    user: string,
    category: string,
    amount: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'record_spending', [
      address(user),
      symbol(category),
      i128(amount),
    ]);
  }

  recordSpendingBatch(
    user: string,
    spendings: CategorySpendInput[],
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'record_spending_batch', [
      address(user),
      vec(spendings.map((s) => struct({ category: symbol(s.category), amount: i128(s.amount) }))),
    ]);
  }

  processEvents(
    caller: string,
    events: TransactionEventInput[],
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'process_events', [
      address(caller),
      vec(events.map(encodeTransactionEvent)),
    ]);
  }

  spendingByCategoryInWindow(
    user: string,
    category: string,
    start: bigint,
    end: bigint,
  ): Promise<CategorySpendingRecord> {
    return this.gateway.read(
      this.contractId,
      'spending_by_category_in_window',
      [address(user), symbol(category), u64(start), u64(end)],
      decodeCategorySpending,
    );
  }

  getCurrentSpending(user: string, category: string): Promise<CategorySpendingRecord> {
    return this.gateway.read(
      this.contractId,
      'get_current_spending',
      [address(user), symbol(category)],
      decodeCategorySpending,
    );
  }

  getCategoryMetrics(
    year: number,
    month: number,
    user: string,
    category: string,
  ): Promise<MonthlyAnalyticsRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_category_metrics',
      [u32(year), u32(month), address(user), symbol(category)],
      decodeMonthlyOrNull,
    );
  }

  getYearlyTrend(
    user: string,
    category: string,
    year: number,
  ): Promise<MonthlyAnalyticsRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_yearly_trend',
      [address(user), symbol(category), u32(year)],
      decodeMonthlyVec,
    );
  }

  getCategoryMetricsFiltered(
    year: number,
    month: number,
    user: string,
    category: string,
    filter: TimeFilterInput,
  ): Promise<MonthlyAnalyticsRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_category_metrics_filtered',
      [u32(year), u32(month), address(user), symbol(category), encodeTimeFilter(filter)],
      decodeMonthlyOrNull,
    );
  }

  getYearlyTrendFiltered(
    user: string,
    category: string,
    year: number,
    filter: TimeFilterInput,
  ): Promise<MonthlyAnalyticsRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_yearly_trend_filtered',
      [address(user), symbol(category), u32(year), encodeTimeFilter(filter)],
      decodeMonthlyVec,
    );
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodeTransactionEvent = (e: TransactionEventInput): ScVal =>
  struct({
    tx_id: u64(e.txId),
    from: address(e.from),
    to: address(e.to),
    amount: i128(e.amount),
    timestamp: u64(e.timestamp),
    category: symbol(e.category),
    currency: symbol(e.currency),
  });

const encodeTimeFilter = (f: TimeFilterInput): ScVal =>
  struct({ start_timestamp: u64(f.startTimestamp), end_timestamp: u64(f.endTimestamp) });

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeCategorySpending = (scVal: ScVal): CategorySpendingRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    count: Number(raw.count as number),
    volume: BigInt(raw.volume as bigint),
  };
};

const decodeMonthlyRaw = (raw: Record<string, unknown>): MonthlyAnalyticsRecord => ({
  user: String(raw.user),
  category: String(raw.category ?? ''),
  year: Number(raw.year as number),
  month: Number(raw.month as number),
  volume: BigInt(raw.volume as bigint),
  count: Number(raw.count as number),
  lastUpdated: BigInt(raw.last_updated as bigint),
});

const decodeMonthlyOrNull = (scVal: ScVal): MonthlyAnalyticsRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeMonthlyRaw(decode(scVal) as Record<string, unknown>);
};

const decodeMonthlyVec = (scVal: ScVal): MonthlyAnalyticsRecord[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]).map(decodeMonthlyRaw) : [];
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
