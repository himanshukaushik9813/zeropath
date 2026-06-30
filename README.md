# ZeroPath

ZeroPath is a privacy-first cross-chain settlement network powered by Stellar Protocol 25/26 cryptography.

Users submit private settlement intents such as:

```text
Move 5000 USDC privately to Solana.
```

ZeroPath routes the intent through solvers, batches settlement on Stellar, verifies Groth16 BN254 proofs natively through CAP-0074 host functions, and releases value to a stealth destination without exposing sender, receiver, amount, route, or liquidity source.

## Stellar Testnet Deployment

The ZeroPath settlement contract is **live on Stellar Testnet** with real BN254 Groth16 proof verification using CAP-0074 host functions.

| Detail | Value |
|--------|-------|
| **Contract ID** | `CB7PGIQBZJBBGPSG7VNZT6KLUIVUEAOPLERFZDJJMCCIZTBEC6QKBBRT` |
| **Network** | Stellar Testnet |
| **Admin / Relayer** | `GC7JLBW6ND3QEU36KEYJQL2EBOYVCI7HNPU52BOS5VDHVZJHCS7UCMTW` |
| **WASM Upload Tx** | [`a1fd8729...`](https://stellar.expert/explorer/testnet/tx/a1fd8729533bb4f023a2486dfbc15fc304c4950d17f55c8ca6cf1f913b72410c) |
| **Deploy Tx** | [`bc89a39c...`](https://stellar.expert/explorer/testnet/tx/bc89a39c40190f3f9a8abcfaea81cea3c4ba8c894f008e127e797e5177959ca0) |
| **Initialize Tx** | [`c0b7cb63...`](https://stellar.expert/explorer/testnet/tx/c0b7cb63e8b88a2ed23b58346d46faa5e8686de297c36dc11c2ec949a647f2be) |
| **Source Root Tx** | [`dc5f8eb9...`](https://stellar.expert/explorer/testnet/tx/dc5f8eb95f908eefa33bacbf3f5100449a3231be6c72001b448698f3f3e42cef) |
| **Source Event Root** | `12bea81668e6994567b78c97e1e3341a83c502d1fbde507bd852c52929fcbd28` |
| **Explorer** | [stellar.expert/explorer/testnet/contract/CB7PGI...](https://stellar.expert/explorer/testnet/contract/CB7PGIQBZJBBGPSG7VNZT6KLUIVUEAOPLERFZDJJMCCIZTBEC6QKBBRT) |
| **Stellar Lab** | [lab.stellar.org](https://lab.stellar.org/r/testnet/contract/CB7PGIQBZJBBGPSG7VNZT6KLUIVUEAOPLERFZDJJMCCIZTBEC6QKBBRT) |

### What the contract does on-chain

The `settle()` function performs **real Groth16 BN254 proof verification** using Stellar's native host functions:

1. Checks nullifier hasn't been spent (replay protection)
2. Validates source event root was submitted by the relayer
3. Computes `vk_x = IC[0] + sum(public_inputs[i] * IC[i+1])` using `bn254.g1_mul()` and `bn254.g1_add()`
4. Negates proof point A (G1 point negation: `y → p - y`)
5. Verifies pairing equation: `e(-A, B) * e(α, β) * e(vk_x, γ) * e(C, δ) == 1` using `bn254.pairing_check()`
6. Marks nullifier as spent and transfers tokens

The verification key is hardcoded from a real Circom trusted setup (BN128, 2^17 powers of tau).

## ZK Proof Pipeline

The project implements a complete end-to-end zero-knowledge proof flow:

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Frontend   │────▶│   Relayer    │────▶│  snarkjs in  │────▶│ Soroban Contract │
│  (React UI)  │     │ (Poseidon    │     │  browser     │     │ (BN254 pairing   │
│              │     │  Merkle tree)│     │ (Groth16     │     │  check via       │
│              │     │              │     │  fullProve)  │     │  CAP-0074)       │
└─────────────┘     └─────────────┘     └──────────────┘     └──────────────────┘
```

### Circuit (`circuits/private_settlement.circom`)

- **Template:** `PrivateSettlement(32)` — depth-32 sparse Merkle trees
- **6 public inputs:** `batch_root`, `source_event_root`, `nullifier_hash`, `destination_commitment`, `asset_id`, `epoch`
- **8 private inputs:** `secret`, `amount`, `route_salt`, `receiver_view_key`, Merkle paths and indices
- **Hash function:** Poseidon (via circomlib) for nullifier derivation, commitment computation, and Merkle tree hashing
- **Proof system:** Groth16 BN254

### Protocol 25/26 Host Functions Used

| Host Function | Usage |
|---------------|-------|
| `bn254.g1_add()` | Accumulate IC points with public inputs |
| `bn254.g1_mul()` | Scalar multiplication of IC points by public input field elements |
| `bn254.pairing_check()` | Verify the Groth16 pairing equation (4-pairing product) |
| `Bn254G1Affine::from_array()` | Deserialize G1 points from 64-byte big-endian encoding |
| `Bn254G2Affine::from_array()` | Deserialize G2 points from 128-byte big-endian encoding |
| `Bn254Fr::from_bytes()` | Deserialize scalar field elements for public inputs |

## Project Structure

```
zeropath/
├── circuits/                    # Circom circuit + trusted setup
│   ├── private_settlement.circom   # Main circuit (6 public + 8 private inputs)
│   ├── build.sh                    # Compile + Powers of Tau + Groth16 setup
│   └── export-vk-soroban.js       # Convert VK to Rust constants for Soroban
├── contracts/stellar/settlement/   # Soroban smart contract
│   ├── src/lib.rs                  # Real BN254 Groth16 verifier (CAP-0074)
│   ├── src/test.rs                 # Contract tests (7 tests)
│   └── Cargo.toml                  # soroban-sdk 26.1.0
├── contracts/stellar/deploy-testnet.sh  # Automated testnet deployment
├── frontend/                    # Next.js React app
│   ├── src/store/protocol-store.ts # Real proof generation via snarkjs
│   ├── src/lib/protocol-engine.ts  # Protocol types and artifacts
│   └── public/circuits/            # WASM + zkey for in-browser proving
├── relayer/                     # Poseidon Merkle tree + demo secrets
│   └── src/index.ts                # HTTP server with sparse Merkle tree
├── sdk/                         # TypeScript SDK
│   └── src/index.ts                # Proof generation + Soroban encoding
└── docs/                        # Architecture documentation
```

## Quick Start

### 1. Relayer (Poseidon Merkle tree server)

```bash
cd relayer
npm install
ZEROPATH_DEMO_MODE=true npx tsx src/index.ts
# Listening on http://localhost:8787
```

### 2. Frontend (in-browser proof generation)

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 3. Contract Tests

```bash
cd contracts/stellar/settlement
cargo test
# 7 tests pass: initialize, double-init, source root, wrong relayer,
# pause/unpause, wrong admin, G1 negation vector
```

### 4. Deploy to Testnet (optional, already deployed)

```bash
cd contracts/stellar
bash deploy-testnet.sh
```

### 5. Circuit Build (optional, artifacts already in repo)

```bash
cd circuits
npm install
bash build.sh
node export-vk-soroban.js
```

## How Proof Generation Works

1. **Frontend** fetches demo secrets and Merkle proofs from the relayer
2. **snarkjs** runs `groth16.fullProve()` in the browser with the circuit WASM and proving key (~10-15s)
3. The proof is encoded for Soroban: G1 points as 64-byte big-endian, G2 points as 128-byte big-endian (c1-first for quadratic extension)
4. The Soroban contract verifies the proof using `bn254.pairing_check()` with hardcoded verification key constants

## Core Moat

ZeroPath treats Stellar as the private settlement layer. The critical innovation is BN254 proof portability: a Groth16 BN254 proof generated from Ethereum-side events can be verified natively on Stellar using CAP-0074 host functions, especially `bn254.pairing_check()`. This enables cross-chain private settlement without bridges or wrapped tokens — only cryptographic commitments and proofs cross the chain boundary.
