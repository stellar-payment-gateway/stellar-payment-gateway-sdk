//! # Batch Currency Conversion Contract
//!
//! This contract enables batch conversion of multiple assets for multiple users.
//!
//! ## Features
//! - Batch processing of currency conversions
//! - Partial failure handling (continues if one conversion fails)
//! - Detailed event emission for each conversion
//! - Gas optimized with batched storage updates
//! - Validates all amounts and currency types
//!
//! ## Conversion Mechanism
//! The contract admin sets an exchange rate per asset pair
//! (`rate_numerator / rate_denominator`) via [`BatchConversionContract::set_conversion_rate`].
//! The contract holds `to_asset` liquidity; on conversion it pulls `from_asset`
//! from the user into the contract and pays out the computed `amount_out` from
//! its liquidity. `min_amount_out` provides slippage protection.
//!
//! This keeps the exchange logic on-chain and auditable; a price oracle or DEX
//! integration can replace the admin-set rate by feeding the same
//! numerator/denominator pair from a trusted source.

#![no_std]

mod types;
mod validation;

use soroban_sdk::{contract, contractimpl, panic_with_error, token, Address, Env, Vec};

pub use crate::types::{
    BatchConversionResult, ConversionEvents, ConversionRate, ConversionRequest, ConversionResult,
    DataKey, MAX_BATCH_SIZE,
};
use crate::validation::{
    validate_address, validate_amount, validate_asset_pair, validate_min_output,
};

/// Error codes for the batch conversion contract.
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum BatchConversionError {
    /// Contract not initialized
    NotInitialized = 1,
    /// Caller is not authorized
    Unauthorized = 2,
    /// Invalid batch data
    InvalidBatch = 3,
    /// Batch is empty
    EmptyBatch = 4,
    /// Batch exceeds maximum size
    BatchTooLarge = 5,
    /// Invalid asset address
    InvalidAsset = 6,
    /// Insufficient balance
    InsufficientBalance = 7,
    /// Slippage tolerance exceeded
    SlippageExceeded = 8,
    /// No conversion rate configured for the asset pair
    RateNotFound = 9,
    /// Invalid conversion rate (non-positive numerator/denominator)
    InvalidRate = 10,
    /// Invalid withdrawal amount (non-positive)
    InvalidAmount = 11,
    /// Withdrawal exceeds the contract's available liquidity
    InsufficientLiquidity = 12,
}

impl From<BatchConversionError> for soroban_sdk::Error {
    fn from(e: BatchConversionError) -> Self {
        soroban_sdk::Error::from_contract_error(e as u32)
    }
}

#[contract]
pub struct BatchConversionContract;

#[contractimpl]
impl BatchConversionContract {
    /// Initializes the contract with an admin address.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TotalBatches, &0u64);
        env.storage()
            .instance()
            .set(&DataKey::TotalConversionsProcessed, &0u64);
        env.storage()
            .instance()
            .set(&DataKey::TotalVolumeConverted, &0i128);
    }

    /// Executes batch currency conversions for multiple users.
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `conversions` - Vector of conversion requests
    ///
    /// # Returns
    /// `BatchConversionResult` containing success/failure details for each conversion
    ///
    /// # Implementation Notes
    /// - Uses two-pass validation (validate all, then execute)
    /// - Handles partial failures (continues if one fails)
    /// - Emits events for each conversion
    /// - Optimized with batched storage updates
    pub fn batch_convert_currency(
        env: Env,
        conversions: Vec<ConversionRequest>,
    ) -> BatchConversionResult {
        // Validate batch size
        let request_count = conversions.len();
        if request_count == 0 {
            panic_with_error!(&env, BatchConversionError::EmptyBatch);
        }
        if request_count > MAX_BATCH_SIZE {
            panic_with_error!(&env, BatchConversionError::BatchTooLarge);
        }

        // Get batch ID and increment
        let batch_id: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalBatches)
            .unwrap_or(0)
            + 1;

        // Emit batch started event
        ConversionEvents::batch_started(&env, batch_id, request_count);

        // Initialize result vectors
        let mut results: Vec<ConversionResult> = Vec::new(&env);
        let mut successful_count: u32 = 0;
        let mut failed_count: u32 = 0;
        let mut total_converted: i128 = 0;

        // First pass: Validate all requests
        let mut validated_requests: Vec<(ConversionRequest, bool, u32)> = Vec::new(&env);

        for request in conversions.iter() {
            let mut is_valid = true;
            let mut error_code = 0u32;

            // Validate user address
            if validate_address(&env, &request.user).is_err() {
                is_valid = false;
                error_code = 0; // Invalid user address
            }
            // Validate from_asset address
            else if validate_address(&env, &request.from_asset).is_err() {
                is_valid = false;
                error_code = 1; // Invalid from_asset address
            }
            // Validate to_asset address
            else if validate_address(&env, &request.to_asset).is_err() {
                is_valid = false;
                error_code = 2; // Invalid to_asset address
            }
            // Validate amount_in
            else if validate_amount(request.amount_in).is_err() {
                is_valid = false;
                error_code = 3; // Invalid amount_in
            }
            // Validate min_amount_out
            else if validate_min_output(request.min_amount_out).is_err() {
                is_valid = false;
                error_code = 4; // Invalid min_amount_out
            }
            // Validate asset pair (not same asset)
            else if validate_asset_pair(&request.from_asset, &request.to_asset).is_err() {
                is_valid = false;
                error_code = 5; // Same asset conversion
            }

            validated_requests.push_back((request.clone(), is_valid, error_code));
        }

        // Second pass: Execute conversions
        for (request, is_valid, error_code) in validated_requests.iter() {
            if !is_valid {
                // Validation failed - record and continue
                results.push_back(ConversionResult::Failure(
                    request.user.clone(),
                    request.from_asset.clone(),
                    request.to_asset.clone(),
                    request.amount_in,
                    error_code,
                ));
                failed_count += 1;
                ConversionEvents::conversion_failure(
                    &env,
                    batch_id,
                    &request.user,
                    &request.from_asset,
                    &request.to_asset,
                    request.amount_in,
                    error_code,
                );
                continue;
            }

            // Execute conversion
            match Self::execute_conversion(&env, &request) {
                Ok(amount_out) => {
                    // Conversion succeeded
                    results.push_back(ConversionResult::Success(
                        request.user.clone(),
                        request.from_asset.clone(),
                        request.to_asset.clone(),
                        request.amount_in,
                        amount_out,
                    ));
                    successful_count += 1;
                    total_converted = total_converted
                        .checked_add(request.amount_in)
                        .unwrap_or(total_converted);

                    ConversionEvents::conversion_success(
                        &env,
                        batch_id,
                        &request.user,
                        &request.from_asset,
                        &request.to_asset,
                        request.amount_in,
                        amount_out,
                    );
                }
                Err(error_code) => {
                    // Conversion failed
                    results.push_back(ConversionResult::Failure(
                        request.user.clone(),
                        request.from_asset.clone(),
                        request.to_asset.clone(),
                        request.amount_in,
                        error_code,
                    ));
                    failed_count += 1;
                    ConversionEvents::conversion_failure(
                        &env,
                        batch_id,
                        &request.user,
                        &request.from_asset,
                        &request.to_asset,
                        request.amount_in,
                        error_code,
                    );
                }
            }
        }

        // Store output amounts for this batch
        let mut output_amounts: Vec<i128> = Vec::new(&env);
        for result in results.iter() {
            match result {
                ConversionResult::Success(_, _, _, _, amount_out) => {
                    output_amounts.push_back(amount_out)
                }
                ConversionResult::Failure(_, _, _, _, _) => output_amounts.push_back(0),
            }
        }
        env.storage()
            .persistent()
            .set(&DataKey::BatchOutput(batch_id), &output_amounts);

        // Update storage (batched at the end for gas efficiency)
        let total_batches: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalBatches)
            .unwrap_or(0);
        let total_processed: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TotalConversionsProcessed)
            .unwrap_or(0);
        let total_volume: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalVolumeConverted)
            .unwrap_or(0);

        env.storage()
            .instance()
            .set(&DataKey::TotalBatches, &(total_batches + 1));
        env.storage().instance().set(
            &DataKey::TotalConversionsProcessed,
            &(total_processed + request_count as u64),
        );
        env.storage().instance().set(
            &DataKey::TotalVolumeConverted,
            &total_converted
                .checked_add(total_volume)
                .unwrap_or(i128::MAX),
        );

        // Emit batch completed event
        ConversionEvents::batch_completed(
            &env,
            batch_id,
            successful_count,
            failed_count,
            total_converted,
        );

        BatchConversionResult {
            total_requests: request_count,
            successful: successful_count,
            failed: failed_count,
            total_converted,
            results,
        }
    }

    /// Returns the total number of batches processed.
    pub fn get_total_batches(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::TotalBatches)
            .unwrap_or(0)
    }

    /// Returns the total number of conversions processed.
    pub fn get_total_conversions_processed(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::TotalConversionsProcessed)
            .unwrap_or(0)
    }

    /// Returns the total volume converted.
    pub fn get_total_volume_converted(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalVolumeConverted)
            .unwrap_or(0)
    }

    /// Returns the output amounts for each item in a completed batch conversion.
    /// Returns an empty vec for an unknown batch id.
    pub fn get_batch_conversion_output(env: Env, batch_id: u64) -> Vec<i128> {
        env.storage()
            .persistent()
            .get(&DataKey::BatchOutput(batch_id))
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Sets the exchange rate for an asset pair. Admin only.
    ///
    /// The rate expresses how many units of `to_asset` are received per unit of
    /// `from_asset`: `amount_out = amount_in * rate_numerator / rate_denominator`.
    pub fn set_conversion_rate(
        env: Env,
        from_asset: Address,
        to_asset: Address,
        rate_numerator: i128,
        rate_denominator: i128,
    ) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, BatchConversionError::NotInitialized));
        admin.require_auth();

        if rate_numerator <= 0 || rate_denominator <= 0 {
            panic_with_error!(&env, BatchConversionError::InvalidRate);
        }

        let rate = ConversionRate {
            from_asset: from_asset.clone(),
            to_asset: to_asset.clone(),
            rate_numerator,
            rate_denominator,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Rate(from_asset, to_asset), &rate);
    }

    /// Returns the configured exchange rate for an asset pair, if any.
    pub fn get_conversion_rate(
        env: Env,
        from_asset: Address,
        to_asset: Address,
    ) -> Option<ConversionRate> {
        env.storage()
            .persistent()
            .get(&DataKey::Rate(from_asset, to_asset))
    }

    /// Returns the contract's current balance of `asset` (its conversion liquidity).
    pub fn get_liquidity(env: Env, asset: Address) -> i128 {
        let token = token::Client::new(&env, &asset);
        token.balance(&env.current_contract_address())
    }

    /// Withdraws `amount` of `asset` from the contract's conversion liquidity to
    /// the admin. Admin only. The withdrawal is capped by the contract's actual
    /// balance, so the contract can never overdraw its liquidity.
    pub fn withdraw_liquidity(env: Env, asset: Address, amount: i128) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, BatchConversionError::NotInitialized));
        admin.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, BatchConversionError::InvalidAmount);
        }

        let token = token::Client::new(&env, &asset);
        let balance = token.balance(&env.current_contract_address());
        if amount > balance {
            panic_with_error!(&env, BatchConversionError::InsufficientLiquidity);
        }

        token.transfer(&env.current_contract_address(), &admin, &amount);
        ConversionEvents::liquidity_withdrawn(&env, &asset, &admin, amount);
    }

    // Internal helper to execute a single conversion.
    //
    // Mechanism:
    // 1. Load the admin-configured rate for the (from_asset, to_asset) pair.
    // 2. Compute `amount_out = amount_in * rate_numerator / rate_denominator`
    //    with checked arithmetic.
    // 3. Enforce slippage protection: `amount_out >= min_amount_out`.
    // 4. Pull `from_asset` from the user into the contract's liquidity.
    // 5. Pay out `to_asset` from the contract's liquidity to the user.
    fn execute_conversion(env: &Env, request: &ConversionRequest) -> Result<i128, u32> {
        let from_token = token::Client::new(env, &request.from_asset);
        let to_token = token::Client::new(env, &request.to_asset);

        // Check user has sufficient balance
        let user_balance = from_token.balance(&request.user);
        if user_balance < request.amount_in {
            return Err(6); // Insufficient balance
        }

        // Load the configured exchange rate for this asset pair
        let rate: ConversionRate = env
            .storage()
            .persistent()
            .get(&DataKey::Rate(request.from_asset.clone(), request.to_asset.clone()))
            .ok_or(9u32)?; // RateNotFound

        // amount_out = amount_in * rate_numerator / rate_denominator (checked)
        let amount_out = match request
            .amount_in
            .checked_mul(rate.rate_numerator)
            .and_then(|product| product.checked_div(rate.rate_denominator))
        {
            Some(value) => value,
            // Arithmetic overflow or division by zero
            None => return Err(10), // InvalidRate
        };
        // A zero-rounded output (e.g. tiny amount with a sub-unit rate) fails the
        // slippage check below, since `min_amount_out` is validated to be positive.

        // Slippage protection: actual output must meet the user's minimum
        if amount_out < request.min_amount_out {
            return Err(8); // SlippageExceeded
        }

        // Authorize the user and execute the swap
        request.user.require_auth();

        // 1. Transfer from_asset from the user to the contract (liquidity in)
        from_token.transfer(&request.user, &env.current_contract_address(), &request.amount_in);

        // 2. Transfer to_asset from the contract's liquidity to the user (pay out)
        to_token.transfer(&env.current_contract_address(), &request.user, &amount_out);

        Ok(amount_out)
    }
}

#[cfg(test)]
mod test;
