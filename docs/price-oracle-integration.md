# Price Oracle Integration

## Overview

The multi-currency wallet and currency conversion contracts use a real on-chain price oracle for defensible pricing. This document describes the oracle architecture, security features, and integration points.

## Architecture

### Components

1. **Oracle Interface** (`contracts/shared/src/oracle.rs`)
   - Defines the `PriceOracle` trait
   - Standardizes price fetching across providers
   - Enables swapping oracle providers

2. **Reflector Oracle Adapter** (`contracts/shared/src/reflector_oracle.rs`)
   - Integrates with Reflector-style oracles via real cross-contract calls
   - Expected oracle interface: `get_price(base: String, quote: String) -> Price` and `get_twap(base: String, quote: String, window_seconds: u64) -> Price`, where `Price` is the 7-decimal struct from `contracts/shared/src/oracle.rs`
   - Supports TWAP (Time-Weighted Average Price)
   - Handles price staleness checking (`is_fresh` compares observation timestamps against the configured threshold)
   - **Fails loudly** (`OracleUnavailable`) when the oracle is unreachable instead of fabricating a rate

3. **Oracle Manager** (`contracts/multi-currency-wallet/src/oracle.rs`)
   - Validates price freshness
   - Checks manipulation resistance
   - Enforces deviation bounds

### Price Flow

```text
wallet.convert_currency()
  -> OracleManager::get_validated_price()
       -> ReflectorOracle::get_price()   // cross-contract call to the oracle
       -> staleness check (price.timestamp vs now)
       -> ReflectorOracle::get_twap()    // manipulation-resistance baseline
       -> deviation + spike checks
  -> wallet applies the validated rate
```
