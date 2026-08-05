//! Per-rule evaluation helpers.
//!
//! Each helper is pure (with the exception of category-limit checks which read
//! ledger time and spend tracking from storage) so that the orchestration in
//! `lib::evaluate_transaction` stays readable and the order of enforcement is
//! explicit and deterministic.

use soroban_sdk::{Address, Env, Symbol};

use crate::storage;
use crate::types::{
    CategoryLimitRule, MerchantAllowlistRule, MerchantBlocklistRule, TimeWindowRule,
    SECONDS_PER_DAY,
};

/// Returns `true` if `recipient` is present on the blocklist.
pub fn is_blocked(recipient: &Address, rule: &MerchantBlocklistRule) -> bool {
    rule.blocked.contains(recipient)
}

/// Returns `true` if `recipient` is present on the allowlist.
pub fn is_allowed(recipient: &Address, rule: &MerchantAllowlistRule) -> bool {
    rule.allowed.contains(recipient)
}

/// Returns `true` if `now` (a ledger timestamp) falls within the permitted
/// time-of-day window.
pub fn is_in_time_window(now: u64, rule: &TimeWindowRule) -> bool {
    let time_of_day = now % SECONDS_PER_DAY;
    if rule.start_seconds <= rule.end_seconds {
        // Normal range: [start, end)
        time_of_day >= rule.start_seconds && time_of_day < rule.end_seconds
    } else {
        // Wrap-around range spanning midnight: [start, 86400) ∪ [0, end)
        time_of_day >= rule.start_seconds || time_of_day < rule.end_seconds
    }
}

/// Returns `true` if spending `amount` in `category` for `wallet` would remain
/// within the configured `max_amount` for the current period.
pub fn is_within_category_limit(
    env: &Env,
    wallet: &Address,
    amount: i128,
    category: &Symbol,
    rule: &CategoryLimitRule,
) -> bool {
    let period_id = current_period_id(env, rule);
    let current = storage::get_category_spending(env, wallet, category, period_id);
    match current.checked_add(amount) {
        Some(total) => total <= rule.max_amount,
        None => false, // overflow => exceeds
    }
}

/// Records `amount` of spending against `wallet`/`category` for the current
/// period. Called only once a transaction is definitively approved.
pub fn record_category_spend(
    env: &Env,
    wallet: &Address,
    amount: i128,
    category: &Symbol,
    rule: &CategoryLimitRule,
) {
    let period_id = current_period_id(env, rule);
    let current = storage::get_category_spending(env, wallet, category, period_id);
    let new_total = current.checked_add(amount).unwrap_or(i128::MAX);
    storage::set_category_spending(env, wallet, category, period_id, new_total);
}

/// Computes the current period identifier from the ledger timestamp.
pub fn current_period_id(env: &Env, rule: &CategoryLimitRule) -> u64 {
    let now = env.ledger().timestamp();
    now / rule.period_seconds
}
