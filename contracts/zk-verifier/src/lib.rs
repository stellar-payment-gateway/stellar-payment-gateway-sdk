//! # ZK Verifier Contract
//!
//! Verifies spending-limit proofs for the privacy-preserving spending system.
//!
//! ## Proof format
//!
//! A proof is `[64-byte ed25519 signature][payload]` where:
//!
//! - `payload` commits to the spending data (e.g. a Pedersen commitment of the
//!   payment amount produced by the Noir circuit in `circuits/spending_proof`).
//! - the signature is produced by the trusted prover service over
//!   `user.to_string() || payload`, which binds every proof to a specific user
//!   and prevents cross-user replay.
//!
//! ## Verification semantics
//!
//! - Returns `true` only when the ed25519 signature is cryptographically valid.
//! - Fails closed: an unconfigured verifier key or a proof shorter than 64
//!   bytes returns `false`.
//! - An invalid signature panics with a host error. Callers must invoke this
//!   contract through `try_invoke_contract` (as `spending-rules` does) and
//!   treat any invocation error as a failed verification.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, Address, Bytes, BytesN, Env,
};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    /// Ed25519 public key of the trusted prover service.
    VerifierPk,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ZkVerifierError {
    NotInitialized = 1,
    Unauthorized = 2,
}

impl From<ZkVerifierError> for soroban_sdk::Error {
    fn from(e: ZkVerifierError) -> Self {
        soroban_sdk::Error::from_contract_error(e as u32)
    }
}

#[contract]
pub struct ZkVerifierContract;

#[contractimpl]
impl ZkVerifierContract {
    /// Initializes the verifier with the admin address and the prover service's
    /// ed25519 public key.
    pub fn initialize(env: Env, admin: Address, verifier_pk: BytesN<32>) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::VerifierPk, &verifier_pk);
    }

    /// Rotates the prover service public key. Admin only.
    pub fn set_verifier_pk(env: Env, admin: Address, new_pk: BytesN<32>) {
        let stored: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, ZkVerifierError::NotInitialized));

        if admin != stored {
            panic_with_error!(&env, ZkVerifierError::Unauthorized);
        }
        admin.require_auth();

        env.storage().instance().set(&DataKey::VerifierPk, &new_pk);
    }

    /// Returns the configured prover service public key, if set.
    pub fn get_verifier_pk(env: Env) -> Option<BytesN<32>> {
        env.storage().instance().get(&DataKey::VerifierPk)
    }

    /// Verifies a signed spending-limit proof for `user`.
    ///
    /// See the module docs for the proof layout and failure semantics.
    pub fn verify_spending_proof(env: Env, user: Address, proof: Bytes) -> bool {
        let verifier_pk: BytesN<32> = match env.storage().instance().get(&DataKey::VerifierPk) {
            Some(pk) => pk,
            // Fail closed: no configured key means nothing can be verified.
            None => return false,
        };

        if proof.len() < 64 {
            return false;
        }

        let signature: BytesN<64> = match proof.slice(0, 64).try_into() {
            Ok(sig) => sig,
            Err(_) => return false,
        };
        let payload = proof.slice(64, proof.len() - 64);

        // Bind the proof to the user so it cannot be replayed for someone else.
        let mut message = user.to_string().into_bytes();
        message.append(&payload);

        // Panics on an invalid signature; callers observe this as a failed
        // verification through `try_invoke_contract`.
        env.crypto().ed25519_verify(&verifier_pk, &message, &signature);
        true
    }
}

#[cfg(test)]
mod test;
