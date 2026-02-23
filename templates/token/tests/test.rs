#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use token_contract::{TokenContract, TokenContractClient};

fn setup<'a>(env: &'a Env) -> (TokenContractClient<'a>, Address, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let alice = Address::generate(env);
    let bob = Address::generate(env);
    let charlie = Address::generate(env);

    client.initialize(&admin);
    (client, admin, alice, bob, charlie)
}

#[test]
fn test_initialize_sets_admin_and_supply() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.total_supply(), 0);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize_fails() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    client.initialize(&admin);
}

#[test]
fn test_mint_increases_balance_and_total_supply() {
    let env = Env::default();
    let (client, admin, alice, _, _) = setup(&env);

    client.mint(&admin, &alice, &1000);

    assert_eq!(client.balance(&alice), 1000);
    assert_eq!(client.total_supply(), 1000);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_mint_zero_amount_fails() {
    let env = Env::default();
    let (client, admin, alice, _, _) = setup(&env);
    client.mint(&admin, &alice, &0);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_mint_negative_amount_fails() {
    let env = Env::default();
    let (client, admin, alice, _, _) = setup(&env);
    client.mint(&admin, &alice, &-1);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_non_admin_cannot_mint() {
    let env = Env::default();
    let (client, _admin, alice, bob, _) = setup(&env);
    client.mint(&alice, &bob, &50);
}

#[test]
fn test_transfer_moves_tokens_between_accounts() {
    let env = Env::default();
    let (client, admin, alice, bob, _) = setup(&env);

    client.mint(&admin, &alice, &1000);
    client.transfer(&alice, &bob, &400);

    assert_eq!(client.balance(&alice), 600);
    assert_eq!(client.balance(&bob), 400);
    assert_eq!(client.total_supply(), 1000);
}

#[test]
fn test_transfer_to_self() {
    let env = Env::default();
    let (client, admin, alice, _, _) = setup(&env);

    client.mint(&admin, &alice, &1000);
    client.transfer(&alice, &alice, &400);

    assert_eq!(client.balance(&alice), 1000);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn test_transfer_fails_with_insufficient_balance() {
    let env = Env::default();
    let (client, _admin, alice, bob, _) = setup(&env);
    client.transfer(&alice, &bob, &1);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_transfer_zero_amount_fails() {
    let env = Env::default();
    let (client, admin, alice, bob, _) = setup(&env);
    client.mint(&admin, &alice, &100);
    client.transfer(&alice, &bob, &0);
}

#[test]
fn test_burn_reduces_balance_and_total_supply() {
    let env = Env::default();
    let (client, admin, alice, _, _) = setup(&env);

    client.mint(&admin, &alice, &1000);
    client.burn(&alice, &250);

    assert_eq!(client.balance(&alice), 750);
    assert_eq!(client.total_supply(), 750);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn test_burn_fails_with_insufficient_balance() {
    let env = Env::default();
    let (client, _admin, alice, _, _) = setup(&env);
    client.burn(&alice, &1);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_burn_zero_amount_fails() {
    let env = Env::default();
    let (client, admin, alice, _, _) = setup(&env);
    client.mint(&admin, &alice, &100);
    client.burn(&alice, &0);
}

#[test]
fn test_integration_multi_user_flow() {
    let env = Env::default();
    let (client, admin, alice, bob, charlie) = setup(&env);

    // 1. Admin mints to Alice
    client.mint(&admin, &alice, &1000);
    
    // 2. Alice transfers to Bob
    client.transfer(&alice, &bob, &300);
    
    // 3. Bob transfers to Charlie
    client.transfer(&bob, &charlie, &100);
    
    // 4. Charlie burns some tokens
    client.burn(&charlie, &50);
    
    // Check final balances
    assert_eq!(client.balance(&alice), 700);
    assert_eq!(client.balance(&bob), 200);
    assert_eq!(client.balance(&charlie), 50);
    assert_eq!(client.total_supply(), 950);
}

#[test]
fn test_balance_accuracy_after_multiple_operations() {
    let env = Env::default();
    let (client, admin, alice, bob, _) = setup(&env);

    for _ in 0..10 {
        client.mint(&admin, &alice, &10);
    }
    assert_eq!(client.balance(&alice), 100);

    for _ in 0..5 {
        client.transfer(&alice, &bob, &5);
    }
    assert_eq!(client.balance(&alice), 75);
    assert_eq!(client.balance(&bob), 25);
}

#[test]
fn test_max_supply_overflow_protection() {
    let env = Env::default();
    let (client, admin, alice, _, _) = setup(&env);

    let max_val = i128::MAX;
    client.mint(&admin, &alice, &max_val);
    assert_eq!(client.total_supply(), max_val);
    
    // This should panic due to checked_add
    let res = std::panic::catch_unwind(|| {
        let env_inner = Env::default();
        let (client_inner, admin_inner, alice_inner, _, _) = setup(&env_inner);
        client_inner.mint(&admin_inner, &alice_inner, &max_val);
        client_inner.mint(&admin_inner, &alice_inner, &1);
    });
    assert!(res.is_err());
}
