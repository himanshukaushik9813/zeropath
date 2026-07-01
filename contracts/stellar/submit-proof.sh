#!/usr/bin/env bash
set -euo pipefail

# ZeroPath — Submit a REAL Groth16 proof to the deployed settlement contract on
# Stellar testnet and print the resulting transaction hash. This closes the
# loop: browser/SDK generates a proof  ->  contract verifies it on-chain.
#
# Prerequisites:
#   1. Deploy + initialize the contract:  bash deploy-testnet.sh
#   2. Generate a proof payload:           cd ../../circuits && node gen-settle-payload.mjs
#
# Usage:
#   CONTRACT_ID=C... TOKEN=C... RECIPIENT=G... bash submit-proof.sh
#
# Env:
#   CONTRACT_ID  (required)  deployed settlement contract id
#   TOKEN        (required)  payout token (SAC) contract id — the contract must hold a balance
#   RECIPIENT    (required)  G... address to receive the settled funds
#   AMOUNT       (default 5000)   i128 payout amount
#   IDENTITY     (default zeropath-deployer)  stellar CLI identity (must be the registered relayer)
#   NETWORK      (default testnet)
#   PAYLOAD      (default ../../circuits/build/settle-payload.json)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD="${PAYLOAD:-$SCRIPT_DIR/../../circuits/build/settle-payload.json}"
IDENTITY="${IDENTITY:-zeropath-deployer}"
NETWORK="${NETWORK:-testnet}"
AMOUNT="${AMOUNT:-5000}"

if ! command -v stellar &>/dev/null; then
  echo "ERROR: stellar CLI not found. Install: https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli"
  exit 1
fi
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 is required to assemble the invocation JSON."
  exit 1
fi
: "${CONTRACT_ID:?Set CONTRACT_ID to the deployed settlement contract id}"
: "${TOKEN:?Set TOKEN to the payout token (SAC) contract id}"
: "${RECIPIENT:?Set RECIPIENT to the G... payout address}"
if [ ! -f "$PAYLOAD" ]; then
  echo "ERROR: proof payload not found at $PAYLOAD"
  echo "Generate it first: cd ../../circuits && node gen-settle-payload.mjs"
  exit 1
fi

RELAYER_ADDR=$(stellar keys address "$IDENTITY")
echo "Relayer identity: $IDENTITY ($RELAYER_ADDR)"

# Build the --intent and --proof JSON from the payload + payout config.
# Python writes each artifact to its own file (robust vs. shell word-splitting).
TMP_ZP="$(mktemp -d)"
trap 'rm -rf "$TMP_ZP"' EXIT
python3 - "$PAYLOAD" "$RECIPIENT" "$TOKEN" "$AMOUNT" "$TMP_ZP" <<'PY'
import json, sys
payload_path, recipient, token, amount, outdir = sys.argv[1:6]
p = json.load(open(payload_path))
pi = p["publicInputs"]
intent = {
    "batch_root": pi["batch_root"],
    "source_event_root": pi["source_event_root"],
    "nullifier_hash": pi["nullifier_hash"],
    "destination_commitment": pi["destination_commitment"],
    "asset_id": pi["asset_id"],
    "epoch": int(p["epoch"]),
    "recipient": recipient,
    "token": token,
    "amount_bucket": str(amount),
}
proof = {"a": p["proof"]["a"], "b": p["proof"]["b"], "c": p["proof"]["c"]}
open(outdir + "/intent.json", "w").write(json.dumps(intent, separators=(",", ":")))
open(outdir + "/proof.json", "w").write(json.dumps(proof, separators=(",", ":")))
open(outdir + "/root.txt", "w").write(pi["source_event_root"])
PY
SOURCE_ROOT="$(cat "$TMP_ZP/root.txt")"
INTENT_JSON="$(cat "$TMP_ZP/intent.json")"
PROOF_JSON="$(cat "$TMP_ZP/proof.json")"

echo "Publishing source-event root $SOURCE_ROOT ..."
stellar contract invoke \
  --id "$CONTRACT_ID" --source "$IDENTITY" --network "$NETWORK" \
  -- update_source_root --relayer "$RELAYER_ADDR" --root "$SOURCE_ROOT"

echo "Submitting proof to settle() ..."
stellar contract invoke \
  --id "$CONTRACT_ID" --source "$IDENTITY" --network "$NETWORK" \
  -- settle --intent "$INTENT_JSON" --proof "$PROOF_JSON"

echo ""
echo "=== Settlement submitted ==="
echo "  Contract:  $CONTRACT_ID"
echo "  Recipient: $RECIPIENT"
echo "  Amount:    $AMOUNT"
echo "  Explorer:  https://stellar.expert/explorer/$NETWORK/contract/$CONTRACT_ID"
