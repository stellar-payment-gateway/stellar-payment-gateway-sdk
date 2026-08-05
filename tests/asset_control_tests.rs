use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events as _},
    Address, Env, Error, InvokeError,
};

#[path = "../contracts/asset_control/src/lib.rs"]
mod asset_control;

use asset_control::{AssetControlContract, AssetControlContractClient, AssetControlError};

fn assert_contract_error<T>(result: Result<T, Result<Error, InvokeError>>, expected: AssetControlError) {
    match result {
        Err(Ok(error)) => assert_eq!(error, Error::from_contract_error(expected as u32)),
        other => panic!("expected contract error {:?}, got {:?}", expected, other),
    }
}

fn setup_test_contract() -> (Env, Address, AssetControlContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AssetControlContract, ());
    let client = AssetControlContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    (env, admin, client)
}

#[test]
fn test_initialize() {
    let (env, admin, client) = setup_test_contract();

    assert_eq!(client.is_blacklisted(&Address::generate(&env)), false);
}

#[test]
fn test_add_to_blacklist() {
    let (env, admin, client) = setup_test_contract();

    let asset = Address::generate(&env);
    client.add_to_blacklist(&asset);

    assert_eq!(client.is_blacklisted(&asset), true);

    // Check event
    let events = env.events().all();
    assert_eq!(events.len(), 1);
    assert_eq!(
        events[0].1,
        (symbol_short!("asset"), symbol_short!("blacklist"))
    );
}

#[test]
fn test_add_already_blacklisted() {
    let (env, admin, client) = setup_test_contract();

    let asset = Address::generate(&env);
    client.add_to_blacklist(&asset);

    let result = client.try_add_to_blacklist(&asset);
    assert_contract_error(result, AssetControlError::AlreadyBlacklisted);
}

#[test]
fn test_remove_from_blacklist() {
    let (env, admin, client) = setup_test_contract();

    let asset = Address::generate(&env);
    client.add_to_blacklist(&asset);
    assert_eq!(client.is_blacklisted(&asset), true);

    client.remove_from_blacklist(&asset);
    assert_eq!(client.is_blacklisted(&asset), false);

    // Check event
    let events = env.events().all();
    assert_eq!(events.len(), 2);
    assert_eq!(
        events[1].1,
        (symbol_short!("asset"), symbol_short!("unblack"))
    );
}

#[test]
fn test_remove_not_blacklisted() {
    let (env, admin, client) = setup_test_contract();

    let asset = Address::generate(&env);
    let result = client.try_remove_from_blacklist(&asset);
    assert_contract_error(result, AssetControlError::NotBlacklisted);
}

#[test]
fn test_check_asset_not_blacklisted() {
    let (env, admin, client) = setup_test_contract();

    let asset = Address::generate(&env);
    client.check_asset(&asset); // Should not panic
}

#[test]
fn test_check_asset_blacklisted() {
    let (env, admin, client) = setup_test_contract();

    let asset = Address::generate(&env);
    client.add_to_blacklist(&asset);

    let result = client.try_check_asset(&asset);
    assert_contract_error(result, AssetControlError::Unauthorized);

    // Check event
    let events = env.events().all();
    assert_eq!(
        events.last().unwrap().1,
        (symbol_short!("asset"), symbol_short!("blocked"))
    );
}

#[test]
fn test_unauthorized_add() {
    let (env, admin, client) = setup_test_contract();

    let unauthorized = Address::generate(&env);
    let asset = Address::generate(&env);

    let result = client.try_add_to_blacklist(&asset);
    assert_contract_error(result, AssetControlError::Unauthorized);
}
