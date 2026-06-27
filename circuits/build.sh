#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== ZeroPath Circuit Build ==="

# Check circom is installed
if ! command -v circom &>/dev/null; then
  echo "ERROR: circom not found. Install from https://docs.circom.io/getting-started/installation/"
  echo "  cargo install --git https://github.com/iden3/circom.git --tag v2.1.9"
  exit 1
fi

# Install npm deps if needed
if [ ! -d "node_modules" ]; then
  echo "[1/6] Installing dependencies..."
  npm install
else
  echo "[1/6] Dependencies already installed."
fi

# Compile circuit
echo "[2/6] Compiling circuit..."
mkdir -p build
circom private_settlement.circom \
  --r1cs --wasm --sym \
  -o build/ \
  -l node_modules

echo "  R1CS:  build/private_settlement.r1cs"
echo "  WASM:  build/private_settlement_js/private_settlement.wasm"

# Powers of Tau ceremony (BN128 = BN254 in snarkjs terminology)
echo "[3/6] Powers of Tau phase 1..."
npx snarkjs powersoftau new bn128 18 build/pot18_0000.ptau -v
npx snarkjs powersoftau contribute build/pot18_0000.ptau build/pot18_0001.ptau \
  --name="zeropath-hackathon" -v -e="zeropath private settlement hackathon entropy"

echo "[4/6] Powers of Tau phase 2 preparation..."
npx snarkjs powersoftau prepare phase2 build/pot18_0001.ptau build/pot18_final.ptau -v

# Groth16 setup
echo "[5/6] Groth16 proving key setup..."
npx snarkjs groth16 setup \
  build/private_settlement.r1cs \
  build/pot18_final.ptau \
  build/private_settlement_0000.zkey

npx snarkjs zkey contribute \
  build/private_settlement_0000.zkey \
  build/private_settlement_final.zkey \
  --name="zeropath-hackathon" -v -e="zeropath proving key contribution entropy"

# Export verification key
echo "[6/6] Exporting verification key..."
npx snarkjs zkey export verificationkey \
  build/private_settlement_final.zkey \
  build/verification_key.json

echo ""
echo "=== Build Complete ==="
echo "  Circuit WASM:      build/private_settlement_js/private_settlement.wasm"
echo "  Proving key:       build/private_settlement_final.zkey"
echo "  Verification key:  build/verification_key.json"
echo ""
echo "Next: run 'npm run export-vk' to generate Soroban constants."
