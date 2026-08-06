/**
 * Typed client for the `SpendingRulesContract` (composite spending engine).
 *
 * Contract methods (see `contracts/spending-rules/src/engine.rs`):
 *   initialize(admin, category_contract, zk_verifier_contract),
 *   add_rule(admin, user, category, max_amount, window_seconds, limit_contract,
 *     zk_threshold), set_rule_active(admin, rule_id, active),
 *   get_rule(rule_id), get_user_rules(user),
 *   evaluate_payment(user, amount, category, proof),
 *   enforce_payment(user, amount, category, proof),
 *   record_limit_spend(user, amount, category, limit_contract),
 *   get_rule_usage(rule_id), get_admin
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  bool,
  bytes,
  decode,
  i128,
  symbol,
  u64,
  voidScVal,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RuleRecord {
  id: bigint;
  user: string;
  category: string | null;
  maxAmount: bigint;
  windowSeconds: bigint;
  limitContract: string | null;
  zkThreshold: bigint | null;
  active: boolean;
}

export type RuleDecision = 'Allow' | 'Deny' | 'RequireZkProof';

export interface EvaluationResultRecord {
  allowed: boolean;
  decision: RuleDecision;
  blockingRule: bigint | null;
  requiresZk: boolean;
  checkedRules: number;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class SpendingRulesClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(
    admin: string,
    categoryContract: string,
    zkVerifierContract: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [
      address(admin),
      address(categoryContract),
      address(zkVerifierContract),
    ]);
  }

  async addRule(
    admin: string,
    user: string,
    category: string | null,
    maxAmount: bigint,
    windowSeconds: bigint,
    limitContract: string | null,
    zkThreshold: bigint | null,
  ): Promise<RuleRecord> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'add_rule',
        [
          address(admin),
          address(user),
          category ? symbol(category) : voidScVal(),
          i128(maxAmount),
          u64(windowSeconds),
          limitContract ? address(limitContract) : voidScVal(),
          zkThreshold !== null ? i128(zkThreshold) : voidScVal(),
        ],
        decodeRule,
      ),
      'add_rule',
    );
  }

  setRuleActive(
    admin: string,
    ruleId: bigint,
    active: boolean,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_rule_active', [
      address(admin),
      u64(ruleId),
      bool(active),
    ]);
  }

  getRule(ruleId: bigint): Promise<RuleRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_rule',
      [u64(ruleId)],
      decodeRuleOrNull,
    );
  }

  getUserRules(user: string): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_user_rules',
      [address(user)],
      decodeU64Vec,
    );
  }

  evaluatePayment(
    user: string,
    amount: bigint,
    category: string | null,
    proof: Buffer | Uint8Array | null,
  ): Promise<EvaluationResultRecord> {
    return this.gateway.read(
      this.contractId,
      'evaluate_payment',
      [
        address(user),
        i128(amount),
        category ? symbol(category) : voidScVal(),
        proof ? bytes(proof) : voidScVal(),
      ],
      decodeEvaluationResult,
    );
  }

  async enforcePayment(
    user: string,
    amount: bigint,
    category: string | null,
    proof: Buffer | Uint8Array | null,
  ): Promise<EvaluationResultRecord> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'enforce_payment',
        [
          address(user),
          i128(amount),
          category ? symbol(category) : voidScVal(),
          proof ? bytes(proof) : voidScVal(),
        ],
        decodeEvaluationResult,
      ),
      'enforce_payment',
    );
  }

  recordLimitSpend(
    user: string,
    amount: bigint,
    category: string | null,
    limitContract: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'record_limit_spend', [
      address(user),
      i128(amount),
      category ? symbol(category) : voidScVal(),
      address(limitContract),
    ]);
  }

  getRuleUsage(ruleId: bigint): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_rule_usage',
      [u64(ruleId)],
      decodeI128,
    );
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeU64Vec = (scVal: ScVal): bigint[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as bigint[]) : [];
};

const decodeRule = (scVal: ScVal): RuleRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    id: BigInt(raw.id as bigint),
    user: String(raw.user),
    category: raw.category ? String(raw.category) : null,
    maxAmount: BigInt(raw.max_amount as bigint),
    windowSeconds: BigInt(raw.window_seconds as bigint),
    limitContract: raw.limit_contract ? String(raw.limit_contract) : null,
    zkThreshold: raw.zk_threshold !== undefined && raw.zk_threshold !== null
      ? BigInt(raw.zk_threshold as bigint)
      : null,
    active: Boolean(raw.active ?? true),
  };
};

const decodeRuleOrNull = (scVal: ScVal): RuleRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeRule(scVal);
};

const decodeEvaluationResult = (scVal: ScVal): EvaluationResultRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    allowed: Boolean(raw.allowed),
    decision: String(raw.decision) as RuleDecision,
    blockingRule: raw.blocking_rule ? BigInt(raw.blocking_rule as bigint) : null,
    requiresZk: Boolean(raw.requires_zk),
    checkedRules: Number(raw.checked_rules as number),
  };
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
