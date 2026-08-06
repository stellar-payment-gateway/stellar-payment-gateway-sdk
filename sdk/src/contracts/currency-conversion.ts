/**
 * Typed client for the `CurrencyConversionContract` (pure math helpers).
 *
 * Contract methods (see `contracts/currency-conversion/src/lib.rs`):
 *   convert(amount, ConversionRate), normalize(balances, rates, base_currency)
 */
import { type SorobanGateway } from '../client.js';
import {
  decode,
  i128,
  string,
  vec,
  struct,
  type ScVal,
} from '../convert.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConversionRateInput {
  fromCurrency: string;
  toCurrency: string;
  rateNumerator: bigint;
  rateDenominator: bigint;
}

export interface ConversionRateRecord extends ConversionRateInput {}

// ── Client ───────────────────────────────────────────────────────────────────

export class CurrencyConversionClient {
  constructor(
    private readonly gateway: SorobanGateway,
    private readonly contractId: string,
  ) {}

  convert(amount: bigint, rate: ConversionRateInput): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'convert',
      [i128(amount), encodeRate(rate)],
      decodeI128,
    );
  }

  normalize(
    balances: Array<{ currency: string; amount: bigint }>,
    rates: ConversionRateInput[],
    baseCurrency: string,
  ): Promise<bigint> {
    return this.gateway.read(
      this.contractId,
      'normalize',
      [
        vec(
          balances.map((b) =>
            vec([string(b.currency), i128(b.amount)]),
          ),
        ),
        vec(rates.map(encodeRate)),
        string(baseCurrency),
      ],
      decodeI128,
    );
  }
}

// ── Encoders ─────────────────────────────────────────────────────────────────

const encodeRate = (r: ConversionRateInput): ScVal =>
  struct({
    from_currency: string(r.fromCurrency),
    to_currency: string(r.toCurrency),
    rate_numerator: i128(r.rateNumerator),
    rate_denominator: i128(r.rateDenominator),
  });

// ── Decoders ─────────────────────────────────────────────────────────────────

const decodeI128 = (scVal: ScVal): bigint => decode(scVal) as bigint;
