//! Integration tests for the Batch Conversion Contract.

#![cfg(test)]

use crate::{
    BatchConversionContract, BatchConversionContractClient, ConversionRequest, ConversionResult,
};
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger},
    token, Address, Env, Vec,
};

/// Creates a test environment with the contract deployed and initialized.
///
/// Returns `(env, from_asset, from_token, from_token_admin, to_asset, to_token,
/// client, to_token_admin, contract_id)`.
#[allow(clippy::type_complexity)]
fn setup_test_env() -> (
    Env,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
    Address,
    token::Client<'static>,
    BatchConversionContractClient<'static>,
    token::StellarAssetClient<'static>,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().with_mut(|li| {
        li.sequence_number = 12345;
    });

    // Deploy from_asset token contract
    let from_asset_admin = Address::generate(&env);
    let from_asset: Address = env
        .register_stellar_asset_contract_v2(from_asset_admin.clone())
        .address();
    let from_token_client = token::Client::new(&env, &from_asset);
    let from_token_admin_client = token::StellarAssetClient::new(&env, &from_asset);

    // Deploy to_asset token contract
    let to_asset_admin = Address::generate(&env);
    let to_asset: Address = env
        .register_stellar_asset_contract_v2(to_asset_admin.clone())
        .address();
    let to_token_client = token::Client::new(&env, &to_asset);
    let to_token_admin_client = token::StellarAssetClient::new(&env, &to_asset);

    // Deploy batch conversion contract
    let contract_id = env.register(BatchConversionContract, ());
    let client = BatchConversionContractClient::new(&env, &contract_id);

    // Initialize (not required for batch processing, but keeps counters explicit)
    let admin = Address::generate(&env);
    client.initialize(&admin);

    (
        env,
        from_asset,
        from_token_client,
        from_token_admin_client,
        to_asset,
        to_token_client,
        client,
        to_token_admin_client,
        contract_id,
    )
}

fn create_conversion_request(
    user: Address,
    from_asset: Address,
    to_asset: Address,
    amount_in: i128,
    min_amount_out: i128,
) -> ConversionRequest {
    ConversionRequest {
        user,
        from_asset,
        to_asset,
        amount_in,
        min_amount_out,
    }
}

/// Configures a 1 : rate_numerator/rate_denominator rate for the pair and funds
/// the contract with `liquidity` units of `to_asset`.
fn set_up_rate_and_liquidity(
    client: &BatchConversionContractClient<'static>,
    from_asset: &Address,
    to_asset: &Address,
    rate_numerator: i128,
    rate_denominator: i128,
    to_token_admin: &token::StellarAssetClient<'static>,
    contract_id: &Address,
    liquidity: i128,
) {
    client.set_conversion_rate(from_asset, to_asset, &rate_numerator, &rate_denominator);
    to_token_admin.mint(contract_id, &liquidity);
}

#[test]
fn test_batch_convert_single_success() {
    let (
        env,
        from_asset,
        from_token_client,
        from_token_admin_client,
        to_asset,
        to_token_client,
        client,
        to_token_admin_client,
        contract_id,
    ) = setup_test_env();

    let user = Address::generate(&env);
    from_token_admin_client.mint(&user, &1000);
    // 1 from_asset = 0.9 to_asset
    set_up_rate_and_liquidity(
        &client,
        &from_asset,
        &to_asset,
        9,
        10,
        &to_token_admin_client,
        &contract_id,
        1000,
    );

    let mut conversions: Vec<ConversionRequest> = Vec::new(&env);
    conversions.push_back(create_conversion_request(
        user.clone(),
        from_asset.clone(),
        to_asset.clone(),
        100,
        85, // min_amount_out below the 90 we expect (slippage allowed)
    ));

    let result = client.batch_convert_currency(&conversions);

    assert_eq!(result.total_requests, 1);
    assert_eq!(result.successful, 1);
    assert_eq!(result.failed, 0);
    assert_eq!(result.total_converted, 100);
    assert_eq!(result.results.len(), 1);

    match result.results.get(0).unwrap() {
        ConversionResult::Success(u, f, t, amount_in, amount_out) => {
            assert_eq!(u.clone(), user);
            assert_eq!(f.clone(), from_asset);
            assert_eq!(t.clone(), to_asset);
            assert_eq!(amount_in, 100);
            assert_eq!(amount_out, 90); // 100 * 9 / 10
        }
        _ => panic!("Expected success"),
    }

    // Tokens actually moved: user paid 100 from_asset and received 90 to_asset.
    assert_eq!(from_token_client.balance(&user), 900);
    assert_eq!(to_token_client.balance(&user), 90);
    assert_eq!(to_token_client.balance(&contract_id), 910);
}

#[test]
fn test_batch_convert_slippage_exceeded() {
    let (
        env,
        from_asset,
        _from_token_client,
        from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        to_token_admin_client,
        contract_id,
    ) = setup_test_env();

    let user = Address::generate(&env);
    from_token_admin_client.mint(&user, &1000);
    set_up_rate_and_liquidity(
        &client,
        &from_asset,
        &to_asset,
        9,
        10,
        &to_token_admin_client,
        &contract_id,
        1000,
    );

    let mut conversions: Vec<ConversionRequest> = Vec::new(&env);
    conversions.push_back(create_conversion_request(
        user.clone(),
        from_asset.clone(),
        to_asset.clone(),
        100,
        95, // actual output is 90 < 95 -> slippage exceeded
    ));

    let result = client.batch_convert_currency(&conversions);
    assert_eq!(result.total_requests, 1);
    assert_eq!(result.successful, 0);
    assert_eq!(result.failed, 1);
    assert_eq!(result.total_converted, 0);

    match result.results.get(0).unwrap() {
        ConversionResult::Failure(u, _f, _t, amount_in, error_code) => {
            assert_eq!(u.clone(), user);
            assert_eq!(amount_in, 100);
            assert_eq!(error_code, 8); // SlippageExceeded
        }
        _ => panic!("Expected failure"),
    }
}

#[test]
fn test_batch_convert_rate_not_set() {
    let (
        env,
        from_asset,
        _from_token_client,
        from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        _to_token_admin_client,
        _contract_id,
    ) = setup_test_env();

    let user = Address::generate(&env);
    from_token_admin_client.mint(&user, &1000);

    let mut conversions: Vec<ConversionRequest> = Vec::new(&env);
    conversions.push_back(create_conversion_request(
        user.clone(),
        from_asset.clone(),
        to_asset.clone(),
        100,
        90,
    ));

    let result = client.batch_convert_currency(&conversions);
    assert_eq!(result.total_requests, 1);
    assert_eq!(result.successful, 0);
    assert_eq!(result.failed, 1);

    match result.results.get(0).unwrap() {
        ConversionResult::Failure(u, _f, _t, _amount_in, error_code) => {
            assert_eq!(u.clone(), user);
            assert_eq!(error_code, 9); // RateNotFound
        }
        _ => panic!("Expected failure"),
    }
}

#[test]
fn test_batch_convert_insufficient_balance() {
    let (
        env,
        from_asset,
        _from_token_client,
        _from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        to_token_admin_client,
        contract_id,
    ) = setup_test_env();

    let user = Address::generate(&env);
    // No from_asset minted for the user.
    set_up_rate_and_liquidity(
        &client,
        &from_asset,
        &to_asset,
        9,
        10,
        &to_token_admin_client,
        &contract_id,
        1000,
    );

    let mut conversions: Vec<ConversionRequest> = Vec::new(&env);
    conversions.push_back(create_conversion_request(
        user.clone(),
        from_asset.clone(),
        to_asset.clone(),
        100,
        90,
    ));

    let result = client.batch_convert_currency(&conversions);
    assert_eq!(result.total_requests, 1);
    assert_eq!(result.successful, 0);
    assert_eq!(result.failed, 1);

    match result.results.get(0).unwrap() {
        ConversionResult::Failure(u, _f, _t, _amount_in, error_code) => {
            assert_eq!(u.clone(), user);
            assert_eq!(error_code, 6); // InsufficientBalance
        }
        _ => panic!("Expected failure"),
    }
}

#[test]
fn test_batch_convert_partial_failures_validation() {
    let (
        env,
        from_asset,
        _from_token_client,
        from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        to_token_admin_client,
        contract_id,
    ) = setup_test_env();

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    from_token_admin_client.mint(&user1, &1000);
    from_token_admin_client.mint(&user2, &1000);
    set_up_rate_and_liquidity(
        &client,
        &from_asset,
        &to_asset,
        9,
        10,
        &to_token_admin_client,
        &contract_id,
        1000,
    );

    let mut conversions: Vec<ConversionRequest> = Vec::new(&env);
    conversions.push_back(create_conversion_request(
        user1.clone(),
        from_asset.clone(),
        to_asset.clone(),
        -1,
        90,
    ));
    conversions.push_back(create_conversion_request(
        user2.clone(),
        from_asset.clone(),
        to_asset.clone(),
        100,
        90,
    ));

    let result = client.batch_convert_currency(&conversions);
    assert_eq!(result.total_requests, 2);
    assert_eq!(result.successful, 1);
    assert_eq!(result.failed, 1);
    assert_eq!(result.total_converted, 100);

    match result.results.get(0).unwrap() {
        ConversionResult::Failure(user, _from, _to, amount_in, error_code) => {
            assert_eq!(user.clone(), user1);
            assert_eq!(amount_in, -1);
            assert_eq!(error_code, 3); // invalid amount_in
        }
        _ => panic!("Expected failure"),
    }

    match result.results.get(1).unwrap() {
        ConversionResult::Success(u, _f, _t, amount_in, amount_out) => {
            assert_eq!(u.clone(), user2);
            assert_eq!(amount_in, 100);
            assert_eq!(amount_out, 90);
        }
        _ => panic!("Expected success"),
    }
}

#[test]
fn test_batch_convert_same_asset_rejected() {
    let (
        env,
        from_asset,
        _from_token_client,
        from_token_admin_client,
        _to_asset,
        _to_token_client,
        client,
        _to_token_admin_client,
        _contract_id,
    ) = setup_test_env();

    let user = Address::generate(&env);
    from_token_admin_client.mint(&user, &1000);

    let mut conversions: Vec<ConversionRequest> = Vec::new(&env);
    conversions.push_back(create_conversion_request(
        user.clone(),
        from_asset.clone(),
        from_asset.clone(),
        100,
        90,
    ));

    let result = client.batch_convert_currency(&conversions);
    assert_eq!(result.total_requests, 1);
    assert_eq!(result.successful, 0);
    assert_eq!(result.failed, 1);
    assert_eq!(result.total_converted, 0);

    match result.results.get(0).unwrap() {
        ConversionResult::Failure(_user, _from, _to, _amount_in, error_code) => {
            assert_eq!(error_code, 5); // same asset
        }
        _ => panic!("Expected failure"),
    }
}

#[test]
fn test_batch_convert_events_emitted() {
    let (
        env,
        from_asset,
        _from_token_client,
        from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        to_token_admin_client,
        contract_id,
    ) = setup_test_env();

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    from_token_admin_client.mint(&user1, &1000);
    from_token_admin_client.mint(&user2, &1000);
    set_up_rate_and_liquidity(
        &client,
        &from_asset,
        &to_asset,
        9,
        10,
        &to_token_admin_client,
        &contract_id,
        1000,
    );

    let mut conversions: Vec<ConversionRequest> = Vec::new(&env);
    conversions.push_back(create_conversion_request(
        user1,
        from_asset.clone(),
        to_asset.clone(),
        100,
        90,
    ));
    conversions.push_back(create_conversion_request(
        user2,
        from_asset.clone(),
        to_asset.clone(),
        -1,
        90,
    ));

    client.batch_convert_currency(&conversions);

    let events = env.events().all();
    // Should have: batch_started, conversion_success (1), conversion_failure (1), batch_completed
    assert!(events.len() >= 4);
}

#[test]
fn test_batch_convert_accumulates_stats() {
    let (
        env,
        from_asset,
        _from_token_client,
        from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        to_token_admin_client,
        contract_id,
    ) = setup_test_env();

    let user = Address::generate(&env);
    from_token_admin_client.mint(&user, &10_000);
    set_up_rate_and_liquidity(
        &client,
        &from_asset,
        &to_asset,
        9,
        10,
        &to_token_admin_client,
        &contract_id,
        10_000,
    );

    let mut batch1: Vec<ConversionRequest> = Vec::new(&env);
    batch1.push_back(create_conversion_request(
        user.clone(),
        from_asset.clone(),
        to_asset.clone(),
        100,
        90,
    ));

    let mut batch2: Vec<ConversionRequest> = Vec::new(&env);
    batch2.push_back(create_conversion_request(
        user.clone(),
        from_asset.clone(),
        to_asset.clone(),
        200,
        180,
    ));

    assert_eq!(client.get_total_batches(), 0);
    assert_eq!(client.get_total_conversions_processed(), 0);
    assert_eq!(client.get_total_volume_converted(), 0);

    client.batch_convert_currency(&batch1);
    assert_eq!(client.get_total_batches(), 1);
    assert_eq!(client.get_total_conversions_processed(), 1);
    assert_eq!(client.get_total_volume_converted(), 100);

    client.batch_convert_currency(&batch2);
    assert_eq!(client.get_total_batches(), 2);
    assert_eq!(client.get_total_conversions_processed(), 2);
    assert_eq!(client.get_total_volume_converted(), 300);
}

#[test]
fn test_get_and_set_conversion_rate() {
    let (
        env,
        from_asset,
        _from_token_client,
        _from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        _to_token_admin_client,
        _contract_id,
    ) = setup_test_env();

    assert!(client.get_conversion_rate(&from_asset, &to_asset).is_none());

    client.set_conversion_rate(&from_asset, &to_asset, &9, &10);

    let rate = client.get_conversion_rate(&from_asset, &to_asset).unwrap();
    assert_eq!(rate.rate_numerator, 9);
    assert_eq!(rate.rate_denominator, 10);
    assert_eq!(rate.from_asset, from_asset);
    assert_eq!(rate.to_asset, to_asset);
}

#[test]
#[should_panic]
fn test_set_conversion_rate_invalid() {
    let (
        env,
        from_asset,
        _from_token_client,
        _from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        _to_token_admin_client,
        _contract_id,
    ) = setup_test_env();

    // Denominator must be positive
    client.set_conversion_rate(&from_asset, &to_asset, &9, &0);
}

#[test]
#[should_panic]
fn test_batch_convert_empty_batch() {
    let (
        env,
        _from_asset,
        _from_token_client,
        _from_token_admin_client,
        _to_asset,
        _to_token_client,
        client,
        _to_token_admin_client,
        _contract_id,
    ) = setup_test_env();

    let conversions: Vec<ConversionRequest> = Vec::new(&env);
    client.batch_convert_currency(&conversions);
}

#[test]
fn test_get_batch_conversion_output_unknown_id() {
    let (_env, _, _, _, _, _, client, _, _) = setup_test_env();
    let output = client.get_batch_conversion_output(&9999);
    assert_eq!(output.len(), 0);
}

#[test]
fn test_get_batch_conversion_output_correct_amounts() {
    let (
        env,
        from_asset,
        _from_token_client,
        from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        to_token_admin_client,
        contract_id,
    ) = setup_test_env();

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    from_token_admin_client.mint(&user1, &1000);
    from_token_admin_client.mint(&user2, &1000);
    set_up_rate_and_liquidity(
        &client,
        &from_asset,
        &to_asset,
        9,
        10,
        &to_token_admin_client,
        &contract_id,
        1000,
    );

    let mut conversions: Vec<ConversionRequest> = Vec::new(&env);
    // user1: valid — should produce amount_out = 100 * 9 / 10 = 90
    conversions.push_back(create_conversion_request(
        user1.clone(),
        from_asset.clone(),
        to_asset.clone(),
        100,
        90,
    ));
    // user2: invalid amount — should produce 0
    conversions.push_back(create_conversion_request(
        user2.clone(),
        from_asset.clone(),
        to_asset.clone(),
        -1,
        80,
    ));

    client.batch_convert_currency(&conversions);
    let batch_id = client.get_total_batches();

    let output = client.get_batch_conversion_output(&batch_id);
    assert_eq!(output.len(), 2);
    assert_eq!(output.get(0).unwrap(), 90);
    assert_eq!(output.get(1).unwrap(), 0);
}

#[test]
fn test_withdraw_liquidity_moves_tokens_and_decreases_balance() {
    let (
        _env,
        _from_asset,
        _from_token_client,
        _from_token_admin_client,
        to_asset,
        to_token_client,
        client,
        to_token_admin_client,
        contract_id,
    ) = setup_test_env();

    // Fund the contract with 1000 units of to_asset liquidity.
    to_token_admin_client.mint(&contract_id, &1000);
    assert_eq!(client.get_liquidity(&to_asset), 1000);

    // Admin is read from storage; mock_all_auths covers the authorization.
    client.withdraw_liquidity(&to_asset, &400);

    assert_eq!(client.get_liquidity(&to_asset), 600);
    assert_eq!(to_token_client.balance(&contract_id), 600);
}

#[test]
#[should_panic]
fn test_withdraw_liquidity_more_than_balance_panics() {
    let (
        _env,
        _from_asset,
        _from_token_client,
        _from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        to_token_admin_client,
        contract_id,
    ) = setup_test_env();

    to_token_admin_client.mint(&contract_id, &100);
    // 100 available, requesting 101 must panic.
    client.withdraw_liquidity(&to_asset, &101);
}

#[test]
#[should_panic]
fn test_withdraw_liquidity_non_positive_panics() {
    let (
        _env,
        _from_asset,
        _from_token_client,
        _from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        _to_token_admin_client,
        _contract_id,
    ) = setup_test_env();

    client.withdraw_liquidity(&to_asset, &0);
}

#[test]
#[should_panic]
fn test_withdraw_liquidity_before_initialize_panics() {
    let env = Env::default();
    env.mock_all_auths();

    let to_asset_admin = Address::generate(&env);
    let to_asset: Address = env
        .register_stellar_asset_contract_v2(to_asset_admin.clone())
        .address();
    let contract_id = env.register(BatchConversionContract, ());
    let client = BatchConversionContractClient::new(&env, &contract_id);

    // Never initialized: withdrawing must panic with NotInitialized.
    client.withdraw_liquidity(&to_asset, &10);
}

#[test]
fn test_get_liquidity_returns_zero_when_never_funded() {
    let (
        _env,
        _from_asset,
        _from_token_client,
        _from_token_admin_client,
        to_asset,
        _to_token_client,
        client,
        _to_token_admin_client,
        _contract_id,
    ) = setup_test_env();

    assert_eq!(client.get_liquidity(&to_asset), 0);
}
