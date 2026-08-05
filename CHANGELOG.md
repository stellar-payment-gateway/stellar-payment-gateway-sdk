# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-08-05

### Added

- Initial release of **Stellar Payment Gateway SDK**: a suite of Soroban smart
  contracts for the Stellar network, including:
  - Privacy-preserving spending limits with on-chain zero-knowledge proof
    verification (UltraHonk proofs generated off-chain with Noir circuits)
  - Automated budget controls with rollover, shared budgets, and spending
    policies
  - Savings goals, recurring savings, and multisig savings withdrawals
  - Escrow services and conditional payments
  - Multi-currency wallet with oracle-backed currency conversion
  - Transaction analytics, spending digests, and category analytics
  - Batch transfer, treasury, governance, and access-control tooling
- Standard project files: `LICENSE` (MIT), `CHANGELOG.md`, `SECURITY.md`,
  `CODE_OF_CONDUCT.md`, and `.editorconfig`.
- Brand assets: `docs/images/stellar-payment-gateway-sdk-banner.svg` and
  `docs/images/stellar-payment-gateway-sdk-logo.svg`.

### Fixed

- `cargo check --workspace` passes for the full workspace.
- Nested `target/` build artifacts are no longer tracked (`.gitignore`).
- All wired `[[test]]` harness targets compile and run in CI.

### Changed

- Rebuilt the `multi-currency-wallet` contract and added the `shared::oracle` /
  `shared::reflector_oracle` modules.
- Rebuilt the `budget` contract with full `spend_from_category` support and
  `transfer_budget_ownership`.

### Removed

- Dormant test files that imported the non-member `stellar_payment_gateway_sdk`
  crate and were never wired into the `[[test]]` harness: `tests/e2e_tests.rs`,
  `tests/refund_tests.rs`, `contracts/tests/fee_simulation_tests.rs`,
  `contracts/tests/fee_tests.rs`, and `contracts/tests/integration_tests.rs`.
