//! Validation utilities for cross-contract interactions

use soroban_sdk::{Address, Env, Symbol, Vec};

use crate::types::{CrossContractCall, DataKey};
use crate::CrossContractError;

/// Validates a contract address
pub fn validate_contract_address(env: &Env, address: &Address) -> Result<(), CrossContractError> {
    // Check if address is valid (non-zero)
    if address.to_string().len() == 0 {
        return Err(CrossContractError::InvalidContractAddress);
    }
    Ok(())
}

/// Validates a function name
pub fn validate_function_name(function_name: &Symbol) -> Result<(), CrossContractError> {
    // Check if function name is not empty
    if function_name.to_string().len() == 0 {
        return Err(CrossContractError::InvalidFunctionName);
    }
    Ok(())
}

/// Validates a cross-contract call request
pub fn validate_call_request(
    env: &Env,
    call: &CrossContractCall,
    require_whitelist: bool,
) -> Result<(), CrossContractError> {
    // Validate contract address
    validate_contract_address(env, &call.contract_address)?;

    // Validate function name
    validate_function_name(&call.function_name)?;

    // Check whitelist if required
    if require_whitelist && !is_whitelisted(env, &call.contract_address) {
        return Err(CrossContractError::ContractNotWhitelisted);
    }

    Ok(())
}

/// Validates a batch of cross-contract calls
pub fn validate_batch_calls(
    env: &Env,
    calls: &Vec<CrossContractCall>,
    require_whitelist: bool,
) -> Result<(), CrossContractError> {
    let call_count = calls.len();

    // Check if batch is empty
    if call_count == 0 {
        return Err(CrossContractError::EmptyBatch);
    }

    // Check if batch exceeds maximum size
    if call_count > crate::types::MAX_BATCH_CALLS {
        return Err(CrossContractError::BatchTooLarge);
    }

    // Validate each call
    for i in 0..call_count {
        let call = calls.get(i).unwrap();
        validate_call_request(env, &call, require_whitelist)?;
    }

    Ok(())
}

/// Checks if a contract address is whitelisted
pub fn is_whitelisted(env: &Env, contract: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Whitelist(contract.clone()))
        .unwrap_or(false)
}
