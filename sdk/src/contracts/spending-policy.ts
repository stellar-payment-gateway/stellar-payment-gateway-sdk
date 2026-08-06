/**
 * Typed client for the `SpendingPolicyContract` (combinable wallet policies).
 *
 * Contract methods (see `contracts/spending-policy/src/lib.rs`):
 *   set_policy(wallet, Vec<PolicyRule>), evaluate_transaction(wallet,
 *     recipient, amount, category), submit_approval(approver, pending_id),
 *   get_policy(wallet), get_pending_transaction(pending_id),
 *   get_pending_ids_for_wallet(wallet), get_category_spending(wallet,
 *     category, period_id)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  decodeEnum,
  decodeEnumItem,
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

export type PolicyRuleInput =
  | { variant: 'CategoryLimit'; category: string; maxAmount: bigint; periodSeconds: bigint }
  | { variant: 'MerchantAllowlist'; allowed: string[] }
  | { variant: 'MerchantBlocklist'; blocked: string[] }
  | { variant: 'TimeWindow'; startSeconds: bigint; endSeconds: bigint }
  | {
      variant: 'ApprovalThreshold';
      thresholdAmount: bigint;
      requiredApprovals: number;
      approvers: string[];
    };

export type PolicyEvaluation =
  | { status: 'approved' }
  | { status: 'rejected'; reason: string }
  | { status: 'pending_approval'; pendingId: bigint };

export type ApprovalOutcome =
  | { status: 'approved' }
  | { status: 'pending'; currentCount: number };

export interface PolicyRecord {
  rules: string[];
  version: number;
  updatedAt: bigint;
}

export interface PendingTransactionRecord {
  id: bigint;
  wallet: string;
  recipient: string;
  amount: bigint;
  category: string | null;
  createdAt: bigint;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class SpendingPolicyClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  setPolicy(
    wallet: string,
    rules: PolicyRuleInput[],
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_policy', [
      address(wallet),
      vec(rules.map(encodePolicyRule)),
    ]);
  }

  async evaluateTransaction(
    wallet: string,
    recipient: string,
    amount: bigint,
    category: string | null,
  ): Promise<PolicyEvaluation> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'evaluate_transaction',
        [address(wallet), address(recipient), i128(amount), category ? symbol(category) : voidScVal()],
        decodePolicyEvaluation,
      ),
      'evaluate_transaction',
    );
  }

  async submitApproval(approver: string, pendingId: bigint): Promise<ApprovalOutcome> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'submit_approval',
        [address(approver), u64(pendingId)],
        decodeApprovalOutcome,
      ),
      'submit_approval',
    );
  }

  getPolicy(wallet: string): Promise<PolicyRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_policy',
      [address(wallet)],
      decodePolicyOrNull,
    );
  }

  getPendingTransaction(pendingId: bigint): Promise<PendingTransactionRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_pending_transaction',
      [u64(pendingId)],
      decodePendingTransactionOrNull,
    );
  }

  getPendingIdsForWallet(wallet: string): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_pending_ids_for_wallet',
      [address(wallet)],
      decodeU64Vec,
    );
  }

  getCategorySpending(
    wallet: string,
    category: string,
    periodId: bigint,
  ): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_category_spending',
      [address(wallet), symbol(category), u64(periodId)],
      decodeI128,
    );
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodePolicyRule = (rule: PolicyRuleInput): ScVal => {
  switch (rule.variant) {
    case 'CategoryLimit':
      return vec([
        symbol('CategoryLimit'),
        struct({
          category: symbol(rule.category),
          max_amount: i128(rule.maxAmount),
          period_seconds: u64(rule.periodSeconds),
        }),
      ]);
    case 'MerchantAllowlist':
      return vec([symbol('MerchantAllowlist'), struct({ allowed: vec(rule.allowed.map(address)) })]);
    case 'MerchantBlocklist':
      return vec([symbol('MerchantBlocklist'), struct({ blocked: vec(rule.blocked.map(address)) })]);
    case 'TimeWindow':
      return vec([
        symbol('TimeWindow'),
        struct({ start_seconds: u64(rule.startSeconds), end_seconds: u64(rule.endSeconds) }),
      ]);
    case 'ApprovalThreshold':
      return vec([
        symbol('ApprovalThreshold'),
        struct({
          threshold_amount: i128(rule.thresholdAmount),
          required_approvals: u32(rule.requiredApprovals),
          approvers: vec(rule.approvers.map(address)),
        }),
      ]);
  }
};

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;

const decodeU64Vec = (scVal: ScVal): bigint[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as bigint[]) : [];
};

const decodePolicyEvaluation = (scVal: ScVal): PolicyEvaluation => {
  const { variant, fields } = decodeEnum(scVal);
  if (variant === 'Approved') return { status: 'approved' };
  if (variant === 'PendingApproval') {
    return { status: 'pending_approval', pendingId: BigInt(fields[0] as bigint) };
  }
  // Rejected(RejectionReason) — the reason is a unit enum (bare symbol).
  return { status: 'rejected', reason: String(fields[0] ?? 'Unknown') };
};

const decodeApprovalOutcome = (scVal: ScVal): ApprovalOutcome => {
  const { variant, fields } = decodeEnum(scVal);
  if (variant === 'Approved') return { status: 'approved' };
  return { status: 'pending', currentCount: Number(fields[0] as number) };
};

const decodePolicyOrNull = (scVal: ScVal): PolicyRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    rules: ((raw.rules as unknown[]) ?? []).map((r) => JSON.stringify(decodeEnumItem(r))),
    version: Number(raw.version as number),
    updatedAt: BigInt(raw.updated_at as bigint),
  };
};

const decodePendingTransactionOrNull = (scVal: ScVal): PendingTransactionRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    id: BigInt(raw.id as bigint),
    wallet: String(raw.wallet),
    recipient: String(raw.recipient),
    amount: BigInt(raw.amount as bigint),
    category: raw.category ? String(raw.category) : null,
    createdAt: BigInt(raw.created_at as bigint),
  };
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
