#![cfg(test)]

use nft_contract::{NftContract, NftContractClient};
use soroban_sdk::{testutils::Address as _, Address, Env, String};

// --- Test Helpers ---

fn setup<'a>(env: &'a Env) -> (NftContractClient<'a>, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize(
        &admin,
        &String::from_str(env, "My NFT"),
        &String::from_str(env, "MNFT"),
        &String::from_str(env, "ipfs://base/"),
    );
    (client, admin)
}

fn mint_token<'a>(env: &'a Env, client: &NftContractClient, to: &Address, uri: &str) -> u64 {
    client.mint(to, &String::from_str(env, uri))
}

// --- Initialization ---

#[test]
fn test_initialize_contract() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, NftContract);
    let client = NftContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);

    client.initialize(
        &admin,
        &String::from_str(&env, "Cool NFTs"),
        &String::from_str(&env, "CNFT"),
        &String::from_str(&env, "ipfs://base/"),
    );

    // Mint to verify contract is initialized (admin can mint)
    let user = Address::generate(&env);
    let id = client.mint(&user, &String::from_str(&env, "ipfs://1"));
    assert_eq!(id, 1);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_initialize_already_initialized_panics() {
    let env = Env::default();
    let (client, admin) = setup(&env);

    // Second initialize should panic
    client.initialize(
        &admin,
        &String::from_str(&env, "Dup"),
        &String::from_str(&env, "DUP"),
        &String::from_str(&env, "ipfs://dup/"),
    );
}

// --- Minting ---

#[test]
fn test_mint_returns_correct_token_id() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let user = Address::generate(&env);

    let id1 = mint_token(&env, &client, &user, "ipfs://token/1");
    let id2 = mint_token(&env, &client, &user, "ipfs://token/2");
    let id3 = mint_token(&env, &client, &user, "ipfs://token/3");

    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);
}

#[test]
fn test_mint_sets_correct_owner() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let recipient = Address::generate(&env);

    let id = mint_token(&env, &client, &recipient, "ipfs://token/1");

    assert_eq!(client.get_owner(&id), recipient);
}

#[test]
fn test_mint_total_supply_increments() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let user = Address::generate(&env);

    mint_token(&env, &client, &user, "ipfs://token/1");
    mint_token(&env, &client, &user, "ipfs://token/2");

    // Verify by checking that the 3rd token gets ID 3
    let id3 = mint_token(&env, &client, &user, "ipfs://token/3");
    assert_eq!(id3, 3);
}

// --- Transfers ---

#[test]
fn test_transfer_nft() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let id = mint_token(&env, &client, &alice, "ipfs://token/1");
    client.transfer(&alice, &bob, &id);

    assert_eq!(client.get_owner(&id), bob);
}

#[test]
fn test_transfer_updates_owner() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);

    let id = mint_token(&env, &client, &alice, "ipfs://token/1");

    // Alice -> Bob -> Carol
    client.transfer(&alice, &bob, &id);
    assert_eq!(client.get_owner(&id), bob);

    client.transfer(&bob, &carol, &id);
    assert_eq!(client.get_owner(&id), carol);
}

#[test]
#[should_panic(expected = "Not the owner")]
fn test_transfer_by_non_owner_panics() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let charlie = Address::generate(&env);

    let id = mint_token(&env, &client, &alice, "ipfs://token/1");

    // Charlie (not the owner) tries to transfer
    client.transfer(&charlie, &bob, &id);
}

#[test]
#[should_panic(expected = "Token does not exist")]
fn test_transfer_nonexistent_token_panics() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    // Token 999 does not exist
    client.transfer(&alice, &bob, &999u64);
}

// --- Metadata ---

#[test]
fn test_get_metadata_correct_uri() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let user = Address::generate(&env);

    let uri = "ipfs://my-token-uri/42";
    let id = mint_token(&env, &client, &user, uri);

    let meta = client.get_metadata(&id);
    assert_eq!(meta.name, String::from_str(&env, "My NFT"));
    assert_eq!(meta.symbol, String::from_str(&env, "MNFT"));
    assert_eq!(meta.uri, String::from_str(&env, uri));
}

#[test]
#[should_panic(expected = "Token does not exist")]
fn test_get_metadata_nonexistent_token_panics() {
    let env = Env::default();
    let (client, _) = setup(&env);
    client.get_metadata(&999u64);
}

#[test]
fn test_metadata_after_transfer_unchanged() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let uri = "ipfs://stable-uri/1";
    let id = mint_token(&env, &client, &alice, uri);

    client.transfer(&alice, &bob, &id);

    // Metadata should remain unchanged after transfer
    let meta = client.get_metadata(&id);
    assert_eq!(meta.uri, String::from_str(&env, uri));
}

// --- Royalties ---

#[test]
fn test_global_royalty_calculation() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let user = Address::generate(&env);
    let royalty_receiver = Address::generate(&env);

    let id = mint_token(&env, &client, &user, "ipfs://token/1");

    // 5% global royalty (500 basis points)
    client.set_royalty(&royalty_receiver, &500u32);

    let (addr, amount) = client.get_royalty(&id, &10000u128);
    assert_eq!(addr, royalty_receiver);
    assert_eq!(amount, 500u128); // 5% of 10000
}

#[test]
fn test_token_royalty_overrides_global() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let user = Address::generate(&env);
    let global_receiver = Address::generate(&env);
    let token_receiver = Address::generate(&env);

    let id = mint_token(&env, &client, &user, "ipfs://token/1");

    // Set global 5% royalty
    client.set_royalty(&global_receiver, &500u32);

    // Set token-specific 10% royalty (1000 basis points)
    client.set_token_royalty(&id, &token_receiver, &1000u32);

    let (addr, amount) = client.get_royalty(&id, &10000u128);
    // Token-specific should override global
    assert_eq!(addr, token_receiver);
    assert_eq!(amount, 1000u128); // 10% of 10000
}

#[test]
#[should_panic(expected = "Royalty cannot exceed 100%")]
fn test_royalty_exceeds_100_percent_panics() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let receiver = Address::generate(&env);

    // 10001 basis points > 100%
    client.set_royalty(&receiver, &10001u32);
}

#[test]
fn test_no_royalty_set_returns_zero() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let user = Address::generate(&env);

    let id = mint_token(&env, &client, &user, "ipfs://token/1");

    // No royalty set - should return (contract_address, 0)
    let (_, amount) = client.get_royalty(&id, &10000u128);
    assert_eq!(amount, 0u128);
}

#[test]
fn test_royalty_with_zero_sale_price() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let user = Address::generate(&env);
    let receiver = Address::generate(&env);

    let id = mint_token(&env, &client, &user, "ipfs://token/1");
    client.set_royalty(&receiver, &500u32);

    let (_, amount) = client.get_royalty(&id, &0u128);
    assert_eq!(amount, 0u128); // 5% of 0 = 0
}

// --- Ownership ---

#[test]
#[should_panic(expected = "Token does not exist")]
fn test_get_owner_nonexistent_token_panics() {
    let env = Env::default();
    let (client, _) = setup(&env);
    client.get_owner(&999u64);
}
