//! Integration tests for the notification contract.

#![cfg(test)]

use crate::{Notification, NotificationContract, NotificationContractClient};
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger},
    Address, Env, String, Symbol, TryFromVal, Vec,
};

const WEEK: u64 = 7 * 24 * 60 * 60;

fn setup() -> (Env, NotificationContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(NotificationContract, ());
    let client = NotificationContractClient::new(&env, &contract_id);
    (env, client)
}

fn notification(env: &Env, recipient: &Address, language: &str, message: &str) -> Notification {
    Notification {
        recipient: recipient.clone(),
        language: String::from_str(env, language),
        message: String::from_str(env, message),
    }
}

#[test]
fn sends_valid_batch_and_emits_events() {
    let (env, client) = setup();
    let user = Address::generate(&env);

    let mut notifications: Vec<Notification> = Vec::new(&env);
    notifications.push_back(notification(&env, &user, "en", "Budget alert: 80% used"));

    let results = client.send_batch_notifications(&notifications);

    assert_eq!(results.len(), 1);
    assert!(results.get(0).unwrap().success);
    assert_eq!(
        results.get(0).unwrap().recipient,
        user,
        "recipient should be preserved"
    );

    let expected = Symbol::new(&env, "notification_sent");
    let events = env.events().all();
    assert!(
        events.iter().any(|e| {
            Symbol::try_from_val(&env, &e.1.get(0).unwrap()) == Ok(expected.clone())
        }),
        "a notification_sent event should be emitted"
    );
}

#[test]
fn rejects_empty_message_and_unknown_language_per_item() {
    let (env, client) = setup();
    let user = Address::generate(&env);

    let mut notifications: Vec<Notification> = Vec::new(&env);
    // Empty message -> failure (error 3)
    notifications.push_back(notification(&env, &user, "en", ""));
    // Unknown language -> failure (error 2)
    notifications.push_back(notification(&env, &user, "xx", "hello"));
    // Valid -> success
    notifications.push_back(notification(&env, &user, "fr", "bonjour"));

    let results = client.send_batch_notifications(&notifications);

    assert_eq!(results.len(), 3);
    assert!(!results.get(0).unwrap().success);
    assert!(!results.get(1).unwrap().success);
    assert!(results.get(2).unwrap().success);
}

#[test]
#[should_panic]
fn empty_batch_panics() {
    let (env, client) = setup();
    let notifications: Vec<Notification> = Vec::new(&env);
    client.send_batch_notifications(&notifications);
}

#[test]
fn digest_emitted_after_weekly_window() {
    let (env, client) = setup();
    let user = Address::generate(&env);

    let mut notifications: Vec<Notification> = Vec::new(&env);
    notifications.push_back(notification(&env, &user, "en", "alert one"));
    notifications.push_back(notification(&env, &user, "en", "alert two"));
    client.send_batch_notifications(&notifications);

    // Before the window elapses, no digest is emitted.
    assert!(client.emit_digest(&user).is_none());

    env.ledger().with_mut(|l| l.timestamp += WEEK + 1);

    let summary = client.emit_digest(&user).unwrap();
    assert_eq!(summary.event_count, 2);

    // The pending list is cleared after the digest.
    assert!(client.emit_digest(&user).is_none());
}

#[test]
fn budget_alert_events_are_emitted() {
    let (env, client) = setup();

    client.update_budget(&80, &100);

    let expected = String::from_str(&env, "budget");
    let events = env.events().all();
    assert!(
        events.iter().any(|e| {
            String::try_from_val(&env, &e.1.get(0).unwrap()) == Ok(expected.clone())
        }),
        "a budget event should be emitted"
    );
}
