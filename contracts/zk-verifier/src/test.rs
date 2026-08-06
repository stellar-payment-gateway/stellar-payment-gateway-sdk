//! End-to-end tests for the ZK verifier contract using real ed25519
//! cryptography (ed25519-dalek) — the same curve the host verifies.

#![cfg(test)]
extern crate std;

use crate::{ZkVerifierContract, ZkVerifierContractClient};
use ed25519_dalek::{Signer, SigningKey};
use soroban_sdk::{testutils::Address as _, Address, Bytes, BytesN, Env};

/// Deploys and initializes the verifier with a fresh prover keypair.
#[allow(clippy::type_complexity)]
fn setup(
    env: &Env,
) -> (
    Address,
    ZkVerifierContractClient<'static>,
    SigningKey,
    BytesN<32>,
) {
    let admin = Address::generate(env);
    let signing_key = SigningKey::from_bytes(&[7u8; 32]);
    let verifier_pk = BytesN::from_array(env, &signing_key.verifying_key().to_bytes());

    let contract_id = env.register(ZkVerifierContract, ());
    let client = ZkVerifierContractClient::new(env, &contract_id);
    client.initialize(&admin, &verifier_pk);

    (admin, client, signing_key, verifier_pk)
}

/// Builds a proof `[signature][payload]` for `user` and `payload`, where the
/// signature covers `user.to_string() || payload` — exactly what the contract
/// recomputes and verifies.
fn build_proof(env: &Env, user: &Address, signing_key: &SigningKey, payload: &[u8]) -> Bytes {
    let payload_bytes = Bytes::from_slice(env, payload);

    // `user.to_string()` -> strkey bytes, matching the contract's recomputation.
    let user_str = user.to_string();
    let mut user_bytes = alloc::vec![0u8; user_str.len() as usize];
    user_str.copy_into_slice(&mut user_bytes);
    let mut message = Bytes::from_slice(env, &user_bytes);
    message.append(&payload_bytes);
    let signature = signing_key.sign(&message.to_alloc_vec());

    let mut proof = Bytes::from_array(env, &signature.to_bytes());
    proof.append(&payload_bytes);
    proof
}

#[test]
fn valid_proof_returns_true() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, client, signing_key, _pk) = setup(&env);

    let user = Address::generate(&env);
    let proof = build_proof(&env, &user, &signing_key, &[0xca, 0xfe, 0x00, 0x01]);

    assert!(client.verify_spending_proof(&user, &proof));
}

#[test]
fn uninitialized_contract_fails_closed() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ZkVerifierContract, ());
    let client = ZkVerifierContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let proof = Bytes::from_slice(&env, &[0x01u8; 100]);

    // No verifier key configured => false, never true.
    assert!(!client.verify_spending_proof(&user, &proof));
}

#[test]
fn empty_or_short_proof_returns_false() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, client, _signing_key, _pk) = setup(&env);

    let user = Address::generate(&env);
    let empty = Bytes::new(&env);
    let short = Bytes::from_slice(&env, &[0x01u8; 63]);

    assert!(!client.verify_spending_proof(&user, &empty));
    assert!(!client.verify_spending_proof(&user, &short));
}

#[test]
#[should_panic]
fn tampered_payload_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, client, signing_key, _pk) = setup(&env);

    let user = Address::generate(&env);
    let mut proof = build_proof(&env, &user, &signing_key, &[0xca, 0xfe, 0x00, 0x01]);
    // Flip the last payload byte so the signature no longer matches.
    let mut payload = proof.slice(64..proof.len());
    payload.set(0, payload.get(0).unwrap() ^ 0xff);
    proof = proof.slice(0..64);
    proof.append(&payload);

    client.verify_spending_proof(&user, &proof);
}

#[test]
#[should_panic]
fn proof_is_bound_to_the_user() {
    let env = Env::default();
    env.mock_all_auths();
    let (_admin, client, signing_key, _pk) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let proof = build_proof(&env, &alice, &signing_key, &[0xde, 0xad, 0xbe, 0xef]);

    // Alice's proof must not verify for Bob.
    client.verify_spending_proof(&bob, &proof);
}

#[test]
fn verifier_key_rotation_invalidates_old_signatures() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, client, old_signing_key, _old_pk) = setup(&env);

    let new_signing_key = SigningKey::from_bytes(&[9u8; 32]);
    let new_pk = BytesN::from_array(&env, &new_signing_key.verifying_key().to_bytes());
    client.set_verifier_pk(&admin, &new_pk);
    assert_eq!(client.get_verifier_pk(), Some(new_pk));

    let user = Address::generate(&env);

    // New key's signature verifies.
    let fresh_proof = build_proof(&env, &user, &new_signing_key, &[0x11, 0x22]);
    assert!(client.verify_spending_proof(&user, &fresh_proof));

    // The old key's signature no longer verifies (panics via host error).
    let stale_proof = build_proof(&env, &user, &old_signing_key, &[0x11, 0x22]);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.verify_spending_proof(&user, &stale_proof);
    }));
    assert!(result.is_err());
}

#[test]
#[should_panic]
fn set_verifier_pk_requires_admin() {
    let env = Env::default();
    env.mock_all_auths();
    let (admin, client, _signing_key, _pk) = setup(&env);

    let impostor = Address::generate(&env);
    // Even with mock auth, the contract checks the caller equals the stored admin.
    let new_pk = BytesN::from_array(&env, &[0x42u8; 32]);
    client.set_verifier_pk(&admin, &new_pk); // succeeds (admin)
    client.set_verifier_pk(&impostor, &new_pk); // must panic
}
