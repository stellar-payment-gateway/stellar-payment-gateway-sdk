//! Composite spending policy engine.
//!
//! Conflict resolution is deliberately conservative: every active rule matching
//! the user and category must pass. When rules disagree, the first violation
//! blocks the payment, which is equivalent to "most restrictive wins" because
//! any lower cap or stricter proof gate can veto an otherwise allowed spend.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, Bytes, Env, IntoVal, Symbol, Val, Vec,
};

pub const MAX_RULES_PER_USER: u32 = 25;

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
#[repr(u32)]
pub enum RuleEngineError {
    NotInitialized = 1,
    Unauthorized = 2,
    InvalidAmount = 3,
    TooManyRules = 4,
    RuleNotFound = 5,
    CategoryRequired = 6,
    CategoryNotFound = 7,
    SpendingLimitRejected = 8,
    ZkProofRequired = 9,
    InvalidZkProof = 10,
    RuleLimitExceeded = 11,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum RuleDecision {
    Allow,
    Deny,
    RequireZkProof,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Rule {
    pub id: u64,
    pub user: Address,
    pub category: Option<Symbol>,
    pub max_amount: i128,
    pub window_seconds: u64,
    pub limit_contract: Option<Address>,
    pub zk_threshold: Option<i128>,
    pub active: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct EvaluationResult {
    pub allowed: bool,
    pub decision: RuleDecision,
    pub blocking_rule: Option<u64>,
    pub requires_zk: bool,
    pub checked_rules: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    CategoryContract,
    ZkVerifierContract,
    LastRuleId,
    UserRules(Address),
    Rule(u64),
    RuleUsage(u64, u64),
}

#[contract]
pub struct SpendingRulesContract;

#[contractimpl]
impl SpendingRulesContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        category_contract: Address,
        zk_verifier_contract: Address,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::CategoryContract, &category_contract);
        env.storage()
            .instance()
            .set(&DataKey::ZkVerifierContract, &zk_verifier_contract);
        env.storage().instance().set(&DataKey::LastRuleId, &0u64);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn add_rule(
        env: Env,
        admin: Address,
        user: Address,
        category: Option<Symbol>,
        max_amount: i128,
        window_seconds: u64,
        limit_contract: Option<Address>,
        zk_threshold: Option<i128>,
    ) -> Rule {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        if max_amount <= 0 || window_seconds == 0 {
            panic_with_error!(&env, RuleEngineError::InvalidAmount);
        }
        if let Some(threshold) = zk_threshold {
            if threshold <= 0 {
                panic_with_error!(&env, RuleEngineError::InvalidAmount);
            }
        }

        let mut user_rules: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::UserRules(user.clone()))
            .unwrap_or(Vec::new(&env));
        if user_rules.len() >= MAX_RULES_PER_USER {
            panic_with_error!(&env, RuleEngineError::TooManyRules);
        }

        let id = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::LastRuleId)
            .unwrap_or(0)
            + 1;

        let rule = Rule {
            id,
            user: user.clone(),
            category,
            max_amount,
            window_seconds,
            limit_contract,
            zk_threshold,
            active: true,
        };

        env.storage().persistent().set(&DataKey::Rule(id), &rule);
        user_rules.push_back(id);
        env.storage()
            .persistent()
            .set(&DataKey::UserRules(user.clone()), &user_rules);
        env.storage().instance().set(&DataKey::LastRuleId, &id);
        env.events().publish(
            (symbol_short!("rules"), symbol_short!("added")),
            (id, user, max_amount, window_seconds),
        );

        rule
    }

    pub fn set_rule_active(env: Env, admin: Address, rule_id: u64, active: bool) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        let mut rule = Self::load_rule(&env, rule_id);
        rule.active = active;
        env.storage()
            .persistent()
            .set(&DataKey::Rule(rule_id), &rule);
    }

    pub fn get_rule(env: Env, rule_id: u64) -> Option<Rule> {
        env.storage().persistent().get(&DataKey::Rule(rule_id))
    }

    pub fn get_user_rules(env: Env, user: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::UserRules(user))
            .unwrap_or(Vec::new(&env))
    }

    pub fn evaluate_payment(
        env: Env,
        user: Address,
        amount: i128,
        category: Option<Symbol>,
        proof: Option<Bytes>,
    ) -> EvaluationResult {
        Self::evaluate_internal(&env, user, amount, category, proof, false)
    }

    pub fn enforce_payment(
        env: Env,
        user: Address,
        amount: i128,
        category: Option<Symbol>,
        proof: Option<Bytes>,
    ) -> EvaluationResult {
        Self::evaluate_internal(&env, user, amount, category, proof, true)
    }

    pub fn record_limit_spend(
        env: Env,
        user: Address,
        amount: i128,
        category: Option<Symbol>,
        limit_contract: Address,
    ) {
        Self::call_limit_record(&env, &limit_contract, user, amount, category);
    }

    pub fn get_rule_usage(env: Env, rule_id: u64) -> i128 {
        let rule = Self::load_rule(&env, rule_id);
        let window_id = Self::window_id(&env, rule.window_seconds);
        env.storage()
            .persistent()
            .get(&DataKey::RuleUsage(rule_id, window_id))
            .unwrap_or(0)
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, RuleEngineError::NotInitialized))
    }

    fn evaluate_internal(
        env: &Env,
        user: Address,
        amount: i128,
        category: Option<Symbol>,
        proof: Option<Bytes>,
        commit: bool,
    ) -> EvaluationResult {
        if amount <= 0 {
            panic_with_error!(env, RuleEngineError::InvalidAmount);
        }

        if let Some(ref cat) = category {
            Self::require_known_category(env, &user, cat);
        }

        let rule_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::UserRules(user.clone()))
            .unwrap_or(Vec::new(env));

        let mut checked_rules = 0u32;
        let mut matching_rules: Vec<Rule> = Vec::new(env);
        let mut requires_zk = false;

        for id in rule_ids.iter() {
            let rule = Self::load_rule(env, id);
            if !Self::matches(&rule, &user, &category) {
                continue;
            }

            checked_rules += 1;
            matching_rules.push_back(rule.clone());

            if let Some(limit_contract) = rule.limit_contract.clone() {
                if !Self::call_limit_check(
                    env,
                    &limit_contract,
                    user.clone(),
                    amount,
                    category.clone(),
                ) {
                    return Self::blocked(rule.id, RuleDecision::Deny, checked_rules, requires_zk);
                }
            }

            let window_id = Self::window_id(env, rule.window_seconds);
            let current: i128 = env
                .storage()
                .persistent()
                .get(&DataKey::RuleUsage(rule.id, window_id))
                .unwrap_or(0);
            let next = current
                .checked_add(amount)
                .unwrap_or_else(|| panic_with_error!(env, RuleEngineError::InvalidAmount));
            if next > rule.max_amount {
                return Self::blocked(rule.id, RuleDecision::Deny, checked_rules, requires_zk);
            }

            if let Some(threshold) = rule.zk_threshold {
                if amount >= threshold {
                    requires_zk = true;
                    match proof.clone() {
                        Some(proof_bytes) => {
                            if !Self::call_zk_verify(env, &user, proof_bytes) {
                                return Self::blocked(
                                    rule.id,
                                    RuleDecision::RequireZkProof,
                                    checked_rules,
                                    true,
                                );
                            }
                        }
                        None => {
                            return Self::blocked(
                                rule.id,
                                RuleDecision::RequireZkProof,
                                checked_rules,
                                true,
                            );
                        }
                    }
                }
            }
        }

        if commit {
            let mut recorded_limit_contracts: Vec<Address> = Vec::new(env);

            for rule in matching_rules.iter() {
                let window_id = Self::window_id(env, rule.window_seconds);
                let key = DataKey::RuleUsage(rule.id, window_id);
                let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
                let next = current
                    .checked_add(amount)
                    .unwrap_or_else(|| panic_with_error!(env, RuleEngineError::InvalidAmount));
                env.storage().persistent().set(&key, &next);

                if let Some(limit_contract) = rule.limit_contract.clone() {
                    if !recorded_limit_contracts.contains(&limit_contract) {
                        Self::call_limit_record(
                            env,
                            &limit_contract,
                            user.clone(),
                            amount,
                            category.clone(),
                        );
                        recorded_limit_contracts.push_back(limit_contract);
                    }
                }
            }

            env.events().publish(
                (symbol_short!("rules"), symbol_short!("allowed")),
                (user, amount, category, checked_rules),
            );
        }

        EvaluationResult {
            allowed: true,
            decision: RuleDecision::Allow,
            blocking_rule: None,
            requires_zk,
            checked_rules,
        }
    }

    fn matches(rule: &Rule, user: &Address, category: &Option<Symbol>) -> bool {
        if &rule.user != user || !rule.active {
            return false;
        }

        match (&rule.category, category) {
            (Some(expected), Some(actual)) => expected == actual,
            (Some(_), None) => false,
            (None, _) => true,
        }
    }

    fn blocked(
        rule_id: u64,
        decision: RuleDecision,
        checked_rules: u32,
        requires_zk: bool,
    ) -> EvaluationResult {
        EvaluationResult {
            allowed: false,
            decision,
            blocking_rule: Some(rule_id),
            requires_zk,
            checked_rules,
        }
    }

    fn load_rule(env: &Env, rule_id: u64) -> Rule {
        env.storage()
            .persistent()
            .get(&DataKey::Rule(rule_id))
            .unwrap_or_else(|| panic_with_error!(env, RuleEngineError::RuleNotFound))
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(env, RuleEngineError::NotInitialized));

        if caller != &admin {
            panic_with_error!(env, RuleEngineError::Unauthorized);
        }
    }

    fn require_known_category(env: &Env, user: &Address, category: &Symbol) {
        let category_contract: Address = env
            .storage()
            .instance()
            .get(&DataKey::CategoryContract)
            .unwrap_or_else(|| panic_with_error!(env, RuleEngineError::NotInitialized));

        let args: Vec<Val> = vec![
            env,
            user.clone().into_val(env),
            category.clone().into_val(env),
        ];
        let exists = env.try_invoke_contract::<bool, soroban_sdk::Error>(
            &category_contract,
            &Symbol::new(env, "category_exists"),
            args,
        );

        match exists {
            Ok(Ok(true)) => {}
            _ => panic_with_error!(env, RuleEngineError::CategoryNotFound),
        }
    }

    fn call_limit_check(
        env: &Env,
        limit_contract: &Address,
        user: Address,
        amount: i128,
        category: Option<Symbol>,
    ) -> bool {
        let args: Vec<Val> = vec![
            env,
            user.into_val(env),
            amount.into_val(env),
            category.into_val(env),
        ];
        matches!(
            env.try_invoke_contract::<bool, soroban_sdk::Error>(
                limit_contract,
                &Symbol::new(env, "check_spending_limit"),
                args,
            ),
            Ok(Ok(true))
        )
    }

    fn call_limit_record(
        env: &Env,
        limit_contract: &Address,
        user: Address,
        amount: i128,
        category: Option<Symbol>,
    ) {
        let args: Vec<Val> = vec![
            env,
            user.into_val(env),
            amount.into_val(env),
            category.into_val(env),
        ];
        let result = env.try_invoke_contract::<(), soroban_sdk::Error>(
            limit_contract,
            &Symbol::new(env, "enforce_spending_limit"),
            args,
        );

        if !matches!(result, Ok(Ok(()))) {
            panic_with_error!(env, RuleEngineError::SpendingLimitRejected);
        }
    }

    fn call_zk_verify(env: &Env, user: &Address, proof: Bytes) -> bool {
        let verifier: Address = env
            .storage()
            .instance()
            .get(&DataKey::ZkVerifierContract)
            .unwrap_or_else(|| panic_with_error!(env, RuleEngineError::NotInitialized));
        let args: Vec<Val> = vec![env, user.clone().into_val(env), proof.into_val(env)];

        matches!(
            env.try_invoke_contract::<bool, soroban_sdk::Error>(
                &verifier,
                &Symbol::new(env, "verify_spending_proof"),
                args,
            ),
            Ok(Ok(true))
        )
    }

    fn window_id(env: &Env, window_seconds: u64) -> u64 {
        let now = env.ledger().timestamp();
        if now == 0 {
            0
        } else {
            (now - 1) / window_seconds
        }
    }
}
