#![no_std]

mod engine;

pub use engine::{
    DataKey, EvaluationResult, Rule, RuleDecision, RuleEngineError, SpendingRulesContract,
    SpendingRulesContractClient, MAX_RULES_PER_USER,
};

#[cfg(test)]
mod test;
