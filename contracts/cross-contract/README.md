# Cross-Contract Interaction Module

This module provides secure cross-contract interaction capabilities for Stellar Payment Gateway SDK, allowing the platform to interact with external Soroban contracts in a controlled and validated manner.

## Features

- **Secure Contract Calls**: Execute calls to external Soroban contracts with proper validation
- **Whitelist Management**: Control which contracts can be called through a whitelist system
- **Batch Operations**: Execute multiple cross-contract calls in a single transaction
- **Error Handling**: Graceful failure handling with continue-on-failure support
- **Event Emission**: Comprehensive event logging for all cross-contract interactions
- **Statistics Tracking**: Monitor success/failure rates of cross-contract calls

## Core Functions

### Initialization

```rust
pub fn initialize(env: Env, admin: Address)
```

Initializes the contract with an admin address who has permission to manage whitelists and execute calls.

### Single Call Execution

```rust
pub fn execute_call(
    env: Env,
    caller: Address,
    call: CrossContractCall,
    require_whitelist: bool,
) -> CallResult
```

Executes a single cross-contract call. The `require_whitelist` parameter determines whether the target contract must be whitelisted.

### Batch Call Execution

```rust
pub fn execute_batch(
    env: Env,
    caller: Address,
    calls: Vec<CrossContractCall>,
    require_whitelist: bool,
) -> BatchCallResult
```

Executes multiple cross-contract calls in sequence. Each call can specify whether to continue on failure.

### Whitelist Management

```rust
pub fn whitelist_contract(env: Env, caller: Address, contract: Address)
pub fn remove_from_whitelist(env: Env, caller: Address, contract: Address)
pub fn is_whitelisted(env: Env, contract: Address) -> bool
```

Manage the whitelist of approved contracts that can be called.

## Data Structures

### CrossContractCall

```rust
pub struct CrossContractCall {
    pub contract_address: Address,
    pub function_name: Symbol,
    pub args: Vec<Bytes>,
    pub continue_on_failure: bool,
}
```

Represents a single cross-contract call request.

### CallResult

```rust
pub struct CallResult {
    pub success: bool,
    pub return_data: Option<Bytes>,
    pub error_message: Option<Symbol>,
}
```

Contains the result of a cross-contract call.

### BatchCallResult

```rust
pub struct BatchCallResult {
    pub total_calls: u32,
    pub successful_calls: u32,
    pub failed_calls: u32,
    pub results: Vec<CallResult>,
}
```

Contains the results of a batch of cross-contract calls.

## Events

The contract emits the following events:

- `call_initiated`: When a cross-contract call is initiated
- `call_succeeded`: When a call completes successfully
- `call_failed`: When a call fails
- `batch_completed`: When a batch of calls completes
- `contract_whitelisted`: When a contract is added to the whitelist
- `contract_removed`: When a contract is removed from the whitelist

## Error Codes

- `NotInitialized (1)`: Contract has not been initialized
- `Unauthorized (2)`: Caller is not authorized to perform the action
- `InvalidContractAddress (3)`: The provided contract address is invalid
- `InvalidFunctionName (4)`: The provided function name is invalid
- `ContractNotWhitelisted (5)`: The target contract is not whitelisted
- `EmptyBatch (6)`: Attempted to execute an empty batch
- `BatchTooLarge (7)`: Batch exceeds maximum size (50 calls)
- `CallFailed (8)`: Cross-contract call failed

## Usage Example

```rust
use soroban_sdk::{Address, Bytes, Env, Symbol, Vec};
use cross_contract::{CrossContractCall, CrossContractInteractionClient};

// Initialize the contract
let admin = Address::generate(&env);
client.initialize(&admin);

// Whitelist a contract
let external_contract = Address::from_string("GXXX...");
client.whitelist_contract(&admin, &external_contract);

// Execute a single call
let call = CrossContractCall {
    contract_address: external_contract.clone(),
    function_name: Symbol::new(&env, "transfer"),
    args: vec![/* encoded arguments */],
    continue_on_failure: false,
};

let result = client.execute_call(&admin, &call, true);

// Execute a batch of calls
let mut calls = Vec::new(&env);
calls.push_back(call1);
calls.push_back(call2);

let batch_result = client.execute_batch(&admin, &calls, true);
```

## Security Considerations

1. **Whitelist Enforcement**: When `require_whitelist` is true, only whitelisted contracts can be called
2. **Admin Authorization**: All sensitive operations require admin authorization
3. **Validation**: All contract addresses and function names are validated before execution
4. **Error Isolation**: Failed calls don't affect subsequent calls when `continue_on_failure` is true
5. **Event Logging**: All operations are logged for audit purposes

## Testing

The module includes comprehensive tests covering:

- Contract initialization
- Whitelist management
- Single and batch call execution
- Error handling and validation
- Statistics tracking
- Event emission

Run tests with:

```bash
cargo test -p cross-contract
```

## Integration

To integrate this module into your Stellar Payment Gateway SDK application:

1. Add the contract to your workspace
2. Deploy the contract to the Stellar network
3. Initialize with an admin address
4. Whitelist trusted external contracts
5. Use the execute_call or execute_batch functions to interact with external contracts

## Limitations

- Maximum batch size: 50 calls per batch
- Requires admin authorization for all operations
- Contract addresses must be valid Stellar addresses
- Function names must be valid Soroban symbols
