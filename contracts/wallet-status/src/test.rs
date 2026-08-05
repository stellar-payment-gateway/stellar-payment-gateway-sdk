//! Integration tests for the wallet-status contract.

#![cfg(test)]

use crate::types::WalletStatus;
use crate::{WalletStatusContract, WalletStatusContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

fn setup() -> (Env, Address, WalletStatusContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(WalletStatusContract, ());
    let client = WalletStatusContractClient::new(&env, &contract_id);
    client.initialize(&admin);

    (env, admin, client)
}

#[test]
fn unset_status_defaults_to_active() {
    let (_env, _admin, client) = setup();
    let wallet = Address::generate(&Env::default());

    assert_eq!(client.get_wallet_status(&wallet), WalletStatus::Active);
}

#[test]
fn admin_sets_and_reads_status() {
    let (env, admin, client) = setup();
    let wallet = Address::generate(&env);

    client.set_wallet_status(&admin, &wallet, &WalletStatus::Paused);
    assert_eq!(client.get_wallet_status(&wallet), WalletStatus::Paused);

    client.set_wallet_status(&admin, &wallet, &WalletStatus::Restricted);
    assert_eq!(client.get_wallet_status(&wallet), WalletStatus::Restricted);

    client.set_wallet_status(&admin, &wallet, &WalletStatus::Active);
    assert_eq!(client.get_wallet_status(&wallet), WalletStatus::Active);
}

#[test]
#[should_panic]
fn non_admin_cannot_set_status() {
    let (env, _admin, client) = setup();
    let wallet = Address::generate(&env);
    let impostor = Address::generate(&env);

    // Even with mock auth, the contract checks the caller equals the admin.
    client.set_wallet_status(&impostor, &wallet, &WalletStatus::Restricted);
}

#[test]
#[should_panic]
fn set_status_before_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let wallet = Address::generate(&env);
    let caller = Address::generate(&env);
    let contract_id = env.register(WalletStatusContract, ());
    let client = WalletStatusContractClient::new(&env, &contract_id);

    client.set_wallet_status(&caller, &wallet, &WalletStatus::Paused);
}
