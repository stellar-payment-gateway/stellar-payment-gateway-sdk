/**
 * Typed client for the `AllowancesContract` (recurring allowances).
 *
 * Contract methods (see `contracts/allowances/src/lib.rs`):
 *   create_allowance(owner, recipient, token, amount, frequency, start_time),
 *   distribute(allowance_id), pause_allowance, resume_allowance,
 *   cancel_allowance, update_beneficiary(allowance_id, new_recipient),
 *   renew_allowance(allowance_id, start_time), get_allowance_balance,
 *   get_allowance, get_allowance_analytics, get_owner_allowances,
 *   get_allowance_history, get_recipient_allowances, allowance_count
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

export type AllowanceFrequency = 'Once' | 'Daily' | 'Weekly' | 'Monthly';

export interface AllowanceRecord {
  owner: string;
  recipient: string;
  token: string;
  amount: bigint;
  frequency: AllowanceFrequency;
  nextDistribution: bigint;
  createdAt: bigint;
  isActive: boolean;
  isPaused: boolean;
}

export interface AllowanceAnalyticsRecord {
  totalDistributed: bigint;
  distributionCount: bigint;
  averagePayment: bigint;
  remaining: bigint;
}

export interface PaymentRecord {
  amount: bigint;
  timestamp: bigint;
  recipient: string;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class AllowancesClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async createAllowance(
    owner: string,
    recipient: string,
    token: string,
    amount: bigint,
    frequency: AllowanceFrequency,
    startTime: bigint,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'create_allowance',
      [address(owner), address(recipient), address(token), i128(amount), symbol(frequency), u64(startTime)],
      decodeU64,
    );
    return assertResult(result, 'create_allowance');
  }

  distribute(allowanceId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'distribute', [u64(allowanceId)]);
  }

  pauseAllowance(allowanceId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'pause_allowance', [u64(allowanceId)]);
  }

  resumeAllowance(allowanceId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'resume_allowance', [u64(allowanceId)]);
  }

  cancelAllowance(allowanceId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'cancel_allowance', [u64(allowanceId)]);
  }

  updateBeneficiary(
    allowanceId: bigint,
    newRecipient: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_beneficiary', [
      u64(allowanceId),
      address(newRecipient),
    ]);
  }

  renewAllowance(
    allowanceId: bigint,
    startTime: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'renew_allowance', [
      u64(allowanceId),
      u64(startTime),
    ]);
  }

  getAllowanceBalance(allowanceId: bigint): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_allowance_balance',
      [u64(allowanceId)],
      decodeI128,
    );
  }

  getAllowance(allowanceId: bigint): Promise<AllowanceRecord> {
    return this.gateway.read(
      this.contractId,
      'get_allowance',
      [u64(allowanceId)],
      decodeAllowance,
    );
  }

  getAllowanceAnalytics(allowanceId: bigint): Promise<AllowanceAnalyticsRecord> {
    return this.gateway.read(
      this.contractId,
      'get_allowance_analytics',
      [u64(allowanceId)],
      decodeAnalytics,
    );
  }

  getOwnerAllowances(owner: string): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_owner_allowances',
      [address(owner)],
      decodeU64Vec,
    );
  }

  getRecipientAllowances(recipient: string): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_recipient_allowances',
      [address(recipient)],
      decodeU64Vec,
    );
  }

  getAllowanceHistory(allowanceId: bigint): Promise<PaymentRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_allowance_history',
      [u64(allowanceId)],
      decodePaymentVec,
    );
  }

  allowanceCount(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'allowance_count', [], decodeU64);
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;

const decodeU64Vec = (scVal: ScVal): bigint[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as bigint[]) : [];
};

const decodeAllowance = (scVal: ScVal): AllowanceRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    owner: String(raw.owner),
    recipient: String(raw.recipient),
    token: String(raw.token),
    amount: BigInt(raw.amount as bigint),
    frequency: String(raw.frequency ?? 'Once') as AllowanceFrequency,
    nextDistribution: BigInt(raw.next_distribution as bigint),
    createdAt: BigInt(raw.created_at as bigint ?? 0n),
    isActive: Boolean(raw.is_active ?? true),
    isPaused: Boolean(raw.is_paused ?? false),
  };
};

const decodeAnalytics = (scVal: ScVal): AllowanceAnalyticsRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    totalDistributed: BigInt(raw.total_distributed as bigint),
    distributionCount: BigInt(raw.distribution_count as bigint),
    averagePayment: BigInt(raw.average_payment as bigint),
    remaining: BigInt(raw.remaining as bigint),
  };
};

const decodePaymentVec = (scVal: ScVal): PaymentRecord[] => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((p) => ({
    amount: BigInt(p.amount as bigint),
    timestamp: BigInt(p.timestamp as bigint),
    recipient: String(p.recipient),
  }));
};
