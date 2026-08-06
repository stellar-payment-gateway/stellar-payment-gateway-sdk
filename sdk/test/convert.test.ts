import { describe, expect, it } from 'vitest';
import { Keypair, nativeToScVal, scValToNative, xdr } from '@stellar/stellar-sdk';

import {
  address,
  bool,
  bytes,
  bytesN,
  decode,
  decodeEnum,
  decodeEnumVec,
  i128,
  string,
  struct,
  symbol,
  u32,
  u64,
  vec,
} from '../src/convert.js';

describe('encoding helpers', () => {
  it('encodes i128 explicitly (never u64)', () => {
    expect(i128(1_000_000n).switch().name).toBe('scvI128');
    expect(i128(42).switch().name).toBe('scvI128');
  });

  it('encodes u32 / u64 / booleans / strings / symbols', () => {
    expect(u32(300).switch().name).toBe('scvU32');
    expect(u64(9_000_000_000n).switch().name).toBe('scvU64');
    expect(bool(true).switch().name).toBe('scvBool');
    expect(string('hello').switch().name).toBe('scvString');
    expect(symbol('premium').switch().name).toBe('scvSymbol');
  });

  it('encodes addresses from strkeys', () => {
    const pk = Keypair.random().publicKey();
    expect(address(pk).switch().name).toBe('scvAddress');
  });

  it('encodes bytes and validates BytesN length', () => {
    expect(bytes(Buffer.from('deadbeef', 'hex')).switch().name).toBe('scvBytes');
    expect(bytesN(Buffer.alloc(32, 1), 32).switch().name).toBe('scvBytes');
    expect(() => bytesN(Buffer.alloc(31, 1), 32)).toThrow(/expected 32 bytes/i);
  });

  it('encodes structs as maps with symbol keys', () => {
    const s = struct({ fee_bps: u32(300), min_fee: i128(0n) });
    expect(s.switch().name).toBe('scvMap');
    const entries = s.map()!;
    const keys = entries.map((e) => scValToNative(e.key()));
    expect(keys).toEqual(['fee_bps', 'min_fee']);
  });

  it('encodes vecs', () => {
    expect(vec([i128(1n), i128(2n)]).switch().name).toBe('scvVec');
  });
});

describe('decoding helpers', () => {
  it('decodes i128 as bigint', () => {
    expect(decode(i128(12345678901234567890n))).toBe(12345678901234567890n);
  });

  it('decodes structs to plain objects', () => {
    const s = struct({ fee_bps: u32(300), min_fee: i128(5n) });
    const raw = decode(s) as Record<string, unknown>;
    expect(raw.fee_bps).toBe(300);
    expect(raw.min_fee).toBe(5n);
  });

  it('normalizes contract enum encodings', () => {
    // Unit variant -> bare symbol
    const bare = decodeEnum(scvSymbolish('Success'));
    expect(bare.variant).toBe('Success');
    expect(bare.fields).toEqual([]);

    // Variant with fields -> Vec([symbol, ...fields])
    const packed = xdr.ScVal.scvVec([
      nativeToScVal('Failure', { type: 'symbol' }),
      nativeToScVal('alice', { type: 'symbol' }),
    ]);
    const parsed = decodeEnum(packed);
    expect(parsed.variant).toBe('Failure');
    expect(parsed.fields).toEqual(['alice']);
  });

  it('normalizes vecs of contract enums', () => {
    const items = decodeEnumVec(
      xdr.ScVal.scvVec([
        xdr.ScVal.scvVec([
          nativeToScVal('Success', { type: 'symbol' }),
          nativeToScVal('u1', { type: 'symbol' }),
          nativeToScVal('a', { type: 'symbol' }),
          nativeToScVal('b', { type: 'symbol' }),
          nativeToScVal(1000n, { type: 'i128' }),
          nativeToScVal(1001n, { type: 'i128' }),
        ]),
      ]),
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.variant).toBe('Success');
    expect(items[0]?.fields).toHaveLength(5);
  });
});

function scvSymbolish(v: string): xdr.ScVal {
  return nativeToScVal(v, { type: 'symbol' });
}

