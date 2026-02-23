#![cfg(test)]

use staking_contract::{StakingContract, StakingContractClient};
use soroban_sdk::{testutils::{Address as _, Ledger}, token, Address, Env};

fn setup_test(env: &Env) -> (Address, Address, Address, token::Client, StakingContractClient) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let user = Address::generate(env);
    let token_admin = Address::generate(env);
    
    // Create token
    let token_id = env.register_stellar_asset_contract(token_admin);
    let token = token::Client::new(env, &token_id);

    // Register staking contract
    let contract_id = env.register_contract(None, StakingContract);
    let client = StakingContractClient::new(env, &contract_id);

    (admin, user, token_id, token, client)
}

#[test]
fn test_initialization() {
    let env = Env::default();
    let (admin, _user, token_id, _token, client) = setup_test(&env);

    client.initialize(&admin, &token_id, &10);
    
    // Check pause state
    client.pause(&admin);
    client.unpause(&admin);
}

#[test]
fn test_staking_and_rewards() {
    let env = Env::default();
    let (admin, user, token_id, token, client) = setup_test(&env);

    // Initial rate: 1 unit per unit per second
    client.initialize(&admin, &token_id, &1);

    token.mint(&user, &1000);
    
    // Stake 100 for 100 seconds
    client.stake(&user, &100, &100);
    assert_eq!(token.balance(&user), 900);

    // Advance 50 seconds
    env.ledger().with_mut(|li| li.timestamp += 50);
    
    // Expected rewards: 100 units * 1 rate * 50 sec = 5000
    assert_eq!(client.get_pending_rewards(&user), 5000);

    // Advance to 150 seconds (unlocked)
    env.ledger().with_mut(|li| li.timestamp += 100);
    assert_eq!(client.get_pending_rewards(&user), 15000);

    // Mint rewards to contract so it can pay out
    token.mint(&client.address, &20000);

    client.claim_rewards(&user);
    assert_eq!(token.balance(&user), 900 + 15000);
    assert_eq!(client.get_pending_rewards(&user), 0);
}

#[test]
#[should_panic(expected = "Assets are currently locked")]
fn test_unstake_locked_fail() {
    let env = Env::default();
    let (admin, user, token_id, token, client) = setup_test(&env);

    client.initialize(&admin, &token_id, &1);
    token.mint(&user, &1000);
    
    client.stake(&user, &500, &1000);
    
    // Try to unstake after 500 seconds (still locked)
    env.ledger().with_mut(|li| li.timestamp += 500);
    client.unstake(&user, &100);
}

#[test]
fn test_unstake_unlocked_success() {
    let env = Env::default();
    let (admin, user, token_id, token, client) = setup_test(&env);

    client.initialize(&admin, &token_id, &1);
    token.mint(&user, &1000);
    
    client.stake(&user, &500, &1000);
    
    // Advance to 1001 seconds (unlocked)
    env.ledger().with_mut(|li| li.timestamp += 1001);
    
    client.unstake(&user, &500);
    assert_eq!(token.balance(&user), 1000);
}

#[test]
#[should_panic(expected = "Contract is currently paused")]
fn test_pause_staking() {
    let env = Env::default();
    let (admin, user, token_id, token, client) = setup_test(&env);

    client.initialize(&admin, &token_id, &1);
    token.mint(&user, &1000);
    
    client.pause(&admin);
    client.stake(&user, &100, &100);
}

#[test]
fn test_update_reward_rate() {
    let env = Env::default();
    let (admin, user, token_id, token, client) = setup_test(&env);

    client.initialize(&admin, &token_id, &1);
    token.mint(&user, &1000);
    
    client.stake(&user, &100, &100);
    
    // 10 seconds at rate 1 = 1000 rewards
    env.ledger().with_mut(|li| li.timestamp += 10);
    assert_eq!(client.get_pending_rewards(&user), 1000);
    
    // Admin updates rate to 2
    client.update_reward_rate(&admin, &2);
    
    // Next 10 seconds at rate 2 = 2000 rewards. Total = 3000
    env.ledger().with_mut(|li| li.timestamp += 10);
    assert_eq!(client.get_pending_rewards(&user), 1000 + 2000);
}
