// PLACE THIS FILE AT: contracts/wallet-profile/src/avatar_hash.rs
// Resolves issue #85 — Create on-chain avatar content-hash registry
//
// After adding this file, wire it into contracts/wallet-profile/src/lib.rs with:
//   mod avatar_hash;
//   pub use avatar_hash::{set_avatar_hash, get_avatar_hash};
//
// Consider reusing contracts/wallet-profile/src/validation.rs for the
// format check below if it already has a generic string-length validator.

use soroban_sdk::{Address, Env, String, Symbol};

const AVATAR_KEY: Symbol = Symbol::short("avatar_h");

/// IPFS CIDv1 (base32) is typically 59 chars; allow a small range either
/// side to support CIDv0 (46 chars, base58) and minor format variation.
/// TODO: tighten this if the project standardizes on one CID format.
const MIN_HASH_LEN: u32 = 40;
const MAX_HASH_LEN: u32 = 64;

/// Sets the caller's own avatar content hash. The caller must be the
/// `owner` (enforced via `owner.require_auth()`), so this cannot be used
/// to set another user's avatar.
pub fn set_avatar_hash(env: &Env, owner: &Address, content_hash: String) {
    owner.require_auth();

    let len = content_hash.len();
    if len < MIN_HASH_LEN || len > MAX_HASH_LEN {
        panic!("avatar content hash has an invalid length");
    }

    // TODO: consider a stricter charset check (base32/base58 alphabet)
    // here once the project settles on a single CID format.

    env.storage()
        .persistent()
        .set(&(AVATAR_KEY, owner.clone()), &content_hash);
}

/// Retrieves a profile's current avatar content hash, if one has been set.
pub fn get_avatar_hash(env: &Env, owner: &Address) -> Option<String> {
    env.storage()
        .persistent()
        .get(&(AVATAR_KEY, owner.clone()))
}

// ---------------------------------------------------------------------------
// Tests — extend per the issue's acceptance criteria (set, get, invalid
// format, owner-only). Run with: cargo test -p wallet-profile -- avatar_hash
// ---------------------------------------------------------------------------
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    fn valid_hash(env: &Env) -> String {
        // 59-char placeholder CIDv1-style string for test purposes.
        String::from_str(
            env,
            "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        )
    }

    #[test]
    fn set_and_get_round_trip() {
        let env = Env::default();
        env.mock_all_auths();
        let owner = Address::generate(&env);

        let hash = valid_hash(&env);
        set_avatar_hash(&env, &owner, hash.clone());

        assert_eq!(get_avatar_hash(&env, &owner), Some(hash));
    }

    #[test]
    fn get_returns_none_when_unset() {
        let env = Env::default();
        let owner = Address::generate(&env);

        assert_eq!(get_avatar_hash(&env, &owner), None);
    }

    #[test]
    #[should_panic(expected = "invalid length")]
    fn rejects_too_short_hash() {
        let env = Env::default();
        env.mock_all_auths();
        let owner = Address::generate(&env);

        let short_hash = String::from_str(&env, "tooshort");
        set_avatar_hash(&env, &owner, short_hash);
    }

    #[test]
    #[should_panic(expected = "invalid length")]
    fn rejects_too_long_hash() {
        let env = Env::default();
        env.mock_all_auths();
        let owner = Address::generate(&env);

        let long_hash = String::from_str(
            &env,
            "this_is_a_deliberately_way_too_long_string_to_be_a_valid_content_hash_at_all",
        );
        set_avatar_hash(&env, &owner, long_hash);
    }

    // TODO: add a test confirming a caller cannot set another address's
    // avatar hash once auth wiring is exercised against a real invoker
    // context (mock_all_auths() bypasses this check in the tests above —
    // use mock_auths() with an explicit, mismatched signer to verify
    // require_auth() actually rejects the wrong caller).
}