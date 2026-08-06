import { afterEach, describe, expect, it, vi } from 'vitest';
import { Keypair, scValToNative, xdr } from '@stellar/stellar-sdk';

import { BatchRewardsClient } from '../src/contracts/batch-rewards.js';
import { BatchTokenMintClient } from '../src/contracts/batch-token-mint.js';
import { BatchWalletCreationClient } from '../src/contracts/batch-wallet-creation.js';
import { AllowancesClient } from '../src/contracts/allowances.js';
import { RewardsClient } from '../src/contracts/rewards.js';
import { MerchantTaggingClient } from '../src/contracts/merchant-tagging.js';
import { UsersClient } from '../src/contracts/users.js';
import { AccessControlClient } from '../src/contracts/access-control.js';
import { TransactionAnalyticsClient } from '../src/contracts/transaction-analytics.js';
import { ActivityFeedClient } from '../src/contracts/activity-feed.js';
import { CurrencyConversionClient } from '../src/contracts/currency-conversion.js';

import {
  invokedArgs,
  invokedFunctionName,
  makeGateway,
  metaWithReturnValue,
  mockPrepareTransaction,
  scvAddress,
  scvBool,
  scvEnumWithFields,
  scvI128,
  scvString,
  scvStruct,
  scvSymbol,
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

function mockSubmit(gateway: ReturnType<typeof makeGateway>, retval: xdr.ScVal) {
  mockPrepareTransaction(gateway);
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
    resultMetaXdr: metaWithReturnValue(retval),
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
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BatchRewardsClient', () => {
  it('encodes idempotency token as bytes and decodes BatchRewardResult', async () => {
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
      resultMetaXdr: metaWithReturnValue(
        scvStruct({
          total_requests: scvU32(2),
          successful: scvU32(1),
          failed: scvU32(1),
          total_distributed: scvI128(1_500n),
          results: scvVec([
            scvEnumWithFields('Success', [scvAddress(USER), scvI128(1_000n)]),
            scvEnumWithFields('Failure', [scvAddress(ADMIN), scvI128(500n), scvU32(5)]),
          ]),
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

    const client = new BatchRewardsClient(gateway, TEST_CONTRACT);
    const result = await client.distributeRewards(ADMIN, TOKEN, Buffer.from('tok-1'), [
      { recipient: USER, amount: 1_000n },
      { recipient: ADMIN, amount: 500n },
    ]);

    const call = prepare.mock.calls[0]![0] as never as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    expect(invokedFunctionName(call)).toBe('distribute_rewards');
    expect(invokedArgs(call)[2]?.switch().name).toBe('scvBytes');
    expect(result.successful).toBe(1);
    expect(result.totalDistributed).toBe(1_500n);
    expect(result.results[0]?.status).toBe('success');
    expect(result.results[1]?.status).toBe('failure');
  });
});

describe('BatchTokenMintClient', () => {
  it('decodes BatchMintResult with nested TokenMinted on success', async () => {
    const gateway = makeGateway();
    mockSubmit(
      gateway,
      scvStruct({
        batch_id: scvU64(2n),
        token_address: scvAddress(TOKEN),
        total_requests: scvU32(1),
        successful: scvU32(1),
        failed: scvU32(0),
        results: scvVec([
          scvEnumWithFields('Success', [
            scvStruct({
              token_address: scvAddress(TOKEN),
              recipient: scvAddress(USER),
              amount: scvI128(5_000n),
              minted_at: scvU64(1_600_000_000n),
            }),
          ]),
        ]),
        metrics: scvStruct({
          total_requests: scvU32(1),
          successful_mints: scvU32(1),
          failed_mints: scvU32(0),
          total_amount_minted: scvI128(5_000n),
          avg_mint_amount: scvI128(5_000n),
          processed_at: scvU64(1_600_000_000n),
        }),
      }),
    );

    const client = new BatchTokenMintClient(gateway, TEST_CONTRACT);
    const result = await client.batchMintTokens(ADMIN, TOKEN, [
      { recipient: USER, amount: 5_000n },
    ]);
    expect(result.batchId).toBe(2n);
    expect(result.results[0]?.status).toBe('success');
    if (result.results[0]?.status === 'success') {
      expect(result.results[0].minted.amount).toBe(5_000n);
    }
  });
});

describe('BatchWalletCreationClient', () => {
  it('decodes BatchCreateResult with wallet addresses', async () => {
    const gateway = makeGateway();
    mockSubmit(
      gateway,
      scvStruct({
        total_requests: scvU32(1),
        successful: scvU32(1),
        failed: scvU32(0),
        results: scvVec([scvEnumWithFields('Success', [scvAddress(USER)])]),
      }),
    );

    const client = new BatchWalletCreationClient(gateway, TEST_CONTRACT);
    const result = await client.batchCreateWallets(ADMIN, [{ owner: USER }]);
    expect(result.successful).toBe(1);
    expect(result.results[0]?.status).toBe('success');
    if (result.results[0]?.status === 'success') {
      expect(result.results[0].wallet).toEqual(expect.any(String));
    }
  });
});

describe('AllowancesClient', () => {
  it('encodes the frequency as a symbol on create_allowance', async () => {
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
      resultMetaXdr: metaWithReturnValue(scvU64(9n)),
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

    const client = new AllowancesClient(gateway, TEST_CONTRACT);
    const id = await client.createAllowance(USER, ADMIN, TOKEN, 1_000n, 'Weekly', 1_700_000_000n);

    const call = prepare.mock.calls[0]![0] as never as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    expect(invokedFunctionName(call)).toBe('create_allowance');
    expect(scValToNative(invokedArgs(call)[4]!)).toBe('Weekly');
    expect(id).toBe(9n);
  });
});

describe('RewardsClient', () => {
  it('decodes get_account or null', async () => {
    const gateway = makeGateway();
    mockSimulate(
      gateway,
      scvStruct({
        owner: scvAddress(USER),
        balance: scvI128(250n),
        lifetime_earned: scvI128(500n),
        lifetime_claimed: scvI128(250n),
        created_at: scvU64(1_600_000_000n),
        last_updated: scvU64(1_600_000_100n),
      }),
    );
    const client = new RewardsClient(gateway, TEST_CONTRACT);
    const account = await client.getAccount(USER);
    expect(account?.balance).toBe(250n);
    expect(account?.lifetimeEarned).toBe(500n);

    mockSimulate(gateway, scvVoid());
    await expect(client.getAccount(ADMIN)).resolves.toBeNull();
  });
});

describe('MerchantTaggingClient', () => {
  it('decodes get_merchant with optional address', async () => {
    const gateway = makeGateway();
    mockSimulate(
      gateway,
      scvStruct({
        id: scvSymbol('STARBUCKS'),
        name: scvString('Starbucks'),
        tags: scvVec([scvSymbol('food')]),
        address: scvVoid(),
        registered_at: scvU64(1_600_000_000n),
        active: scvBool(true),
      }),
    );
    const client = new MerchantTaggingClient(gateway, TEST_CONTRACT);
    const merchant = await client.getMerchant('STARBUCKS');
    expect(merchant?.name).toBe('Starbucks');
    expect(merchant?.tags).toEqual(['food']);
    expect(merchant?.address).toBeNull();
  });
});

describe('UsersClient', () => {
  it('encodes update_user_profile optional args as void or value', async () => {
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
      resultMetaXdr: metaWithReturnValue(scvBool(true)),
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

    const client = new UsersClient(gateway, TEST_CONTRACT);
    const ok = await client.updateUserProfile(USER, 'USDC', null);

    const call = prepare.mock.calls[0]![0] as never as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    const args = invokedArgs(call);
    expect(args[1]?.switch().name).toBe('scvString');
    expect(args[2]?.switch().name).toBe('scvVoid');
    expect(ok).toBe(true);
  });
});

describe('AccessControlClient', () => {
  it('encodes the role as a symbol on grant_role', async () => {
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
      resultMetaXdr: metaWithReturnValue(scvVoid()),
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

    const client = new AccessControlClient(gateway, TEST_CONTRACT);
    await client.grantRole(ADMIN, USER, 'Operator');

    const call = prepare.mock.calls[0]![0] as never as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    expect(invokedFunctionName(call)).toBe('grant_role');
    expect(scValToNative(invokedArgs(call)[2]!)).toBe('Operator');
  });
});

describe('TransactionAnalyticsClient', () => {
  it('decodes get_batch_metrics', async () => {
    const gateway = makeGateway();
    mockSimulate(
      gateway,
      scvStruct({
        tx_count: scvU32(10),
        total_volume: scvI128(100_000n),
        avg_amount: scvI128(10_000n),
        min_amount: scvI128(100n),
        max_amount: scvI128(50_000n),
        unique_senders: scvU32(3),
        unique_recipients: scvU32(2),
        total_fees: scvI128(500n),
        processed_at: scvU64(1_600_000_000n),
      }),
    );
    const client = new TransactionAnalyticsClient(gateway, TEST_CONTRACT);
    const metrics = await client.getBatchMetrics(1n);
    expect(metrics?.txCount).toBe(10);
    expect(metrics?.totalVolume).toBe(100_000n);
  });
});

describe('ActivityFeedClient', () => {
  it('encodes record_event event_type as a symbol', async () => {
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
      resultMetaXdr: metaWithReturnValue(scvU64(1n)),
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

    const client = new ActivityFeedClient(gateway, TEST_CONTRACT);
    const seq = await client.recordEvent('login');

    const call = prepare.mock.calls[0]![0] as never as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    expect(invokedFunctionName(call)).toBe('record_event');
    expect(scValToNative(invokedArgs(call)[0]!)).toBe('login');
    expect(seq).toBe(1n);
  });
});

describe('CurrencyConversionClient', () => {
  it('encodes the ConversionRate struct for convert', async () => {
    const gateway = makeGateway();
    let builtTx: never | null = null;
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    vi.spyOn(gateway.server, 'simulateTransaction').mockImplementation(async (tx) => {
      builtTx = tx as never;
      return successSimulation(scvI128(2_000n));
    });

    const client = new CurrencyConversionClient(gateway, TEST_CONTRACT);
    const out = await client.convert(1_000n, {
      fromCurrency: 'USDC',
      toCurrency: 'EURC',
      rateNumerator: 2n,
      rateDenominator: 1n,
    });

    const call = builtTx as unknown as {
      operations: Array<{ func: { invokeContract: () => { args: () => xdr.ScVal[]; functionName: () => { toString: () => string } } } }>;
    };
    expect(invokedFunctionName(call)).toBe('convert');
    const rate = scValToNative(invokedArgs(call)[1]!) as Record<string, unknown>;
    expect(rate.from_currency).toBe('USDC');
    expect(rate.rate_numerator).toBe(2n);
    expect(out).toBe(2_000n);
  });
});
