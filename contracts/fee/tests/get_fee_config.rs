#[cfg(test)]
mod test {
    use fee::{FeeConfig, FeeContract, FeeContractClient};
    use soroban_sdk::{testutils::Address as _, Address, Env};

    #[test]
    fn test_get_fee_config_default() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        let treasury = Address::generate(&env);
        let contract_id = env.register(FeeContract, ());
        let client = FeeContractClient::new(&env, &contract_id);
        client.initialize(&admin, &token, &treasury, &500u32, &1u64);

        let config: FeeConfig = client.get_fee_config();
        assert_eq!(config.admin, admin);
        assert_eq!(config.token, token);
        assert_eq!(config.treasury, treasury);
        assert_eq!(config.fee_bps, 500);
        assert_eq!(config.min_fee, 0); // DEFAULT_MIN_FEE
        assert_eq!(config.max_fee, 1_000_000); // DEFAULT_MAX_FEE
        assert!(!config.is_locked);
        assert_eq!(config.current_cycle, 1);
    }

    #[test]
    #[should_panic]
    fn test_get_fee_config_before_init_panics() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(FeeContract, ());
        let client = FeeContractClient::new(&env, &contract_id);

        // Contract not initialized yet — get_fee_config must panic.
        let _ = client.get_fee_config();
    }
}
