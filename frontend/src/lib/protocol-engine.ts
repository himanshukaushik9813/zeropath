export type ChainId = "ethereum" | "solana" | "base" | "polygon" | "arbitrum" | "stellar";
export type AssetId = "USDC" | "XLM" | "ETH";
export type ComplianceMode = "private" | "balanced" | "institutional";
export type ProtocolPhase = "idle" | "deposit" | "commitment" | "proof" | "verify" | "settlement" | "complete";
export type ProofStatus = "idle" | "active" | "complete";

export type Chain = {
  id: ChainId;
  name: string;
  short: string;
  region: RegionId;
  liquidityDepth: number;
};

export type RegionId = "americas" | "europe" | "apac" | "mena";

export type RouterIntent = {
  source: ChainId;
  destination: ChainId;
  asset: AssetId;
  amount: number;
  complianceMode: ComplianceMode;
};

export type ParsedIntent = RouterIntent & {
  confidence: number;
  summary: string;
  reasoning: string[];
};

export type RouteLeg = {
  id: string;
  from: ChainId;
  to: ChainId;
  layer: "source" | "stellar" | "destination";
  status: ProofStatus;
};

export type SolverQuote = {
  id: string;
  name: string;
  strategy: string;
  latencySeconds: number;
  feeBps: number;
  successRate: number;
  privacyScore: number;
  routeQuality: number;
  complianceSupport: ComplianceMode[];
};

export type PrivacyAnalytics = {
  anonymitySet: number;
  poolSizeUsd: number;
  proofVerifications: number;
  settlementCount: number;
  privacyScore: number;
  complianceScore: number;
  routeAvailability: number;
  feeBps: number;
  latencySeconds: number;
};

export type StealthIdentity = {
  stealthReceiver: string;
  ephemeralPublicKey: string;
  destinationCommitment: string;
  routeCommitment: string;
  nullifierHash: string;
  metadata: string[];
};

export type ProofArtifact = {
  commitment: string;
  merkleRoot: string;
  merklePath: string[];
  groth16Proof: string;
  bn254Status: "pending" | "verified";
  settlementTx: string;
  publicInputs: {
    batch_root: string;
    source_event_root: string;
    nullifier_hash: string;
    destination_commitment: string;
    asset_id: string;
    epoch: string;
  };
  /** Real Groth16 proof from snarkjs (populated when proof generation succeeds). */
  realProof?: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  /** Real public signals from snarkjs. */
  realPublicSignals?: string[];
  /** Soroban-encoded proof bytes (populated after encoding). */
  sorobanEncoded?: {
    a: string;
    b: string;
    c: string;
    publicInputs: string[];
  };
  /** True when using demo/mock data instead of a real Groth16 proof. */
  demoMode?: boolean;
};

export type ProofStep = {
  id: ProtocolPhase;
  label: string;
  detail: string;
  status: ProofStatus;
};

export type ProtocolEvent = {
  id: string;
  phase: ProtocolPhase;
  title: string;
  detail: string;
  timestamp: string;
};

export type RegionActivity = {
  id: RegionId;
  label: string;
  volumeUsd: number;
  privacyActivity: number;
  activeRoutes: number;
  settlementShare: number;
};

export const chains: Chain[] = [
  { id: "ethereum", name: "Ethereum", short: "ETH", region: "americas", liquidityDepth: 96 },
  { id: "solana", name: "Solana", short: "SOL", region: "apac", liquidityDepth: 86 },
  { id: "base", name: "Base", short: "BASE", region: "americas", liquidityDepth: 82 },
  { id: "polygon", name: "Polygon", short: "POL", region: "apac", liquidityDepth: 77 },
  { id: "arbitrum", name: "Arbitrum", short: "ARB", region: "europe", liquidityDepth: 80 },
  { id: "stellar", name: "Stellar", short: "XLM", region: "europe", liquidityDepth: 92 },
] as const;

export const assets: AssetId[] = ["USDC", "XLM", "ETH"];
export const complianceModes: Array<{ id: ComplianceMode; label: string; detail: string }> = [
  { id: "private", label: "Private", detail: "Max anonymity, least policy disclosure." },
  { id: "balanced", label: "Balanced", detail: "Privacy with selective route attestations." },
  { id: "institutional", label: "Institutional", detail: "Privacy Pools style compliance proofs." },
];

export const defaultIntent: RouterIntent = {
  source: "ethereum",
  destination: "solana",
  asset: "USDC",
  amount: 5000,
  complianceMode: "private",
};

export const proofTimeline: Array<Pick<ProofStep, "id" | "label" | "detail">> = [
  { id: "deposit", label: "Deposit detected", detail: "Source escrow emits PrivateIntentCommitted." },
  { id: "commitment", label: "Commitment generated", detail: "Destination and route stay opaque." },
  { id: "proof", label: "Groth16 proof", detail: "Merkle membership compresses into BN254 proof." },
  { id: "verify", label: "BN254 verification", detail: "Stellar verifies public inputs natively." },
  { id: "settlement", label: "Settlement", detail: "Nullifier consumed and liquidity released." },
  { id: "complete", label: "Transfer complete", detail: "Destination funded without public route linkage." },
];

const phaseRank: Record<ProtocolPhase, number> = {
  idle: 0,
  deposit: 1,
  commitment: 2,
  proof: 3,
  verify: 4,
  settlement: 5,
  complete: 6,
};

export function getChain(id: ChainId) {
  return chains.find((chain) => chain.id === id) ?? chains[0];
}

export function parseIntentPrompt(prompt: string, current: RouterIntent): ParsedIntent {
  const normalized = prompt.toLowerCase();
  const amountMatch = normalized.match(/(?:move|send|transfer)?\s*\$?([0-9][0-9,]*(?:\.[0-9]+)?)/);
  const assetMatch = normalized.match(/\b(usdc|xlm|eth)\b/);
  const source = findChainAfter(normalized, ["from", "on"]) ?? current.source;
  const destination = findChainAfter(normalized, ["to", "into", "towards"]) ?? current.destination;
  const complianceMode: ComplianceMode = normalized.includes("institution")
    ? "institutional"
    : normalized.includes("balanced") || normalized.includes("compliance")
      ? "balanced"
      : normalized.includes("cheap")
        ? "balanced"
        : "private";
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : current.amount;
  const asset = assetMatch ? (assetMatch[1].toUpperCase() as AssetId) : current.asset;
  const safeDestination = source === destination ? (source === "stellar" ? "ethereum" : "stellar") : destination;
  const parsed = { source, destination: safeDestination, asset, amount, complianceMode };
  const route = buildRoute(parsed, "idle");

  const finalRouteLeg = route[route.length - 1];

  return {
    ...parsed,
    confidence: amountMatch && assetMatch ? 96 : 82,
    summary: `${formatAmount(amount)} ${asset} from ${getChain(source).name} to ${getChain(safeDestination).name}`,
    reasoning: [
      `Intent parsed into ${route.map((leg) => getChain(leg.from).name).concat(getChain(finalRouteLeg?.to ?? safeDestination).name).join(" -> ")}.`,
      "Stellar selected as private settlement layer for BN254 verification.",
      `${labelForCompliance(complianceMode)} policy controls route availability and disclosure level.`,
    ],
  };
}

export function buildRoute(intent: RouterIntent, phase: ProtocolPhase): RouteLeg[] {
  const path =
    intent.source === "stellar" || intent.destination === "stellar"
      ? [intent.source, intent.destination]
      : [intent.source, "stellar" as ChainId, intent.destination];

  return path.slice(0, -1).map((from, index) => {
    const statusRank = phaseRank[phase];
    const activeIndex = Math.max(0, Math.min(path.length - 2, statusRank - 2));
    const status: ProofStatus =
      phase === "idle" ? "idle" : index < activeIndex || phase === "complete" ? "complete" : index === activeIndex ? "active" : "idle";
    return {
      id: `${from}-${path[index + 1]}`,
      from,
      to: path[index + 1],
      layer: path[index + 1] === "stellar" ? "stellar" : index === 0 ? "source" : "destination",
      status,
    };
  });
}

export function buildSolverQuotes(intent: RouterIntent): SolverQuote[] {
  const routeDepth = intent.source === "stellar" || intent.destination === "stellar" ? 1 : 2;
  const amountScale = Math.min(18, Math.floor(intent.amount / 1000));
  const policy = policyWeights(intent.complianceMode);

  return [
    {
      id: "northstar",
      name: "Northstar",
      strategy: "Maximum privacy batch",
      latencySeconds: 16 + routeDepth * 5 + policy.latency,
      feeBps: 7 + amountScale + policy.fee,
      successRate: 99.2,
      privacyScore: Math.min(99, 91 + policy.privacy),
      routeQuality: 94 - policy.restriction,
      complianceSupport: ["private", "balanced"],
    },
    {
      id: "helix",
      name: "Helix",
      strategy: "Balanced settlement",
      latencySeconds: 14 + routeDepth * 4 + Math.floor(policy.latency / 2),
      feeBps: 5 + Math.floor(amountScale * 0.7) + Math.max(0, policy.fee - 2),
      successRate: 98.7,
      privacyScore: Math.min(99, 86 + Math.floor(policy.privacy / 2)),
      routeQuality: 91,
      complianceSupport: ["private", "balanced", "institutional"],
    },
    {
      id: "atlas",
      name: "Atlas",
      strategy: "Institutional compliance",
      latencySeconds: 20 + routeDepth * 3,
      feeBps: 9 + Math.floor(amountScale * 0.55),
      successRate: 99.6,
      privacyScore: intent.complianceMode === "institutional" ? 82 : 88,
      routeQuality: intent.complianceMode === "institutional" ? 96 : 87,
      complianceSupport: ["balanced", "institutional"],
    },
    {
      id: "vector",
      name: "Vector",
      strategy: "Low-fee fill",
      latencySeconds: 22 + routeDepth * 2,
      feeBps: 3 + Math.floor(amountScale * 0.45),
      successRate: 97.8,
      privacyScore: intent.complianceMode === "private" ? 83 : 79,
      routeQuality: 84,
      complianceSupport: ["balanced"],
    },
  ];
}

export function chooseSolver(intent: RouterIntent, quotes: SolverQuote[]) {
  const available = quotes.filter((quote) => quote.complianceSupport.includes(intent.complianceMode));
  const ranked = [...(available.length ? available : quotes)].sort((a, b) => {
    const scoreA = a.privacyScore * 0.42 + a.routeQuality * 0.3 + a.successRate * 0.18 - a.feeBps * 0.1;
    const scoreB = b.privacyScore * 0.42 + b.routeQuality * 0.3 + b.successRate * 0.18 - b.feeBps * 0.1;
    return scoreB - scoreA;
  });
  return ranked[0];
}

export function buildAnalytics(intent: RouterIntent, phase: ProtocolPhase, solver: SolverQuote): PrivacyAnalytics {
  const policy = policyWeights(intent.complianceMode);
  const source = getChain(intent.source);
  const destination = getChain(intent.destination);
  const phaseLift = phaseRank[phase] * 227;
  const anonymitySet = 28600 + Math.round(intent.amount * 1.7) + source.liquidityDepth * 83 + destination.liquidityDepth * 71 + policy.anonymity + phaseLift;
  const complianceScore = Math.min(99, 54 + policy.compliance + Math.round(solver.successRate / 4));
  const privacyScore = Math.max(64, Math.min(99, Math.round((solver.privacyScore + Math.log10(anonymitySet) * 18 + policy.privacy) / 2.2)));

  return {
    anonymitySet,
    poolSizeUsd: 178_000_000 + intent.amount * 11_000 + (source.liquidityDepth + destination.liquidityDepth) * 410_000,
    proofVerifications: 921_400 + phaseRank[phase] * 19 + Math.floor(intent.amount / 100),
    settlementCount: 184_000 + phaseRank[phase] * 7 + Math.floor(intent.amount / 1250),
    privacyScore,
    complianceScore,
    routeAvailability: Math.max(28, Math.min(96, 88 - policy.restriction + Math.round(solver.routeQuality / 8))),
    feeBps: solver.feeBps,
    latencySeconds: solver.latencySeconds,
  };
}

export function buildProofArtifact(
  intent: RouterIntent,
  identity: StealthIdentity | null,
  solverId: string,
  epoch: number,
  realProofData?: {
    proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
    publicSignals: string[];
    sorobanEncoded?: { a: string; b: string; c: string; publicInputs: string[] };
  }
): ProofArtifact {
  const seed = `${intent.source}:${intent.destination}:${intent.asset}:${intent.amount}:${intent.complianceMode}:${solverId}:${epoch}`;
  const destinationCommitment = identity?.destinationCommitment ?? pseudoHash(`${seed}:destination`);
  const nullifierHash = identity?.nullifierHash ?? pseudoHash(`${seed}:nullifier`);
  const sourceEventRoot = pseudoHash(`${seed}:source-event-root`);
  const batchRoot = pseudoHash(`${seed}:batch-root`);

  return {
    commitment: pseudoHash(`${seed}:commitment`),
    merkleRoot: sourceEventRoot,
    merklePath: Array.from({ length: 8 }, (_, index) => pseudoHash(`${seed}:path:${index}`)),
    groth16Proof: realProofData
      ? `groth16:${realProofData.proof.pi_a[0].slice(0, 16)}...`
      : pseudoHash(`${seed}:groth16-proof`),
    bn254Status: realProofData ? "verified" : "pending",
    demoMode: !realProofData,
    settlementTx: `stellar_${pseudoHash(`${seed}:settlement`).slice(2, 18)}`,
    publicInputs: {
      batch_root: realProofData ? realProofData.publicSignals[0] : batchRoot,
      source_event_root: realProofData ? realProofData.publicSignals[1] : sourceEventRoot,
      nullifier_hash: realProofData ? realProofData.publicSignals[2] : nullifierHash,
      destination_commitment: realProofData ? realProofData.publicSignals[3] : destinationCommitment,
      asset_id: realProofData ? realProofData.publicSignals[4] : pseudoHash(intent.asset).slice(0, 18),
      epoch: realProofData ? realProofData.publicSignals[5] : String(epoch),
    },
    realProof: realProofData?.proof,
    realPublicSignals: realProofData?.publicSignals,
    sorobanEncoded: realProofData?.sorobanEncoded,
  };
}

export function buildProofSteps(phase: ProtocolPhase): ProofStep[] {
  const rank = phaseRank[phase];
  return proofTimeline.map((step) => {
    const stepRank = phaseRank[step.id];
    return {
      ...step,
      status: phase === "idle" ? "idle" : stepRank < rank || phase === "complete" ? "complete" : stepRank === rank ? "active" : "idle",
    };
  });
}

export function buildRegionActivity(intent: RouterIntent, phase: ProtocolPhase): RegionActivity[] {
  const sourceRegion = getChain(intent.source).region;
  const destinationRegion = getChain(intent.destination).region;
  const phaseBonus = phaseRank[phase] * 3;

  const baseRegions: RegionActivity[] = [
    { id: "americas", label: "Americas", volumeUsd: 42_600_000, privacyActivity: 74, activeRoutes: 18, settlementShare: 32 },
    { id: "europe", label: "Europe", volumeUsd: 51_200_000, privacyActivity: 81, activeRoutes: 23, settlementShare: 38 },
    { id: "apac", label: "APAC", volumeUsd: 47_900_000, privacyActivity: 77, activeRoutes: 21, settlementShare: 24 },
    { id: "mena", label: "MENA", volumeUsd: 18_400_000, privacyActivity: 66, activeRoutes: 9, settlementShare: 6 },
  ];

  return baseRegions.map((region) => ({
    ...region,
    volumeUsd: region.volumeUsd + (region.id === sourceRegion || region.id === destinationRegion ? intent.amount * 1400 : intent.amount * 180),
    privacyActivity: Math.min(99, region.privacyActivity + (region.id === sourceRegion || region.id === destinationRegion ? phaseBonus : Math.floor(phaseBonus / 3))),
    activeRoutes: region.activeRoutes + (region.id === "europe" ? 4 : 0) + (region.id === sourceRegion || region.id === destinationRegion ? phaseRank[phase] : 0),
  }));
}

export function buildProtocolEvents(phase: ProtocolPhase, intent: RouterIntent, artifact: ProofArtifact | null): ProtocolEvent[] {
  const now = Date.now();
  const route = buildRoute(intent, phase);
  const finalRouteLeg = route[route.length - 1];
  const routeLabel = route.map((leg) => getChain(leg.from).name).concat(getChain(finalRouteLeg?.to ?? intent.destination).name).join(" -> ");
  const available = [
    { phase: "deposit" as const, title: "Intent accepted", detail: `${formatAmount(intent.amount)} ${intent.asset} locked on ${getChain(intent.source).name}.` },
    { phase: "commitment" as const, title: "Commitment generated", detail: artifact ? artifact.commitment : "Source and destination commitments prepared." },
    { phase: "proof" as const, title: "Groth16 proof created", detail: artifact ? artifact.groth16Proof : "Circuit witnesses route membership without exposing path." },
    { phase: "verify" as const, title: "BN254 verified on Stellar", detail: artifact ? artifact.publicInputs.source_event_root : "Public inputs checked against Stellar settlement state." },
    { phase: "settlement" as const, title: "Settlement coordinated", detail: routeLabel },
    { phase: "complete" as const, title: "Transfer complete", detail: artifact ? artifact.settlementTx : "Destination liquidity released." },
  ];

  return available
    .filter((event) => phaseRank[event.phase] <= phaseRank[phase] && phase !== "idle")
    .map((event, index) => ({
      id: `${event.phase}-${index}`,
      phase: event.phase,
      title: event.title,
      detail: event.detail,
      timestamp: new Date(now - (available.length - index) * 18_000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    }));
}

export async function generateStealthIdentity(intent: RouterIntent): Promise<StealthIdentity> {
  const receiverSeed = randomHex(32);
  const ephemeralPublicKey = `epk_${randomHex(32)}`;
  const routeSalt = randomHex(16);
  const stealthReceiver = `stealth_${intent.destination}_${receiverSeed.slice(0, 18)}`;
  const destinationCommitment = await digestHex(`${stealthReceiver}:${ephemeralPublicKey}:${routeSalt}`);
  const routeCommitment = await digestHex(`${intent.source}:${intent.destination}:${intent.asset}:${intent.complianceMode}:${routeSalt}`);
  const nullifierHash = await digestHex(`${receiverSeed}:nullifier`);

  return {
    stealthReceiver,
    ephemeralPublicKey,
    destinationCommitment: `0x${destinationCommitment}`,
    routeCommitment: `0x${routeCommitment}`,
    nullifierHash: `0x${nullifierHash}`,
    metadata: [
      "Receiver address is never posted publicly.",
      "Destination commitment binds one-time receiver and route salt.",
      "Nullifier prevents replay during Stellar settlement.",
    ],
  };
}

export function labelForCompliance(mode: ComplianceMode) {
  return complianceModes.find((item) => item.id === mode)?.label ?? "Private";
}

export function formatAmount(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat(undefined, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

export function shorten(value: string, lead = 8, tail = 6) {
  if (!value) return "";
  if (value.length <= lead + tail + 3) return value;
  return `${value.slice(0, lead)}...${value.slice(-tail)}`;
}

function findChainAfter(input: string, markers: string[]): ChainId | undefined {
  for (const marker of markers) {
    const match = input.match(new RegExp(`${marker}\\s+(ethereum|solana|base|polygon|arbitrum|stellar)\\b`));
    if (match) return match[1] as ChainId;
  }
  return undefined;
}

function policyWeights(mode: ComplianceMode) {
  if (mode === "institutional") {
    return { anonymity: -1800, compliance: 38, fee: 3, latency: 5, privacy: -4, restriction: 22 };
  }
  if (mode === "balanced") {
    return { anonymity: 800, compliance: 24, fee: 1, latency: 2, privacy: 2, restriction: 9 };
  }
  return { anonymity: 3200, compliance: 8, fee: 4, latency: 4, privacy: 7, restriction: 18 };
}

function pseudoHash(value: string) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  const left = (h1 >>> 0).toString(16).padStart(8, "0");
  const right = (h2 >>> 0).toString(16).padStart(8, "0");
  return `0x${(left + right).repeat(4).slice(0, 64)}`;
}

function randomHex(bytes: number) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digestHex(input: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
