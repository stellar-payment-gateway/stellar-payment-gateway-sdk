use soroban_sdk::{Address, Bytes, Env, String, Vec};

use crate::errors::SharedError;

// ---------------------------------------------------------------------------
// Batch size
// ---------------------------------------------------------------------------

/// Validates that a batch size is within the configured bounds.
///
/// This helper is intentionally generic so each contract can pass its own
/// configured `max_batch_size` constant and map failures to contract-specific
/// error codes.
pub fn validate_batch_size(batch_size: u32, max_batch_size: u32) -> Result<(), SharedError> {
    if batch_size == 0 || batch_size > max_batch_size {
        return Err(SharedError::InvalidLength);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Amounts
// ---------------------------------------------------------------------------

/// Accepts amounts strictly greater than zero.
///
/// Use for transfers, fees, or any value where zero has no meaning.
pub fn validate_positive_amount(amount: i128) -> Result<(), SharedError> {
    if amount <= 0 {
        Err(SharedError::InvalidAmount)
    } else {
        Ok(())
    }
}

/// Accepts amounts greater than or equal to zero.
///
/// Use for balances, rewards, or allocations where zero is a valid initial state.
pub fn validate_non_negative_amount(amount: i128) -> Result<(), SharedError> {
    if amount < 0 {
        Err(SharedError::InvalidAmount)
    } else {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Timestamps
// ---------------------------------------------------------------------------

/// Rejects the zero sentinel that signals an uninitialized timestamp.
pub fn validate_timestamp(ts: u64) -> Result<(), SharedError> {
    if ts == 0 {
        Err(SharedError::InvalidInput)
    } else {
        Ok(())
    }
}

/// Requires `ts` to be strictly in the future relative to the current ledger time.
pub fn validate_future_timestamp(env: &Env, ts: u64) -> Result<(), SharedError> {
    if ts <= env.ledger().timestamp() {
        Err(SharedError::TooEarly)
    } else {
        Ok(())
    }
}

/// Requires `start < end` so that a time window is well-formed.
pub fn validate_timestamp_range(start: u64, end: u64) -> Result<(), SharedError> {
    if start >= end {
        Err(SharedError::InvalidInput)
    } else {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

/// Requires `actual == expected`, returning `Unauthorized` otherwise.
///
/// Use to gate mutations on whether the caller is the resource owner.
pub fn validate_owner(actual: &Address, expected: &Address) -> Result<(), SharedError> {
    if actual != expected {
        Err(SharedError::Unauthorized)
    } else {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Non-empty values
// ---------------------------------------------------------------------------

/// Rejects an empty Soroban `String`.
pub fn validate_not_empty_str(s: &String) -> Result<(), SharedError> {
    if s.is_empty() {
        Err(SharedError::MissingRequiredField)
    } else {
        Ok(())
    }
}

/// Rejects an empty Soroban `Vec`.
pub fn validate_vec_not_empty<T>(v: &Vec<T>) -> Result<(), SharedError> {
    if v.is_empty() {
        Err(SharedError::MissingRequiredField)
    } else {
        Ok(())
    }
}

/// Rejects empty `Bytes`.
pub fn validate_bytes_not_empty(b: &Bytes) -> Result<(), SharedError> {
    if b.is_empty() {
        Err(SharedError::MissingRequiredField)
    } else {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{contract, contractimpl, Bytes, Env, String, Vec};

    #[contract]
    struct TestContract;

    #[contractimpl]
    impl TestContract {
        pub fn noop() {}
    }

    fn env_at(ts: u64) -> Env {
        let env = Env::default();
        env.ledger().with_mut(|l| l.timestamp = ts);
        env
    }

    // --- validate_batch_size ---

    #[test]
    fn batch_size_valid() {
        assert!(validate_batch_size(1, 100).is_ok());
        assert!(validate_batch_size(100, 100).is_ok());
    }

    #[test]
    fn batch_size_zero_rejected() {
        assert_eq!(validate_batch_size(0, 100), Err(SharedError::InvalidLength));
    }

    #[test]
    fn batch_size_exceeds_max() {
        assert_eq!(
            validate_batch_size(101, 100),
            Err(SharedError::InvalidLength)
        );
    }

    // --- validate_positive_amount ---

    #[test]
    fn positive_amount_accepts_one_and_large() {
        assert!(validate_positive_amount(1).is_ok());
        assert!(validate_positive_amount(1_000_000).is_ok());
        assert!(validate_positive_amount(i128::MAX).is_ok());
    }

    #[test]
    fn positive_amount_rejects_zero() {
        assert_eq!(validate_positive_amount(0), Err(SharedError::InvalidAmount));
    }

    #[test]
    fn positive_amount_rejects_negative() {
        assert_eq!(
            validate_positive_amount(-1),
            Err(SharedError::InvalidAmount)
        );
        assert_eq!(
            validate_positive_amount(i128::MIN),
            Err(SharedError::InvalidAmount)
        );
    }

    // --- validate_non_negative_amount ---

    #[test]
    fn non_negative_amount_accepts_zero_and_positive() {
        assert!(validate_non_negative_amount(0).is_ok());
        assert!(validate_non_negative_amount(1).is_ok());
        assert!(validate_non_negative_amount(i128::MAX).is_ok());
    }

    #[test]
    fn non_negative_amount_rejects_negative() {
        assert_eq!(
            validate_non_negative_amount(-1),
            Err(SharedError::InvalidAmount)
        );
    }

    // --- validate_timestamp ---

    #[test]
    fn timestamp_rejects_zero() {
        assert_eq!(validate_timestamp(0), Err(SharedError::InvalidInput));
    }

    #[test]
    fn timestamp_accepts_nonzero() {
        assert!(validate_timestamp(1).is_ok());
        assert!(validate_timestamp(1_700_000_000).is_ok());
    }

    // --- validate_future_timestamp ---

    #[test]
    fn future_timestamp_accepts_value_after_now() {
        let env = env_at(1_000);
        assert!(validate_future_timestamp(&env, 1_001).is_ok());
    }

    #[test]
    fn future_timestamp_rejects_equal_to_now() {
        let env = env_at(1_000);
        assert_eq!(
            validate_future_timestamp(&env, 1_000),
            Err(SharedError::TooEarly)
        );
    }

    #[test]
    fn future_timestamp_rejects_past_value() {
        let env = env_at(1_000);
        assert_eq!(
            validate_future_timestamp(&env, 999),
            Err(SharedError::TooEarly)
        );
    }

    // --- validate_timestamp_range ---

    #[test]
    fn timestamp_range_accepts_start_before_end() {
        assert!(validate_timestamp_range(100, 200).is_ok());
    }

    #[test]
    fn timestamp_range_rejects_equal_start_end() {
        assert_eq!(
            validate_timestamp_range(100, 100),
            Err(SharedError::InvalidInput)
        );
    }

    #[test]
    fn timestamp_range_rejects_start_after_end() {
        assert_eq!(
            validate_timestamp_range(200, 100),
            Err(SharedError::InvalidInput)
        );
    }

    // --- validate_owner ---

    #[test]
    fn owner_matches() {
        let env = Env::default();
        let addr = Address::generate(&env);
        assert!(validate_owner(&addr, &addr).is_ok());
    }

    #[test]
    fn owner_mismatch_returns_unauthorized() {
        let env = Env::default();
        let a = Address::generate(&env);
        let b = Address::generate(&env);
        assert_eq!(validate_owner(&a, &b), Err(SharedError::Unauthorized));
    }

    // --- validate_not_empty_str ---

    #[test]
    fn not_empty_str_accepts_nonempty() {
        let env = Env::default();
        let s = String::from_str(&env, "hello");
        assert!(validate_not_empty_str(&s).is_ok());
    }

    #[test]
    fn not_empty_str_rejects_empty() {
        let env = Env::default();
        let s = String::from_str(&env, "");
        assert_eq!(
            validate_not_empty_str(&s),
            Err(SharedError::MissingRequiredField)
        );
    }

    // --- validate_vec_not_empty ---

    #[test]
    fn vec_not_empty_accepts_nonempty() {
        let env = Env::default();
        let mut v: Vec<u32> = Vec::new(&env);
        v.push_back(1u32);
        assert!(validate_vec_not_empty(&v).is_ok());
    }

    #[test]
    fn vec_not_empty_rejects_empty() {
        let env = Env::default();
        let v: Vec<u32> = Vec::new(&env);
        assert_eq!(
            validate_vec_not_empty(&v),
            Err(SharedError::MissingRequiredField)
        );
    }

    // --- validate_bytes_not_empty ---

    #[test]
    fn bytes_not_empty_accepts_nonempty() {
        let env = Env::default();
        let b = Bytes::from_slice(&env, &[1u8]);
        assert!(validate_bytes_not_empty(&b).is_ok());
    }

    #[test]
    fn bytes_not_empty_rejects_empty() {
        let env = Env::default();
        let b = Bytes::new(&env);
        assert_eq!(
            validate_bytes_not_empty(&b),
            Err(SharedError::MissingRequiredField)
        );
    }
}
