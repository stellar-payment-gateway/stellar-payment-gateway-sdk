//! Oracle price types and traits shared across contracts.

use soroban_sdk::{contracttype, Env, String};

/// A single price observation with the ledger timestamp it was recorded at.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Price {
    /// Price scaled by 10_000_000 (7 decimal places).
    pub value: i128,
    pub timestamp: u64,
}

/// Errors returned by oracle-backed price validation.
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
#[contracttype]
pub enum OracleError {
    PriceStale = 1,
    PriceDeviationExceeded = 2,
    PriceManipulationDetected = 3,
    OracleUnavailable = 4,
    InvalidPair = 5,
}

impl From<OracleError> for soroban_sdk::Error {
    fn from(e: OracleError) -> Self {
        soroban_sdk::Error::from_contract_error(e as u32)
    }
}

/// Abstraction over an on-chain price oracle.
///
/// Implementations query an external oracle contract (e.g. Reflector) for the
/// current price and TWAP of an asset pair.
pub trait PriceOracle {
    /// Returns the current price for an asset pair.
    fn get_price(&self, env: &Env, asset_a: String, asset_b: String) -> Price;

    /// Returns the time-weighted average price over `window_seconds`.
    fn get_twap(&self, env: &Env, asset_a: String, asset_b: String, window_seconds: u64) -> Price;

    /// Returns whether the latest observation is within the staleness threshold.
    fn is_fresh(
        &self,
        env: &Env,
        asset_a: String,
        asset_b: String,
        staleness_threshold: u64,
    ) -> bool;
}
