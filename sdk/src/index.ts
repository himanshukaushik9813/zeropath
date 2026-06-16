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
};

export type SolverQuote = {
  solverId: string;
  routeCommitment: string;
  feeBps: number;
  latencySeconds: number;
  privacyScore: number;
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

export async function generateSettlementProof(_intent: PrivateIntent) {
  // Production path:
  // 1. Fetch source event Merkle path from relayer.
  // 2. Fetch current batch path.
  // 3. Run snarkjs.groth16.fullProve in browser.
  // 4. Return proof and public signals formatted for Soroban.
  throw new Error("wire snarkjs artifacts: private_settlement.wasm and private_settlement_final.zkey");
}

export function privacyScore(quote: SolverQuote, anonymitySet: number, poolUtilization: number) {
  const setScore = Math.min(100, Math.round(Math.log10(Math.max(anonymitySet, 10)) * 24));
  const liquidityScore = Math.min(100, Math.round(poolUtilization * 100));
  const routeScore = quote.privacyScore;
  const feePenalty = Math.min(12, quote.feeBps / 4);
  return Math.max(0, Math.round((setScore + liquidityScore + routeScore) / 3 - feePenalty));
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
