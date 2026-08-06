# stellar-payment-gateway-js

TypeScript client SDK for the Stellar Payment Gateway Soroban contracts.

Wraps the on-chain contracts behind typed, ergonomic clients. Every workspace
contract has a matching client:

| Area | Clients |
| ---- | ------- |
| Core | `BatchConversionClient`, `BatchTransferClient`, `TransactionsClient`, `RecurringPaymentClient`, `EscrowClient`, `EscrowV2Client`, `FeeClient`, `AccountStatusClient`, `ZkVerifierClient`, `MultiCurrencyWalletClient` |
| Savings & budgets | `SavingsClient`, `SavingsGoalsClient`, `BudgetClient`, `SharedBudgetsClient`, `BudgetAllocationClient`, `SpendingLimitsClient`, `SpendingPolicyClient`, `SpendingRulesClient`, `SpendingCategoriesClient` |
| Payments & treasury | `BatchRewardsClient`, `BatchTokenMintClient`, `BatchPaymentRemindersClient`, `BatchNotificationsClient`, `BatchHistoryClient`, `BatchWalletCreationClient`, `TreasuryClient`, `AllowancesClient`, `RewardsClient`, `PenaltyClient`, `NotificationClient`, `ActivityFeedClient` |
| Admin & governance | `AdminClient`, `PausableClient`, `AccessControlClient`, `AssetControlClient`, `UserClient`, `UsersClient`, `WalletStatusClient`, `TransactionalClient`, `TransactionValidationClient`, `TransactionAnalyticsClient`, `CurrencyConversionClient`, `MerchantTaggingClient`, `CategoryAnalyticsClient`, `TransferClient`, `BalanceClient` |

## Install

```bash
npm install stellar-payment-gateway-js
```

## Quick start

```ts
import { Keypair } from '@stellar/stellar-sdk';
import {
  SorobanGateway,
  BatchConversionClient,
  FeeClient,
  TESTNET,
} from 'stellar-payment-gateway-js';

// 1. Configure the gateway (RPC + signer)
const keypair = Keypair.random();
const gateway = new SorobanGateway({
  ...TESTNET,
  publicKey: keypair.publicKey(),
  signer: keypair, // or a custom signer function for wallet integrations
});

// 2. Wrap the deployed contracts
const batch = new BatchConversionClient(gateway, 'C...batch-contract-id');
const fee = new FeeClient(gateway, 'C...fee-contract-id');

// 3. Read (simulate, no state change)
const volume = await batch.getTotalVolumeConverted(); // bigint

// 4. Submit (prepare → sign → send → wait → decode)
const result = await batch.batchConvertCurrency([
  {
    user: 'G...recipient',
    fromAsset: 'C...usdc',
    toAsset: 'C...eurc',
    amountIn: 1_000_000n,
    minAmountOut: 980_000n,
  },
]);
console.log(result.successful, result.failed, result.totalConverted);

// 5. Fee engine accessors
const config = await fee.getFeeConfig();
console.log(config.feeBps, config.minFee, config.maxFee);
```

## API overview

### `SorobanGateway`

Core client that owns the transaction lifecycle.

- `new SorobanGateway({ rpcUrl, networkPassphrase, publicKey, signer?, fee?, timeout?, waitTimeoutMs? })`
- `gateway.read<T>(contractId, method, args, decodeResult)` — simulate-only call; returns the decoded return value.
- `gateway.submit<T>(contractId, method, args, decodeResult)` — submits and waits for the transaction; returns `{ hash, status, result }`.
- Constants: `MAINNET` and `TESTNET` bundle the RPC URL + network passphrase.

**Signing:** pass a `Keypair` in `GatewayOptions`, a custom `(tx) => Promise<Transaction>` signer (for wallet integrations), or provide one per call.

**Errors:** RPC/contract failures raise `GatewayError` (with a `code` for contract errors).

### Conventions

- Amounts are `bigint` end-to-end (contract `i128`/`u64`), never lossy `number`s.
- Addresses are plain `C...`/`G...` strkeys.
- Optional fields decode to `null`.
- Methods that change state (`initialize`, `collectFee`, `freezeAccount`, …) go through `submit`; accessors go through `read`.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit over src + test
npm test            # vitest (31 tests: encoding, decoding, mocked RPC lifecycle)
npm run build       # emit dist/
```

The test suite runs against a fully mocked RPC server — no network access required.

## Feature coverage

All contract clients follow the same conventions: state-changing methods go
through `submit` (returning a decoded `SubmitResult` or a decoded value via
`assertResult`), accessors go through `read`. Amounts are `bigint`, addresses
are strkeys, optional fields decode to `null`, and `Option<T>` arguments accept
`null`/`undefined`. Nested contract enums decode into discriminated unions
(e.g. `{ status: 'success' } | { status: 'failure', errorCode }`).

See `src/contracts/*.ts` for the exact contract method each client wraps.
