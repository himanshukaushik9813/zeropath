#!/usr/bin/env bash
set -euo pipefail

# ZeroPath Settlement — Stellar Testnet Deployment
# Usage: bash deploy-testnet.sh

WASM_PATH="settlement/target/wasm32v1-none/release/zeropath_settlement.wasm"
NETWORK="testnet"
IDENTITY="zeropath-deployer"

# 1. Check prerequisites
if ! command -v stellar &>/dev/null; then
  echo "ERROR: stellar CLI not found."
  echo "Install: https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli"
  exit 1
fi

if [ ! -f "$WASM_PATH" ]; then
  echo "ERROR: Contract WASM not found at $WASM_PATH"
  echo "Build first: cd settlement && stellar contract build"
  exit 1
fi

# 2. Generate deployer identity if it doesn't exist
if ! stellar keys address "$IDENTITY" &>/dev/null 2>&1; then
  echo "Generating deployer identity '$IDENTITY'..."
  stellar keys generate "$IDENTITY" --network "$NETWORK"
  echo "Identity created."
else
  echo "Using existing identity '$IDENTITY'."
fi

DEPLOYER_ADDR=$(stellar keys address "$IDENTITY")
echo "Deployer address: $DEPLOYER_ADDR"

# 3. Fund via friendbot
echo "Funding account via Stellar friendbot..."
curl -s "https://friendbot.stellar.org/?addr=$DEPLOYER_ADDR" > /dev/null
echo "Account funded."

# 4. Deploy WASM
echo "Deploying contract WASM..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source "$IDENTITY" \
  --network "$NETWORK")
echo "Contract deployed: $CONTRACT_ID"

# 5. Initialize contract (deployer is both admin and relayer for hackathon)
echo "Initializing contract..."
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$IDENTITY" \
  --network "$NETWORK" \
  -- initialize \
  --admin "$DEPLOYER_ADDR" \
  --relayer "$DEPLOYER_ADDR"
echo "Contract initialized."

# 6. Submit source event root from relayer (if running)
RELAYER_URL="${RELAYER_URL:-http://localhost:8787}"
echo ""
echo "Attempting to fetch source root from relayer at $RELAYER_URL..."
if SOURCE_ROOT=$(curl -sf "$RELAYER_URL/v1/roots" 2>/dev/null | grep -o '"sourceEventRoot":"[^"]*"' | cut -d'"' -f4); then
  echo "Source root: $SOURCE_ROOT"
  # Convert decimal string to 32-byte hex for BytesN<32>
  ROOT_HEX=$(python3 -c "print(hex(int('$SOURCE_ROOT'))[2:].zfill(64))" 2>/dev/null || echo "")
  if [ -n "$ROOT_HEX" ]; then
    echo "Submitting source root to contract..."
    stellar contract invoke \
      --id "$CONTRACT_ID" \
      --source "$IDENTITY" \
      --network "$NETWORK" \
      -- update_source_root \
      --relayer "$DEPLOYER_ADDR" \
      --root "$ROOT_HEX"
    echo "Source root submitted."
  else
    echo "SKIP: Could not convert root to hex (python3 not available)."
    echo "Manually submit root with: stellar contract invoke --id $CONTRACT_ID -- update_source_root --relayer $DEPLOYER_ADDR --root <hex>"
  fi
else
  echo "SKIP: Relayer not reachable. Start the relayer and submit the root manually."
  echo "  stellar contract invoke --id $CONTRACT_ID --source $IDENTITY --network $NETWORK -- update_source_root --relayer $DEPLOYER_ADDR --root <hex>"
fi

echo ""
echo "=== Deployment Complete ==="
echo "  Contract ID: $CONTRACT_ID"
echo "  Network:     $NETWORK"
echo "  Admin:       $DEPLOYER_ADDR"
echo "  Relayer:     $DEPLOYER_ADDR"
echo "  Explorer:    https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
