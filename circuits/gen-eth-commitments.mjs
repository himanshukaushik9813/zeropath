/**
 * gen-eth-commitments.mjs
 *
 * Computes the Poseidon source-event commitments for the demo secrets — the
 * exact values to deposit into the Sepolia escrow (ZeroPathSepoliaEscrow) so the
 * on-chain source tree matches the circuit and relayer.
 *
 * Each commitment = Poseidon(secret, amount, assetId, destinationCommitment, routeSalt)
 * where destinationCommitment = Poseidon(receiverViewKey, secret, routeSalt).
 * These are identical to the source leaves proofgen.mjs / the relayer build.
 *
 * Usage: node gen-eth-commitments.mjs
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPoseidon } from "circomlibjs";
import { demoSecrets } from "./proofgen.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const poseidon = await buildPoseidon();
const F = poseidon.F;
const h = (inputs) => F.toObject(poseidon(inputs));

console.log("Deposit these commitments into the Sepolia escrow IN THIS ORDER");
console.log("(leaf index == deposit order). Amount is your choice of test ETH.\n");

const lines = [];
for (const d of demoSecrets) {
  const secret = BigInt(d.secret);
  const amount = BigInt(d.amount);
  const assetId = BigInt(d.assetId);
  const routeSalt = BigInt(d.routeSalt);
  const receiverViewKey = BigInt(d.receiverViewKey);

  const destinationCommitment = h([receiverViewKey, secret, routeSalt]);
  const sourceLeaf = h([secret, amount, assetId, destinationCommitment, routeSalt]);

  console.log(`leaf ${d.leafIndex}  commitment = ${sourceLeaf.toString()}`);
  lines.push(sourceLeaf.toString());
}

// Machine-readable output for deploy-sepolia.sh
writeFileSync(join(__dirname, "build", "eth-commitments.json"), JSON.stringify(lines, null, 2));

console.log("\nExample deposit (leaf 0), 0.001 ETH:");
console.log(
  `cast send $ESCROW "deposit(uint256)" ${lines[0]} \\\n` +
    `  --value 0.001ether --rpc-url $SEPOLIA_RPC --account zeropath-eth`
);
