/**
 * Typed client for the `PenaltyContract` (early-withdrawal fees).
 *
 * Contract methods (see `contracts/penalty/src/lib.rs`):
 *   initialize(admin, penalty_percent, treasury),
 *   set_penalty_percent(caller, percent), get_penalty_percent,
 *   set_treasury(caller, treasury), get_treasury,
 *   calculate_penalty_fee(amount), calculate_penalty_fee_with_bps(amount, bps)
 */
import { type SorobanGateway } from '../client.js';
import { address, decode, i128, u32, type ScVal } from '../convert.js';

export class PenaltyClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  initialize(
    admin: string,
    penaltyPercent: number,
    treasury: string,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'initialize', [
      address(admin),
      u32(penaltyPercent),
      address(treasury),
    ]);
  }

  setPenaltyPercent(
    caller: string,
    percent: number,
  ): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_penalty_percent', [
      address(caller),
      u32(percent),
    ]);
  }

  getPenaltyPercent(): Promise<number> {
    return this.gateway.read(this.contractId, 'get_penalty_percent', [], decodeU32);
  }

  setTreasury(caller: string, treasury: string): ReturnType<SorobanGateway['submit']> {
    return this.gateway.submit(this.contractId, 'set_treasury', [
      address(caller),
      address(treasury),
    ]);
  }

  getTreasury(): Promise<string> {
    return this.gateway.read(this.contractId, 'get_treasury', [], decodeAddress);
  }

  calculatePenaltyFee(amount: bigint): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'calculate_penalty_fee',
      [i128(amount)],
      decodeI128,
    );
  }

  calculatePenaltyFeeWithBps(amount: bigint, bps: number): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'calculate_penalty_fee_with_bps',
      [i128(amount), u32(bps)],
      decodeI128,
    );
  }
}

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeU32 = (scVal: ScVal): number => Number(decode(scVal));
const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
const decodeAddress = (scVal: ScVal): string => String(decode(scVal));
