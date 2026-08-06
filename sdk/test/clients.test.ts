import { afterEach, describe, expect, it, vi } from 'vitest';
import { Keypair, scValToNative, xdr } from '@stellar/stellar-sdk';

import { BatchConversionClient } from '../src/contracts/batch-conversion.js';
import { FeeClient } from '../src/contracts/fee.js';
import { AccountStatusClient } from '../src/contracts/account-status.js';
import { ZkVerifierClient } from '../src/contracts/zk-verifier.js';
import { MultiCurrencyWalletClient } from '../src/contracts/multi-currency-wallet.js';

import {
  invokedArgs,
  invokedFunctionName,
  makeGateway,
  metaWithReturnValue,
  metaWithVoid,
  mockPrepareTransaction,
  scvAddress,
  scvBool,
  scvBytes,
  scvEnumWithFields,
  scvI128,
  scvString,
  scvStruct,
  scvU32,
  scvU64,
  scvVec,
  scvVoid,
  successSimulation,
  testAccount,
  TEST_CONTRACT,
} from './helpers.js';

const USER = Keypair.random().publicKey();
const ADMIN = Keypair.random().publicKey();
const TOKEN = Keypair.random().publicKey();

function mockSimulate(gateway: ReturnType<typeof makeGateway>, retval: xdr.ScVal) {
  vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
  vi.spyOn(gateway.server, 'simulateTransaction').mockResolvedValue(successSimulation(retval));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BatchConversionClient', () => {
  it('encodes a batch of ConversionRequest structs as a vec of maps', async () => {
    const gateway = makeGateway();
    const prepare = mockPrepareTransaction(gateway);
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'h',
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);
    vi.spyOn(gateway.server, 'getTransaction').mockResolvedValue({
      status: 'SUCCESS',
      resultMetaXdr: metaWithReturnValue(batchResultScVal()),
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      ledger: 1,
      createdAt: 1,
      applicationOrder: 1,
      feeBump: false,
      envelopeXdr: {} as never,
      resultXdr: {} as never,
      id: '1',
    } as never);

    const client = new BatchConversionClient(gateway, TEST_CONTRACT);
    await client.batchConvertCurrency([
      {
        user: USER,
        fromAsset: TOKEN,
        toAsset: ADMIN,
        amountIn: 1_000_000n,
        minAmountOut: 980_000n,
      },
    ]);

    const call = prepare.mock.calls[0]![0] as never as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    expect(invokedFunctionName(call)).toBe('batch_convert_currency');
    const [arg] = invokedArgs(call);
    expect(arg?.switch().name).toBe('scvVec');
    // Round-trip: decode the encoded vec back and verify the struct fields.
    const decoded = arg ? scValToNative(arg) : null;
    expect(decoded).toHaveLength(1);
    const first = (decoded as Array<Record<string, unknown>>)[0]!;
    expect(first.user).toEqual(expect.any(String));
    expect(first.from_asset).toEqual(expect.any(String));
    expect(first.amount_in).toBe(1_000_000n);
    expect(first.min_amount_out).toBe(980_000n);
  });

  it('decodes a BatchConversionResult with mixed success/failure items', async () => {
    const gateway = makeGateway();
    mockSimulate(gateway, batchResultScVal());

    const client = new BatchConversionClient(gateway, TEST_CONTRACT);
    const prepare = mockPrepareTransaction(gateway);
    vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'h2',
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);
    const meta = metaWithReturnValue(batchResultScVal());
    vi.spyOn(gateway.server, 'getTransaction').mockResolvedValue({
      status: 'SUCCESS',
      resultMetaXdr: meta,
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      ledger: 1,
      createdAt: 1,
      applicationOrder: 1,
      feeBump: false,
      envelopeXdr: {} as never,
      resultXdr: {} as never,
      id: '1',
    } as never);

    const result = await client.batchConvertCurrency([
      { user: USER, fromAsset: TOKEN, toAsset: ADMIN, amountIn: 1000n, minAmountOut: 900n },
      { user: ADMIN, fromAsset: TOKEN, toAsset: USER, amountIn: 500n, minAmountOut: 450n },
    ]);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(result.totalRequests).toBe(2);
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.totalConverted).toBe(1_000_000n);
    expect(result.results[0]?.status).toBe('success');
    if (result.results[0]?.status === 'success') {
      expect(result.results[0].amountOut).toBe(1_000_000n);
    }
    expect(result.results[1]?.status).toBe('failure');
  });

  it('reads get_conversion_rate and returns null for an unset rate', async () => {
    const gateway = makeGateway();
    mockSimulate(gateway, scvVoid());

    const client = new BatchConversionClient(gateway, TEST_CONTRACT);
    await expect(client.getConversionRate(TOKEN, ADMIN)).resolves.toBeNull();
  });

  it('reads get_conversion_rate and decodes a configured rate', async () => {
    const gateway = makeGateway();
    mockSimulate(
      gateway,
      scvStruct({
        from_asset: scvAddress(TOKEN),
        to_asset: scvAddress(ADMIN),
        rate_numerator: scvI128(2n),
        rate_denominator: scvI128(3n),
      }),
    );

    const client = new BatchConversionClient(gateway, TEST_CONTRACT);
    await expect(client.getConversionRate(TOKEN, ADMIN)).resolves.toEqual({
      fromAsset: expect.any(String),
      toAsset: expect.any(String),
      rateNumerator: 2n,
      rateDenominator: 3n,
    });
  });
});

describe('FeeClient', () => {
  it('reads get_fee_config and decodes the FeeConfig struct', async () => {
    const gateway = makeGateway();
    mockSimulate(
      gateway,
      scvStruct({
        admin: scvAddress(ADMIN),
        token: scvAddress(TOKEN),
        treasury: scvAddress(USER),
        fee_bps: scvU32(300),
        min_fee: scvI128(10n),
        max_fee: scvI128(1_000_000n),
        is_locked: scvBool(false),
        current_cycle: scvU64(7n),
      }),
    );

    const client = new FeeClient(gateway, TEST_CONTRACT);
    const config = await client.getFeeConfig();
    expect(config).toEqual({
      admin: expect.any(String),
      token: expect.any(String),
      treasury: expect.any(String),
      feeBps: 300,
      minFee: 10n,
      maxFee: 1_000_000n,
      isLocked: false,
      currentCycle: 7n,
    });
  });

  it('decodes BatchFeeResult from collectFeeBatch', async () => {
    const gateway = makeGateway();
    const prepare = mockPrepareTransaction(gateway);
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'h3',
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);
    vi.spyOn(gateway.server, 'getTransaction').mockResolvedValue({
      status: 'SUCCESS',
      resultMetaXdr: metaWithReturnValue(
        scvStruct({
          batch_size: scvU32(2),
          total_amount: scvI128(3000n),
          cycle: scvU64(1n),
          pending_fees: scvI128(3000n),
        }),
      ),
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      ledger: 1,
      createdAt: 1,
      applicationOrder: 1,
      feeBump: false,
      envelopeXdr: {} as never,
      resultXdr: {} as never,
      id: '1',
    } as never);

    const client = new FeeClient(gateway, TEST_CONTRACT);
    const result = await client.collectFeeBatch(USER, [1000n, 2000n]);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      batchSize: 2,
      totalAmount: 3000n,
      cycle: 1n,
      pendingFees: 3000n,
    });
  });

  it('decodes getUserTier as null when unset', async () => {
    const gateway = makeGateway();
    mockSimulate(gateway, scvVoid());
    const client = new FeeClient(gateway, TEST_CONTRACT);
    await expect(client.getUserTier(USER)).resolves.toBeNull();
  });
});

describe('AccountStatusClient', () => {
  it('decodes AccountStatusRecord with an optional frozen_by', async () => {
    const gateway = makeGateway();
    mockSimulate(
      gateway,
      scvStruct({
        frozen: scvBool(true),
        frozen_by: scvAddress(ADMIN),
        reason: scvString('fraud'),
        frozen_at: scvU64(1700000000n),
        expires_at: scvU64(0n),
        freeze_count: scvU32(2),
      }),
    );

    const client = new AccountStatusClient(gateway, TEST_CONTRACT);
    const record = await client.getStatus(USER);
    expect(record.frozen).toBe(true);
    expect(record.frozenBy).toEqual(expect.any(String));
    expect(record.reason).toBe('fraud');
    expect(record.frozenAt).toBe(1700000000n);
    expect(record.expiresAt).toBe(0n);
    expect(record.freezeCount).toBe(2);
  });

  it('maps None frozen_by to null', async () => {
    const gateway = makeGateway();
    mockSimulate(
      gateway,
      scvStruct({
        frozen: scvBool(false),
        frozen_by: scvVoid(),
        reason: scvString(''),
        frozen_at: scvU64(0n),
        expires_at: scvU64(0n),
        freeze_count: scvU32(0),
      }),
    );

    const client = new AccountStatusClient(gateway, TEST_CONTRACT);
    const record = await client.getStatus(USER);
    expect(record.frozenBy).toBeNull();
  });

  it('decodes getAdmins as a string array', async () => {
    const gateway = makeGateway();
    mockSimulate(gateway, scvVec([scvAddress(ADMIN), scvAddress(USER)]));
    const client = new AccountStatusClient(gateway, TEST_CONTRACT);
    const admins = await client.getAdmins();
    expect(admins).toHaveLength(2);
    expect(admins[0]).toEqual(expect.any(String));
  });
});

describe('ZkVerifierClient', () => {
  it('encodes the 32-byte verifier pk and decodes getVerifierPk', async () => {
    const gateway = makeGateway();
    const pk = Buffer.alloc(32, 7);
    const prepare = mockPrepareTransaction(gateway);
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'h4',
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);
    vi.spyOn(gateway.server, 'getTransaction').mockResolvedValue({
      status: 'SUCCESS',
      resultMetaXdr: metaWithVoid(),
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      ledger: 1,
      createdAt: 1,
      applicationOrder: 1,
      feeBump: false,
      envelopeXdr: {} as never,
      resultXdr: {} as never,
      id: '1',
    } as never);

    const client = new ZkVerifierClient(gateway, TEST_CONTRACT);
    await client.initialize(ADMIN, pk);
    const call = prepare.mock.calls[0]![0] as never as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    expect(invokedFunctionName(call)).toBe('initialize');
    const args = invokedArgs(call);
    expect(args[0]?.switch().name).toBe('scvAddress');
    expect(args[1]?.switch().name).toBe('scvBytes');
    expect(Buffer.from(args[1]!.bytes())).toEqual(pk);
  });

  it('decodes getVerifierPk as Buffer or null', async () => {
    const gateway = makeGateway();
    mockSimulate(gateway, scvBytes(Buffer.alloc(32, 9)));
    const client = new ZkVerifierClient(gateway, TEST_CONTRACT);
    await expect(client.getVerifierPk()).resolves.toEqual(Buffer.alloc(32, 9));

    mockSimulate(gateway, scvVoid());
    await expect(client.getVerifierPk()).resolves.toBeNull();
  });

  it('rejects a wrong-length verifier pk before building the tx', () => {
    const gateway = makeGateway();
    const client = new ZkVerifierClient(gateway, TEST_CONTRACT);
    expect(() => client.initialize(ADMIN, Buffer.alloc(31, 1))).toThrow(/expected 32 bytes/i);
  });
});

describe('MultiCurrencyWalletClient', () => {
  it('decodes a ConversionResult from convert_currency', async () => {
    const gateway = makeGateway();
    const prepare = mockPrepareTransaction(gateway);
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'h5',
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);
    vi.spyOn(gateway.server, 'getTransaction').mockResolvedValue({
      status: 'SUCCESS',
      resultMetaXdr: metaWithReturnValue(
        scvStruct({
          from_amount: scvI128(1000n),
          to_amount: scvI128(2000n),
          rate: scvI128(2n),
          timestamp: scvU64(1700000000n),
        }),
      ),
      latestLedger: 1,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      ledger: 1,
      createdAt: 1,
      applicationOrder: 1,
      feeBump: false,
      envelopeXdr: {} as never,
      resultXdr: {} as never,
      id: '1',
    } as never);

    const client = new MultiCurrencyWalletClient(gateway, TEST_CONTRACT);
    const result = await client.convertCurrency({
      fromAsset: 'USDC',
      toAsset: 'EURC',
      amount: 1000n,
      minReceived: 1950n,
    });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      fromAmount: 1000n,
      toAmount: 2000n,
      rate: 2n,
      timestamp: 1700000000n,
    });
  });
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

function batchResultScVal(): xdr.ScVal {
  return scvStruct({
    total_requests: scvU32(2),
    successful: scvU32(1),
    failed: scvU32(1),
    total_converted: scvI128(1_000_000n),
    results: scvVec([
      scvEnumWithFields('Success', [
        scvAddress(USER),
        scvAddress(TOKEN),
        scvAddress(ADMIN),
        scvI128(1000n),
        scvI128(1_000_000n),
      ]),
      scvEnumWithFields('Failure', [
        scvAddress(ADMIN),
        scvAddress(TOKEN),
        scvAddress(USER),
        scvI128(500n),
        scvU32(6),
      ]),
    ]),
  });
}

