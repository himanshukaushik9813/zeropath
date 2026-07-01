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
| **Contract ID** | `CCFZ2A3VBMND6P6S4XBVPCWT5CVD7BZBUZBTQ2FTN6B6RIAF6YJF6F3S` |
| **Network** | Stellar Testnet |
| **Admin / Relayer** | `GD4RCSD3SVYSNJEKCL5EVD56AX3OHHZKT4VBNH342TBN52MJASS2QGN6` |
| **🔑 Proof-verified settlement Tx** | [`0488359f...`](https://stellar.expert/explorer/testnet/tx/0488359fd03df9e04e8071140beb081cdcc73c2af9ad1e5870af94d43ad6068f) — a real Groth16 proof verified on-chain via `bn254.pairing_check()`, releasing funds |
| **Deploy Tx** | [`5298f70c...`](https://stellar.expert/explorer/testnet/tx/5298f70c8d7976a388b35ea1efb0dc3bff2c90e135f912b20030f2b92e00a3da) |
| **Initialize Tx** | [`1f1aeeba...`](https://stellar.expert/explorer/testnet/tx/1f1aeebab1cf3a8b643a3fb62ffb82d05cae8fa0775fef4d2e98a914702a0d44) |
| **Source Root Tx** | [`01b0920d...`](https://stellar.expert/explorer/testnet/tx/01b0920d6828f7d95592290d600229a27e85e604b39734c42c1cb12aadb087fd) |
| **Source Event Root** | `12bea81668e6994567b78c97e1e3341a83c502d1fbde507bd852c52929fcbd28` |
| **Payout Token (native XLM SAC)** | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| **Explorer** | [stellar.expert/explorer/testnet/contract/CCFZ2A3V...](https://stellar.expert/explorer/testnet/contract/CCFZ2A3VBMND6P6S4XBVPCWT5CVD7BZBUZBTQ2FTN6B6RIAF6YJF6F3S) |
| **Stellar Lab** | [lab.stellar.org](https://lab.stellar.org/r/testnet/contract/CCFZ2A3VBMND6P6S4XBVPCWT5CVD7BZBUZBTQ2FTN6B6RIAF6YJF6F3S) |

### Ethereum Sepolia source (real cross-chain bridge)

The source leg is a **real on-chain Ethereum deposit**, not simulated. A depositor
locks ETH in `ZeroPathSepoliaEscrow` and records a Poseidon commitment; the relayer
reads those commitments and builds the source Merkle tree whose root the Stellar
contract verifies proofs against.

| Detail | Value |
|--------|-------|
| **Sepolia Escrow** | `0xc9f3bcb09b41057a105A7b0598962D8738c4cf8A` ([Etherscan](https://sepolia.etherscan.io/address/0xc9f3bcb09b41057a105A7b0598962D8738c4cf8A)) |
| **Real deposits** | 4 (commitments match the circuit source leaves) |
| **Source root (from Sepolia)** | `8478492314359116648130867232714891075992276064643264678878148440755760053544` — identical to the root published on Stellar |

**Flow:** deposit ETH on Sepolia → relayer reads `allCommitments()` and builds the
source root → ZK proof of membership → `bn254.pairing_check()` on Stellar releases
funds. Deploy your own with `contracts/ethereum/deploy-sepolia.sh`, then set
`ZEROPATH_ETH_RPC` + `ZEROPATH_ETH_ESCROW` in `relayer/.env`.

**Trust model:** relayer-attested — the escrow proves a real deposit; the relayer
reports the root to Stellar. Making that step trustless on Stellar (an Ethereum
light-client / header proof) is future work.

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
│   ├── export-vk-soroban.js        # Convert VK to Rust constants for Soroban
│   ├── proofgen.mjs                # Shared: rebuild trees + real snarkjs proof
│   ├── gen-test-vector.mjs         # Emit verified proof vectors for test.rs
│   └── gen-settle-payload.mjs      # Emit settle-payload.json for submission
├── contracts/stellar/settlement/   # Soroban smart contract
│   ├── src/lib.rs                  # Real BN254 Groth16 verifier (CAP-0074)
│   ├── src/test.rs                 # Contract tests (13, incl. real-proof settle())
│   └── Cargo.toml                  # soroban-sdk 26.1.0
├── contracts/stellar/deploy-testnet.sh  # Automated testnet deployment
├── contracts/stellar/submit-proof.sh    # Submit a real proof to settle() on-chain
├── frontend/                    # Next.js React app
│   ├── src/store/protocol-store.ts # Real proof gen + on-chain settle submission
│   ├── src/lib/protocol-engine.ts  # Protocol types and artifacts
│   └── public/circuits/            # WASM + zkey for in-browser proving
├── relayer/                     # Poseidon Merkle tree + demo secrets
│   ├── src/index.ts                # HTTP server with sparse Merkle tree
│   └── src/stellar.ts              # POST /v1/settle → contract settle() on testnet
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
# 13 tests pass, including end-to-end Groth16 verification:
#   test_settle_accepts_real_proof_and_pays_recipient  — a REAL snarkjs proof
#     is verified on-chain via bn254.pairing_check() and funds are released
#   test_settle_rejects_tampered_proof / _tampered_public_input / _replay /
#     _unpublished_root / _malformed_proof_point  — every rejection path
```

The real proof vectors embedded in the test are produced by
`circuits/gen-test-vector.mjs`, which self-verifies with `snarkjs.groth16.verify`
against the same verification key hardcoded in the contract before emitting them.

### 4. Deploy to Testnet (optional, already deployed)

```bash
cd contracts/stellar
bash deploy-testnet.sh
```

### 5. Submit a real proof to the contract on-chain

Generate a real proof payload, then submit it to the deployed contract's
`settle()` so it is verified on Stellar testnet and returns a transaction hash:

```bash
cd circuits && node gen-settle-payload.mjs        # writes build/settle-payload.json
cd ../contracts/stellar
CONTRACT_ID=C... TOKEN=C... RECIPIENT=G... bash submit-proof.sh
```

The browser flow does the same automatically: after generating a proof it POSTs
to the relayer's `POST /v1/settle` endpoint (configured via `relayer/.env.example`),
which invokes `settle()` on-chain and surfaces the resulting tx hash + explorer
link in the UI. Without on-chain config the proof still verifies in-browser.

### 6. Circuit Build (optional, artifacts already in repo)

```bash
cd circuits
npm install
bash build.sh
node export-vk-soroban.js
```

## How Proof Generation & On-Chain Verification Work

1. **Frontend** fetches demo secrets and Merkle proofs from the relayer
2. **snarkjs** runs `groth16.fullProve()` in the browser with the circuit WASM and proving key (~10-15s)
3. The proof is encoded for Soroban: G1 points as 64-byte big-endian, G2 points as 128-byte big-endian (c1-first for quadratic extension)
4. The encoded proof is submitted to the deployed contract's `settle()` (via the relayer's `/v1/settle`, or `submit-proof.sh` from the CLI)
5. The Soroban contract verifies the proof using `bn254.pairing_check()` with hardcoded verification key constants, then releases funds to the recipient — the same path exercised by `cargo test`

## Core Moat

ZeroPath treats Stellar as the private settlement layer. The critical innovation is BN254 proof portability: a Groth16 BN254 proof generated from Ethereum-side events can be verified natively on Stellar using CAP-0074 host functions, especially `bn254.pairing_check()`. This enables cross-chain private settlement without bridges or wrapped tokens — only cryptographic commitments and proofs cross the chain boundary.
