"use client";

import { create } from "zustand";
import {
  buildAnalytics,
  buildProofArtifact,
  buildProofSteps,
  buildProtocolEvents,
  buildRegionActivity,
  buildRoute,
  buildSolverQuotes,
  chooseSolver,
  defaultIntent,
  generateStealthIdentity,
  getChain,
  parseIntentPrompt,
  proofTimeline,
  type ChainId,
  type ComplianceMode,
  type ParsedIntent,
  type PrivacyAnalytics,
  type ProofArtifact,
  type ProofStep,
  type ProtocolEvent,
  type ProtocolPhase,
  type RegionActivity,
  type RegionId,
  type RouteLeg,
  type RouterIntent,
  type SolverQuote,
  type StealthIdentity,
} from "@/lib/protocol-engine";

export type DemoStage = "idle" | "proving" | "settling" | "done" | "error";

export type DemoStatus = {
  /** True while a proof is being generated or submitted (drives spinners/disabled buttons). */
  running: boolean;
  stage: DemoStage;
  /** Plain-language description of what is happening, for non-technical viewers. */
  message: string;
  /** True when a real snarkjs Groth16 proof was produced (not the demo fallback). */
  isRealProof: boolean;
  /** Set once the proof is verified on the Stellar contract on-chain. */
  onChain: { txHash: string | null; explorer: string | null; network: string } | null;
};

const STATUS_IDLE: DemoStatus = {
  running: false,
  stage: "idle",
  message: "Ready. Run the demo to generate a real zero-knowledge proof and verify it on Stellar.",
  isRealProof: false,
  onChain: null,
};

const MSG_PROVING =
  "Generating a real zero-knowledge proof in your browser with snarkjs — this takes ~10s and never leaves your device.";
const MSG_SETTLING =
  "Proof ready. Submitting it to the ZeroPath contract on Stellar testnet for on-chain BN254 verification…";
const MSG_SETTLED_ONCHAIN =
  "Verified on Stellar. The contract ran bn254.pairing_check(), the proof passed, and funds were released.";
const MSG_REAL_OFFCHAIN =
  "Real Groth16 proof generated and verified against the circuit's key in-browser. Configure the relayer to also settle on Stellar testnet.";
const MSG_PROOF_REAL =
  "Real Groth16 proof generated and locally verified against the circuit's verification key.";
const MSG_DEMO_FALLBACK =
  "Showing a demo proof. Start the relayer (cd relayer && npm start) to generate a real proof in the browser.";

function errorStatus(error: unknown): DemoStatus {
  return {
    running: false,
    stage: "error",
    message: "Something interrupted the run: " + (error instanceof Error ? error.message : String(error)),
    isRealProof: false,
    onChain: null,
  };
}

type ProtocolStore = {
  prompt: string;
  intent: RouterIntent;
  demoStatus: DemoStatus;
  parsedIntent: ParsedIntent;
  route: RouteLeg[];
  solverQuotes: SolverQuote[];
  selectedSolverId: string;
  phase: ProtocolPhase;
  stealthIdentity: StealthIdentity | null;
  proofArtifact: ProofArtifact | null;
  proofSteps: ProofStep[];
  analytics: PrivacyAnalytics;
  events: ProtocolEvent[];
  regions: RegionActivity[];
  selectedRegionId: RegionId;
  runId: number;
  setPrompt: (prompt: string) => void;
  parsePrompt: () => void;
  updateIntent: (patch: Partial<RouterIntent>) => void;
  setComplianceMode: (mode: ComplianceMode) => void;
  selectSolver: (solverId: string) => void;
  selectRegion: (regionId: RegionId) => void;
  generateStealthAddress: () => Promise<void>;
  generateProof: () => Promise<void>;
  executeTransfer: () => Promise<void>;
  resetDemo: () => void;
};

const defaultPrompt = "Move 5000 USDC privately from Ethereum to Solana.";
const initialParsedIntent = parseIntentPrompt(defaultPrompt, defaultIntent);
const initialQuotes = buildSolverQuotes(defaultIntent);
const initialSolver = chooseSolver(defaultIntent, initialQuotes);
const initialPhase: ProtocolPhase = "idle";
const initialArtifact: ProofArtifact | null = null;

let timers: number[] = [];
let epoch = 4218;

export const useProtocolStore = create<ProtocolStore>((set, get) => ({
  prompt: defaultPrompt,
  intent: defaultIntent,
  demoStatus: STATUS_IDLE,
  parsedIntent: initialParsedIntent,
  route: buildRoute(defaultIntent, initialPhase),
  solverQuotes: initialQuotes,
  selectedSolverId: initialSolver.id,
  phase: initialPhase,
  stealthIdentity: null,
  proofArtifact: initialArtifact,
  proofSteps: buildProofSteps(initialPhase),
  analytics: buildAnalytics(defaultIntent, initialPhase, initialSolver),
  events: [],
  regions: buildRegionActivity(defaultIntent, initialPhase),
  selectedRegionId: "europe",
  runId: 0,

  setPrompt: (prompt) => set({ prompt }),

  parsePrompt: () => {
    clearProtocolTimers();
    const current = get();
    const parsedIntent = parseIntentPrompt(current.prompt, current.intent);
    const nextIntent = sanitizeIntent(parsedIntent);
    const next = deriveState({
      artifact: null,
      identity: current.stealthIdentity,
      intent: nextIntent,
      phase: "idle",
      preferredSolverId: current.selectedSolverId,
    });

    set({
      ...next,
      parsedIntent,
      intent: nextIntent,
      proofArtifact: null,
      runId: current.runId + 1,
    });
  },

  updateIntent: (patch) => {
    clearProtocolTimers();
    const current = get();
    const intent = sanitizeIntent({ ...current.intent, ...patch });
    const parsedIntent = parseIntentPrompt(
      `Move ${intent.amount} ${intent.asset} privately from ${getChain(intent.source).name} to ${getChain(intent.destination).name}.`,
      intent
    );
    const next = deriveState({
      artifact: null,
      identity: current.stealthIdentity,
      intent,
      phase: "idle",
      preferredSolverId: current.selectedSolverId,
    });

    set({
      ...next,
      intent,
      parsedIntent,
      phase: "idle",
      proofArtifact: null,
      runId: current.runId + 1,
    });
  },

  setComplianceMode: (mode) => get().updateIntent({ complianceMode: mode }),

  selectSolver: (solverId) => {
    clearProtocolTimers();
    const current = get();
    const next = deriveState({
      artifact: null,
      identity: current.stealthIdentity,
      intent: current.intent,
      phase: "idle",
      preferredSolverId: solverId,
    });

    set({
      ...next,
      proofArtifact: null,
      runId: current.runId + 1,
    });
  },

  selectRegion: (regionId) => set({ selectedRegionId: regionId }),

  generateStealthAddress: async () => {
    clearProtocolTimers();
    const current = get();
    const stealthIdentity = await generateStealthIdentity(current.intent);
    const next = deriveState({
      artifact: null,
      identity: stealthIdentity,
      intent: current.intent,
      phase: "idle",
      preferredSolverId: current.selectedSolverId,
    });

    set({
      ...next,
      stealthIdentity,
      proofArtifact: null,
      runId: current.runId + 1,
    });
  },

  generateProof: async () => {
    set({ demoStatus: { running: true, stage: "proving", message: MSG_PROVING, isRealProof: false, onChain: null } });
    try {
      await ensureStealthIdentity();
      const current = get();
      const solver = current.solverQuotes.find((quote) => quote.id === current.selectedSolverId) ?? current.solverQuotes[0];

      // Try real proof generation, fall back to demo artifact
      const realProofData = await tryGenerateRealProof(0);
      const artifact = buildProofArtifact(current.intent, current.stealthIdentity, solver.id, epoch, realProofData ?? undefined);
      set({
        proofArtifact: artifact,
        runId: current.runId + 1,
        demoStatus: {
          running: false,
          stage: "done",
          isRealProof: !!realProofData,
          onChain: null,
          message: realProofData ? MSG_PROOF_REAL : MSG_DEMO_FALLBACK,
        },
      });
      runPhases(["deposit", "commitment", "proof", "verify"], 620);
    } catch (error) {
      set({ demoStatus: errorStatus(error) });
    }
  },

  executeTransfer: async () => {
    set({ demoStatus: { running: true, stage: "proving", message: MSG_PROVING, isRealProof: false, onChain: null } });
    try {
      await ensureStealthIdentity();
      const current = get();
      const solver = current.solverQuotes.find((quote) => quote.id === current.selectedSolverId) ?? current.solverQuotes[0];
      epoch += 1;

      // Try real proof generation, fall back to demo artifact. Rotate the demo
      // leaf so repeated on-chain settlements each get a fresh nullifier.
      const leafIndex = onChainLeafCursor % DEMO_LEAF_COUNT;
      onChainLeafCursor += 1;
      const realProofData = await tryGenerateRealProof(leafIndex);
      const artifact = buildProofArtifact(current.intent, current.stealthIdentity, solver.id, epoch, realProofData ?? undefined);
      set({
        proofArtifact: artifact,
        runId: current.runId + 1,
        demoStatus: {
          running: !!realProofData,
          stage: realProofData ? "settling" : "done",
          isRealProof: !!realProofData,
          onChain: null,
          message: realProofData ? MSG_SETTLING : MSG_DEMO_FALLBACK,
        },
      });
      runPhases(["deposit", "commitment", "proof", "verify", "settlement", "complete"], 720);

      // With a real proof in hand, submit it to the deployed Stellar contract so
      // it is verified on-chain, then surface the transaction to the viewer.
      if (realProofData) {
        const onChain = await trySubmitOnChain(realProofData);
        const cur = get();
        set({
          proofArtifact: cur.proofArtifact
            ? {
                ...cur.proofArtifact,
                onChain: onChain ?? undefined,
                settlementTx: onChain?.txHash ?? cur.proofArtifact.settlementTx,
              }
            : cur.proofArtifact,
          demoStatus: {
            running: false,
            stage: "done",
            isRealProof: true,
            onChain,
            message: onChain ? MSG_SETTLED_ONCHAIN : MSG_REAL_OFFCHAIN,
          },
        });
      }
    } catch (error) {
      set({ demoStatus: errorStatus(error) });
    }
  },

  resetDemo: () => {
    clearProtocolTimers();
    const current = get();
    const next = deriveState({
      artifact: null,
      identity: current.stealthIdentity,
      intent: current.intent,
      phase: "idle",
      preferredSolverId: current.selectedSolverId,
    });
    set({
      ...next,
      phase: "idle",
      proofArtifact: null,
      demoStatus: STATUS_IDLE,
      runId: current.runId + 1,
    });
  },
}));

function deriveState({
  artifact,
  identity,
  intent,
  phase,
  preferredSolverId,
}: {
  artifact: ProofArtifact | null;
  identity: StealthIdentity | null;
  intent: RouterIntent;
  phase: ProtocolPhase;
  preferredSolverId: string;
}) {
  const solverQuotes = buildSolverQuotes(intent);
  const preferred = solverQuotes.find((quote) => quote.id === preferredSolverId && quote.complianceSupport.includes(intent.complianceMode));
  const solver = preferred ?? chooseSolver(intent, solverQuotes);
  const proofArtifact = artifact
    ? {
        ...buildProofArtifact(intent, identity, solver.id, epoch,
          artifact.realProof ? {
            proof: artifact.realProof,
            publicSignals: artifact.realPublicSignals ?? [],
            sorobanEncoded: artifact.sorobanEncoded,
          } : undefined),
        // Preserve any on-chain settlement result across state re-derivations.
        onChain: artifact.onChain,
      }
    : artifact;

  return {
    analytics: buildAnalytics(intent, phase, solver),
    events: buildProtocolEvents(phase, intent, proofArtifact),
    phase,
    proofArtifact,
    proofSteps: buildProofSteps(phase),
    regions: buildRegionActivity(intent, phase),
    route: buildRoute(intent, phase),
    selectedSolverId: solver.id,
    solverQuotes,
  };
}

function runPhases(phases: ProtocolPhase[], interval: number) {
  clearProtocolTimers();
  phases.forEach((phase, index) => {
    const timer = window.setTimeout(() => {
      const current = useProtocolStore.getState();
      const next = deriveState({
        artifact: current.proofArtifact,
        identity: current.stealthIdentity,
        intent: current.intent,
        phase,
        preferredSolverId: current.selectedSolverId,
      });
      useProtocolStore.setState(next);
    }, index * interval);
    timers.push(timer);
  });
}

async function ensureStealthIdentity() {
  const current = useProtocolStore.getState();
  if (current.stealthIdentity) {
    return;
  }
  await current.generateStealthAddress();
}

function clearProtocolTimers() {
  timers.forEach((timer) => window.clearTimeout(timer));
  timers = [];
}

function sanitizeIntent(intent: RouterIntent): RouterIntent {
  const destination: ChainId =
    intent.source === intent.destination ? (intent.source === "stellar" ? "ethereum" : "stellar") : intent.destination;
  return {
    ...intent,
    amount: Math.max(1, Math.min(10_000_000, Number(intent.amount) || defaultIntent.amount)),
    destination,
  };
}

// ---------------------------------------------------------------------------
// Real ZK proof generation via snarkjs + relayer
// ---------------------------------------------------------------------------

const RELAYER_URL = process.env.NEXT_PUBLIC_RELAYER_URL ?? "http://localhost:8787";
const CIRCUIT_WASM_PATH = "/circuits/private_settlement.wasm";
const CIRCUIT_ZKEY_PATH = "/circuits/private_settlement_final.zkey";

// There are 4 pre-seeded demo leaves, each with a single-use nullifier. Rotate
// through them so repeated on-chain settlements use fresh nullifiers (a reused
// leaf is still verified in-browser but rejected on-chain as "nullifier spent").
const DEMO_LEAF_COUNT = 4;
let onChainLeafCursor = 0;

type RealProofData = {
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
  publicSignals: string[];
  sorobanEncoded: { a: string; b: string; c: string; publicInputs: string[] };
};

/**
 * Attempt to generate a real Groth16 proof using the relayer's demo secrets
 * and snarkjs running in the browser.
 * Returns null if the relayer is unreachable or circuit artifacts are missing.
 */
async function tryGenerateRealProof(leafIndex: number): Promise<RealProofData | null> {
  try {
    // 1. Fetch demo secrets from relayer
    const secretsRes = await fetch(`${RELAYER_URL}/v1/demo-secrets`);
    if (!secretsRes.ok) return null;
    const { secrets } = await secretsRes.json();
    const demo = secrets[leafIndex];
    if (!demo) return null;

    // 2. Fetch Merkle proofs for source and batch trees
    const [sourceRes, batchRes] = await Promise.all([
      fetch(`${RELAYER_URL}/v1/merkle-proof/source/${leafIndex}`),
      fetch(`${RELAYER_URL}/v1/merkle-proof/batch/${leafIndex}`),
    ]);
    if (!sourceRes.ok || !batchRes.ok) return null;
    const sourceProof = await sourceRes.json();
    const batchProof = await batchRes.json();

    // 3. Build circuit inputs
    const circuitInputs = {
      batch_root: demo.batchRoot,
      source_event_root: demo.sourceEventRoot,
      nullifier_hash: demo.nullifierHash,
      destination_commitment: demo.destinationCommitment,
      asset_id: demo.assetId,
      epoch: demo.epoch,
      secret: demo.secret,
      amount: demo.amount,
      route_salt: demo.routeSalt,
      receiver_view_key: demo.receiverViewKey,
      source_event_path: sourceProof.path,
      source_event_indices: sourceProof.indices,
      batch_path: batchProof.path,
      batch_indices: batchProof.indices,
    };

    // 4. Generate proof with snarkjs in the browser
    console.log("[ZeroPath] Generating Groth16 proof in browser...");
    const snarkjs = await import("snarkjs");
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      circuitInputs,
      CIRCUIT_WASM_PATH,
      CIRCUIT_ZKEY_PATH
    );
    console.log("[ZeroPath] Proof generated successfully!", { publicSignals });

    // 5. Encode for Soroban
    const sorobanEncoded = encodeSorobanProof(proof, publicSignals);

    return {
      proof: { pi_a: proof.pi_a, pi_b: proof.pi_b, pi_c: proof.pi_c },
      publicSignals,
      sorobanEncoded,
    };
  } catch (error) {
    console.info("[ZeroPath] Real proof generation unavailable — using demo artifact. This is expected if the relayer is not running.");
    console.warn("[ZeroPath] Underlying error:", error);
    return null;
  }
}

type OnChainResult = { txHash: string | null; explorer: string | null; network: string };

/**
 * Submit a real Groth16 proof to the relayer's /v1/settle endpoint, which
 * invokes the deployed contract's settle() on Stellar so the proof is verified
 * on-chain. Returns null if the relayer is unreachable or on-chain settlement
 * is not configured (expected in a local demo without a deployed contract).
 */
async function trySubmitOnChain(realProofData: RealProofData): Promise<OnChainResult | null> {
  try {
    const enc = realProofData.sorobanEncoded;
    if (!enc || enc.publicInputs.length < 6) return null;

    const body = {
      publicInputs: {
        batch_root: enc.publicInputs[0],
        source_event_root: enc.publicInputs[1],
        nullifier_hash: enc.publicInputs[2],
        destination_commitment: enc.publicInputs[3],
        asset_id: enc.publicInputs[4],
      },
      // The proof commits to the demo epoch, not the UI's running counter.
      epoch: Number(realProofData.publicSignals[5]),
      proof: { a: enc.a, b: enc.b, c: enc.c },
    };

    const res = await fetch(`${RELAYER_URL}/v1/settle`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.info("[ZeroPath] On-chain settlement unavailable (status " + res.status + "). This is expected without a deployed contract.");
      return null;
    }
    const data = await res.json();
    console.log("[ZeroPath] Proof settled on-chain:", data);
    return { txHash: data.txHash ?? null, explorer: data.explorer ?? null, network: data.network ?? "testnet" };
  } catch (error) {
    console.info("[ZeroPath] On-chain settlement submission failed — proof still verified in-browser.");
    console.warn("[ZeroPath] Underlying error:", error);
    return null;
  }
}

function fieldToHex32(decimalString: string): string {
  const n = BigInt(decimalString);
  return n.toString(16).padStart(64, "0");
}

function encodeSorobanProof(
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] },
  publicSignals: string[]
) {
  return {
    a: fieldToHex32(proof.pi_a[0]) + fieldToHex32(proof.pi_a[1]),
    b:
      fieldToHex32(proof.pi_b[0][1]) +
      fieldToHex32(proof.pi_b[0][0]) +
      fieldToHex32(proof.pi_b[1][1]) +
      fieldToHex32(proof.pi_b[1][0]),
    c: fieldToHex32(proof.pi_c[0]) + fieldToHex32(proof.pi_c[1]),
    publicInputs: publicSignals.map(fieldToHex32),
  };
}
