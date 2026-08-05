//! Reflector-compatible oracle client.
//!
//! Implements [`PriceOracle`] by delegating to a Reflector-style oracle
//! contract deployed on-chain. The adapter expects the oracle contract to
//! expose the following interface (matching [`Price`](crate::oracle::Price),
//! scaled to 7 decimals):
//!
//! - `get_price(base: String, quote: String) -> Price`
//! - `get_twap(base: String, quote: String, window_seconds: u64) -> Price`
//!
//! This adapter is the single integration point for the oracle provider: to
//! point the wallet at a different oracle contract, deploy the provider and
//! pass its address to the wallet's `initialize`/`set_oracle` entry points.
//!
//! ## Behavior
//!
//! - `get_price` / `get_twap` perform a real cross-contract call and **fail
//!   loudly** with [`OracleError::OracleUnavailable`] when the oracle is
//!   unreachable or does not answer. Downstream contracts therefore never act
//!   on fabricated prices.
//! - `is_fresh` compares the returned observation's timestamp against the
//!   staleness threshold. An unreachable oracle is treated as *stale*, never
//!   as fresh.

use soroban_sdk::{panic_with_error, vec, Address, Env, IntoVal, String, Symbol, Val, Vec};

use crate::oracle::{OracleError, Price, PriceOracle};

/// Reflector oracle client wrapping the oracle contract address.
pub struct ReflectorOracle {
    pub address: Address,
}

impl ReflectorOracle {
    pub fn new(address: Address) -> Self {
        Self { address }
    }

    /// Calls `get_price(base, quote)` on the oracle contract.
    fn call_get_price(
        &self,
        env: &Env,
        asset_a: String,
        asset_b: String,
    ) -> Result<Price, OracleError> {
        let args: Vec<Val> = vec![env, asset_a.into_val(env), asset_b.into_val(env)];
        match env.try_invoke_contract::<Price, soroban_sdk::Error>(
            &self.address,
            &Symbol::new(env, "get_price"),
            args,
        ) {
            Ok(Ok(price)) => Ok(price),
            _ => Err(OracleError::OracleUnavailable),
        }
    }

    /// Calls `get_twap(base, quote, window_seconds)` on the oracle contract.
    fn call_get_twap(
        &self,
        env: &Env,
        asset_a: String,
        asset_b: String,
        window_seconds: u64,
    ) -> Result<Price, OracleError> {
        let args: Vec<Val> = vec![
            env,
            asset_a.into_val(env),
            asset_b.into_val(env),
            window_seconds.into_val(env),
        ];
        match env.try_invoke_contract::<Price, soroban_sdk::Error>(
            &self.address,
            &Symbol::new(env, "get_twap"),
            args,
        ) {
            Ok(Ok(price)) => Ok(price),
            _ => Err(OracleError::OracleUnavailable),
        }
    }
}

impl PriceOracle for ReflectorOracle {
    fn get_price(&self, env: &Env, asset_a: String, asset_b: String) -> Price {
        match self.call_get_price(env, asset_a, asset_b) {
            Ok(price) => price,
            Err(e) => panic_with_error!(env, e),
        }
    }

    fn get_twap(
        &self,
        env: &Env,
        asset_a: String,
        asset_b: String,
        window_seconds: u64,
    ) -> Price {
        match self.call_get_twap(env, asset_a, asset_b, window_seconds) {
            Ok(price) => price,
            Err(e) => panic_with_error!(env, e),
        }
    }

    fn is_fresh(
        &self,
        env: &Env,
        asset_a: String,
        asset_b: String,
        staleness_threshold: u64,
    ) -> bool {
        match self.call_get_price(env, asset_a, asset_b) {
            Ok(price) => {
                let age = env.ledger().timestamp().saturating_sub(price.timestamp);
                age <= staleness_threshold
            }
            // An unreachable oracle is stale, never fresh.
            Err(_) => false,
        }
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        contract, contractimpl, contracttype, testutils::Address as _, Env, String,
    };

    #[contracttype]
    #[derive(Clone)]
    enum MockKey {
        Timestamp,
    }

    /// Minimal mock of the expected oracle interface for tests.
    #[contract]
    pub struct MockOracleContract;

    #[contractimpl]
    impl MockOracleContract {
        pub fn initialize(env: Env) {
            env.storage()
                .instance()
                .set(&MockKey::Timestamp, &env.ledger().timestamp());
        }

        pub fn set_timestamp(env: Env, timestamp: u64) {
            env.storage().instance().set(&MockKey::Timestamp, &timestamp);
        }

        pub fn get_price(env: Env, _asset_a: String, _asset_b: String) -> Price {
            Price {
                value: 2_500_000,
                timestamp: env
                    .storage()
                    .instance()
                    .get::<MockKey, u64>(&MockKey::Timestamp)
                    .unwrap_or(0),
            }
        }

        pub fn get_twap(
            env: Env,
            _asset_a: String,
            _asset_b: String,
            _window_seconds: u64,
        ) -> Price {
            Price {
                value: 2_400_000,
                timestamp: env
                    .storage()
                    .instance()
                    .get::<MockKey, u64>(&MockKey::Timestamp)
                    .unwrap_or(0),
            }
        }
    }

    fn setup() -> (Env, Address, ReflectorOracle) {
        let env = Env::default();
        let mock_id = env.register(MockOracleContract, ());
        let client = MockOracleContractClient::new(&env, &mock_id);
        client.initialize();
        let oracle = ReflectorOracle::new(mock_id.clone());
        (env, mock_id, oracle)
    }

    #[test]
    fn get_price_returns_real_oracle_value() {
        let (env, _mock_id, oracle) = setup();

        let now = env.ledger().timestamp();
        let price = oracle.get_price(
            &env,
            String::from_str(&env, "XLM"),
            String::from_str(&env, "USDC"),
        );

        assert_eq!(price.value, 2_500_000);
        assert_eq!(price.timestamp, now);
        assert!(oracle.is_fresh(
            &env,
            String::from_str(&env, "XLM"),
            String::from_str(&env, "USDC"),
            60,
        ));
    }

    #[test]
    fn get_twap_returns_real_oracle_value() {
        let (env, _mock_id, oracle) = setup();

        let twap = oracle.get_twap(
            &env,
            String::from_str(&env, "XLM"),
            String::from_str(&env, "USDC"),
            300,
        );

        assert_eq!(twap.value, 2_400_000);
    }

    #[test]
    fn is_fresh_returns_false_when_observation_is_stale() {
        let (env, mock_id, oracle) = setup();

        let now = env.ledger().timestamp();
        let mock = MockOracleContractClient::new(&env, &mock_id);
        // Observation timestamp set far in the past.
        mock.set_timestamp(&now.saturating_sub(10_000));

        assert!(!oracle.is_fresh(
            &env,
            String::from_str(&env, "XLM"),
            String::from_str(&env, "USDC"),
            60,
        ));
    }

    #[test]
    fn is_fresh_returns_false_when_oracle_unreachable() {
        let env = Env::default();
        let unreachable = Address::generate(&env);
        let oracle = ReflectorOracle::new(unreachable);

        // Unreachable oracle => stale, not fresh.
        assert!(!oracle.is_fresh(
            &env,
            String::from_str(&env, "XLM"),
            String::from_str(&env, "USDC"),
            60,
        ));
    }

    #[test]
    #[should_panic]
    fn get_price_panics_when_oracle_unreachable() {
        let env = Env::default();
        let unreachable = Address::generate(&env);
        let oracle = ReflectorOracle::new(unreachable);

        // A price read against a missing oracle must fail loudly instead of
        // fabricating a rate.
        let _ = oracle.get_price(
            &env,
            String::from_str(&env, "XLM"),
            String::from_str(&env, "USDC"),
        );
    }
}
