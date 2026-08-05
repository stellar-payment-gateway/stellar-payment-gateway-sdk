use soroban_sdk::Env;

use crate::errors::SharedError;

pub const SECONDS_PER_MINUTE: u64 = 60;
pub const SECONDS_PER_HOUR: u64 = 3_600;
pub const SECONDS_PER_DAY: u64 = 86_400;
pub const SECONDS_PER_WEEK: u64 = 604_800;
pub const SECONDS_PER_MONTH: u64 = 2_592_000; // 30 days
pub const SECONDS_PER_YEAR: u64 = 31_536_000; // 365 days

// ---------------------------------------------------------------------------
// Duration
// ---------------------------------------------------------------------------

/// Composes a duration in seconds from its component parts.
///
/// Returns `Err(SharedError::ArithmeticOverflow)` if the total exceeds `u64::MAX`.
pub fn duration_from_parts(
    days: u64,
    hours: u64,
    minutes: u64,
    secs: u64,
) -> Result<u64, SharedError> {
    let d = days
        .checked_mul(SECONDS_PER_DAY)
        .ok_or(SharedError::ArithmeticOverflow)?;
    let h = hours
        .checked_mul(SECONDS_PER_HOUR)
        .ok_or(SharedError::ArithmeticOverflow)?;
    let m = minutes
        .checked_mul(SECONDS_PER_MINUTE)
        .ok_or(SharedError::ArithmeticOverflow)?;

    d.checked_add(h)
        .and_then(|t| t.checked_add(m))
        .and_then(|t| t.checked_add(secs))
        .ok_or(SharedError::ArithmeticOverflow)
}

// ---------------------------------------------------------------------------
// Expiration
// ---------------------------------------------------------------------------

/// Returns the Unix timestamp at which something expires (`now + duration_secs`).
///
/// Panics on overflow; use `checked_add` directly if you need a fallible version.
pub fn expiration_timestamp(env: &Env, duration_secs: u64) -> u64 {
    env.ledger()
        .timestamp()
        .checked_add(duration_secs)
        .expect("expiration timestamp overflow")
}

/// Returns `true` if `expires_at` is in the past (i.e., the item has expired).
pub fn is_expired(env: &Env, expires_at: u64) -> bool {
    env.ledger().timestamp() >= expires_at
}

/// Returns the number of seconds until `expires_at`, or `None` if already expired.
pub fn seconds_until_expiry(env: &Env, expires_at: u64) -> Option<u64> {
    expires_at.checked_sub(env.ledger().timestamp())
}

/// Errors with `SharedError::Expired` if `expires_at` is in the past.
pub fn assert_not_expired(env: &Env, expires_at: u64) -> Result<(), SharedError> {
    if is_expired(env, expires_at) {
        Err(SharedError::Expired)
    } else {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Recurring periods
// ---------------------------------------------------------------------------

/// Computes the timestamp of the next scheduled occurrence after `last_execution`.
pub fn next_occurrence(last_execution: u64, interval_secs: u64) -> u64 {
    last_execution
        .checked_add(interval_secs)
        .expect("next_occurrence overflow")
}

/// Returns `true` if enough time has passed since `last_execution` for the next
/// period to be due.
pub fn is_period_due(env: &Env, last_execution: u64, interval_secs: u64) -> bool {
    env.ledger().timestamp() >= next_occurrence(last_execution, interval_secs)
}

/// Returns how many complete periods of `interval_secs` have elapsed since `start`.
///
/// Returns `0` if `start` is in the future or `interval_secs` is zero.
pub fn periods_elapsed(env: &Env, start: u64, interval_secs: u64) -> u64 {
    if interval_secs == 0 {
        return 0;
    }
    let now = env.ledger().timestamp();
    if now <= start {
        return 0;
    }
    (now - start) / interval_secs
}

/// Errors with `SharedError::TooEarly` if the next period is not yet due.
pub fn assert_period_due(
    env: &Env,
    last_execution: u64,
    interval_secs: u64,
) -> Result<(), SharedError> {
    if !is_period_due(env, last_execution, interval_secs) {
        Err(SharedError::TooEarly)
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
    use soroban_sdk::{contract, contractimpl, Env};

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

    // --- duration_from_parts ---

    #[test]
    fn duration_one_day() {
        assert_eq!(duration_from_parts(1, 0, 0, 0), Ok(86_400));
    }

    #[test]
    fn duration_mixed_parts() {
        // 1d 2h 3m 4s = 86400 + 7200 + 180 + 4 = 93784
        assert_eq!(duration_from_parts(1, 2, 3, 4), Ok(93_784));
    }

    #[test]
    fn duration_zero_parts() {
        assert_eq!(duration_from_parts(0, 0, 0, 0), Ok(0));
    }

    #[test]
    fn duration_overflow_returns_error() {
        assert_eq!(
            duration_from_parts(u64::MAX, 1, 0, 0),
            Err(SharedError::ArithmeticOverflow)
        );
    }

    // --- expiration ---

    #[test]
    fn expiration_timestamp_adds_duration() {
        let env = env_at(1_000_000);
        assert_eq!(expiration_timestamp(&env, SECONDS_PER_DAY), 1_086_400);
    }

    #[test]
    fn not_expired_before_deadline() {
        let env = env_at(999);
        assert!(!is_expired(&env, 1_000));
    }

    #[test]
    fn expired_at_deadline() {
        let env = env_at(1_000);
        assert!(is_expired(&env, 1_000));
    }

    #[test]
    fn expired_after_deadline() {
        let env = env_at(1_001);
        assert!(is_expired(&env, 1_000));
    }

    #[test]
    fn seconds_until_expiry_returns_remaining() {
        let env = env_at(900);
        assert_eq!(seconds_until_expiry(&env, 1_000), Some(100));
    }

    #[test]
    fn seconds_until_expiry_returns_none_when_expired() {
        let env = env_at(1_001);
        assert_eq!(seconds_until_expiry(&env, 1_000), None);
    }

    #[test]
    fn assert_not_expired_ok_before_deadline() {
        let env = env_at(999);
        assert!(assert_not_expired(&env, 1_000).is_ok());
    }

    #[test]
    fn assert_not_expired_errors_when_expired() {
        let env = env_at(1_000);
        assert_eq!(assert_not_expired(&env, 1_000), Err(SharedError::Expired));
    }

    // --- recurring periods ---

    #[test]
    fn next_occurrence_adds_interval() {
        assert_eq!(next_occurrence(1_000, SECONDS_PER_DAY), 1_000 + 86_400);
    }

    #[test]
    fn period_not_due_before_interval() {
        let env = env_at(1_000 + SECONDS_PER_DAY - 1);
        assert!(!is_period_due(&env, 1_000, SECONDS_PER_DAY));
    }

    #[test]
    fn period_due_exactly_at_interval() {
        let env = env_at(1_000 + SECONDS_PER_DAY);
        assert!(is_period_due(&env, 1_000, SECONDS_PER_DAY));
    }

    #[test]
    fn period_due_after_interval() {
        let env = env_at(1_000 + SECONDS_PER_DAY + 1);
        assert!(is_period_due(&env, 1_000, SECONDS_PER_DAY));
    }

    #[test]
    fn periods_elapsed_zero_before_start() {
        let env = env_at(500);
        assert_eq!(periods_elapsed(&env, 1_000, SECONDS_PER_DAY), 0);
    }

    #[test]
    fn periods_elapsed_zero_interval_guard() {
        let env = env_at(9_000);
        assert_eq!(periods_elapsed(&env, 1_000, 0), 0);
    }

    #[test]
    fn periods_elapsed_counts_complete_periods() {
        // start=0, interval=100, now=350 → 3 complete periods
        let env = env_at(350);
        assert_eq!(periods_elapsed(&env, 0, 100), 3);
    }

    #[test]
    fn assert_period_due_ok_when_due() {
        let env = env_at(1_000 + SECONDS_PER_HOUR);
        assert!(assert_period_due(&env, 1_000, SECONDS_PER_HOUR).is_ok());
    }

    #[test]
    fn assert_period_due_errors_too_early() {
        let env = env_at(1_000 + SECONDS_PER_HOUR - 1);
        assert_eq!(
            assert_period_due(&env, 1_000, SECONDS_PER_HOUR),
            Err(SharedError::TooEarly)
        );
    }
}
