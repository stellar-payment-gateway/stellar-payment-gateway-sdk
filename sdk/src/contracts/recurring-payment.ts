/**
 * Typed client for the `RecurringPaymentContract`.
 *
 * Contract methods (see `contracts/recurring-payment/src/lib.rs`):
 *   create_payment(sender, recipient, token, amount, interval, start_time),
 *   execute_payment(payment_id), cancel_payment(payment_id),
 *   pause_payment(payment_id), resume_payment(payment_id),
 *   get_payment(payment_id),
 *   create_income_stream(recipient, source, amount, interval_seconds,
 *     target_goal_id), process_income(stream_id),
 *   cancel_income_stream(stream_id), get_income_stream(stream_id),
 *   get_user_income_streams(user)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  i128,
  symbol,
  u64,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RecurringPayment {
  sender: string;
  recipient: string;
  token: string;
  amount: bigint;
  interval: bigint;
  nextExecution: bigint;
  active: boolean;
  paused: boolean;
  executionCount: number;
  missedCount: number;
  lastMissedAt: bigint;
}

export interface IncomeStream {
  streamId: bigint;
  recipient: string;
  source: string;
  amount: bigint;
  intervalSeconds: bigint;
  nextPayout: bigint;
  targetGoalId: bigint;
  active: boolean;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class RecurringPaymentClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async createPayment(
    sender: string,
    recipient: string,
    token: string,
    amount: bigint,
    interval: bigint,
    startTime: bigint,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'create_payment',
      [
        address(sender),
        address(recipient),
        address(token),
        i128(amount),
        u64(interval),
        u64(startTime),
      ],
      decodeU64,
    );
    return assertResult(result, 'create_payment');
  }

  executePayment(paymentId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'execute_payment', [u64(paymentId)]);
  }

  cancelPayment(paymentId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'cancel_payment', [u64(paymentId)]);
  }

  pausePayment(paymentId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'pause_payment', [u64(paymentId)]);
  }

  resumePayment(paymentId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'resume_payment', [u64(paymentId)]);
  }

  getPayment(paymentId: bigint): Promise<RecurringPayment> {
    return this.gateway.read(
      this.contractId,
      'get_payment',
      [u64(paymentId)],
      decodeRecurringPayment,
    );
  }

  async createIncomeStream(
    recipient: string,
    source: string,
    amount: bigint,
    intervalSeconds: bigint,
    targetGoalId: bigint,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'create_income_stream',
      [
        address(recipient),
        symbol(source),
        i128(amount),
        u64(intervalSeconds),
        u64(targetGoalId),
      ],
      decodeU64,
    );
    return assertResult(result, 'create_income_stream');
  }

  processIncome(streamId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'process_income', [u64(streamId)]);
  }

  cancelIncomeStream(streamId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'cancel_income_stream', [
      u64(streamId),
    ]);
  }

  getIncomeStream(streamId: bigint): Promise<IncomeStream> {
    return this.gateway.read(
      this.contractId,
      'get_income_stream',
      [u64(streamId)],
      decodeIncomeStream,
    );
  }

  getUserIncomeStreams(user: string): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_user_income_streams',
      [address(user)],
      decodeU64Vec,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;

const decodeU64Vec = (scVal: ScVal): bigint[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as bigint[]) : [];
};

const decodeRecurringPayment = (scVal: ScVal): RecurringPayment => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    sender: String(raw.sender),
    recipient: String(raw.recipient),
    token: String(raw.token),
    amount: BigInt(raw.amount as bigint),
    interval: BigInt(raw.interval as bigint),
    nextExecution: BigInt(raw.next_execution as bigint),
    active: Boolean(raw.active),
    paused: Boolean(raw.paused),
    executionCount: Number(raw.execution_count),
    missedCount: Number(raw.missed_count),
    lastMissedAt: BigInt(raw.last_missed_at as bigint),
  };
};

const decodeIncomeStream = (scVal: ScVal): IncomeStream => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    streamId: BigInt(raw.stream_id as bigint),
    recipient: String(raw.recipient),
    source: String(raw.source),
    amount: BigInt(raw.amount as bigint),
    intervalSeconds: BigInt(raw.interval_seconds as bigint),
    nextPayout: BigInt(raw.next_payout as bigint),
    targetGoalId: BigInt(raw.target_goal_id as bigint),
    active: Boolean(raw.active),
  };
};
