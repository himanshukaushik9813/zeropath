"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import {
  Brain,
  Cpu,
  LockKeyhole,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import heroSettlementCore from "@/assets/visuals/hero-settlement-core.png";
import proofGenerationLayers from "@/assets/visuals/proof-generation-layers.png";
import visionCommandCenter from "@/assets/visuals/vision-command-center.png";
import {
  assets,
  chains,
  complianceModes,
  formatAmount,
  getChain,
  labelForCompliance,
  shorten,
  type AssetId,
  type ChainId,
  type ComplianceMode,
  type ProofStatus,
  type ProtocolPhase,
  type RouteLeg,
  type SolverQuote,
} from "@/lib/protocol-engine";
import { useProtocolStore } from "@/store/protocol-store";

const SettlementGlobe = dynamic(
  () => import("@/components/settlement-globe").then((mod) => mod.SettlementGlobe),
  {
    loading: () => <div className="globe-loading">Loading settlement activity</div>,
    ssr: false,
  }
);

const demoPhaseOrder: ProtocolPhase[] = ["deposit", "commitment", "proof", "verify", "settlement", "complete"];

export function ProtocolOperatingSystem() {
  const store = useProtocolStore();
  const [runtime, setRuntime] = useState({ noWebGL: false, reducedMotion: false });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reduced = params.has("reduced-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRuntime({ noWebGL: params.has("no-webgl"), reducedMotion: reduced });

    if (!reduced) {
      gsap.fromTo(
        ".experience-section",
        { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.58, ease: "power2.out", stagger: 0.08 }
      );
    }
  }, []);

  const activeSolver = getActiveSolver(store.solverQuotes, store.selectedSolverId);
  const routePath = getRoutePath(store.route, store.intent.destination);

  const runDemo = () => {
    void store.executeTransfer();
    document.getElementById("demo")?.scrollIntoView({ behavior: runtime.reducedMotion ? "auto" : "smooth" });
  };

  return (
    <main className={runtime.reducedMotion ? "protocol-os reduce-motion" : "protocol-os"}>
      <Image alt="" className="shell-backplate monolith-backplate" priority src={heroSettlementCore} />
      <TopNav />

      <HeroSection
        activeSolver={activeSolver.name}
        analyticsPrivacy={store.analytics.privacyScore}
        noWebGL={runtime.noWebGL}
        onRun={runDemo}
        routePath={routePath}
      />
      <ProductRouter activeSolver={activeSolver} routePath={routePath} />
      <HowItWorks />
      <ProofEngine />
      <ComplianceModeSelector />
      <SolverCompetition />
      <FinalSettlementDemo onRun={runDemo} />
    </main>
  );
}

function TopNav() {
  const links = [
    ["Product", "#product"],
    ["How", "#how"],
    ["Proof", "#proof"],
    ["Modes", "#modes"],
    ["Solvers", "#solvers"],
    ["Demo", "#demo"],
  ];

  return (
    <header className="os-nav">
      <a className="brand-lockup" href="#hero">
        <span aria-hidden="true" />
        ZeroPath
      </a>
      <nav aria-label="Protocol experience navigation">
        {links.map(([label, href]) => (
          <a href={href} key={href}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function HeroSection({
  activeSolver,
  analyticsPrivacy,
  noWebGL,
  onRun,
  routePath,
}: {
  activeSolver: string;
  analyticsPrivacy: number;
  noWebGL: boolean;
  onRun: () => void;
  routePath: string[];
}) {
  const phase = useProtocolStore((state) => state.phase);
  const regions = useProtocolStore((state) => state.regions);
  const route = useProtocolStore((state) => state.route);
  const selectedRegionId = useProtocolStore((state) => state.selectedRegionId);
  const selectRegion = useProtocolStore((state) => state.selectRegion);

  return (
    <section className="hero-section experience-section" id="hero">
      <div className="hero-copy">
        <p className="eyebrow">Private Settlement Network</p>
        <h1>Route intent. Prove privacy. Settle on Stellar.</h1>
        <p>
          ZeroPath turns a cross-chain transfer into one private settlement operation: intent in, BN254 proof verified,
          destination funded.
        </p>
        <button className="primary-button hero-cta" onClick={onRun} type="button">
          <Play size={15} /> Run protocol demo
        </button>
      </div>

      <div className="hero-globe">
        <SettlementGlobe
          noWebGL={noWebGL}
          onSelectRegion={selectRegion}
          phase={phase}
          regions={regions}
          route={route}
          selectedRegionId={selectedRegionId}
        />
        <div className="live-activity" aria-label="Live transaction activity">
          <Signal label="Settlement path" value={routePath.join(" -> ")} />
          <Signal label="Privacy score" value={`${analyticsPrivacy}/100`} />
          <Signal label="Solver" value={activeSolver} />
          <Signal label="Phase" value={phase} />
        </div>
      </div>
    </section>
  );
}

function ProductRouter({ activeSolver, routePath }: { activeSolver: SolverQuote; routePath: string[] }) {
  const analytics = useProtocolStore((state) => state.analytics);
  const intent = useProtocolStore((state) => state.intent);
  const parsedIntent = useProtocolStore((state) => state.parsedIntent);
  const prompt = useProtocolStore((state) => state.prompt);
  const route = useProtocolStore((state) => state.route);
  const executeTransfer = useProtocolStore((state) => state.executeTransfer);
  const parsePrompt = useProtocolStore((state) => state.parsePrompt);
  const setPrompt = useProtocolStore((state) => state.setPrompt);
  const updateIntent = useProtocolStore((state) => state.updateIntent);

  return (
    <section className="product-section experience-section" id="product">
      <SectionIntro
        eyebrow="The Product"
        title="AI Privacy Router"
        body="The user describes the outcome. ZeroPath parses the intent, selects the private path through Stellar, ranks solvers, and prices settlement."
      />

      <div className="router-command-center">
        <div className="intent-console">
          <div className="console-bar">
            <Brain size={16} />
            <span>Intent interface</span>
          </div>
          <textarea
            aria-label="Private transfer intent"
            onChange={(event) => setPrompt(event.target.value)}
            value={prompt}
          />
          <div className="button-row">
            <button className="primary-button" onClick={parsePrompt} type="button">
              <Sparkles size={15} /> Route intent
            </button>
            <button className="secondary-button" onClick={() => void executeTransfer()} type="button">
              <Play size={15} /> Execute
            </button>
          </div>
        </div>

        <div className="protocol-response">
          <div className="route-map" aria-label="Selected settlement path">
            {routePath.map((label, index) => (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className={index === 1 ? "route-stop stellar" : "route-stop"}
                initial={{ opacity: 0.55, y: 8 }}
                key={`${label}-${index}`}
                transition={{ delay: index * 0.08 }}
              >
                <span>{label}</span>
              </motion.div>
            ))}
          </div>

          <div className="decision-grid">
            <Signal label="Parsed" value={parsedIntent.summary} />
            <Signal label="Solver selected" value={activeSolver.name} />
            <Signal label="Fee" value={`${(analytics.feeBps / 100).toFixed(2)}%`} />
            <Signal label="Privacy" value={`${analytics.privacyScore}/100`} />
            <Signal label="Settlement" value={`${analytics.latencySeconds}s`} />
          </div>

          <div className="reasoning-flow">
            {parsedIntent.reasoning.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="route-controls" aria-label="Cross-chain route controls">
        <SelectField
          label="Source"
          onChange={(value) => updateIntent({ source: value as ChainId })}
          options={chains.map((chain) => [chain.id, chain.name])}
          value={intent.source}
        />
        <SelectField
          label="Destination"
          onChange={(value) => updateIntent({ destination: value as ChainId })}
          options={chains.map((chain) => [chain.id, chain.name])}
          value={intent.destination}
        />
        <SelectField
          label="Asset"
          onChange={(value) => updateIntent({ asset: value as AssetId })}
          options={assets.map((asset) => [asset, asset])}
          value={intent.asset}
        />
        <label className="field amount-field">
          <span>Amount</span>
          <input
            min={1}
            onChange={(event) => updateIntent({ amount: Number(event.target.value) })}
            type="number"
            value={intent.amount}
          />
        </label>
        <div className="route-leg-strip">
          {route.map((leg) => (
            <LegPill key={leg.id} leg={leg} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const proofSteps = useProtocolStore((state) => state.proofSteps);

  return (
    <section className="timeline-section experience-section" id="how">
      <SectionIntro
        eyebrow="How ZeroPath Works"
        title="One private lifecycle."
        body="The transfer is not exposed as a route. It becomes commitments, a portable Groth16 proof, Stellar BN254 verification, and final settlement."
      />
      <div className="cinematic-timeline">
        {proofSteps.map((step, index) => (
          <motion.article
            animate={{ opacity: step.status === "idle" ? 0.42 : 1, scale: step.status === "active" ? 1.02 : 1 }}
            className={`timeline-stage ${step.status}`}
            key={step.id}
          >
            <small>{String(index + 1).padStart(2, "0")}</small>
            <h3>{step.label}</h3>
            <p>{step.detail}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function ProofEngine() {
  const generateProof = useProtocolStore((state) => state.generateProof);
  const phase = useProtocolStore((state) => state.phase);
  const proofArtifact = useProtocolStore((state) => state.proofArtifact);
  const stealthIdentity = useProtocolStore((state) => state.stealthIdentity);

  return (
    <section className="proof-engine-section experience-section" id="proof">
      <Image alt="" className="proof-backplate" src={proofGenerationLayers} />
      <div className="proof-engine-copy">
        <p className="eyebrow">Technical Moat</p>
        <h2>BN254 proof portability.</h2>
        <p>
          Ethereum-side events collapse into a Groth16 BN254 proof that Stellar verifies natively. This is the private
          settlement primitive, not bridge messaging.
        </p>
        <button className="primary-button" onClick={() => void generateProof()} type="button">
          <Zap size={15} /> Generate proof
        </button>
      </div>

      <div className="proof-core">
        <div className="proof-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="proof-core-center">
          <Cpu size={28} />
          <strong>{proofArtifact?.bn254Status ?? "pending"}</strong>
          <span>Stellar BN254 verifier</span>
        </div>
      </div>

      <div className="proof-inputs">
        <Signal label="Current phase" value={phase} />
        <Signal label="Commitment" mono value={proofArtifact ? shorten(proofArtifact.commitment) : "not generated"} />
        <Signal label="Merkle root" mono value={proofArtifact ? shorten(proofArtifact.merkleRoot) : "pending"} />
        <Signal label="Groth16 proof" mono value={proofArtifact ? shorten(proofArtifact.groth16Proof) : "pending"} />
        <Signal
          label="Destination commitment"
          mono
          value={stealthIdentity ? shorten(stealthIdentity.destinationCommitment) : "created with proof"}
        />
        <Signal label="Nullifier" mono value={stealthIdentity ? shorten(stealthIdentity.nullifierHash) : "pending"} />
      </div>
    </section>
  );
}

function ComplianceModeSelector() {
  const analytics = useProtocolStore((state) => state.analytics);
  const intent = useProtocolStore((state) => state.intent);
  const setComplianceMode = useProtocolStore((state) => state.setComplianceMode);

  return (
    <section className="modes-section experience-section" id="modes">
      <SectionIntro
        eyebrow="Compliance Layer"
        title="Choose the operating mode."
        body="Private, balanced, and institutional routes use the same flow with different anonymity, compliance, and solver eligibility constraints."
      />

      <div className="mode-console" role="group" aria-label="Compliance operating mode">
        {complianceModes.map((mode) => (
          <button
            className={intent.complianceMode === mode.id ? "mode-option active" : "mode-option"}
            key={mode.id}
            onClick={() => setComplianceMode(mode.id)}
            type="button"
          >
            <span>{mode.label}</span>
            <strong>{mode.id === "private" ? "Max privacy" : mode.id === "balanced" ? "Selective disclosure" : "Policy proofs"}</strong>
            <small>{mode.detail}</small>
          </button>
        ))}
      </div>

      <div className="mode-readout">
        <Signal label="Mode" value={labelForCompliance(intent.complianceMode as ComplianceMode)} />
        <Signal label="Anonymity" value={`${analytics.privacyScore}/100`} />
        <Signal label="Compliance" value={`${analytics.complianceScore}/100`} />
        <Signal label="Route availability" value={`${analytics.routeAvailability}%`} />
      </div>
    </section>
  );
}

function SolverCompetition() {
  const selectSolver = useProtocolStore((state) => state.selectSolver);
  const selectedSolverId = useProtocolStore((state) => state.selectedSolverId);
  const solverQuotes = useProtocolStore((state) => state.solverQuotes);

  const rankedSolvers = useMemo(
    () =>
      [...solverQuotes].sort((left, right) => {
        const leftScore = left.routeQuality + left.privacyScore + left.successRate - left.feeBps / 2 - left.latencySeconds / 4;
        const rightScore = right.routeQuality + right.privacyScore + right.successRate - right.feeBps / 2 - right.latencySeconds / 4;
        return rightScore - leftScore;
      }),
    [solverQuotes]
  );

  return (
    <section className="solvers-section experience-section" id="solvers">
      <SectionIntro
        eyebrow="Solver Marketplace"
        title="Liquidity competes for the intent."
        body="Solvers race on privacy, route quality, latency, and fee. The protocol selects the best route, but users can compare the competition."
      />
      <div className="solver-arena">
        {rankedSolvers.map((solver, index) => (
          <button
            className={solver.id === selectedSolverId ? "solver-lane active" : "solver-lane"}
            key={solver.id}
            onClick={() => selectSolver(solver.id)}
            type="button"
          >
            <span className="solver-rank">0{index + 1}</span>
            <span className="solver-name">
              <strong>{solver.name}</strong>
              <small>{solver.strategy}</small>
            </span>
            <span className="solver-score">
              <i style={{ width: `${Math.max(18, solver.routeQuality)}%` }} />
            </span>
            <span className="solver-meta">{solver.latencySeconds}s</span>
            <span className="solver-meta">{(solver.feeBps / 100).toFixed(2)}%</span>
            <span className="solver-meta">{solver.privacyScore}/100</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function FinalSettlementDemo({ onRun }: { onRun: () => void }) {
  const analytics = useProtocolStore((state) => state.analytics);
  const intent = useProtocolStore((state) => state.intent);
  const phase = useProtocolStore((state) => state.phase);
  const proofArtifact = useProtocolStore((state) => state.proofArtifact);
  const resetDemo = useProtocolStore((state) => state.resetDemo);

  const demoSteps = [
    { id: "deposit", label: getChain(intent.source).name, detail: `${formatAmount(intent.amount)} ${intent.asset} deposit` },
    { id: "commitment", label: "Commitment", detail: "Destination hidden" },
    { id: "proof", label: "Proof", detail: "Groth16 BN254" },
    { id: "verify", label: "Stellar Verification", detail: "CAP-0074 verifier" },
    { id: "settlement", label: getChain(intent.destination).name, detail: "Private settlement" },
  ] as const;

  return (
    <section className="final-demo-section experience-section" id="demo">
      <Image alt="" className="ops-backplate" src={visionCommandCenter} />
      <div className="final-demo-header">
        <p className="eyebrow">Final Settlement Demonstration</p>
        <h2>{phase === "complete" ? "Transfer complete." : "Watch the protocol settle."}</h2>
        <div className="button-row">
          <button className="primary-button" onClick={onRun} type="button">
            <LockKeyhole size={15} /> Execute transfer
          </button>
          <button className="ghost-button" onClick={resetDemo} type="button">
            <RotateCcw size={15} /> Reset
          </button>
        </div>
      </div>

      <div className="settlement-theater" aria-label="End-to-end private settlement flow">
        {demoSteps.map((step) => (
          <motion.div
            animate={{ opacity: statusForPhase(step.id, phase) === "idle" ? 0.38 : 1 }}
            className={`settlement-step ${statusForPhase(step.id, phase)}`}
            key={step.id}
          >
            <span />
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </motion.div>
        ))}
      </div>

      <div className="completion-strip">
        <Signal label="Privacy" value={`${analytics.privacyScore}/100`} />
        <Signal label="Fee" value={`${(analytics.feeBps / 100).toFixed(2)}%`} />
        <Signal label="Time" value={`${analytics.latencySeconds}s`} />
        <Signal label="Settlement tx" mono value={proofArtifact ? proofArtifact.settlementTx : "pending"} />
      </div>
    </section>
  );
}

function SectionIntro({ body, eyebrow, title }: { body: string; eyebrow: string; title: string }) {
  return (
    <div className="section-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

function LegPill({ leg }: { leg: RouteLeg }) {
  return (
    <motion.div
      animate={{ opacity: leg.status === "idle" ? 0.54 : 1, y: leg.status === "active" ? -2 : 0 }}
      className={`leg-pill ${leg.status}`}
    >
      <span>{getChain(leg.from).short}</span>
      <i />
      <span>{getChain(leg.to).short}</span>
    </motion.div>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  value: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function Signal({ label, mono, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className={mono ? "signal mono" : "signal"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getActiveSolver(solverQuotes: SolverQuote[], selectedSolverId: string) {
  return solverQuotes.find((solver) => solver.id === selectedSolverId) ?? solverQuotes[0];
}

function getRoutePath(route: RouteLeg[], destination: ChainId) {
  const finalRouteLeg = route[route.length - 1];
  return route.map((leg) => getChain(leg.from).name).concat(getChain(finalRouteLeg?.to ?? destination).name);
}

function statusForPhase(stepId: ProtocolPhase, current: ProtocolPhase): ProofStatus {
  if (current === "idle") return "idle";
  const currentIndex = demoPhaseOrder.indexOf(current);
  const stepIndex = demoPhaseOrder.indexOf(stepId);
  if (stepIndex < currentIndex || current === "complete") return "complete";
  if (stepIndex === currentIndex) return "active";
  return "idle";
}
