#!/usr/bin/env bash
set -euo pipefail

# ZeroPath — deploy the source-chain escrow to Ethereum Sepolia and seed it with
# the demo commitments, turning the "source chain" leg into a REAL on-chain flow.
#
# Signing uses a Foundry keystore account so your raw private key never appears in
# a command or shell history. First import your key ONCE (interactive, hidden):
#
#     cast wallet import zeropath-eth --interactive
#
# Then run this script:
#
#     SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com bash deploy-sepolia.sh
#
# Env:
#   SEPOLIA_RPC   (required)  Sepolia JSON-RPC URL
#   ETH_ACCOUNT   (default zeropath-eth)  Foundry keystore account name
#   DEPOSIT_ETH   (default 0.001ether)    ETH locked per deposit

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ETH_ACCOUNT="${ETH_ACCOUNT:-zeropath-eth}"
DEPOSIT_ETH="${DEPOSIT_ETH:-0.001ether}"
COMMITMENTS_JSON="$SCRIPT_DIR/../../circuits/build/eth-commitments.json"

: "${SEPOLIA_RPC:?Set SEPOLIA_RPC to a Sepolia JSON-RPC URL}"
command -v forge >/dev/null || { echo "ERROR: Foundry (forge) not found — https://getfoundry.sh"; exit 1; }
command -v cast  >/dev/null || { echo "ERROR: Foundry (cast) not found";  exit 1; }
command -v node  >/dev/null || { echo "ERROR: node not found"; exit 1; }

# 1. Compute the demo commitments (writes circuits/build/eth-commitments.json)
echo "[1/3] Computing source commitments..."
( cd "$SCRIPT_DIR/../../circuits" && node gen-eth-commitments.mjs >/dev/null )

# 2. Compile + deploy the escrow
echo "[2/3] Deploying ZeroPathSepoliaEscrow to Sepolia..."
cd "$SCRIPT_DIR"
forge build >/dev/null
DEPLOY_OUT=$(forge create sepolia/ZeroPathSepoliaEscrow.sol:ZeroPathSepoliaEscrow \
  --rpc-url "$SEPOLIA_RPC" --account "$ETH_ACCOUNT" --broadcast)
echo "$DEPLOY_OUT"
ESCROW=$(echo "$DEPLOY_OUT" | grep -i "Deployed to:" | awk '{print $NF}')
if [ -z "$ESCROW" ]; then echo "ERROR: could not parse deployed address"; exit 1; fi
echo "Escrow: $ESCROW"

# 3. Deposit each commitment (leaf index == deposit order)
echo "[3/3] Depositing ${DEPOSIT_ETH} per commitment..."
COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$COMMITMENTS_JSON')).length)")
for i in $(seq 0 $((COUNT - 1))); do
  C=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$COMMITMENTS_JSON'))[$i])")
  echo "  deposit leaf $i ..."
  cast send "$ESCROW" "deposit(uint256)" "$C" \
    --value "$DEPOSIT_ETH" --rpc-url "$SEPOLIA_RPC" --account "$ETH_ACCOUNT" >/dev/null
done

echo ""
echo "=== Sepolia source escrow live ==="
echo "  Escrow:   $ESCROW"
echo "  Deposits: $COUNT"
echo "  Explorer: https://sepolia.etherscan.io/address/$ESCROW"
echo ""
echo "Now point the relayer at it (relayer/.env):"
echo "  ZEROPATH_ETH_RPC=$SEPOLIA_RPC"
echo "  ZEROPATH_ETH_ESCROW=$ESCROW"
echo "Then restart the relayer and check: curl localhost:8787/v1/source-info"
