/**
 * Stellar Payment Gateway JS SDK.
 *
 * A typed TypeScript client layer over the on-chain Soroban contracts:
 * batch transfers, transactions, recurring payments, escrow (v1 & v2),
 * currency conversion, fee engine, account status, ZK proof verifier,
 * and multi-currency wallet.
 *
 * @example
 * ```ts
 * import { Keypair } from '@stellar/stellar-sdk';
 * import { SorobanGateway, BatchTransferClient, TESTNET } from 'stellar-payment-gateway-js';
 *
 * const keypair = Keypair.random();
 * const gateway = new SorobanGateway({
 *   ...TESTNET,
 *   publicKey: keypair.publicKey(),
 *   signer: keypair,
 * });
 *
 * const bt = new BatchTransferClient(gateway, contractId);
 * const result = await bt.batchTransfer(caller, token, [
 *   { recipient: 'G...', amount: 1_000_000n },
 * ]);
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

// ── Contract clients ─────────────────────────────────────────────────────────

export { BatchConversionClient } from './contracts/batch-conversion.js';
export { BatchTransferClient } from './contracts/batch-transfer.js';
export { TransactionsClient } from './contracts/transactions.js';
export { RecurringPaymentClient } from './contracts/recurring-payment.js';
export { EscrowClient } from './contracts/escrow.js';
export { EscrowV2Client } from './contracts/escrow-v2.js';
export { FeeClient } from './contracts/fee.js';
export { AccountStatusClient } from './contracts/account-status.js';
export { ZkVerifierClient } from './contracts/zk-verifier.js';
export { MultiCurrencyWalletClient } from './contracts/multi-currency-wallet.js';

// ── Types ────────────────────────────────────────────────────────────────────

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

// Batch transfer types
export type {
  TransferRequestInput,
  BurnRequestInput,
  TransferResultItem,
  BurnResultItem,
  BatchTransferResult,
  BatchBurnResult,
} from './contracts/batch-transfer.js';

// Transaction types
export type {
  TransactionRecord,
  TransactionInput,
  TransactionStatus,
} from './contracts/transactions.js';

// Recurring payment types
export type {
  RecurringPayment,
  IncomeStream,
} from './contracts/recurring-payment.js';

// Escrow types
export type {
  EscrowReleaseRequest,
  EscrowReversalRequest,
  ReleaseResultItem,
  ReversalResultItem,
  BatchReleaseResult,
  BatchReversalResult,
  EscrowRecord,
} from './contracts/escrow.js';

// Escrow v2 types
export type {
  EscrowV2Record,
} from './contracts/escrow-v2.js';
