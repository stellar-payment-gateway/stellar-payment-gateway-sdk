/**
 * Stellar Payment Gateway JS SDK.
 *
 * A typed TypeScript client layer over the on-chain Soroban contracts:
 * batch currency conversion, the fee engine, account status (freeze/controls),
 * the ZK proof verifier, and the multi-currency wallet.
 *
 * @example
 * ```ts
 * import { Keypair } from '@stellar/stellar-sdk';
 * import { SorobanGateway, BatchConversionClient, TESTNET } from 'stellar-payment-gateway-js';
 *
 * const keypair = Keypair.random();
 * const gateway = new SorobanGateway({
 *   ...TESTNET,
 *   publicKey: keypair.publicKey(),
 *   signer: keypair,
 * });
 *
 * const batch = new BatchConversionClient(gateway, contractId);
 * const result = await batch.batchConvertCurrency([{
 *   user, fromAsset, toAsset, amountIn: 1_000_000n, minAmountOut: 980_000n,
 * }]);
 * ```
 */
export { SorobanGateway, GatewayError, assertResult, MAINNET, TESTNET } from './client.js';
export type {
  GatewayOptions,
  SubmitOptions,
  SubmitResult,
  TransactionSigner,
} from './client.js';

export * as convert from './convert.js';

export { BatchConversionClient } from './contracts/batch-conversion.js';
export { FeeClient } from './contracts/fee.js';
export { AccountStatusClient } from './contracts/account-status.js';
export { ZkVerifierClient } from './contracts/zk-verifier.js';
export { MultiCurrencyWalletClient } from './contracts/multi-currency-wallet.js';

export type {
  BatchConversionResult,
  ConversionRate,
  ConversionRequestInput,
  ConversionResultItem,
} from './types.js';
export type {
  BatchFeeResult,
  FeeConfig,
  ReconciliationResult,
} from './types.js';
export type {
  AccountStatusRecord,
} from './types.js';
export type {
  WalletConversionRequest,
  WalletConversionResult,
} from './types.js';
