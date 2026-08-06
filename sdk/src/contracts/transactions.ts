/**
 * Typed client for the `TransactionsContract`.
 *
 * Contract methods (see `contracts/transactions/src/lib.rs`):
 *   initialize(admin), create_transaction(from, to, amount, note, memo, tags,
 *     tx_type, is_public, metadata), get_transaction(id),
 *   get_user_transactions(user), get_all_transactions,
 *   get_transactions_paginated(offset, limit), get_total_income,
 *   get_total_expense, delete_transaction(caller, id),
 *   update_transaction_note(id, caller, note),
 *   update_transaction_amount(id, caller, amount),
 *   set_metadata(id, caller, metadata), get_metadata(id),
 *   clear_user_transactions(user), get_total_transactions_count
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  bool,
  decode,
  i128,
  string,
  symbol,
  u32,
  vec,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TransactionRecord {
  id: string;
  from: string;
  to: string;
  amount: bigint;
  note: string;
  memo: string;
  tags: string[];
  txType: string;
  isPublic: boolean;
  timestamp: bigint;
  status: string;
  metadata: Record<string, string>;
}

export interface TransactionInput {
  from: string;
  to: string;
  amount: bigint;
  note?: string;
  memo?: string;
  tags?: string[];
  txType?: string;
  isPublic?: boolean;
  metadata?: Record<string, string>;
}

export type TransactionStatus = 'Pending' | 'Completed' | 'Failed' | 'Reversed';

// ── Client ───────────────────────────────────────────────────────────────────

export class TransactionsClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async createTransaction(input: TransactionInput): Promise<string> {
    const args = [
      address(input.from),
      address(input.to),
      i128(input.amount),
      string(input.note ?? ''),
      string(input.memo ?? ''),
      vec((input.tags ?? []).map(string)),
      symbol(input.txType ?? 'transfer'),
      bool(input.isPublic ?? false),
      vec(
        Object.entries(input.metadata ?? {}).map(([k, v]) =>
          vec([symbol(k), string(v)]),
        ),
      ),
    ];
    const result = await this.gateway.submit(
      this.contractId,
      'create_transaction',
      args,
      decodeSymbol,
    );
    return String(assertResult(result, 'create_transaction'));
  }

  getTransaction(id: string): Promise<TransactionRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_transaction',
      [symbol(id)],
      decodeTransactionOrNull,
    );
  }

  getUserTransactions(user: string): Promise<TransactionRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_user_transactions',
      [address(user)],
      decodeTransactionVec,
    );
  }

  getAllTransactions(): Promise<TransactionRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_all_transactions',
      [],
      decodeTransactionVec,
    );
  }

  getTransactionsPaginated(offset: number, limit: number): Promise<TransactionRecord[]> {
    return this.gateway.read(
      this.contractId,
      'get_transactions_paginated',
      [u32(offset), u32(limit)],
      decodeTransactionVec,
    );
  }

  getTotalIncome(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_income', [], decodeI128);
  }

  getTotalExpense(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_expense', [], decodeI128);
  }

  getTotalTransactionsCount(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_transactions_count',
      [],
      decodeU64,
    );
  }

  deleteTransaction(caller: string, id: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'delete_transaction', [
      address(caller),
      symbol(id),
    ]);
  }

  updateTransactionNote(
    id: string,
    caller: string,
    note: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_transaction_note', [
      symbol(id),
      address(caller),
      string(note),
    ]);
  }

  updateTransactionAmount(
    id: string,
    caller: string,
    amount: bigint,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_transaction_amount', [
      symbol(id),
      address(caller),
      i128(amount),
    ]);
  }

  setMetadata(
    id: string,
    caller: string,
    metadata: Record<string, string>,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_metadata', [
      symbol(id),
      address(caller),
      vec(
        Object.entries(metadata).map(([k, v]) =>
          vec([symbol(k), string(v)]),
        ),
      ),
    ]);
  }

  getMetadata(id: string): Promise<Record<string, string> | null> {
    return this.gateway.read(
      this.contractId,
      'get_metadata',
      [symbol(id)],
      decodeMetadataOrNull,
    );
  }

  clearUserTransactions(user: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'clear_user_transactions', [
      address(user),
    ]);
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeSymbol = (scVal: ScVal): string => String(decode(scVal));

const decodeTransaction = (raw: Record<string, unknown>): TransactionRecord => ({
  id: String(raw.id),
  from: String(raw.from),
  to: String(raw.to),
  amount: BigInt(raw.amount as bigint),
  note: String(raw.note ?? ''),
  memo: String(raw.memo ?? ''),
  tags: Array.isArray(raw.tags) ? (raw.tags as unknown[]).map(String) : [],
  txType: String(raw.tx_type ?? ''),
  isPublic: Boolean(raw.is_public),
  timestamp: BigInt(raw.timestamp as bigint),
  status: String(raw.status ?? ''),
  metadata: decodeMetadataMap(raw.metadata),
});

const decodeMetadataMap = (val: unknown): Record<string, string> => {
  if (!val || !Array.isArray(val)) return {};
  const result: Record<string, string> = {};
  for (const entry of val as { key: unknown; val: unknown }[]) {
    result[String(entry.key)] = String(entry.val);
  }
  return result;
};

const decodeTransactionVec = (scVal: ScVal): TransactionRecord[] => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map(decodeTransaction);
};

const decodeTransactionOrNull = (scVal: ScVal): TransactionRecord | null => {
  if (isVoid(scVal)) return null;
  return decodeTransaction(decode(scVal) as Record<string, unknown>);
};

const decodeMetadataOrNull = (scVal: ScVal): Record<string, string> | null => {
  if (isVoid(scVal)) return null;
  return decodeMetadataMap(decode(scVal));
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
