//! # Wallet Status Contract
//!
//! Tracks per-wallet operational status (`Active`, `Paused`, `Restricted`)
//! so other contracts and off-chain services can gate behavior on a wallet's
//! current state.
//!
//! - Statuses default to [`WalletStatus::Active`] when unset.
//! - Only the configured admin may change a wallet's status.

#![no_std]

mod types;

use soroban_sdk::{contract, contractimpl, contracttype, panic_with_error, Address, Env};

pub use crate::types::WalletStatus;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    WalletStatus(Address),
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum WalletStatusError {
    NotInitialized = 1,
    Unauthorized = 2,
}

impl From<WalletStatusError> for soroban_sdk::Error {
    fn from(e: WalletStatusError) -> Self {
        soroban_sdk::Error::from_contract_error(e as u32)
    }
}

#[contract]
pub struct WalletStatusContract;

#[contractimpl]
impl WalletStatusContract {
    /// Initializes the contract with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Returns the current status of `wallet`, defaulting to `Active`.
    pub fn get_wallet_status(env: Env, wallet: Address) -> WalletStatus {
        env.storage()
            .instance()
            .get(&DataKey::WalletStatus(wallet))
            .unwrap_or(WalletStatus::Active)
    }

    /// Sets the status of `wallet`. Admin only.
    pub fn set_wallet_status(env: Env, caller: Address, wallet: Address, status: WalletStatus) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, WalletStatusError::NotInitialized));

        if caller != admin {
            panic_with_error!(&env, WalletStatusError::Unauthorized);
        }
        caller.require_auth();

        env.storage()
            .instance()
            .set(&DataKey::WalletStatus(wallet), &status);
    }
}

#[cfg(test)]
mod test;
