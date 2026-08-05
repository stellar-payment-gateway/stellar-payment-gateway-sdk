//! # Notification Contract
//!
//! Batch on-chain notifications, budget-usage alerts, and weekly digest
//! accumulation.
//!
//! - [`NotificationContract::send_batch_notifications`] validates and emits a
//!   batch of notifications, accumulating each one into the recipient's weekly
//!   digest.
//! - [`NotificationContract::update_budget`] and
//!   [`NotificationContract::complete_goal`] emit budget-usage alert events.
//! - [`NotificationContract::emit_digest`] emits a pending weekly digest for a
//!   user once its window has elapsed.

#![no_std]

mod budget_notifier;
mod digest_scheduler;
mod errors;
mod events;
mod types;

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, Env, String, Symbol, Vec};

pub use crate::errors::NotificationError;
pub use crate::types::{Notification, NotificationResult};
pub use crate::digest_scheduler::{DigestEntry, DigestSummary};

#[contract]
pub struct NotificationContract;

#[contractimpl]
impl NotificationContract {
    /// Validates and emits a batch of notifications.
    ///
    /// Each valid notification emits a `notification_sent` event and is
    /// accumulated into the recipient's pending weekly digest. Invalid entries
    /// are reported individually without aborting the batch.
    pub fn send_batch_notifications(
        env: Env,
        notifications: Vec<Notification>,
    ) -> Vec<NotificationResult> {
        if notifications.is_empty() {
            panic_with_error!(&env, NotificationError::EmptyBatch);
        }

        let mut results: Vec<NotificationResult> = Vec::new(&env);

        for notification in notifications.iter() {
            let mut success = true;
            let mut error_code = 0u32;

            // Validate message
            if notification.message.len() == 0 {
                success = false;
                error_code = 3; // EmptyMessage
            }
            // Validate language
            if !Self::is_supported_language(&env, &notification.language) {
                success = false;
                error_code = 2; // InvalidLanguage
            }

            if success {
                env.events().publish(
                    (
                        Symbol::new(&env, "notification_sent"),
                        notification.recipient.clone(),
                    ),
                    notification.message.clone(),
                );
                // Accumulate into the recipient's weekly digest.
                digest_scheduler::record_event(
                    &env,
                    &notification.recipient,
                    Symbol::new(&env, "notification"),
                );
            }

            results.push_back(NotificationResult {
                recipient: notification.recipient.clone(),
                success,
                error_code,
            });
        }

        results
    }

    /// Emits budget-usage alert events for a spending update.
    pub fn update_budget(env: Env, used: i128, limit: i128) {
        budget_notifier::BudgetNotifier::check_usage(&env, used, limit);
    }

    /// Emits the goal-completed alert event.
    pub fn complete_goal(env: Env) {
        budget_notifier::BudgetNotifier::goal_completed(&env);
    }

    /// Emits a pending weekly digest for `user` once its window has elapsed.
    ///
    /// Returns the digest summary if one was emitted, `None` otherwise.
    pub fn emit_digest(env: Env, user: Address) -> Option<DigestSummary> {
        digest_scheduler::emit_digest_if_due(&env, &user)
    }

    fn is_supported_language(env: &Env, lang: &String) -> bool {
        let supported = ["en", "fr", "es", "de"];
        supported.iter().any(|s| lang == &String::from_str(env, s))
    }
}

#[cfg(test)]
mod test;
