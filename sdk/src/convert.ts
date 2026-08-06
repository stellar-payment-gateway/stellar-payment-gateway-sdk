/**
 * ScVal conversion helpers for the Stellar Payment Gateway JS SDK.
 *
 * These wrap `@stellar/stellar-sdk`'s `nativeToScVal` / `scValToNative` with
 * the explicit Soroban types used by the payment gateway contracts
 * (i128 amounts, u32 config values, `BytesN<32>` verifier keys, etc.).
 *
 * All amounts are handled as `bigint` end-to-end so nothing is lost to JS
 * `Number` precision for values beyond `Number.MAX_SAFE_INTEGER`.
 */
import {
  Address,
  nativeToScVal,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';

export type ScVal = xdr.ScVal;

// ── Encoding ────────────────────────────────────────────────────────────────

/** Encode a signed 128-bit integer (the contract `i128` type). */
export function i128(value: bigint | number | string): ScVal {
  return nativeToScVal(BigInt(value), { type: 'i128' });
}

/** Encode an unsigned 32-bit integer (the contract `u32` type). */
export function u32(value: number): ScVal {
  return nativeToScVal(value, { type: 'u32' });
}

/** Encode an unsigned 64-bit integer (the contract `u64` type). */
export function u64(value: bigint | number): ScVal {
  return nativeToScVal(BigInt(value), { type: 'u64' });
}

/** Encode a boolean. */
export function bool(value: boolean): ScVal {
  return nativeToScVal(value);
}

/** Encode a UTF-8 string (the contract `String` type). */
export function string(value: string): ScVal {
  return nativeToScVal(value);
}

/** Encode a Soroban `Address` from a `C...`/`G...` strkey or an `Address` instance. */
export function address(value: string | Address): ScVal {
  return nativeToScVal(typeof value === 'string' ? Address.fromString(value) : value);
}

/** Encode raw bytes (the contract `Bytes` type). */
export function bytes(value: Buffer | Uint8Array): ScVal {
  return nativeToScVal(Buffer.from(value));
}

/**
 * Encode a fixed-length byte array (the contract `BytesN<N>` type).
 *
 * `BytesN` is transported over the wire as `ScVal::Bytes`; this helper adds a
 * length guard so encoding mistakes fail fast at the call site.
 */
export function bytesN(value: Buffer | Uint8Array, length: number): ScVal {
  const buf = Buffer.from(value);
  if (buf.length !== length) {
    throw new Error(`bytesN: expected ${length} bytes, got ${buf.length}`);
  }
  return nativeToScVal(buf);
}

/** Encode a symbol (the contract `Symbol` type). */
export function symbol(value: string): ScVal {
  return nativeToScVal(value, { type: 'symbol' });
}

/** Encode a `Vec<T>` of already-encoded values. */
export function vec(values: ScVal[]): ScVal {
  return xdr.ScVal.scvVec(values);
}

/**
 * Encode a contract struct (named-field `#[contracttype] struct`) as an
 * `ScVal::Map` with symbol keys.
 */
export function struct(fields: Record<string, ScVal>): ScVal {
  return xdr.ScVal.scvMap(
    Object.entries(fields).map(
      ([key, val]) => new xdr.ScMapEntry({ key: nativeToScVal(key), val }),
    ),
  );
}

// ── Decoding ────────────────────────────────────────────────────────────────

/** Decode a raw ScVal into a native JS value (bigint for i128/u64). */
export function decode(scVal: ScVal): unknown {
  return scValToNative(scVal);
}

/**
 * Extract the ScVal return value from a Soroban transaction result meta.
 *
 * v13 of `@stellar/stellar-sdk` returns the parsed `xdr.TransactionMeta` from
 * `server.getTransaction(...)`, so this takes the object directly.
 */
export function returnValueFromMeta(resultMeta: xdr.TransactionMeta): ScVal {
  const sorobanMeta = resultMeta.v3().sorobanMeta();
  if (!sorobanMeta) {
    throw new Error('Transaction result meta contains no Soroban return value');
  }
  return sorobanMeta.returnValue();
}

/** Read the `i128` payload of an ScVal as a bigint. */
export function asI128(scVal: ScVal): bigint {
  return scValToNative(scVal) as bigint;
}

/**
 * Decode a Soroban contract enum from its ScVal form.
 *
 * Contract enums serialize as `ScVal::Vec([Symbol(variant), ...fields])` when
 * the variant carries fields, or a bare `ScVal::Symbol(variant)` for unit
 * variants. `scValToNative` gives us either an array or a string — this helper
 * normalizes both shapes.
 */
/**
 * Normalize one decoded enum value (from `scValToNative`) into a variant name
 * and field list. Handles both the `Vec([Symbol(variant), ...fields])` shape
 * and the bare `Symbol(variant)` shape for unit variants.
 */
export function decodeEnumItem(raw: unknown): { variant: string; fields: unknown[] } {
  if (Array.isArray(raw)) {
    const [variant, ...fields] = raw as unknown[];
    return { variant: String(variant), fields };
  }
  return { variant: String(raw), fields: [] };
}

/** Decode a contract enum from its ScVal form (see {@link decodeEnumItem}). */
export function decodeEnum(scVal: ScVal): { variant: string; fields: unknown[] } {
  return decodeEnumItem(scValToNative(scVal));
}

/** Decode a `Vec<T>` of enum values into normalized enum records. */
export function decodeEnumVec(scVal: ScVal): Array<{ variant: string; fields: unknown[] }> {
  const raw = scValToNative(scVal);
  if (!Array.isArray(raw)) {
    throw new Error('Expected an ScVal::Vec of enum values');
  }
  return (raw as unknown[]).map(decodeEnumItem);
}
