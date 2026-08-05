//! Validation logic for spending policies.
//!
//! `validate_policy` is called by `set_policy` **before** any storage write
//! occurs, which guarantees that policy replacement is atomic: either the new
//! policy is fully valid and persisted, or the call panics and the previous
//! policy remains untouched.
//!
//! # Conflict resolution (allowlist vs blocklist)
//!
//! A single address may legitimately appear in both a `MerchantAllowlist`
//! and a `MerchantBlocklist` rule. This is **not** a validation error. The
//! deterministic, documented behaviour at evaluation time is:
//!
//! > **Blocklist wins.** If a recipient appears on any blocklist it is
//! > rejected with `MerchantBlocked`, regardless of whether it also appears
//! > on an allowlist. This "deny-by-default" rule is the secure choice for a
//! > programmable spending policy.

use soroban_sdk::{Address, Env, Vec};

use crate::types::{
    ApprovalThresholdRule, CategoryLimitRule, MerchantAllowlistRule, MerchantBlocklistRule,
    PolicyRule, TimeWindowRule, MAX_APPROVERS, MAX_RULES, SECONDS_PER_DAY,
};
use crate::SpendingPolicyError;

/// Validates a complete policy rule set.
///
/// Returns `Ok(())` if every rule is well-formed, otherwise the first
/// `SpendingPolicyError` encountered.
pub fn validate_policy(_env: &Env, rules: &Vec<PolicyRule>) -> Result<(), SpendingPolicyError> {
    if rules.len() > MAX_RULES {
        return Err(SpendingPolicyError::TooManyRules);
    }

    for rule in rules.iter() {
        match rule {
            PolicyRule::CategoryLimit(cl) => validate_category_limit(&cl)?,
            PolicyRule::MerchantAllowlist(ar) => validate_allowlist(&ar)?,
            PolicyRule::MerchantBlocklist(br) => validate_blocklist(&br)?,
            PolicyRule::TimeWindow(tw) => validate_time_window(&tw)?,
            PolicyRule::ApprovalThreshold(at) => validate_threshold(&at)?,
        }
    }

    // Note: allowlist/blocklist overlap is intentionally *not* rejected here.
    // See the module docs for the documented "blocklist wins" behaviour.

    Ok(())
}

fn validate_category_limit(cl: &CategoryLimitRule) -> Result<(), SpendingPolicyError> {
    if cl.max_amount <= 0 {
        return Err(SpendingPolicyError::InvalidCategoryLimit);
    }
    if cl.period_seconds == 0 {
        return Err(SpendingPolicyError::InvalidCategoryLimit);
    }
    Ok(())
}

fn validate_allowlist(ar: &MerchantAllowlistRule) -> Result<(), SpendingPolicyError> {
    if ar.allowed.is_empty() {
        return Err(SpendingPolicyError::InvalidPolicy);
    }
    if has_duplicates(&ar.allowed) {
        return Err(SpendingPolicyError::InvalidPolicy);
    }
    Ok(())
}

fn validate_blocklist(br: &MerchantBlocklistRule) -> Result<(), SpendingPolicyError> {
    if br.blocked.is_empty() {
        return Err(SpendingPolicyError::InvalidPolicy);
    }
    if has_duplicates(&br.blocked) {
        return Err(SpendingPolicyError::InvalidPolicy);
    }
    Ok(())
}

fn validate_time_window(tw: &TimeWindowRule) -> Result<(), SpendingPolicyError> {
    if !is_valid_time_window(tw.start_seconds, tw.end_seconds) {
        return Err(SpendingPolicyError::InvalidTimeWindow);
    }
    Ok(())
}

fn validate_threshold(at: &ApprovalThresholdRule) -> Result<(), SpendingPolicyError> {
    if at.threshold_amount <= 0 {
        return Err(SpendingPolicyError::InvalidThreshold);
    }
    if at.required_approvals == 0 {
        return Err(SpendingPolicyError::InvalidThreshold);
    }
    if at.approvers.is_empty() {
        return Err(SpendingPolicyError::InvalidApproverList);
    }
    if at.approvers.len() > MAX_APPROVERS {
        return Err(SpendingPolicyError::InvalidApproverList);
    }
    // required_approvals must be achievable: <= number of approvers.
    if at.required_approvals > at.approvers.len() {
        return Err(SpendingPolicyError::InvalidApproverList);
    }
    if has_duplicates(&at.approvers) {
        return Err(SpendingPolicyError::InvalidApproverList);
    }
    Ok(())
}

/// A time window is valid when both bounds fall within a day and the window is
/// non-empty. `start == end` would define an empty half-open interval and is
/// rejected.
fn is_valid_time_window(start: u64, end: u64) -> bool {
    start < SECONDS_PER_DAY && end > 0 && end <= SECONDS_PER_DAY && start != end
}

/// Returns `true` if the vector contains the same address more than once.
fn has_duplicates(vec: &Vec<Address>) -> bool {
    let outer = vec.iter();
    for (i, a) in outer.enumerate() {
        for b in vec.iter().skip(i + 1) {
            if a == b {
                return true;
            }
        }
    }
    false
}

// ---------------------------------------------------------------------------
// Unit tests for validation internals
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};

    fn env() -> Env {
        Env::default()
    }

    #[test]
    fn test_valid_time_window_normal() {
        assert!(is_valid_time_window(21_600, 86_400)); // 06:00 -> midnight
        assert!(is_valid_time_window(0, 21_600)); // midnight -> 06:00
    }

    #[test]
    fn test_valid_time_window_wrap_around() {
        assert!(is_valid_time_window(79_200, 7_200)); // 22:00 -> 02:00
    }

    #[test]
    fn test_invalid_time_window_empty() {
        assert!(!is_valid_time_window(21_600, 21_600));
    }

    #[test]
    fn test_invalid_time_window_out_of_range() {
        assert!(!is_valid_time_window(86_400, 90_000));
        assert!(!is_valid_time_window(0, 0));
        assert!(!is_valid_time_window(86_400, 86_400));
    }

    #[test]
    fn test_validate_empty_policy_is_valid() {
        let e = env();
        let rules: Vec<PolicyRule> = Vec::new(&e);
        assert!(validate_policy(&e, &rules).is_ok());
    }

    #[test]
    fn test_validate_category_limit_rejects_zero_period() {
        let e = env();
        let mut rules: Vec<PolicyRule> = Vec::new(&e);
        rules.push_back(PolicyRule::CategoryLimit(CategoryLimitRule {
            category: symbol_short!("groc"),
            max_amount: 1_000,
            period_seconds: 0,
        }));
        assert_eq!(
            validate_policy(&e, &rules),
            Err(SpendingPolicyError::InvalidCategoryLimit)
        );
    }

    #[test]
    fn test_validate_threshold_requires_achievable_quorum() {
        let e = env();
        let mut approvers: Vec<Address> = Vec::new(&e);
        approvers.push_back(Address::generate(&e));
        let mut rules: Vec<PolicyRule> = Vec::new(&e);
        rules.push_back(PolicyRule::ApprovalThreshold(ApprovalThresholdRule {
            threshold_amount: 100,
            required_approvals: 5, // more than approvers (1)
            approvers,
        }));
        assert_eq!(
            validate_policy(&e, &rules),
            Err(SpendingPolicyError::InvalidApproverList)
        );
    }

    #[test]
    fn test_validate_allowlist_rejects_empty() {
        let e = env();
        let mut rules: Vec<PolicyRule> = Vec::new(&e);
        rules.push_back(PolicyRule::MerchantAllowlist(MerchantAllowlistRule {
            allowed: Vec::new(&e),
        }));
        assert_eq!(
            validate_policy(&e, &rules),
            Err(SpendingPolicyError::InvalidPolicy)
        );
    }

    #[test]
    fn test_validate_blocklist_rejects_empty() {
        let e = env();
        let mut rules: Vec<PolicyRule> = Vec::new(&e);
        rules.push_back(PolicyRule::MerchantBlocklist(MerchantBlocklistRule {
            blocked: Vec::new(&e),
        }));
        assert_eq!(
            validate_policy(&e, &rules),
            Err(SpendingPolicyError::InvalidPolicy)
        );
    }
}
