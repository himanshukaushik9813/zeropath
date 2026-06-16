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

type ProtocolStore = {
  prompt: string;
  intent: RouterIntent;
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
    await ensureStealthIdentity();
    const current = get();
    const solver = current.solverQuotes.find((quote) => quote.id === current.selectedSolverId) ?? current.solverQuotes[0];
    const artifact = buildProofArtifact(current.intent, current.stealthIdentity, solver.id, epoch);
    set({
      proofArtifact: artifact,
      runId: current.runId + 1,
    });
    runPhases(["deposit", "commitment", "proof", "verify"], 620);
  },

  executeTransfer: async () => {
    await ensureStealthIdentity();
    const current = get();
    const solver = current.solverQuotes.find((quote) => quote.id === current.selectedSolverId) ?? current.solverQuotes[0];
    epoch += 1;
    const artifact = buildProofArtifact(current.intent, current.stealthIdentity, solver.id, epoch);
    set({
      proofArtifact: artifact,
      runId: current.runId + 1,
    });
    runPhases(["deposit", "commitment", "proof", "verify", "settlement", "complete"], 720);
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
    ? buildProofArtifact(intent, identity, solver.id, epoch)
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
