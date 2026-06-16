# ZeroPath

ZeroPath is a privacy-first cross-chain settlement network powered by Stellar Protocol 25/26 cryptography.

Users submit private settlement intents such as:

```text
Move 5000 USDC privately to Solana.
```

ZeroPath routes the intent through solvers, batches settlement on Stellar, verifies Groth16 BN254 proofs natively through CAP-0074 host functions, and releases value to a stealth destination without exposing sender, receiver, amount, route, or liquidity source.

## Project Shape

- `frontend/` - cinematic React intent console and settlement dashboard.
- `docs/zeropath-v2-blueprint.md` - protocol architecture, threat model, deployment strategy, wireframes, and investor narrative.
- `contracts/ethereum/` - Solidity source-chain intent and escrow scaffolds.
- `contracts/stellar/settlement/` - Soroban private settlement layer scaffold.
- `circuits/` - Circom private settlement circuit scaffold.
- `sdk/` - TypeScript SDK architecture scaffold.
- `relayer/` - trusted relayer and future SP1 handoff scaffold.
- `api/` - public API design.
- `db/` - database schema for intents, solvers, epochs, and proof metadata.

## Frontend

```bash
cd frontend
npm install
npm run dev -- --port 5173
```

Open `http://127.0.0.1:5173/`.

## Core Moat

ZeroPath treats Stellar as the private settlement layer. The critical innovation is BN254 proof portability: a Groth16 BN254 proof generated from Ethereum-side events can be verified natively on Stellar using CAP-0074 host functions, especially `bn254_pairing`.
