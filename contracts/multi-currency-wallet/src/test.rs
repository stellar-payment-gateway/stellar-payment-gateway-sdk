//! Tests for the multi-currency wallet contract.
//!
//! These tests wire the [`shared::reflector_oracle::ReflectorOracle`] adapter
//! to a *registered mock oracle contract* so `convert_currency` is exercised
//! end-to-end: the wallet performs a real cross-contract call to the mock for
//! `get_price`/`get_twap`, runs the `OracleManager` staleness / deviation /
//! manipulation guards, applies the rate, and updates balances.
//!
//! The mock oracle exposes the same interface the wallet expects and lets each
//! test pin the spot price and TWAP (value + observation timestamp), which is
//! how the failure modes (stale price, deviation exceeded, manipulated price,
//! unreachable oracle, minimum-received not met) are triggered.

#![cfg(test)]

use crate::{ConversionRequest, MultiCurrencyWalletContract, MultiCurrencyWalletClient};
use shared::oracle::Price;
use soroban_sdk::{
    contract, contractimpl, contracttype, testutils::Address as _, Address, Env, String,
};

/// Storage keys for the mock oracle's observations.
#[contracttype]
#[derive(Clone)]
enum MockDataKey {
    Price,
    Twap,
}

/// Minimal in-test oracle implementing the Reflector-style interface the
/// wallet expects: `get_price(base, quote)` and `get_twap(base, quote, window)`.
/// Observations are pinned per-test via `set_price` / `set_twap`.
#[contract]
pub struct MockOracleContract;

#[contractimpl]
impl MockOracleContract {
    pub fn initialize(env: Env) {
        env.storage().instance().set(
            &MockDataKey::Price,
            &Price {
                value: 0,
                timestamp: 0,
            },
        );
        env.storage().instance().set(
            &MockDataKey::Twap,
            &Price {
                value: 0,
                timestamp: 0,
            },
        );
    }

    pub fn set_price(env: Env, price: Price) {
        env.storage().instance().set(&MockDataKey::Price, &price);
    }

    pub fn set_twap(env: Env, price: Price) {
        env.storage().instance().set(&MockDataKey::Twap, &price);
    }

    pub fn get_price(env: Env, _asset_a: String, _asset_b: String) -> Price {
        env.storage()
            .instance()
            .get(&MockDataKey::Price)
            .unwrap_or(Price {
                value: 0,
                timestamp: 0,
            })
    }

    pub fn get_twap(
        env: Env,
        _asset_a: String,
        _asset_b: String,
        _window_seconds: u64,
    ) -> Price {
        env.storage()
            .instance()
            .get(&MockDataKey::Twap)
            .unwrap_or(Price {
                value: 0,
                timestamp: 0,
            })
    }
}

/// Registers the mock oracle and the wallet, initializing the wallet with the
/// given oracle policy (staleness threshold in seconds, max deviation in bps).
fn setup_with(
    staleness_threshold: u64,
    max_deviation_bps: i128,
) -> (Env, MockOracleContractClient<'static>, MultiCurrencyWalletClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let oracle_id = env.register(MockOracleContract, ());
    let oracle = MockOracleContractClient::new(&env, &oracle_id);
    oracle.initialize();

    let wallet_id = env.register(MultiCurrencyWalletContract, ());
    let wallet = MultiCurrencyWalletClient::new(&env, &wallet_id);

    let owner = Address::generate(&env);
    wallet.initialize(&owner, &oracle_id, &staleness_threshold, &max_deviation_bps);

    (env, oracle, wallet)
}

/// Default setup: 300s staleness threshold, 1000 bps max deviation.
fn setup() -> (Env, MockOracleContractClient<'static>, MultiCurrencyWalletClient<'static>) {
    setup_with(300, 1_000)
}

fn usdc(env: &Env) -> String {
    String::from_str(env, "USDC")
}

fn xlm(env: &Env) -> String {
    String::from_str(env, "XLM")
}

fn convert_request(env: &Env, amount: i128, min_received: i128) -> ConversionRequest {
    ConversionRequest {
        from_asset: usdc(env),
        to_asset: xlm(env),
        amount,
        min_received,
    }
}

/// Seeds a realistic pair of observations: spot 2_500_000 (0.25 XLM per USDC)
/// with a nearby 2_400_000 TWAP, both stamped at the current ledger time.
fn seed_fresh_prices(oracle: &MockOracleContractClient<'static>, env: &Env) {
    let now = env.ledger().timestamp();
    oracle.set_price(&Price {
        value: 2_500_000,
        timestamp: now,
    });
    oracle.set_twap(&Price {
        value: 2_400_000,
        timestamp: now,
    });
}

#[test]
fn test_convert_currency_applies_oracle_rate_and_updates_balances() {
    let (env, oracle, wallet) = setup();
    let now = env.ledger().timestamp();
    seed_fresh_prices(&oracle, &env);

    wallet.add_balance(&usdc(&env), &1000);
    wallet.add_balance(&xlm(&env), &50);

    let result = wallet.convert_currency(&convert_request(&env, 400, 90));

    // 400 USDC * 2_500_000 / 10_000_000 = 100 XLM
    assert_eq!(result.from_amount, 400);
    assert_eq!(result.to_amount, 100);
    assert_eq!(result.rate, 2_500_000);
    assert_eq!(result.timestamp, now);

    // Balances are debited / credited in place.
    assert_eq!(wallet.get_balance(&usdc(&env)), 600);
    assert_eq!(wallet.get_balance(&xlm(&env)), 150);
}

#[test]
fn test_convert_currency_creates_new_balance_entry() {
    let (env, oracle, wallet) = setup();
    seed_fresh_prices(&oracle, &env);

    // Only USDC exists; XLM must be created as a new entry on conversion.
    wallet.add_balance(&usdc(&env), &1000);

    let result = wallet.convert_currency(&convert_request(&env, 400, 90));

    assert_eq!(result.to_amount, 100);
    assert_eq!(wallet.get_balance(&usdc(&env)), 600);
    assert_eq!(wallet.get_balance(&xlm(&env)), 100);
}

#[test]
fn test_convert_currency_accepts_exact_minimum_received() {
    let (env, oracle, wallet) = setup();
    seed_fresh_prices(&oracle, &env);

    wallet.add_balance(&usdc(&env), &1000);

    // min_received exactly equal to the computed 100 XLM is allowed.
    let result = wallet.convert_currency(&convert_request(&env, 400, 100));
    assert_eq!(result.to_amount, 100);
}

#[test]
#[should_panic]
fn test_convert_currency_panics_when_minimum_received_not_met() {
    let (env, oracle, wallet) = setup();
    seed_fresh_prices(&oracle, &env);

    wallet.add_balance(&usdc(&env), &1000);

    // Oracle yields 100 XLM; asking for 101 must revert.
    wallet.convert_currency(&convert_request(&env, 400, 101));
}

#[test]
#[should_panic]
fn test_convert_currency_rejects_stale_price() {
    let (env, oracle, wallet) = setup_with(300, 1_000);
    let now = env.ledger().timestamp();

    // Spot observation stamped 10_000s in the past: far beyond the 300s
    // threshold, so the OracleManager must reject it (OracleError::PriceStale).
    oracle.set_price(&Price {
        value: 2_500_000,
        timestamp: now.saturating_sub(10_000),
    });
    oracle.set_twap(&Price {
        value: 2_400_000,
        timestamp: now,
    });

    wallet.add_balance(&usdc(&env), &1000);
    wallet.convert_currency(&convert_request(&env, 400, 90));
}

#[test]
#[should_panic]
fn test_convert_currency_rejects_deviation_exceeding_max() {
    let (env, oracle, wallet) = setup_with(300, 1_000);
    let now = env.ledger().timestamp();

    // Spot 2.5 vs TWAP 1.0: deviation = |2.5M - 1.0M| * 10_000 / 1.0M =
    // 15_000 bps, far above the configured 1_000 bps cap.
    oracle.set_price(&Price {
        value: 2_500_000,
        timestamp: now,
    });
    oracle.set_twap(&Price {
        value: 1_000_000,
        timestamp: now,
    });

    wallet.add_balance(&usdc(&env), &1000);
    wallet.convert_currency(&convert_request(&env, 400, 90));
}

#[test]
#[should_panic]
fn test_convert_currency_rejects_manipulated_price() {
    // Loosen the deviation cap so the deviation guard passes and the
    // manipulation guard (spot deviating > 50% from TWAP) is what triggers.
    let (env, oracle, wallet) = setup_with(300, 20_000);
    let now = env.ledger().timestamp();

    // Deviation = |2.5M - 1.1M| * 10_000 / 1.1M = 12_727 bps: within the
    // 20_000 bps cap, but > 5_000 bps => PriceManipulationDetected.
    oracle.set_price(&Price {
        value: 2_500_000,
        timestamp: now,
    });
    oracle.set_twap(&Price {
        value: 1_100_000,
        timestamp: now,
    });

    wallet.add_balance(&usdc(&env), &1000);
    wallet.convert_currency(&convert_request(&env, 400, 90));
}

#[test]
#[should_panic]
fn test_convert_currency_panics_when_oracle_unreachable() {
    let env = Env::default();
    env.mock_all_auths();

    // The wallet points at an address with no deployed oracle contract: the
    // ReflectorOracle must fail loudly (OracleError::OracleUnavailable) rather
    // than fabricate a rate.
    let ghost_oracle = Address::generate(&env);

    let wallet_id = env.register(MultiCurrencyWalletContract, ());
    let wallet = MultiCurrencyWalletClient::new(&env, &wallet_id);
    let owner = Address::generate(&env);
    wallet.initialize(&owner, &ghost_oracle, &300, &1_000);

    wallet.add_balance(&usdc(&env), &1000);
    wallet.convert_currency(&convert_request(&env, 400, 90));
}

#[test]
fn test_is_oracle_fresh_true_within_threshold() {
    let (env, oracle, wallet) = setup();
    let now = env.ledger().timestamp();

    oracle.set_price(&Price {
        value: 2_500_000,
        timestamp: now,
    });

    assert!(wallet.is_oracle_fresh(&usdc(&env), &xlm(&env)));
}

#[test]
fn test_is_oracle_fresh_false_when_observation_stale() {
    let (env, oracle, wallet) = setup();
    let now = env.ledger().timestamp();

    oracle.set_price(&Price {
        value: 2_500_000,
        timestamp: now.saturating_sub(10_000),
    });

    assert!(!wallet.is_oracle_fresh(&usdc(&env), &xlm(&env)));
}

#[test]
fn test_is_oracle_fresh_false_when_oracle_unreachable() {
    let env = Env::default();
    env.mock_all_auths();

    let ghost_oracle = Address::generate(&env);

    let wallet_id = env.register(MultiCurrencyWalletContract, ());
    let wallet = MultiCurrencyWalletClient::new(&env, &wallet_id);
    let owner = Address::generate(&env);
    wallet.initialize(&owner, &ghost_oracle, &300, &1_000);

    // An unreachable oracle is treated as stale, never fresh.
    assert!(!wallet.is_oracle_fresh(&usdc(&env), &xlm(&env)));
}

#[test]
fn test_add_balance_accumulates_and_replaces() {
    let (env, _oracle, wallet) = setup();

    wallet.add_balance(&usdc(&env), &1000);
    wallet.add_balance(&usdc(&env), &250);
    assert_eq!(wallet.get_balance(&usdc(&env)), 1250);

    // Unknown assets read as 0.
    assert_eq!(wallet.get_balance(&xlm(&env)), 0);
}

#[test]
#[should_panic]
fn test_convert_currency_before_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let wallet_id = env.register(MultiCurrencyWalletContract, ());
    let wallet = MultiCurrencyWalletClient::new(&env, &wallet_id);

    // Never initialized: converting must panic ("Wallet not initialized").
    wallet.convert_currency(&convert_request(&env, 400, 90));
}
