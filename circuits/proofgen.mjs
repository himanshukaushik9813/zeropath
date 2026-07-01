/**
 * proofgen.mjs
 *
 * Shared proof-generation logic for the ZeroPath demo. Rebuilds the exact same
 * depth-32 Poseidon Merkle trees as the relayer (relayer/src/index.ts) and the
 * frontend witness assembly (frontend/src/store/protocol-store.ts), then
 * produces a real Groth16 BN254 proof with snarkjs and encodes it for the
 * Soroban contract (contracts/stellar/settlement/src/lib.rs).
 *
 * Consumed by:
 *   - gen-test-vector.mjs   (emits Rust arrays for the on-chain verifier test)
 *   - gen-settle-payload.mjs (emits JSON for submit-proof.sh / the relayer)
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD = join(__dirname, "build");
const WASM = join(BUILD, "private_settlement_js", "private_settlement.wasm");
const ZKEY = join(BUILD, "private_settlement_final.zkey");
const VK = JSON.parse(readFileSync(join(BUILD, "verification_key.json"), "utf-8"));

const TREE_DEPTH = 32;

// Demo secrets — identical to relayer/src/index.ts demoSecrets.
export const demoSecrets = [
  { leafIndex: 0, secret: "12345678901234567890", amount: "5000", assetId: "1", routeSalt: "111111111111111", receiverViewKey: "222222222222222", epoch: 4219 },
  { leafIndex: 1, secret: "98765432109876543210", amount: "10000", assetId: "1", routeSalt: "333333333333333", receiverViewKey: "444444444444444", epoch: 4219 },
  { leafIndex: 2, secret: "55555555555555555555", amount: "2500", assetId: "2", routeSalt: "666666666666666", receiverViewKey: "777777777777777", epoch: 4219 },
  { leafIndex: 3, secret: "11111111111111111111", amount: "7500", assetId: "1", routeSalt: "888888888888888", receiverViewKey: "999999999999999", epoch: 4219 },
];

let poseidon, F;
function h(inputs) {
  return F.toObject(poseidon(inputs));
}

function buildTree(entries, zeroHashes) {
  const leaves = new Map();
  for (const e of entries) leaves.set(e.index, e.value);
  const layers = [new Map(leaves)];
  for (let depth = 0; depth < TREE_DEPTH; depth++) {
    const cur = layers[depth];
    const next = new Map();
    const parents = new Set();
    for (const idx of cur.keys()) parents.add(Math.floor(idx / 2));
    for (const p of parents) {
      const left = cur.get(p * 2) ?? zeroHashes[depth];
      const right = cur.get(p * 2 + 1) ?? zeroHashes[depth];
      next.set(p, h([left, right]));
    }
    layers.push(next);
  }
  const root = layers[TREE_DEPTH].get(0) ?? zeroHashes[TREE_DEPTH];
  return { root, layers };
}

function merkleProof(tree, leafIndex, zeroHashes) {
  const path = [];
  const indices = [];
  let idx = leafIndex;
  for (let depth = 0; depth < TREE_DEPTH; depth++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = tree.layers[depth].get(siblingIdx) ?? zeroHashes[depth];
    path.push(sibling.toString());
    indices.push(idx % 2);
    idx = Math.floor(idx / 2);
  }
  return { root: tree.root.toString(), path, indices };
}

/** Convert a decimal field-element string to 32-byte big-endian hex (no 0x). */
export function feHex(dec) {
  return BigInt(dec).toString(16).padStart(64, "0");
}

/** Encode a snarkjs Groth16 proof into the Soroban byte layout (hex, no 0x). */
export function encodeSorobanProof(proof) {
  return {
    a: feHex(proof.pi_a[0]) + feHex(proof.pi_a[1]),
    b:
      feHex(proof.pi_b[0][1]) +
      feHex(proof.pi_b[0][0]) +
      feHex(proof.pi_b[1][1]) +
      feHex(proof.pi_b[1][0]),
    c: feHex(proof.pi_c[0]) + feHex(proof.pi_c[1]),
  };
}

/**
 * Generate and self-verify a real Groth16 proof for a demo leaf.
 * Throws if snarkjs.groth16.verify fails against the contract's VK.
 */
export async function generateDemoProof(leafIndex = 0) {
  const demo = demoSecrets[leafIndex];
  if (!demo) throw new Error(`no demo secret at leafIndex ${leafIndex}`);

  if (!poseidon) {
    poseidon = await buildPoseidon();
    F = poseidon.F;
  }

  const zeroHashes = new Array(TREE_DEPTH + 1);
  zeroHashes[0] = 0n;
  for (let i = 1; i <= TREE_DEPTH; i++) zeroHashes[i] = h([zeroHashes[i - 1], zeroHashes[i - 1]]);

  const secret = BigInt(demo.secret);
  const amount = BigInt(demo.amount);
  const assetId = BigInt(demo.assetId);
  const routeSalt = BigInt(demo.routeSalt);
  const receiverViewKey = BigInt(demo.receiverViewKey);
  const epoch = BigInt(demo.epoch);

  const nullifierHash = h([secret, 1n]);
  const destinationCommitment = h([receiverViewKey, secret, routeSalt]);

  // Build the source/batch trees from ALL demo leaves — identical to the
  // relayer (relayer/src/index.ts seedDemoData) — so the CLI, browser, and test
  // paths all commit to the same canonical roots.
  const sourceEntries = [];
  const batchEntries = [];
  for (const d of demoSecrets) {
    const s = BigInt(d.secret);
    const a = BigInt(d.amount);
    const as = BigInt(d.assetId);
    const rs = BigInt(d.routeSalt);
    const rvk = BigInt(d.receiverViewKey);
    const ep = BigInt(d.epoch);
    const nh = h([s, 1n]);
    const dc = h([rvk, s, rs]);
    sourceEntries.push({ index: d.leafIndex, value: h([s, a, as, dc, rs]) });
    batchEntries.push({ index: d.leafIndex, value: h([nh, dc, as, ep, a]) });
  }

  const sourceTree = buildTree(sourceEntries, zeroHashes);
  const batchTree = buildTree(batchEntries, zeroHashes);
  const sourceProof = merkleProof(sourceTree, demo.leafIndex, zeroHashes);
  const batchProof = merkleProof(batchTree, demo.leafIndex, zeroHashes);

  const circuitInputs = {
    batch_root: batchTree.root.toString(),
    source_event_root: sourceTree.root.toString(),
    nullifier_hash: nullifierHash.toString(),
    destination_commitment: destinationCommitment.toString(),
    asset_id: assetId.toString(),
    epoch: epoch.toString(),
    secret: secret.toString(),
    amount: amount.toString(),
    route_salt: routeSalt.toString(),
    receiver_view_key: receiverViewKey.toString(),
    source_event_path: sourceProof.path,
    source_event_indices: sourceProof.indices,
    batch_path: batchProof.path,
    batch_indices: batchProof.indices,
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuitInputs, WASM, ZKEY);

  const ok = await snarkjs.groth16.verify(VK, publicSignals, proof);
  if (!ok) throw new Error("snarkjs.groth16.verify returned false — refusing to emit an invalid proof");

  // publicSignals order: [batch_root, source_event_root, nullifier_hash,
  //                        destination_commitment, asset_id, epoch]
  return {
    proof,
    publicSignals,
    sorobanEncoded: encodeSorobanProof(proof),
    publicInputsHex: publicSignals.map(feHex),
    epoch: Number(publicSignals[5]),
    amount: demo.amount,
    assetId: demo.assetId,
  };
}
