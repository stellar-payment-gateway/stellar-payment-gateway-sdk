//! Standardized event emitters for the rewards contract.
//!
//! Every observable state change emits exactly one event through these helpers
//! so off-chain indexers have a single, stable set of topic strings to listen on.

use soroban_sdk::{Address, Env};

/// Emitted when a new reward account is initialised for `participant`.
pub fn emit_account_initialized(env: &Env, participant: &Address) {
    env.events()
        .publish(("rewards", "account_initialized"), participant.clone());
}

/// Emitted when `amount` reward points are credited to `participant`'s account.
pub fn emit_reward_credited(env: &Env, participant: &Address, amount: i128, tx_id: u64) {
    env.events().publish(
        ("rewards", "reward_credited"),
        (participant.clone(), amount, tx_id),
    );
}

/// Emitted when `amount` reward points are debited from `participant`'s account.
pub fn emit_reward_debited(env: &Env, participant: &Address, amount: i128, tx_id: u64) {
    env.events().publish(
        ("rewards", "reward_debited"),
        (participant.clone(), amount, tx_id),
    );
}
