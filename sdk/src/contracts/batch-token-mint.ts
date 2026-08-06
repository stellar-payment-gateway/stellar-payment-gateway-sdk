/**
 * Typed client for the `BatchTokenMintContract`.
 *
 * Contract methods (see `contracts/batch-token-mint/src/lib.rs`):
 *   initialize(admin), batch_mint_tokens(caller, token, Vec<TokenMintRequest>),
 *   get_admin, set_admin, get_last_batch_id, get_total_minted,
 *   get_total_batches_processed
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  decodeEnumItem,
  i128,
  vec,
  struct,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TokenMintRequestInput {
  recipient: string;
  amount: bigint;
}

export interface TokenMintedRecord {
  tokenAddress: string;
  recipient: string;
  amount: bigint;
  mintedAt: bigint;
}

export interface BatchMintMetricsRecord {
  totalRequests: number;
  successfulMints: number;
  failedMints: number;
  totalAmountMinted: bigint;
  avgMintAmount: bigint;
  processedAt: bigint;
}

export type MintResultItem =
  | { status: 'success'; minted: TokenMintedRecord }
  | { status: 'failure'; recipient: string; errorCode: number };

export interface BatchMintResult {
  batchId: bigint;
  tokenAddress: string;
  totalRequests: number;
  successful: number;
  failed: number;
  results: MintResultItem[];
  metrics: BatchMintMetricsRecord;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class BatchTokenMintClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(admin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [address(admin)]);
  }

  async batchMintTokens(
    caller: string,
    token: string,
    requests: TokenMintRequestInput[],
  ): Promise<BatchMintResult> {
    return assertResult(
      await this.gateway.submit(
        this.contractId,
        'batch_mint_tokens',
        [
          address(caller),
          address(token),
          vec(requests.map((r) => struct({ recipient: address(r.recipient), amount: i128(r.amount) }))),
        ],
        decodeBatchMintResult,
      ),
      'batch_mint_tokens',
    );
  }

  getAdmin(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_admin', [], decodeAddress);
  }

  setAdmin(currentAdmin: string, newAdmin: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_admin', [
      address(currentAdmin),
      address(newAdmin),
    ]);
  }

  getLastBatchId(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_last_batch_id', [], decodeU64);
  }

  getTotalMinted(): Promise<bigint> {
    return this.gateway.read(this.contractId, 'get_total_minted', [], decodeI128);
  }

  getTotalBatchesProcessed(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_total_batches_processed',
      [],
      decodeU64,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));

const decodeTokenMinted = (raw: Record<string, unknown>): TokenMintedRecord => ({
  tokenAddress: String(raw.token_address),
  recipient: String(raw.recipient),
  amount: BigInt(raw.amount as bigint),
  mintedAt: BigInt(raw.minted_at as bigint),
});

const decodeMintResultItem = (item: unknown): MintResultItem => {
  const { variant, fields } = decodeEnumItem(item);
  if (variant === 'Success') {
    return { status: 'success' as const, minted: decodeTokenMinted(fields[0] as Record<string, unknown>) };
  }
  const [recipient, errorCode] = fields as unknown[];
  return { status: 'failure' as const, recipient: String(recipient), errorCode: Number(errorCode) };
};

const decodeMintMetrics = (raw: Record<string, unknown>): BatchMintMetricsRecord => ({
  totalRequests: Number(raw.total_requests as number),
  successfulMints: Number(raw.successful_mints as number),
  failedMints: Number(raw.failed_mints as number),
  totalAmountMinted: BigInt(raw.total_amount_minted as bigint),
  avgMintAmount: BigInt(raw.avg_mint_amount as bigint),
  processedAt: BigInt(raw.processed_at as bigint),
});

const decodeBatchMintResult = (scVal: ScVal): BatchMintResult => {
  const raw = decode(scVal) as Record<string, unknown>;
  return {
    batchId: BigInt(raw.batch_id as bigint),
    tokenAddress: String(raw.token_address),
    totalRequests: Number(raw.total_requests as number),
    successful: Number(raw.successful as number),
    failed: Number(raw.failed as number),
    results: ((raw.results as unknown[]) ?? []).map(decodeMintResultItem),
    metrics: decodeMintMetrics((raw.metrics as Record<string, unknown>) ?? {}),
  };
};
