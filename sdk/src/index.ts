export type PrivacyLevel = "max-privacy" | "balanced" | "lowest-fee";

export type SettlementIntent = {
  amount: string;
  token: string;
  destination: string;
  privacyLevel: PrivacyLevel;
  deadline: number;
};

export type PrivateIntent = SettlementIntent & {
  sourceCommitment: string;
  destinationCommitment: string;
  routeCommitment: string;
  nullifierHash: string;
  secret: string;
  routeSalt: string;
  receiverViewKey: string;
};

export type SolverQuote = {
  solverId: string;
  routeCommitment: string;
  feeBps: number;
  latencySeconds: number;
  privacyScore: number;
};

export type Groth16Proof = {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
};

export type ProofResult = {
  proof: Groth16Proof;
  publicSignals: string[];
};

export type SorobanEncodedProof = {
  a: string;   // hex, 64 bytes (128 hex chars)
  b: string;   // hex, 128 bytes (256 hex chars)
  c: string;   // hex, 64 bytes (128 hex chars)
  publicInputs: string[];  // hex, 32 bytes each
};

const encoder = new TextEncoder();

export async function createPrivateIntent(intent: SettlementIntent): Promise<PrivateIntent> {
  const secret = randomHex(32);
  const routeSalt = randomHex(32);
  const receiverViewKey = await digestHex(`${intent.destination}:${secret}`);
  const destinationCommitment = await digestHex(`${receiverViewKey}:${secret}:${routeSalt}`);
  const nullifierHash = await digestHex(`${secret}:1`);
  const sourceCommitment = await digestHex(
    JSON.stringify({
      secret,
      amount: intent.amount,
      token: intent.token,
      destinationCommitment,
      routeSalt,
    })
  );
  const routeCommitment = await digestHex(`${intent.privacyLevel}:${routeSalt}:${intent.deadline}`);

  return {
    ...intent,
    secret,
    routeSalt,
    receiverViewKey,
    sourceCommitment,
    destinationCommitment,
    routeCommitment,
    nullifierHash,
  };
}

export async function quoteIntent(apiUrl: string, intent: PrivateIntent): Promise<SolverQuote[]> {
  const response = await fetch(`${apiUrl}/v1/intents/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      token: intent.token,
      destinationCommitment: intent.destinationCommitment,
      routeCommitment: intent.routeCommitment,
      privacyLevel: intent.privacyLevel,
      deadline: intent.deadline,
    }),
  });

  if (!response.ok) throw new Error(`quote failed: ${response.status}`);
  return response.json();
}

/**
 * Generate a Groth16 BN254 proof using snarkjs.
 *
 * @param circuitInputs - Witness inputs matching the circuit's signal declarations
 * @param wasmPath      - URL or path to private_settlement.wasm
 * @param zkeyPath      - URL or path to private_settlement_final.zkey
 */
export async function generateSettlementProof(
  circuitInputs: Record<string, unknown>,
  wasmPath: string,
  zkeyPath: string
): Promise<ProofResult> {
  // Dynamic import so snarkjs is only loaded when proof generation is needed
  const snarkjs = await import("snarkjs");

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    circuitInputs,
    wasmPath,
    zkeyPath
  );

  return {
    proof: {
      pi_a: proof.pi_a,
      pi_b: proof.pi_b,
      pi_c: proof.pi_c,
    },
    publicSignals,
  };
}

/**
 * Encode a snarkjs Groth16 proof into the byte format expected by the Soroban contract.
 *
 * Soroban BN254 encoding:
 *   G1 (64 bytes): be_bytes(x) || be_bytes(y)
 *   G2 (128 bytes): be_bytes(x.c1) || be_bytes(x.c0) || be_bytes(y.c1) || be_bytes(y.c0)
 *
 * snarkjs output format:
 *   pi_a: [x, y, "1"]  (affine, z=1)
 *   pi_b: [[x.c0, x.c1], [y.c0, y.c1], ["1","0"]]
 *   pi_c: [x, y, "1"]
 */
export function encodeProofForSoroban(result: ProofResult): SorobanEncodedProof {
  const { proof, publicSignals } = result;

  // Encode pi_a (G1): be(x) || be(y)
  const a = fieldToHex32(proof.pi_a[0]) + fieldToHex32(proof.pi_a[1]);

  // Encode pi_b (G2): be(x.c1) || be(x.c0) || be(y.c1) || be(y.c0)
  // snarkjs gives [[x.c0, x.c1], [y.c0, y.c1], ...]
  const b =
    fieldToHex32(proof.pi_b[0][1]) + // x.c1
    fieldToHex32(proof.pi_b[0][0]) + // x.c0
    fieldToHex32(proof.pi_b[1][1]) + // y.c1
    fieldToHex32(proof.pi_b[1][0]);  // y.c0

  // Encode pi_c (G1): be(x) || be(y)
  const c = fieldToHex32(proof.pi_c[0]) + fieldToHex32(proof.pi_c[1]);

  // Public inputs are already field elements, encode as 32-byte big-endian
  const publicInputs = publicSignals.map((signal: string) => fieldToHex32(signal));

  return { a, b, c, publicInputs };
}

/**
 * Build the circuit witness inputs from a PrivateIntent and Merkle proofs.
 */
export function buildCircuitInputs(
  intent: PrivateIntent,
  batchRoot: string,
  sourceEventRoot: string,
  assetId: string,
  epoch: number,
  sourceMerklePath: string[],
  sourceMerkleIndices: number[],
  batchMerklePath: string[],
  batchMerkleIndices: number[]
): Record<string, unknown> {
  return {
    // Public inputs
    batch_root: batchRoot,
    source_event_root: sourceEventRoot,
    nullifier_hash: intent.nullifierHash,
    destination_commitment: intent.destinationCommitment,
    asset_id: assetId,
    epoch: epoch,
    // Private inputs
    secret: intent.secret,
    amount: intent.amount,
    route_salt: intent.routeSalt,
    receiver_view_key: intent.receiverViewKey,
    source_event_path: sourceMerklePath,
    source_event_indices: sourceMerkleIndices,
    batch_path: batchMerklePath,
    batch_indices: batchMerkleIndices,
  };
}

export function privacyScore(quote: SolverQuote, anonymitySet: number, poolUtilization: number) {
  const setScore = Math.min(100, Math.round(Math.log10(Math.max(anonymitySet, 10)) * 24));
  const liquidityScore = Math.min(100, Math.round(poolUtilization * 100));
  const routeScore = quote.privacyScore;
  const feePenalty = Math.min(12, quote.feeBps / 4);
  return Math.max(0, Math.round((setScore + liquidityScore + routeScore) / 3 - feePenalty));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a decimal string field element to a 32-byte big-endian hex string. */
function fieldToHex32(decimalString: string): string {
  const n = BigInt(decimalString);
  return n.toString(16).padStart(64, "0");
}

function randomHex(bytes: number) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function digestHex(input: string) {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
