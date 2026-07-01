/**
 * gen-settle-payload.mjs
 *
 * Generates a REAL, snarkjs-verified Groth16 proof for a demo leaf and writes
 * a JSON payload that contracts/stellar/submit-proof.sh (and the relayer) feed
 * into the deployed contract's settle() entry point on Stellar testnet.
 *
 * Output: build/settle-payload.json
 *   {
 *     "leafIndex": 0,
 *     "publicInputs": {          // hex, no 0x — must match the proof exactly
 *       "batch_root", "source_event_root", "nullifier_hash",
 *       "destination_commitment", "asset_id"
 *     },
 *     "epoch": 4219,             // u64
 *     "proof": { "a", "b", "c" } // hex, no 0x
 *   }
 *
 * Usage: node gen-settle-payload.mjs [leafIndex]
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateDemoProof } from "./proofgen.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const leafIndex = Number(process.argv[2] ?? 0);
  console.error(`Generating settle payload for demo leaf ${leafIndex}...`);
  const { sorobanEncoded, publicInputsHex, epoch } = await generateDemoProof(leafIndex);
  console.error("snarkjs.groth16.verify: OK");

  const payload = {
    leafIndex,
    publicInputs: {
      batch_root: publicInputsHex[0],
      source_event_root: publicInputsHex[1],
      nullifier_hash: publicInputsHex[2],
      destination_commitment: publicInputsHex[3],
      asset_id: publicInputsHex[4],
    },
    epoch,
    proof: { a: sorobanEncoded.a, b: sorobanEncoded.b, c: sorobanEncoded.c },
  };

  const outPath = join(__dirname, "build", "settle-payload.json");
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.error(`Wrote ${outPath}`);
  console.log(JSON.stringify(payload, null, 2));
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
