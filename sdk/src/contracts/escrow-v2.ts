/**
 * Typed client for the `EscrowV2Contract` (multi-party escrow with disputes).
 *
 * Contract methods (see `contracts/escrow-v2/src/lib.rs`):
 *   fund_escrow(buyer, seller, arbitrator, token, amount, auto_release_secs),
 *   release(caller, escrow_id), raise_dispute(caller, escrow_id),
 *   resolve_dispute(caller, escrow_id, buyer_bps, seller_bps),
 *   auto_release(escrow_id), get_escrow(escrow_id), get_escrow_counter
 */
import { assertResult, type SorobanGateway } from '../client.js';
import {
  address,
  decode,
  i128,
  u32,
  u64,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EscrowV2Record {
  escrowId: bigint;
  buyer: string;
  seller: string;
  arbitrator: string | null;
  token: string;
  amount: bigint;
  state: string;
  fundedAt: bigint;
  autoReleaseAt: bigint;
  disputedBy: string | null;
  buyerPayout: bigint;
  sellerPayout: bigint;
}

// ── Client ───────────────────────────────────────────────────────────────────

export class EscrowV2Client {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  async fundEscrow(
    buyer: string,
    seller: string,
    arbitrator: string | null,
    token: string,
    amount: bigint,
    autoReleaseSecs: bigint,
  ): Promise<bigint> {
    const result = await this.gateway.submit(
      this.contractId,
      'fund_escrow',
      [
        address(buyer),
        address(seller),
        arbitrator ? address(arbitrator) : voidScVal(),
        address(token),
        i128(amount),
        u64(autoReleaseSecs),
      ],
      decodeU64,
    );
    return assertResult(result, 'fund_escrow');
  }

  release(caller: string, escrowId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'release', [
      address(caller),
      u64(escrowId),
    ]);
  }

  raiseDispute(caller: string, escrowId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'raise_dispute', [
      address(caller),
      u64(escrowId),
    ]);
  }

  resolveDispute(
    caller: string,
    escrowId: bigint,
    buyerBps: number,
    sellerBps: number,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'resolve_dispute', [
      address(caller),
      u64(escrowId),
      u32(buyerBps),
      u32(sellerBps),
    ]);
  }

  autoRelease(escrowId: bigint): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'auto_release', [u64(escrowId)]);
  }

  getEscrow(escrowId: bigint): Promise<EscrowV2Record | null> {
    return this.gateway.read(
      this.contractId,
      'get_escrow',
      [u64(escrowId)],
      decodeEscrowV2OrNull,
    );
  }

  getEscrowCounter(): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'get_escrow_counter',
      [],
      decodeU64,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU64 = (scVal: ScVal): bigint => decode(scVal) as bigint;

const decodeEscrowV2 = (raw: Record<string, unknown>): EscrowV2Record => ({
  escrowId: BigInt(raw.escrow_id as bigint),
  buyer: String(raw.buyer),
  seller: String(raw.seller),
  arbitrator: raw.arbitrator ? String(raw.arbitrator) : null,
  token: String(raw.token),
  amount: BigInt(raw.amount as bigint),
  state: String(raw.state),
  fundedAt: BigInt(raw.funded_at as bigint),
  autoReleaseAt: BigInt(raw.auto_release_at as bigint),
  disputedBy: raw.disputed_by ? String(raw.disputed_by) : null,
  buyerPayout: BigInt(raw.buyer_payout as bigint),
  sellerPayout: BigInt(raw.seller_payout as bigint),
});

const decodeEscrowV2OrNull = (scVal: ScVal): EscrowV2Record | null => {
  if (isVoid(scVal)) return null;
  return decodeEscrowV2(decode(scVal) as Record<string, unknown>);
};

function isVoid(scVal: ScVal): boolean {
  return scVal.switch().name === 'scvVoid';
}

function voidScVal(): ScVal {
  return { switch: () => ({ name: 'scvVoid' }) } as unknown as ScVal;
}
