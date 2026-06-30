#![cfg(test)]

use crate::{ZeroPathSettlement, ZeroPathSettlementClient};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

fn setup() -> (Env, ZeroPathSettlementClient<'static>, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(ZeroPathSettlement, ());
    let client = ZeroPathSettlementClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let relayer = Address::generate(&env);
    (env, client, admin, relayer)
}

#[test]
fn test_initialize() {
    let (_env, client, admin, relayer) = setup();
    client.initialize(&admin, &relayer);
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialize() {
    let (_env, client, admin, relayer) = setup();
    client.initialize(&admin, &relayer);
    client.initialize(&admin, &relayer);
}

#[test]
fn test_update_source_root() {
    let (env, client, admin, relayer) = setup();
    client.initialize(&admin, &relayer);
    let root = BytesN::from_array(&env, &[1u8; 32]);
    client.update_source_root(&relayer, &root);
}

#[test]
#[should_panic(expected = "not relayer")]
fn test_update_source_root_wrong_relayer() {
    let (env, client, admin, relayer) = setup();
    client.initialize(&admin, &relayer);
    let impostor = Address::generate(&env);
    let root = BytesN::from_array(&env, &[1u8; 32]);
    client.update_source_root(&impostor, &root);
}

#[test]
fn test_pause_unpause() {
    let (_env, client, admin, relayer) = setup();
    client.initialize(&admin, &relayer);
    client.pause(&admin);
    client.unpause(&admin);
}

#[test]
#[should_panic(expected = "not admin")]
fn test_pause_wrong_admin() {
    let (env, client, admin, relayer) = setup();
    client.initialize(&admin, &relayer);
    let impostor = Address::generate(&env);
    client.pause(&impostor);
}

#[test]
fn test_negate_g1_generator() {
    let env = Env::default();

    // BN254 generator G1 = (1, 2) in big-endian 64-byte encoding
    let mut point_bytes = [0u8; 64];
    point_bytes[31] = 1; // x = 1
    point_bytes[63] = 2; // y = 2
    let point = BytesN::from_array(&env, &point_bytes);

    let neg = ZeroPathSettlement::negate_g1(&env, &point);
    let neg_bytes = neg.to_array();

    // x should be unchanged
    assert_eq!(neg_bytes[31], 1, "x coordinate should be preserved");
    for i in 0..31 {
        assert_eq!(neg_bytes[i], 0, "x high bytes should be zero");
    }

    // Negated y = p - 2
    // p = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47
    // p - 2 = 0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd45
    // Last byte: 0x47 - 2 = 0x45
    assert_eq!(neg_bytes[63], 0x45, "last byte of negated y should be 0x45");
    // First byte of y should match first byte of p
    assert_eq!(neg_bytes[32], 0x30, "first byte of negated y should match p");
}
