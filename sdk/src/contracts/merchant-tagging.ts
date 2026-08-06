/**
 * Typed client for the `MerchantTaggingContract`.
 *
 * Contract methods (see `contracts/merchant-tagging/src/lib.rs`):
 *   init(admin), get_admin, register_merchant(caller, id, name, tags,
 *     address), update_merchant(caller, id, name, tags, address),
 *   deactivate_merchant(caller, id), get_merchant(id), list_merchants(),
 *   tag_transaction(tagger, tx_id, merchant_id, amount, asset, note),
 *   remove_tag(caller, tx_id, merchant_id), get_transaction_tag(tx_id,
 *     merchant_id), get_merchant_transactions(merchant_id),
 *   get_merchant_analytics(merchant_id), get_total_tagged(),
 *   get_merchants_by_tag(tag)
 */
import { type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  i128,
  string,
  symbol,
  u64,
  vec,
  voidScVal,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MerchantRecord {
  id: string;
  name: string;
  tags: string[];
  address: string | null;
  registeredAt: bigint;
  active: boolean;
}

export interface TransactionMerchantTagRecord {
  txId: bigint;
  merchantId: string;
  amount: bigint;
  asset: string;
  timestamp: bigint;
  note: string;
}

export interface MerchantAnalyticsRecord {
  merchantId: string;
  txCount: number;
  totalVolume: bigint;
  lastTxAt: bigint;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class MerchantTaggingClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  init(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'init', [address(admin)]);
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  registerMerchant(
    caller: string,
    id: string,
    name: string,
    tags: string[],
    merchantAddress: string | null,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'register_merchant', [
      address(caller),
      symbol(id),
      string(name),
      vec(tags.map(symbol)),
      merchantAddress ? address(merchantAddress) : voidScVal(),
    ]);
  }

  updateMerchant(
    caller: string,
    id: string,
    name: string | null,
    tags: string[] | null,
    merchantAddress: string | null,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'update_merchant', [
      address(caller),
      symbol(id),
      name !== null ? string(name) : voidScVal(),
      tags !== null ? vec(tags.map(symbol)) : voidScVal(),
      merchantAddress !== null ? address(merchantAddress) : voidScVal(),
    ]);
  }

  deactivateMerchant(caller: string, id: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'deactivate_merchant', [
      address(caller),
      symbol(id),
    ]);
  }

  getMerchant(id: string): Promise<MerchantRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_merchant',
      [symbol(id)],
      decodeMerchantOrNull,
    );
  }

  listMerchants(): Promise<string[]> {
    return this.gateway.read(this.contractId, 'list_merchants', [], decodeSymbolVec);
  }

  tagTransaction(
    tagger: string,
    txId: bigint,
    merchantId: string,
    amount: bigint,
    asset: string,
    note: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'tag_transaction', [
      address(tagger),
      u64(txId),
      symbol(merchantId),
      i128(amount),
      symbol(asset),
      string(note),
    ]);
  }

  removeTag(
    caller: string,
    txId: bigint,
    merchantId: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'remove_tag', [
      address(caller),
      u64(txId),
      symbol(merchantId),
    ]);
  }

  getTransactionTag(txId: bigint, merchantId: string): Promise<TransactionMerchantTagRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_transaction_tag',
      [u64(txId), symbol(merchantId)],
      decodeTagOrNull,
    );
  }

  getMerchantTransactions(merchantId: string): Promise<bigint[]> {
    return this.gateway.read(
      this.contractId,
      'get_merchant_transactions',
      [symbol(merchantId)],
      decodeU64Vec,
    );
  }

  getMerchantAnalytics(merchantId: string): Promise<MerchantAnalyticsRecord | null> {
    return this.gateway.read(
      this.contractId,
      'get_merchant_analytics',
      [symbol(merchantId)],
      decodeAnalyticsOrNull,
    );
  }

  getTotalTagged(): Promise<number> {
    return this.gateway.read(this.contractId, 'get_total_tagged', [], decodeU32);
  }

  getMerchantsByTag(tag: string): Promise<string[]> {
    return this.gateway.read(
      this.contractId,
      'get_merchants_by_tag',
      [symbol(tag)],
      decodeSymbolVec,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU32 = (scVal: ScVal): number => Number(decode(scVal));
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeSymbolVec = (scVal: ScVal): string[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as unknown[]).map(String) : [];
};

const decodeU64Vec = (scVal: ScVal): bigint[] => {
  const raw = decode(scVal);
  return Array.isArray(raw) ? (raw as bigint[]) : [];
};

const decodeMerchantOrNull = (scVal: ScVal): MerchantRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    tags: ((raw.tags as unknown[]) ?? []).map(String),
    address: raw.address ? String(raw.address) : null,
    registeredAt: BigInt(raw.registered_at as bigint),
    active: Boolean(raw.active ?? true),
  };
};

const decodeTagOrNull = (scVal: ScVal): TransactionMerchantTagRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    txId: BigInt(raw.tx_id as bigint),
    merchantId: String(raw.merchant_id ?? ''),
    amount: BigInt(raw.amount as bigint),
    asset: String(raw.asset ?? ''),
    timestamp: BigInt(raw.timestamp as bigint),
    note: String(raw.note ?? ''),
  };
};

const decodeAnalyticsOrNull = (scVal: ScVal): MerchantAnalyticsRecord | null => {
  if (isVoid(scVal)) return null;
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    merchantId: String(raw.merchant_id ?? ''),
    txCount: Number(raw.tx_count as number),
    totalVolume: BigInt(raw.total_volume as bigint),
    lastTxAt: BigInt(raw.last_tx_at as bigint),
  };
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}
