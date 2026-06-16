#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, BytesN, Env, Map, Symbol, Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct SettlementProof {
    pub a: Vec<BytesN<32>>,
    pub b: Vec<BytesN<32>>,
    pub c: Vec<BytesN<32>>,
    pub public_inputs: Vec<BytesN<32>>,
}

#[contracttype]
#[derive(Clone)]
pub struct SettlementIntent {
    pub batch_root: BytesN<32>,
    pub source_event_root: BytesN<32>,
    pub nullifier_hash: BytesN<32>,
    pub destination_commitment: BytesN<32>,
    pub asset_id: BytesN<32>,
    pub epoch: u64,
    pub recipient: Address,
    pub token: Address,
    pub amount_bucket: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Relayer,
    VerifierKey,
    VerifiedRoot(BytesN<32>),
    Nullifier(BytesN<32>),
    EpochLiquidity(u64, BytesN<32>),
    Paused,
}

#[contract]
pub struct ZeroPathSettlement;

#[contractimpl]
impl ZeroPathSettlement {
    pub fn initialize(env: Env, admin: Address, relayer: Address, verifier_key: BytesN<32>) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Relayer, &relayer);
        env.storage().instance().set(&DataKey::VerifierKey, &verifier_key);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    pub fn update_source_root(env: Env, relayer: Address, root: BytesN<32>) {
        relayer.require_auth();
        let expected: Address = env.storage().instance().get(&DataKey::Relayer).unwrap();
        if relayer != expected {
            panic!("not relayer");
        }
        env.storage().persistent().set(&DataKey::VerifiedRoot(root.clone()), &true);
        env.events().publish((Symbol::new(&env, "root"),), root);
    }

    pub fn settle(env: Env, intent: SettlementIntent, proof: SettlementProof) {
        Self::assert_live(&env);
        if env
            .storage()
            .persistent()
            .has(&DataKey::Nullifier(intent.nullifier_hash.clone()))
        {
            panic!("nullifier spent");
        }
        if !env
            .storage()
            .persistent()
            .has(&DataKey::VerifiedRoot(intent.source_event_root.clone()))
        {
            panic!("unverified source root");
        }
        if !Self::verify_bn254_groth16(&env, &intent, &proof) {
            panic!("invalid proof");
        }

        env.storage()
            .persistent()
            .set(&DataKey::Nullifier(intent.nullifier_hash.clone()), &true);
        Self::record_liquidity(&env, intent.epoch, intent.asset_id.clone(), intent.amount_bucket);

        let client = token::Client::new(&env, &intent.token);
        client.transfer(&env.current_contract_address(), &intent.recipient, &intent.amount_bucket);

        env.events().publish(
            (Symbol::new(&env, "settled"), intent.epoch),
            (intent.nullifier_hash, intent.destination_commitment),
        );
    }

    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &true);
    }

    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
    }

    fn verify_bn254_groth16(env: &Env, intent: &SettlementIntent, proof: &SettlementProof) -> bool {
        let _verifier_key: BytesN<32> = env.storage().instance().get(&DataKey::VerifierKey).unwrap();
        let expected_inputs = Vec::from_array(
            env,
            [
                intent.batch_root.clone(),
                intent.source_event_root.clone(),
                intent.nullifier_hash.clone(),
                intent.destination_commitment.clone(),
                intent.asset_id.clone(),
            ],
        );

        if proof.public_inputs.len() < expected_inputs.len() {
            return false;
        }

        // Production implementation calls Stellar Protocol 25 BN254 host functions:
        // bn254_add, bn254_mul, and bn254_pairing. This scaffold keeps the public
        // input binding explicit while the verifier-key generated code is wired in.
        for index in 0..expected_inputs.len() {
            if proof.public_inputs.get_unchecked(index) != expected_inputs.get_unchecked(index) {
                return false;
            }
        }

        true
    }

    fn record_liquidity(env: &Env, epoch: u64, asset_id: BytesN<32>, amount: i128) {
        let key = DataKey::EpochLiquidity(epoch, asset_id);
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + amount));
    }

    fn assert_live(env: &Env) {
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            panic!("paused");
        }
    }

    fn require_admin(env: &Env, admin: &Address) {
        let expected: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != &expected {
            panic!("not admin");
        }
    }
}
