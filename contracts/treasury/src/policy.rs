use soroban_sdk::{contracttype, Vec};

#[derive(Clone)]
#[contracttype]
pub struct SpendingTier {
    pub label: soroban_sdk::Symbol,
    pub min_amount: i128,
    pub max_amount: i128,
    pub required_signers: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct TierConfig {
    pub tiers: Vec<SpendingTier>,
    pub fallback_threshold: u32,
}

pub fn find_tier_requirement(config: &TierConfig, amount: i128) -> u32 {
    for tier in config.tiers.iter() {
        if amount >= tier.min_amount && (amount < tier.max_amount || tier.max_amount == i128::MAX) {
            return tier.required_signers;
        }
    }
    config.fallback_threshold
}

pub fn validate_tier_config(config: &TierConfig, total_signers: u32) {
    if config.fallback_threshold == 0 || config.fallback_threshold > total_signers {
        panic!("invalid fallback threshold");
    }
    let mut prev_max: i128 = 0;
    for tier in config.tiers.iter() {
        if tier.min_amount < prev_max {
            panic!("overlapping tier boundaries");
        }
        if tier.min_amount < 0 || tier.max_amount <= tier.min_amount {
            panic!("invalid tier bounds");
        }
        if tier.required_signers == 0 || tier.required_signers > total_signers {
            panic!("invalid tier required_signers");
        }
        prev_max = tier.max_amount;
    }
}
