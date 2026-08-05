# Testnet Deployment Guide

This guide walks through deploying the Stellar Payment Gateway SDK contracts to
Stellar **testnet**. The same steps apply to mainnet — only the RPC URL,
network passphrase, and funding source change.

## 1. Prerequisites

| Tool | Install |
| --- | --- |
| Rust (with `wasm32-unknown-unknown` target) | `rustup target add wasm32-unknown-unknown` |
| `soroban` CLI (or `stellar` CLI) | `cargo install --locked stellar-cli` (provides both `stellar` and `soroban` binaries) |

Verify the CLI works:

```bash
soroban --version
```

## 2. Create a deployer account

Generate a keypair and write it to a local file:

```bash
soroban keys generate deployer --network testnet
```

Fund it with testnet XLM via the Friendbot:

```bash
curl -X POST "https://friendbot.stellar.org?addr=$(soroban keys address deployer)"
```

## 3. Configure the environment

```bash
cp scripts/.env.example scripts/.env
```

Fill in `scripts/.env`:

```bash
RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
SOURCE_ACCOUNT=deployer            # key name from step 2, or paste the S... secret
ADMIN=G...                          # address that will own the contracts
VERIFIER_PK=...                     # ed25519 prover public key (hex) for zk-verifier
```

> `SOURCE_ACCOUNT` accepts either a `soroban keys` name or a raw secret key.
> If your CLI version requires a public key there, set
> `SOURCE_ACCOUNT=<G...>` and add `--secret-key`/`--source-secret` to the
> `soroban contract deploy` invocation in `scripts/deploy.sh` as appropriate
> for your CLI version.

## 4. Deploy the core set

```bash
bash scripts/deploy.sh
```

The script builds the WASM for each package (if needed), deploys it, runs the
initialization call when known, and records addresses in
`scripts/.deployed-addresses.env`:

```bash
batch_conversion=CBK...   # example
zk_verifier=CCD...
savings_goals=CAD...
spending_limits=CAG...
multi_currency_wallet=CAJ...
```

Deploy a specific contract:

```bash
bash scripts/deploy.sh escrow
```

## 5. Wire up dependent contracts

Some contracts reference others by address. Set per-contract init args through
the environment when deploying them:

```bash
export INIT_ARGS_spending_rules="-- --admin $ADMIN \
  --category_contract <spending_categories_address> \
  --zk_verifier_contract <zk_verifier_address>"
bash scripts/deploy.sh spending-rules spending-categories
```

Any contract listed in `scripts/deploy.sh`'s `init_args()` can be customized
the same way — see `INIT_ARGS_*` in `scripts/.env.example`.

## 6. Smoke-test the deployment

```bash
# Query the verifier key back from the deployed contract
soroban contract invoke \
  --id <zk_verifier_address> \
  --source-account deployer \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- get_verifier_pk

# Set a conversion rate on the batch-conversion contract
soroban contract invoke \
  --id <batch_conversion_address> \
  --source-account deployer \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- set_conversion_rate --from_asset <token_a> --to_asset <token_b> \
     --rate_numerator 9 --rate_denominator 10
```

## 7. Run the end-to-end smoke test

A scripted integration test deploys the contracts and exercises one full
on-chain flow against the real network. It uses the `batch-conversion`
contract as the end-to-end scenario:

1. Deploys `batch-conversion` via `scripts/deploy.sh` (skipped with
   `--skip-deploy` to reuse saved addresses).
2. Creates two test assets (`SMOKE1` / `SMOKE2`, issued by the admin account)
   and their Stellar Asset Contracts.
3. Funds the contract with `SMOKE2` liquidity and the admin with `SMOKE1`.
4. Sets a `9/10` conversion rate and converts 100 `SMOKE1` → ≥ 90 `SMOKE2`
   (slippage-protected via `min_amount_out`).
5. Verifies the resulting balances on-chain with real contract reads.
6. Withdraws the collected `SMOKE1` liquidity back to the admin.

```bash
bash scripts/smoke-test.sh
```

Expected output ends with:

```text
SMOKE TEST PASSED — end-to-end conversion flow verified on-chain.
```

> **Prerequisite:** for the smoke test, `ADMIN` must be the **public key
> (G...)** of the `SOURCE_ACCOUNT` secret key, because the admin authorizes
> the token minting, conversion, and liquidity withdrawal steps.
>
> **Auth override:** if you initialize `batch-conversion` with a different
> admin (e.g. via `INIT_ARGS_batch_conversion`), set `SMOKE_SIGNER` in
> `scripts/.env` to a secret key matching that stored admin, or the
> admin-required calls will fail authorization.
>
> **CLI version:** the newest `stellar` CLI accepts `--source` instead of
> `--source-account`; if your CLI rejects the default flag, set
> `SOURCE_FLAG=source` in `scripts/.env`.

Other useful invocations:

```bash
bash scripts/smoke-test.sh --skip-deploy   # reuse previously deployed contracts
bash scripts/smoke-test.sh --reset         # forget saved addresses and redeploy
```

Smoke-test parameters (`AMOUNT_IN`, `MIN_AMOUNT_OUT`, `LIQUIDITY`, asset
codes, rate) can be overridden via `SMOKE_*` variables — see
`scripts/.env.example`.

## 8. Notes

- **Upgrades**: redeploy an updated WASM with
  `soroban contract update --id <address> --wasm <new.wasm>` (the CLI's exact
  flag may vary by version).
- **Oracle**: the `multi-currency-wallet` requires an oracle contract address.
  Pass it via `INIT_ARGS_multi_currency_wallet` when initializing, and deploy
  your Reflector-compatible oracle first (see `docs/price-oracle-integration.md`).
- **Mainnet**: swap `RPC_URL` and `NETWORK_PASSPHRASE`, and fund `SOURCE_ACCOUNT`
  with real XLM. Deploying to mainnet is an irreversible operation — test on
  testnet first.
