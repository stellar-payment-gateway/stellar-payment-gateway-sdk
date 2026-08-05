# Contributing to Stellar Payment Gateway SDK Contracts

Welcome to the Stellar Payment Gateway SDK Contracts repository! This document provides a comprehensive overview of our contract modules and their responsibilities to help new and existing contributors navigate the codebase efficiently.

---

## Module Ownership Map

Below is the complete map of every top-level module and crate in the workspace, along with a one-line description of its core responsibility.

### 1. Workspace Sub-Crates (`contracts/<crate-name>/`)

Standalone Soroban smart contract crates compiled as workspace packages:

| Module / Crate | Responsibility |
|---|---|
| `access-control` | Role-based access control and admin permission management. |
| `activity-feed` | User and contract activity logging, pagination, and event queries. |
| `admin` | Protocol administration, governance configuration, and administrative privileges. |
| `allowances` | Scheduled allowance management, periodic distributions, and spending caps. |
| `asset_control` | Asset issuer management, mint/burn restrictions, and asset operations. |
| `audit` | On-chain security audit logging and transaction event recording. |
| `balance` | Account balance queries, ledger validation, and balance formatting utilities. |
| `batch-conversion` | Bulk currency conversion operations in a single atomic transaction. |
| `batch-history` | Historical execution tracking and logs for batched contract operations. |
| `batch-notifications` | Alert dispatching and notification scheduling for batch operations. |
| `batch-payment` | Bulk payment processing and token distribution to multiple recipients. |
| `batch-payment-reminders` | Reminder scheduling and status tracking for bulk payment operations. |
| `batch-rewards` | Bulk reward calculation and distribution across multiple user accounts. |
| `batch-token-mint` | Batch token minting utilities for platform asset initialization. |
| `batch-transfer` | High-efficiency multi-recipient asset transfer contract. |
| `batch-transfer-pausable` | Emergency pausable variant of multi-recipient asset transfers. |
| `batch-wallet-creation` | Bulk provisioning of user wallets and accounts in a single batch. |
| `benchmarks` | Performance benchmarking and gas cost profiling suite for workspace contracts. |
| `budget` | Core budget creation, line-item tracking, and spending allocation engine (See Known Overlaps). |
| `budget-allocation` | Automated fund allocation logic across designated budget categories (See Known Overlaps). |
| `budget-recommendations` | Spending-based budget recommendations and analytics suggestions. |
| `budget_history` | Historical snapshot recording and queries for user budget allocations over time (See Known Overlaps). |
| `budget_rollback` | State rollback and restoration utilities for budget modifications (See Known Overlaps). |
| `category-analytics` | Categorized spending breakdown analytics and aggregation queries. |
| `contract-upgrade` | Contract code upgrade mechanisms, migration helpers, and WASM version management. |
| `cross-contract` | Inter-contract call helpers and cross-contract integration utilities. |
| `currency-conversion` | Exchange rate management and currency conversion calculations. |
| `escrow` | Conditional fund escrow locking, release conditions, and dispute handling. |
| `events` | Standardized event emission schemas and off-chain event indexing helpers. |
| `fee` | Core platform fee engine, fee structures, and tier-based fee calculations (See Known Overlaps). |
| `goal_tracking` | Goal progress tracking, milestone assertions, and completion metrics (See Known Overlaps). |
| `goals` | User savings goal creation, target tracking, and milestone allocation (See Known Overlaps). |
| `merchant-tagging` | Merchant taxonomy tagging, categorization, and merchant-specific rules. |
| `multi-currency-wallet` | Multi-asset user wallet management, balance holding, and multi-currency storage. |
| `notification` | Alert generation, digest scheduling, and user notification preference management. |
| `pausable` | Emergency pause circuit breaker mechanism for contract safety. |
| `penalty` | Penalty fee assessment, rule enforcement, and forfeiture management. |
| `recurring` | General scheduled execution primitives and recurring task engine (See Known Overlaps). |
| `recurring-payment` | Automated subscription and scheduled recurring token payment processing (See Known Overlaps). |
| `rewards` | User reward crediting, ledger indexing, debiting, and loyalty point storage. |
| `savings` | General savings vault storage, deposit management, and yield tracking (See Known Overlaps). |
| `savings-goals` | Dedicated savings goal lockups, target completion tracking, and beneficiary transfers (See Known Overlaps). |
| `shared` | Common utilities, types, date functions, and constants across contracts. |
| `shared-budgets` | Multi-user collaborative budgeting, joint spending limits, and co-signer approvals. |
| `spending-categories` | Spending taxonomy structure, category creation, and validation rules. |
| `spending-digest` | Spending summary compilation and periodic digest generation. |
| `spending-limits` | Daily, weekly, and monthly spending limit enforcement with ZK proof integration. |
| `spending-rules` | Rule-based transaction enforcement, spend restrictions, and condition checks. |
| `stellar-payment-gateway-sdk` | Main entry point wrapper and protocol orchestration contract. |
| `stellar-payment-gateway-fee` | Protocol-specific fee collection and distribution contract (See Known Overlaps). |
| `transact` | Transaction execution primitives and atomic transfer wrappers. |
| `transaction` | Lightweight transaction log registry with strict per-user limits (See Known Overlaps). |
| `transaction-analytics` | High-throughput transaction metrics, batch analytics, fee math, and bundling. |
| `transaction-memo` | Validated memo storage and size-bounded transaction notes. |
| `transaction-validation` | Timestamp freshness verification and transaction payload validation. |
| `transactional` | Sequential transaction ledger with running averages and duplicate prevention (See Known Overlaps). |
| `transactions` | Comprehensive production historical transaction database with metadata, tags, and status tracking (See Known Overlaps). |
| `transfer` | Single peer-to-peer asset transfer logic and authorization checks. |
| `treasury` | Protocol treasury reserve management, fee collection pool, and disbursement routines. |
| `user` | Legacy minimal user registration stub (deprecated; See Known Overlaps). |
| `users` | Production canonical user registry, profile updates, and status management (See Known Overlaps). |
| `version` | Protocol contract versioning and compatibility metadata reporting. |
| `wallet-profile` | User wallet metadata, avatar hash management, and profile customization. |
| `wallet-status` | Account state monitoring, active/suspended status tracking, and activation rules. |
| `zk-verifier` | Soroban UltraHonk zero-knowledge proof verification contract for spending privacy. |

---

### 2. Loose Contract Modules (`contracts/*.rs`)

File-based contract modules included via root tests:

| Module File | Responsibility |
|---|---|
| `contracts/account_status.rs` | Account status flag tracking and state verification helper. |
| `contracts/approval.rs` | Multi-party transaction authorization and approval verification helpers. |
| `contracts/archive.rs` | Archival storage utilities for inactive contract states. |
| `contracts/batch.rs` | Legacy batch operation handling routines. |
| `contracts/category.rs` | Lightweight category entity definitions and lookup functions. |
| `contracts/compliance.rs` | Regulatory compliance checks, sanction screening, and restriction enforcement. |
| `contracts/conditional_payment.rs` | Conditional escrow and milestone-gated payment execution. |
| `contracts/contract.rs` | Basic contract initialisation template and placeholder module. |
| `contracts/conversion.rs` | Exchange rate lookup and single currency conversion helper functions. |
| `contracts/delegation.rs` | Budget and transaction authority delegation management. |
| `contracts/dependencies.rs` | Internal dependency tracking and system integration verification. |
| `contracts/errors.rs` | Workspace-wide error code definitions and error mapping helper functions. |
| `contracts/fees.rs` | Legacy fee calculation and fee table lookup functions (See Known Overlaps). |
| `contracts/fraud.rs` | Anomaly detection, suspicious transaction flagging, and anti-fraud heuristics. |
| `contracts/gas-optimization.rs` | Gas-optimized utility functions and efficient state packing helpers. |
| `contracts/governance.rs` | Governance proposal submission, voting mechanics, and execution timelocks. |
| `contracts/history.rs` | Legacy user transaction history recording module. |
| `contracts/lib.rs` | Workspace root export library binding loose contract modules. |
| `contracts/memo.rs` | Simple transaction memo string formatting and validation utilities. |
| `contracts/metadata.rs` | Protocol and contract metadata key-value storage. |
| `contracts/msg.rs` | Messaging payload struct definitions for cross-module communication. |
| `contracts/multisig.rs` | Multi-signature authorization threshold verification logic. |
| `contracts/multisig_savings_integration.rs` | Integration adapter binding multi-signature approvals to savings actions. |
| `contracts/multisig_savings_withdrawal.rs` | Multi-signature authorization workflow for savings withdrawals. |
| `contracts/multisig_savings_withdrawal_utils.rs` | Auxiliary utility functions for multi-signature savings withdrawals. |
| `contracts/overdraft.rs` | Overdraft facility management, credit line tracking, and fee assessment. |
| `contracts/prediction.rs` | Financial prediction modeling and spending forecast calculations. |
| `contracts/preference.rs` | User notification, currency, and protocol preference settings. |
| `contracts/priority.rs` | Priority transaction queuing and gas/fee prioritization rules. |
| `contracts/rate_limit.rs` | Request and transaction rate-limiting guards to prevent abuse. |
| `contracts/recurring_savings.rs` | Automated periodic savings contribution scheduling module (See Known Overlaps). |
| `contracts/refunds.rs` | Transaction refund processing, reversal logic, and claim tracking. |
| `contracts/rewards.rs` | Legacy user reward and bonus point distribution functions. |
| `contracts/savings.rs` | Single-file savings account management and deposit tracking helper (See Known Overlaps). |
| `contracts/simulation.rs` | Dry-run transaction simulation and state transition preview routines. |
| `contracts/snapshots.rs` | Periodic state snapshot recording for historical reporting. |
| `contracts/state.rs` | Protocol global state storage keys and contract state lifecycle flags. |
| `contracts/streak_reward.rs` | Gamified consecutive usage rewards and streak counter tracking. |
| `contracts/template.rs` | Template boilerplate for creating new Soroban smart contract modules. |
| `contracts/threshold.rs` | Multi-sig and monetary threshold value checks. |
| `contracts/throttling.rs` | System-wide throughput throttling and load shedding mechanisms. |
| `contracts/timelock.rs` | Time-delay lock enforcement for high-value contract operations. |
| `contracts/token.rs` | Standard Soroban token contract interaction and wrapper interface. |
| `contracts/transaction_metadata.rs` | Metadata key-value attachment for individual transactions. |
| `contracts/transactions.rs` | Integration test execution simulator for multi-sig/timelocked transactions (See Known Overlaps). |
| `contracts/utils.rs` | Shared utility functions, math helpers, and assertions. |
| `contracts/wallet.rs` | Standalone single-wallet operational management functions. |
| `contracts/wallet_linking.rs` | Cross-account wallet linking and primary/secondary address mapping. |

---

## Known Overlaps & Tracking Issues

We track several overlapping or duplicate modules across the codebase. Resolving these is handled under dedicated issues; please do not refactor them unless assigned to the specific issue:

- **User Registries (`user` vs `users`)**:
  - `contracts/users` is the canonical production registry. `contracts/user` is a legacy stub kept for backwards compatibility.
  - Tracked in **Issue #712** (See [docs/user-vs-users-crates.md](docs/user-vs-users-crates.md)).

- **Transaction Registries (`transactions` vs `transactional` vs `transaction` vs `transactions.rs`)**:
  - `contracts/transactions` acts as the production historical registry. `contracts/transaction` is a mock registry enforcing a 5-tx limit. `contracts/transactional` is a sequential ledger with running averages. `contracts/transactions.rs` simulates ledger execution for tests.
  - Tracked in **Issue #707** (See [docs/transactions-architecture.md](docs/transactions-architecture.md)).

- **Fee Engine & Fee Collection (`fee` vs `stellar-payment-gateway-fee` vs `fees.rs`)**:
  - `contracts/fee` is the multi-tier fee engine. `contracts/stellar-payment-gateway-fee` handles protocol-specific fee collection. `contracts/fees.rs` contains legacy helper routines.
  - Tracked in **Issue #737**.

- **Budget Modules (`budget` vs `budget-*` vs `budget_history` vs `budget_rollback`)**:
  - Reconciling entry points and state boundaries between core `budget`, allocation, history, and rollback modules.
  - Tracked in **Issue #764**.

- **Recurring Operations (`recurring` vs `recurring-payment` vs `recurring_savings.rs`)**:
  - `contracts/recurring` provides scheduling primitives, `contracts/recurring-payment` manages token transfers, and `contracts/recurring_savings.rs` handles savings goal contributions.
  - Tracked in **Issue #733** (See [docs/RECURRING_MODULES.md](docs/RECURRING_MODULES.md)).

- **Savings & Goals (`savings` vs `savings-goals` vs `goals` vs `goal_tracking` vs `savings.rs`)**:
  - `contracts/savings` handles general vault storage, `contracts/savings-goals` handles dedicated goal lockups, while `goals` and `goal_tracking` manage milestone progress.
  - Tracked in **Issue #734** & **Issue #735**.

---

## Guidelines for Contributors

1. **Before Adding a New Module**: Check the Ownership Map to see if an existing module or crate covers your use case.
2. **Deprecations**: Do not depend on legacy/deprecated stubs (such as `contracts/user`). Always use canonical workspace crates.
3. **Documentation**: When creating a new contract crate under `contracts/`, include a `README.md` using the [contract README template](docs/templates/contract-README-template.md).
