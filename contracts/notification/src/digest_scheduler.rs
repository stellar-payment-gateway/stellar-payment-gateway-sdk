// Weekly digest event scheduler.
//
// Records notification events per user and emits a single digest event once
// the weekly window has elapsed.

use soroban_sdk::{contracttype, vec, Address, Env, Symbol, Vec};

const DIGEST_WINDOW_SECS: u64 = 7 * 24 * 60 * 60; // 7 days
const PENDING_KEY: Symbol = Symbol::short("dgst_pend");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DigestEntry {
    pub category: Symbol,
    pub occurred_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DigestSummary {
    pub window_start: u64,
    pub window_end: u64,
    pub event_count: u32,
}

/// Call this from wherever individual notification events are currently
/// emitted (see contracts/notification/src/budget_notifier.rs and
/// contracts/notification/src/events.rs) to additionally accumulate the
/// event into the pending weekly digest for the user.
pub fn record_event(env: &Env, user: &Address, category: Symbol) {
    let key = (PENDING_KEY, user.clone());
    let mut pending: Vec<DigestEntry> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(vec![env]);

    pending.push_back(DigestEntry {
        category,
        occurred_at: env.ledger().timestamp(),
    });

    env.storage().persistent().set(&key, &pending);
}

/// Call this periodically (e.g. from a cross-contract scheduled trigger,
/// or lazily on the user's next interaction) to check whether 7 days have
/// elapsed since the oldest pending entry, and if so, emit a single digest
/// event and clear the pending list.
pub fn emit_digest_if_due(env: &Env, user: &Address) -> Option<DigestSummary> {
    let key = (PENDING_KEY, user.clone());
    let pending: Vec<DigestEntry> = env.storage().persistent().get(&key).unwrap_or(vec![env]);

    if pending.is_empty() {
        return None;
    }

    let oldest = pending.get(0).unwrap().occurred_at;
    let now = env.ledger().timestamp();

    if now - oldest < DIGEST_WINDOW_SECS {
        return None;
    }

    let summary = DigestSummary {
        window_start: oldest,
        window_end: now,
        event_count: pending.len(),
    };

    // Clear the pending list now that it's been digested.
    env.storage().persistent().set(&key, &vec![env]);

    // Emit the digest event for off-chain consumers (indexers, push services).
    env.events().publish(
        (Symbol::new(env, "digest"), user.clone()),
        summary.clone(),
    );

    Some(summary)
}

// ---------------------------------------------------------------------------
// Tests — extend per the issue's acceptance criteria.
// Run with: cargo test -p notification -- digest_scheduler
// ---------------------------------------------------------------------------
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{Env, Symbol};

    #[test]
    fn no_digest_before_window_elapses() {
        let env = Env::default();
        let user = Address::generate(&env);

        record_event(&env, &user, Symbol::new(&env, "budget_alert"));
        assert!(emit_digest_if_due(&env, &user).is_none());
    }

    #[test]
    fn digest_emitted_after_window_elapses() {
        let env = Env::default();
        let user = Address::generate(&env);

        record_event(&env, &user, Symbol::new(&env, "budget_alert"));
        record_event(&env, &user, Symbol::new(&env, "savings_milestone"));

        env.ledger().with_mut(|l| l.timestamp += DIGEST_WINDOW_SECS + 1);

        let summary = emit_digest_if_due(&env, &user);
        assert!(summary.is_some());
        assert_eq!(summary.unwrap().event_count, 2);
    }

    #[test]
    fn pending_list_clears_after_digest() {
        let env = Env::default();
        let user = Address::generate(&env);

        record_event(&env, &user, Symbol::new(&env, "budget_alert"));
        env.ledger().with_mut(|l| l.timestamp += DIGEST_WINDOW_SECS + 1);

        emit_digest_if_due(&env, &user);
        // Second call immediately after should find nothing pending.
        assert!(emit_digest_if_due(&env, &user).is_none());
    }
}