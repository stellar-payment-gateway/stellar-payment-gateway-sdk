/**
 * Typed client for the `BatchHistoryContract`.
 *
 * Contract methods (see `contracts/batch-history/src/lib.rs`):
 *   retrieve_histories(requester, Vec<Address>)
 */
import { assertResult, type SorobanGateway } from '../client.js';
import { address, decode, vec, type ScVal } from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

/** A single transaction record inside a user history (schema-agnostic). */
export interface HistoryTransactionRecord {
  id: string;
  [key: string]: unknown;
}

export interface UserHistoryRecord {
  user: string;
  transactions: HistoryTransactionRecord[];
}

// ── Client ───────────────────────────────────────────────────────────────────

export class BatchHistoryClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async retrieveHistories(
    requester: string,
    users: string[],
  ): Promise<UserHistoryRecord[]> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'retrieve_histories',
        [address(requester), vec(users.map(address))],
        decodeHistories,
      ),
      'retrieve_histories',
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeHistories = (scVal: ScVal): UserHistoryRecord[] => {
  const raw = decode(scVal);
  if (!Array.isArray(raw)) return [];
  return (raw as Record<string, unknown>[]).map((h) => ({
    user: String(h.user),
    transactions: ((h.transactions as unknown[]) ?? []).map((t) => {
      const record = t as Record<string, unknown>;
      const id = (record.id ?? record.tx_id ?? record.transaction_id) as string;
      return { ...record, id: String(id ?? '') } as HistoryTransactionRecord;
    }),
  }));
};
