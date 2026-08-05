use soroban_sdk::{contract, contractimpl};

#[contract]
pub struct LMSContract;

#[contractimpl]
impl LMSContract {
    pub fn initialize() -> bool {
        true
    }
}