/**
 * Typed client for the `TreasuryContract` (multi-sig treasury).
 *
 * Contract methods (see `contracts/treasury/src/lib.rs`):
 *   initialize(admin), credit_penalty / credit_fee / credit_reward(amount),
 *   set_signers(caller, Vec<Address>, threshold), add_signer, remove_signer,
 *   set_threshold(caller, threshold), set_spending_tiers(caller, tiers,
 *     fallback_threshold), propose_disbursement(caller, recipient, amount,
 *     reason), approve_disbursement(caller, proposal_id),
 *   execute_disbursement(caller, proposal_id), cancel_proposal(caller,
 *     proposal_id), get_proposal, get_proposal_status,
 *   get_proposal_approval_count, has_approved, get_total_penalties,
 *   get_total_fees, get_total_rewards, get_total_reserve, get_signers,
 *   get_threshold, get_required_signers_for_amount, is_signer, get_admin,
 *   get_spending_tiers, get_fallback_threshold
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
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SpendingTierInput {
  label: string;
  minAmount: bigint;
  maxAmount: bigint;
  requiredSigners: number;
}

export interface SpendingTierRecord extends SpendingTierInput {}

export type ProposalStatus = 'Pending' | 'Approved' | 'Executed' | 'Cancelled' | 'Expired';

export interface ProposalRecord {
  id: bigint;
  recipient: string;
  amount: bigint;
  reason: string;
  proposer: string;
  createdAt: bigint;
  approvalCount: number;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class TreasuryClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  creditPenalty(amount: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'credit_penalty', [i128(amount)]);
  }

  creditFee(amount: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'credit_fee', [i128(amount)]);
  }

  creditReward(amount: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'credit_reward', [i128(amount)]);
  }

  setSigners(
    caller: string,
    signers: string[],
    threshold: number,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_signers', [
      address(caller),
      vec(signers.map(address)),
      u32(threshold),
    ]);
  }

  addSigner(caller: string, signer: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'add_signer', [
      address(caller),
      address(signer),
    ]);
  }

  removeSigner(caller: string, signer: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'remove_signer', [
      address(caller),
      address(signer),
    ]);
  }

  setThreshold(caller: string, threshold: number): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_threshold', [
      address(caller),
      u32(threshold),
    ]);
  }

  setSpendingTiers(
    caller: string,
    tiers: SpendingTierInput[],
    fallbackThreshold: number,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_spending_tiers', [
      address(caller),
      vec(tiers.map(encodeTier)),
      u32(fallbackThreshold),
    ]);
  }

  async proposeDisbursement(
    caller: string,
    recipient: string,
    amount: bigint,
    reason: string,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'propose_disbursement',
      [address(caller), address(recipient), i128(amount), symbol(reason)],
      decodeU64,
    );
    return assertResult(result, 'propose_disbursement');
  }

  approveDisbursement(
    caller: string,
    proposalId: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'approve_disbursement', [
      address(caller),
      u64(proposalId),
    ]);
  }

  executeDisbursement(
    caller: string,
    proposalId: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'execute_disbursement', [
      address(caller),
      u64(proposalId),
    ]);
  }

  cancelProposal(caller: string, proposalId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'cancel_proposal', [
      address(caller),
      u64(proposalId),
    ]);
  }

  getProposal(proposalId: bigint): Promise<ProposalRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_proposal',
      [u64(proposalId)],
      decodeProposalOrNull,
    );
  }

  getProposalStatus(proposalId: bigint): Promise<ProposalStatus | null> {
    return this.gateway.read(
      this.contractId,
      'get_proposal_status',
      [u64(proposalId)],
      decodeProposalStatusOrNull,
    );
  }

  getProposalApprovalCount(proposalId: bigint): Promise<number> {
    return this.gateway.read(
      this.contractId,
      'get_proposal_approval_count',
      [u64(proposalId)],
      decodeU32,
    );
  }

  hasApproved(proposalId: bigint, signer: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'has_approved',
      [u64(proposalId), address(signer)],
      decodeBool,
    );
  }

  getTotalPenalties(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_penalties', [], decodeI128);
  }

  getTotalFees(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_fees', [], decodeI128);
  }

  getTotalRewards(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_rewards', [], decodeI128);
  }

  getTotalReserve(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_reserve', [], decodeI128);
  }

  getSigners(): Promise<string[]> {
    return this.gateway.read(this.contractId, 'get_signers', [], decodeAddressVec);
  }

  getThreshold(): Promise<number> {
    return this.gateway.read(this.contractId, 'get_threshold', [], decodeU32);
  }

  getRequiredSignersForAmount(amount: bigint): Promise<number> {
    return this.gateway.read(
      this.contractId,
      'get_required_signers_for_amount',
      [i128(amount)],
      decodeU32,
    );
  }

  isSigner(addressStr: string): Promise<boolean> {
    return this.gateway.read(
      this.contractId,
      'is_signer',
      [address(addressStr)],
      decodeBool,
    );
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  getSpendingTiers(): Promise<SpendingTierRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_spending_tiers',
      [],
      decodeTierVec,
    );
  }

  getFallbackThreshold(): Promise<number> {
    return this.gateway.read(this.contractId, 'get_fallback_threshold', [], decodeU32);
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodeTier = (t: SpendingTierInput): ScVal =>
  struct({
    label: symbol(t.label),
    min_amount: i128(t.minAmount),
    max_amount: i128(t.maxAmount),
    required_signers: u32(t.requiredSigners),
  });

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeU32 = (scVal: ScVal): number => Number(decode(scVal));
const decodeBool = (scVal: ScVal): boolean => Boolean(decode(scVal));
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeAddressVec = (scVal: ScVal): string[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as unknown[]).map(String) : [];
};

const decodeProposalOrNull = (scVal: ScVal): ProposalRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    id: BigInt(raw.id as bigint),
    recipient: String(raw.recipient),
    amount: BigInt(raw.amount as bigint),
    reason: String(raw.reason ?? ''),
    proposer: String(raw.proposer),
    createdAt: BigInt(raw.created_at as bigint),
    approvalCount: Number(raw.approval_count as number),
  };
};

const decodeProposalStatusOrNull = (scVal: ScVal): ProposalStatus | null => {
  if (isVoid(scVal)) return null;
  return String(decode(scVal)) as ProposalStatus;
};

const decodeTierVec = (scVal: ScVal): SpendingTierRecord[] => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((t) => ({
    label: String(t.label ?? ''),
    minAmount: BigInt(t.min_amount as bigint),
    maxAmount: BigInt(t.max_amount as bigint),
    requiredSigners: Number(t.required_signers as number),
  }));
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
