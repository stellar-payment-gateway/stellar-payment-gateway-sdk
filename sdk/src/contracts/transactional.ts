/**
 * Typed client for the `TransactionContract` (transactional store).
 *
 * Contract methods (see `contracts/transactional/src/lib.rs`):
 *   add_transaction(tx), get_earliest_transaction(),
 *   get_average_transaction_amount(), get_transaction(id)
 */
import { type SorobanGateway } from '../client.js';
import {
  decode,
  i128,
  struct,
  symbol,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TransactionInput {
  id: string;
  amount: bigint;
  sender: string;
  receiver: string;
}

export interface TransactionRecord extends TransactionInput {}

// ── Client ───────────────────────────────────────────────────────────────────

export class TransactionalClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async addTransaction(tx: TransactionInput): Promise<void> {
    const result = await this.gateway.submit(
      this.contractId,
      'add_transaction',
      [encodeTransaction(tx)],
      decodeResult,
    );
    // `add_transaction` returns `Result<(), Error>`: Ok has no payload, so we
    // check the on-chain status directly instead of using `assertResult`.
    if (result.status !== 'SUCCESS') {
      throw new Error(`add_transaction did not succeed (status=${result.status})`);
    }
  }

  getEarliestTransaction(): Promise<TransactionRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_earliest_transaction',
      [],
      decodeTransactionOrNull,
    );
  }

  getAverageTransactionAmount(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_average_transaction_amount',
      [],
      decodeI128,
    );
  }

  getTransaction(id: string): Promise<TransactionRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_transaction',
      [symbol(id)],
      decodeTransactionOrNull,
    );
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodeTransaction = (tx: TransactionInput): ScVal =>
  struct({
    id: symbol(tx.id),
    amount: i128(tx.amount),
    sender: symbol(tx.sender),
    receiver: symbol(tx.receiver),
  });

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;

const decodeTransaction = (scVal: ScVal): TransactionRecord => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ''),
    amount: BigInt(raw.amount as bigint),
    sender: String(raw.sender ?? ''),
    receiver: String(raw.receiver ?? ''),
  };
};

const decodeTransactionOrNull = (scVal: ScVal): TransactionRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeTransaction(scVal);
};

/** Decode a `Result<(), Error>` return value; throws on the Err variant. */
const decodeResult = (scVal: ScVal): undefined => {
  const raw = decode(scVal);
  if (Array.isArray(raw) && raw[0] === 'Err') {
    throw new Error(`Contract call returned Err: ${String(raw[1])}`);
  }
  return undefined;
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
