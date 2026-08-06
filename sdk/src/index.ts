/**
 * Stellar Payment Gateway JS SDK.
 *
 * A typed TypeScript client layer over the on-chain Soroban contracts:
 * batch transfers, transactions, recurring payments, escrow (v1 & v2),
 * currency conversion, fee engine, account status, ZK proof verifier,
 * multi-currency wallet, savings & savings goals, budgets (personal, shared,
 * allocation), spending limits/rules/policy/categories, batch rewards / token
 * mint / wallet creation / payment reminders / notifications, treasury,
 * allowances, rewards, penalty, notification, activity feed, admin, pausable,
 * access control, asset control, users, wallet status, transactional store,
 * transaction validation & analytics, merchant tagging, category analytics,
 * transfer, and balance.
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

// Savings & budgets
export { SavingsClient } from './contracts/savings.js';
export { SavingsGoalsClient } from './contracts/savings-goals.js';
export { BudgetClient } from './contracts/budget.js';
export { SharedBudgetsClient } from './contracts/shared-budgets.js';
export { BudgetAllocationClient } from './contracts/budget-allocation.js';
export { SpendingLimitsClient } from './contracts/spending-limits.js';
export { SpendingPolicyClient } from './contracts/spending-policy.js';
export { SpendingRulesClient } from './contracts/spending-rules.js';
export { SpendingCategoriesClient } from './contracts/spending-categories.js';

// Payments & treasury
export { BatchRewardsClient } from './contracts/batch-rewards.js';
export { BatchTokenMintClient } from './contracts/batch-token-mint.js';
export { BatchPaymentRemindersClient } from './contracts/batch-payment-reminders.js';
export { BatchNotificationsClient } from './contracts/batch-notifications.js';
export { BatchHistoryClient } from './contracts/batch-history.js';
export { BatchWalletCreationClient } from './contracts/batch-wallet-creation.js';
export { TreasuryClient } from './contracts/treasury.js';
export { AllowancesClient } from './contracts/allowances.js';
export { RewardsClient } from './contracts/rewards.js';
export { PenaltyClient } from './contracts/penalty.js';
export { NotificationClient } from './contracts/notification.js';
export { ActivityFeedClient } from './contracts/activity-feed.js';

// Admin & governance
export { AdminClient } from './contracts/admin.js';
export { PausableClient } from './contracts/pausable.js';
export { AccessControlClient } from './contracts/access-control.js';
export { AssetControlClient } from './contracts/asset-control.js';
export { UserClient } from './contracts/user.js';
export { UsersClient } from './contracts/users.js';
export { WalletStatusClient } from './contracts/wallet-status.js';
export { TransactionalClient } from './contracts/transactional.js';
export { TransactionValidationClient } from './contracts/transaction-validation.js';
export { TransactionAnalyticsClient } from './contracts/transaction-analytics.js';
export { CurrencyConversionClient } from './contracts/currency-conversion.js';
export { MerchantTaggingClient } from './contracts/merchant-tagging.js';
export { CategoryAnalyticsClient } from './contracts/category-analytics.js';
export { TransferClient } from './contracts/transfer.js';
export { BalanceClient } from './contracts/balance.js';

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

// Savings & budgets types
export type {
  SavingsGoalRequestInput,
  MilestoneAchievementRequestInput,
  AutoAllocationRequestInput,
  SavingsGoalRecord,
  SavingsGoalProgressRecord,
  ContributionRecord,
  GoalCertificateRecord,
  MilestoneAchievementRecord,
  BatchGoalResult,
  BatchMilestoneResult,
  GoalResultItem,
  MilestoneResultItem,
  AutoAllocationResult,
} from './contracts/savings-goals.js';
export type {
  BudgetRuleInput,
  BeneficiaryInput,
  BudgetRecord,
  UserBudgetRecord,
  CategoryBudgetRecord,
  CategoryTransferRecord,
  BudgetFreezeRecord,
  BudgetConfigVersionRecord,
  PendingDeletionRecord,
  DelegationPermissionRecord,
  BeneficiaryRecord,
} from './contracts/budget.js';
export type {
  BudgetSpendingRuleInput,
  BudgetRecord as SharedBudgetRecord,
  BudgetUtilizationSummaryRecord,
  BudgetContributionRecord,
  ArchivedBudgetRecord,
  BudgetUtilizationBand,
} from './contracts/shared-budgets.js';
export type {
  BudgetRequestInput,
  CategoryBudgetRequestInput,
  BatchBudgetResult,
  UserBudgetCategoriesRecord,
  BudgetAllocationSummaryRecord,
  BudgetRenewalConfigRecord,
  BudgetVersionRecord,
} from './contracts/budget-allocation.js';
export type {
  SpendingLimitRequestInput,
  SpendingLimitRecord,
  EscalationConfigRecord,
  ExceptionRuleRecord,
  BatchLimitResult,
  LimitUpdateResultItem,
} from './contracts/spending-limits.js';
export type {
  PolicyRuleInput,
  PolicyEvaluation,
  ApprovalOutcome,
  PolicyRecord,
  PendingTransactionRecord,
} from './contracts/spending-policy.js';
export type {
  RuleRecord,
  RuleDecision,
  EvaluationResultRecord,
} from './contracts/spending-rules.js';
export type {
  SpendingCategoryRecord,
} from './contracts/spending-categories.js';

// Payments & treasury types
export type {
  RewardRequestInput,
  RewardResultItem,
  BatchRewardResult,
} from './contracts/batch-rewards.js';
export type {
  TokenMintRequestInput,
  TokenMintedRecord,
  BatchMintResult,
  MintResultItem,
} from './contracts/batch-token-mint.js';
export type {
  PaymentReminderRequestInput,
  BatchReminderResult,
} from './contracts/batch-payment-reminders.js';
export type {
  NotificationPayloadInput,
  BatchNotificationResult,
} from './contracts/batch-notifications.js';
export type {
  UserHistoryRecord,
  HistoryTransactionRecord,
} from './contracts/batch-history.js';
export type {
  WalletCreateRequestInput,
  WalletRecoveryRequestInput,
  WalletRecord,
  WalletCreateResultItem,
  WalletRecoveryResultItem,
  BatchCreateResult,
  BatchRecoveryResult,
} from './contracts/batch-wallet-creation.js';
export type {
  SpendingTierInput,
  SpendingTierRecord,
  ProposalRecord,
  ProposalStatus,
} from './contracts/treasury.js';
export type {
  AllowanceFrequency,
  AllowanceRecord,
  AllowanceAnalyticsRecord,
  PaymentRecord,
} from './contracts/allowances.js';
export type {
  RewardType,
  RewardStatus,
  RewardAccountRecord,
  RewardTransactionRecord,
} from './contracts/rewards.js';
export type {
  NotificationInput,
  NotificationResultRecord,
  DigestSummaryRecord,
} from './contracts/notification.js';
export type {
  ActivityEventRecord,
} from './contracts/activity-feed.js';

// Admin & governance types
export type {
  Role,
} from './contracts/access-control.js';
export type {
  WalletStatus,
} from './contracts/wallet-status.js';
export type {
  TransactionInput as TransactionalTransactionInput,
  TransactionRecord as TransactionalTransactionRecord,
} from './contracts/transactional.js';
export type {
  ConversionRateInput,
  ConversionRateRecord,
} from './contracts/currency-conversion.js';
export type {
  MerchantRecord,
  TransactionMerchantTagRecord,
  MerchantAnalyticsRecord,
} from './contracts/merchant-tagging.js';
export type {
  CategorySpendInput,
  TransactionEventInput as CategoryAnalyticsEventInput,
  TimeFilterInput,
  CategorySpendingRecord,
  MonthlyAnalyticsRecord,
} from './contracts/category-analytics.js';
export type {
  TransactionInput as AnalyticsTransactionInput,
  AuditLogInput,
  BundledTransactionInput,
  RatingInput,
  TransactionStatus as AnalyticsTransactionStatus,
  TransactionStatusUpdateInput,
  RefundRequestInput,
  FeeModelInput,
  FeeTierInput,
  FeeConfigInput,
  TransactionEventInput as AnalyticsEventInput,
  BatchMetricsRecord,
  BundleResultRecord,
  BatchStatusUpdateResultRecord,
  RatingResultRecord,
  FeeCalculationResultRecord,
  RefundBatchMetricsRecord,
  PaginatedBatchMetricsRecord,
  MonthlyAnalyticsRecord as AnalyticsMonthlyAnalyticsRecord,
  UserSpendingSummaryRecord,
  CategorySpendWindowRecord,
} from './contracts/transaction-analytics.js';
