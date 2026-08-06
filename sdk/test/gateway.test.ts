import { afterEach, describe, expect, it, vi } from 'vitest';
import { Keypair, type xdr } from '@stellar/stellar-sdk';

import { decode } from '../src/convert.js';
import { GatewayError, SorobanGateway } from '../src/client.js';
import {
  errorSimulation,
  invokedFunctionName,
  makeGateway,
  mockPrepareTransaction,
  pendingGetTransaction,
  scvI128,
  successGetTransaction,
  successSimulation,
  testAccount,
  TEST_CONTRACT,
} from './helpers.js';

function mockRead(gateway: SorobanGateway, retval: xdr.ScVal) {
  vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
  return vi.spyOn(gateway.server, 'simulateTransaction').mockResolvedValue(successSimulation(retval));
}

describe('SorobanGateway.read', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a contract-call transaction and decodes the simulated return value', async () => {
    const gateway = makeGateway();
    const simulate = mockRead(gateway, scvI128(987_654_321n));

    const result = await gateway.read(TEST_CONTRACT, 'get_total_volume_converted', [], decode);

    expect(simulate).toHaveBeenCalledTimes(1);
    expect(invokedFunctionName(simulate.mock.calls[0]![0] as never)).toBe(
      'get_total_volume_converted',
    );
    expect(result).toBe(987_654_321n);
  });

  it('decodes through the provided decodeResult', async () => {
    const gateway = makeGateway();
    mockRead(gateway, scvI128(1_000_000n));

    const result = await gateway.read(TEST_CONTRACT, 'get_total_volume_converted', [], (v) =>
      decode(v) === 1_000_000n ? 'matched' : 'mismatch',
    );
    expect(result).toBe('matched');
  });

  it('throws GatewayError with the contract error code on failed simulation', async () => {
    const gateway = makeGateway();
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    vi.spyOn(gateway.server, 'simulateTransaction').mockResolvedValue(
      errorSimulation('HostError: Error(Contract, #9)'),
    );

    await expect(
      gateway.read(TEST_CONTRACT, 'get_conversion_rate', [], () => null),
    ).rejects.toMatchObject({
      name: 'GatewayError',
      code: 9,
    });
  });
});

describe('SorobanGateway.submit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prepares, signs, sends, waits, and decodes the return value', async () => {
    const keypair = Keypair.random();
    const gateway = makeGateway(keypair);
    const retval = scvI128(2_500_000n);

    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    const prepare = mockPrepareTransaction(gateway);
    const send = vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'txhash123',
      latestLedger: 100,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);
    vi.spyOn(gateway.server, 'getTransaction').mockResolvedValue(successGetTransaction(retval));

    const result = await gateway.submit(TEST_CONTRACT, 'collect_fee', [], (v) =>
      decode(v) === 2_500_000n ? 2_500_000n : 0n,
    );

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('SUCCESS');
    expect(result.hash).toBe('txhash123');
    expect(result.result).toBe(2_500_000n);
  });

  it('polls until the transaction settles', async () => {
    const gateway = makeGateway();
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    mockPrepareTransaction(gateway);
    vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'PENDING',
      hash: 'txhash123',
      latestLedger: 100,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);

    const getTransaction = vi
      .spyOn(gateway.server, 'getTransaction')
      .mockResolvedValueOnce(pendingGetTransaction())
      .mockResolvedValueOnce(successGetTransaction(scvI128(5n)));

    const result = await gateway.submit(TEST_CONTRACT, 'lock', [], (v) => decode(v));
    expect(getTransaction).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('SUCCESS');
  });

  it('throws when no signer is configured', async () => {
    const gateway = new SorobanGateway({
      rpcUrl: 'https://rpc.invalid',
      networkPassphrase: 'Test SDF Network ; September 2015',
      publicKey: Keypair.random().publicKey(),
    });
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    mockPrepareTransaction(gateway);

    await expect(gateway.submit(TEST_CONTRACT, 'lock', [], () => undefined)).rejects.toThrow(
      /No signer configured/i,
    );
  });

  it('throws GatewayError when the network rejects the transaction', async () => {
    const gateway = makeGateway();
    vi.spyOn(gateway.server, 'getAccount').mockResolvedValue(testAccount());
    mockPrepareTransaction(gateway);
    vi.spyOn(gateway.server, 'sendTransaction').mockResolvedValue({
      status: 'ERROR',
      errorResult: { toXDR: () => 'tx-rejected' } as never,
      latestLedger: 100,
      latestLedgerCloseTime: 1,
      oldestLedger: 1,
      id: '1',
    } as never);

    await expect(gateway.submit(TEST_CONTRACT, 'lock', [], () => undefined)).rejects.toBeInstanceOf(
      GatewayError,
    );
  });
});
