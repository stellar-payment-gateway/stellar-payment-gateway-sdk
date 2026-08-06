/**
 * Shared test helpers: mocked Soroban RPC server + XDR fixtures.
 */
import { Account, Address, Keypair, nativeToScVal, xdr, type Transaction } from '@stellar/stellar-sdk';
import { vi } from 'vitest';
import type { Api } from '@stellar/stellar-sdk/rpc';

import { SorobanGateway } from '../src/client.js';

export const TEST_NETWORK = 'Test SDF Network ; September 2015';
export const TEST_CONTRACT = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';

export const TEST_PUBLIC_KEY = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

/** An Account used to build transactions in mocks. */
export function testAccount(seqNum = '123'): Account {
  return new Account(TEST_PUBLIC_KEY, seqNum);
}

/** A gateway wired to a mock RPC server. */
export function makeGateway(keypair: Keypair = Keypair.random()): SorobanGateway {
  return new SorobanGateway({
    rpcUrl: 'https://rpc.invalid',
    networkPassphrase: TEST_NETWORK,
    publicKey: keypair.publicKey(),
    signer: keypair,
  });
}

/** Extract the invoked function name from a built transaction. */
export function invokedFunctionName(
  tx: { operations: Array<{ func: { invokeContract: () => { functionName: () => { toString: () => string } } } }> },
): string {
  return tx.operations[0]!.func.invokeContract().functionName().toString();
}

/** Extract the invoked function's ScVal args from a built transaction. */
export function invokedArgs(
  tx: { operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[] } } }> },
): xdr.ScVal[] {
  return tx.operations[0]!.func.invokeContract().args();
}

/**
 * Mock `server.prepareTransaction` to pass the built transaction through
 * unchanged (no real RPC round-trip).
 */
export function mockPrepareTransaction(gateway: SorobanGateway) {
  return vi
    .spyOn(gateway.server, 'prepareTransaction')
    .mockImplementation(async (tx) => tx as Transaction);
}

/** Build a successful simulation response with the given return value. */
export function successSimulation(retval: xdr.ScVal): Api.SimulateTransactionResponse {
  return {
    id: '1',
    latestLedger: 100,
    events: [],
    transactionData: {} as never,
    minResourceFee: '0',
    result: { auth: [], retval },
    stateChanges: [],
  } as unknown as Api.SimulateTransactionResponse;
}

/** Build an error simulation response. */
export function errorSimulation(message: string): Api.SimulateTransactionResponse {
  return {
    id: '1',
    latestLedger: 100,
    events: [],
    error: message,
  } as unknown as Api.SimulateTransactionResponse;
}

/**
 * Build a `TransactionMeta` containing the given Soroban return value
 * (base64 round-trippable).
 */
// js-xdr v3 union classes accept (switchOn, value) at runtime but the generated
// typings only expose implicit zero-arg constructors, so we cast them here.
const SorobanMetaExtCtor = xdr.SorobanTransactionMetaExt as unknown as new (
  v: number,
) => xdr.SorobanTransactionMetaExt;
const ExtensionPointCtor = xdr.ExtensionPoint as unknown as new (v: number) => xdr.ExtensionPoint;
const TransactionMetaCtor = xdr.TransactionMeta as unknown as new (
  switchOn: number,
  value: xdr.TransactionMetaV3,
) => xdr.TransactionMeta;

/**
 * Build a `TransactionMeta` containing the given Soroban return value
 * (base64 round-trippable).
 */
export function metaWithReturnValue(retval: xdr.ScVal): xdr.TransactionMeta {
  const sorobanMeta = new xdr.SorobanTransactionMeta({
    ext: new SorobanMetaExtCtor(0),
    events: [],
    returnValue: retval,
    diagnosticEvents: [],
  });
  const v3 = new xdr.TransactionMetaV3({
    ext: new ExtensionPointCtor(0),
    txChangesBefore: [],
    operations: [],
    txChangesAfter: [],
    sorobanMeta,
  });
  return new TransactionMetaCtor(3, v3);
}

/** A `TransactionMeta` whose return value is `ScVal::Void`. */
export function metaWithVoid(): xdr.TransactionMeta {
  return metaWithReturnValue(xdr.ScVal.scvVoid());
}

/** A `getTransaction` SUCCESS response fixture. */
export function successGetTransaction(retval: xdr.ScVal): Api.GetTransactionResponse {
  return {
    status: 'SUCCESS',
    latestLedger: 101,
    latestLedgerCloseTime: 1_700_000_000,
    oldestLedger: 1,
    ledger: 101,
    createdAt: 1_700_000_000,
    applicationOrder: 1,
    feeBump: false,
    envelopeXdr: {} as never,
    resultXdr: {} as never,
    resultMetaXdr: metaWithReturnValue(retval),
    id: '1',
  } as unknown as Api.GetTransactionResponse;
}

/** A pending `getTransaction` response (for polling tests). */
export function pendingGetTransaction(): Api.GetTransactionResponse {
  return {
    status: 'PENDING' as never,
    latestLedger: 100,
    latestLedgerCloseTime: 1_700_000_000,
    oldestLedger: 1,
    id: '1',
  } as unknown as Api.GetTransactionResponse;
}

// ── ScVal builders ───────────────────────────────────────────────────────────

export const scvU32 = (v: number): xdr.ScVal => nativeToScVal(v, { type: 'u32' });
export const scvU64 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: 'u64' });
export const scvI128 = (v: bigint): xdr.ScVal => nativeToScVal(v, { type: 'i128' });
export const scvSymbol = (v: string): xdr.ScVal => nativeToScVal(v, { type: 'symbol' });
export const scvString = (v: string): xdr.ScVal => nativeToScVal(v);
export const scvBool = (v: boolean): xdr.ScVal => nativeToScVal(v);
export const scvBytes = (v: Buffer): xdr.ScVal => nativeToScVal(v);

export const scvAddress = (v: string): xdr.ScVal => nativeToScVal(Address.fromString(v));

/** Build a struct as ScVal::Map with symbol keys. */
export function scvStruct(fields: Record<string, xdr.ScVal>): xdr.ScVal {
  return xdr.ScVal.scvMap(
    Object.entries(fields).map(
      ([key, val]) => new xdr.ScMapEntry({ key: nativeToScVal(key), val }),
    ),
  );
}

export const scvVoid = (): xdr.ScVal => xdr.ScVal.scvVoid();
export const scvVec = (items: xdr.ScVal[]): xdr.ScVal => xdr.ScVal.scvVec(items);

/** A contract enum with fields: `Vec([Symbol(variant), ...fields])`. */
export function scvEnumWithFields(variant: string, fields: xdr.ScVal[]): xdr.ScVal {
  return scvVec([scvSymbol(variant), ...fields]);
}
