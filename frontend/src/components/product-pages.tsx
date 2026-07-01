"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import Lenis from "lenis";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Cpu,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Play,
  RotateCcw,
  ShieldCheck,
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
  formatUsd,
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
import { useProtocolStore, type DemoStage } from "@/store/protocol-store";

const SettlementGlobe3D = dynamic(
  () => import("@/components/settlement-globe-3d").then((mod) => mod.SettlementGlobe3D),
  { loading: () => <div className="globe-loading">Loading settlement command surface</div>, ssr: false }
);

const SettlementCoreScene = dynamic(
  () => import("@/components/protocol-scenes").then((mod) => mod.SettlementCoreScene),
  { loading: () => <SceneFallback label="Loading settlement core" />, ssr: false }
);

const ProofEngineScene = dynamic(
  () => import("@/components/protocol-scenes").then((mod) => mod.ProofEngineScene),
  { loading: () => <SceneFallback label="Loading proof engine" />, ssr: false }
);

const ComplianceRingsScene = dynamic(
  () => import("@/components/protocol-scenes").then((mod) => mod.ComplianceRingsScene),
  { loading: () => <SceneFallback label="Loading policy engine" />, ssr: false }
);

const demoPhaseOrder: ProtocolPhase[] = ["deposit", "commitment", "proof", "verify", "settlement", "complete"];

export function HomeExperience() {
  const runtime = usePageMotion();
  const route = useProtocolStore((state) => state.route);
  const intent = useProtocolStore((state) => state.intent);
  const analytics = useProtocolStore((state) => state.analytics);
  const phase = useProtocolStore((state) => state.phase);
  const regions = useProtocolStore((state) => state.regions);
  const selectedRegionId = useProtocolStore((state) => state.selectedRegionId);
  const selectRegion = useProtocolStore((state) => state.selectRegion);
  const solver = useActiveSolver();

  return (
    <div className={runtime.reducedMotion ? "hq-route reduce-motion" : "hq-route"}>
      <Image alt="" className="hq-backplate monolith-backplate" priority src={heroSettlementCore} />
      <section className="hq-hero page-reveal">
        <div className="hq-hero-copy">
          <p className="eyebrow">Private Cross-Chain Settlement Infrastructure</p>
          <h1>Route Intent. Prove Privacy. Settle on Stellar.</h1>
          <p>
            ZeroPath moves value across chains privately. Instead of a public bridge, your transfer becomes a
            zero-knowledge proof — and a Stellar smart contract verifies that proof on-chain before releasing funds,
            without ever revealing the sender, receiver, route, or amount.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" href="/operate?run=1">
              Run the live demo <ArrowRight size={15} />
            </Link>
            <Link className="secondary-button" href="/proof">
              How the proof works
            </Link>
          </div>
          <p className="hero-footnote">
            The demo generates a real Groth16 proof in your browser and verifies it on Stellar testnet — no slideware.
          </p>
        </div>
        <div className="hero-visual-panel">
          <SettlementGlobe3D
            analytics={analytics}
            noWebGL={runtime.noWebGL}
            onSelectRegion={selectRegion}
            phase={phase}
            reducedMotion={runtime.reducedMotion}
            regions={regions}
            route={route}
            selectedRegionId={selectedRegionId}
            solverName={solver.name}
            variant="hero"
          />
        </div>
      </section>
      <section className="ecosystem-grid page-reveal" aria-label="ZeroPath product ecosystem">
        {[
          ["Operate", "AI privacy router", "/operate"],
          ["Proof", "BN254 portability engine", "/proof"],
          ["Network", "Global settlement activity", "/network"],
          ["Compliance", "Institutional policy modes", "/compliance"],
          ["Solvers", "Private liquidity competition", "/solvers"],
          ["Explorer", "End-to-end transaction lifecycle", "/explorer"],
        ].map(([title, body, href]) => (
          <Link className="ecosystem-card" href={href} key={href}>
            <span>{title}</span>
            <strong>{body}</strong>
            <ArrowRight size={15} />
          </Link>
        ))}
      </section>
    </div>
  );
}

export function OperateExperience() {
  usePageMotion();
  const analytics = useProtocolStore((state) => state.analytics);
  const intent = useProtocolStore((state) => state.intent);
  const parsedIntent = useProtocolStore((state) => state.parsedIntent);
  const prompt = useProtocolStore((state) => state.prompt);
  const route = useProtocolStore((state) => state.route);
  const executeTransfer = useProtocolStore((state) => state.executeTransfer);
  const parsePrompt = useProtocolStore((state) => state.parsePrompt);
  const setPrompt = useProtocolStore((state) => state.setPrompt);
  const updateIntent = useProtocolStore((state) => state.updateIntent);
  const running = useProtocolStore((state) => state.demoStatus.running);
  const solver = useActiveSolver();
  const routePath = getRoutePath(route, intent.destination);

  // Guided one-click: arriving via /operate?run=1 (the Home "Run live demo"
  // button) kicks off the full flow automatically.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("run") === "1") {
      void useProtocolStore.getState().executeTransfer();
    }
  }, []);

  return (
    <div className="hq-route operate-route">
      <PageHeader
        eyebrow="AI Privacy Router"
        title="A command surface for private settlement."
        body="Type the outcome. ZeroPath parses the intent, selects the route through Stellar, prices solver execution, and prepares private settlement."
      />
      <section className="operate-workbench page-reveal">
        <div className="intent-terminal">
          <div className="terminal-title">
            <Brain size={16} />
            Intent
          </div>
          <textarea
            aria-label="Private transfer intent"
            onChange={(event) => setPrompt(event.target.value)}
            value={prompt}
          />
          <div className="button-row">
            <button className="secondary-button" onClick={parsePrompt} type="button" disabled={running}>
              <Sparkles size={15} /> Parse Intent
            </button>
            <button className="primary-button" onClick={() => void executeTransfer()} type="button" disabled={running}>
              {running ? (
                <>
                  <Loader2 className="spin" size={15} /> Running…
                </>
              ) : (
                <>
                  <Play size={15} /> Execute Settlement
                </>
              )}
            </button>
          </div>
          <p className="button-hint">
            One click runs the whole flow: a real zero-knowledge proof is generated in your browser, then verified on the
            Stellar contract before funds move.
          </p>
        </div>
        <div className="router-intelligence">
          <PathVisual routePath={routePath} />
          <div className="intelligence-grid">
            <Signal label="Parsed intent" value={parsedIntent.summary} />
            <Signal label="Solver selected" value={solver.name} />
            <Signal label="Estimated fee" value={`${(analytics.feeBps / 100).toFixed(2)}%`} />
            <Signal label="Privacy score" value={`${analytics.privacyScore}/100`} />
            <Signal label="Settlement time" value={`${analytics.latencySeconds}s`} />
          </div>
          <div className="reasoning-flow">
            {parsedIntent.reasoning.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      </section>
      <SettlementStatus />
      <section className="route-control-band page-reveal">
        <SelectField label="Source" onChange={(value) => updateIntent({ source: value as ChainId })} options={chains.map((chain) => [chain.id, chain.name])} value={intent.source} />
        <SelectField label="Destination" onChange={(value) => updateIntent({ destination: value as ChainId })} options={chains.map((chain) => [chain.id, chain.name])} value={intent.destination} />
        <SelectField label="Asset" onChange={(value) => updateIntent({ asset: value as AssetId })} options={assets.map((asset) => [asset, asset])} value={intent.asset} />
        <label className="field">
          <span>Amount</span>
          <input min={1} onChange={(event) => updateIntent({ amount: Number(event.target.value) })} type="number" value={intent.amount} />
        </label>
        <div className="leg-row">
          {route.map((leg) => (
            <LegPill key={leg.id} leg={leg} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function ProofExperience() {
  const runtime = usePageMotion();
  const generateProof = useProtocolStore((state) => state.generateProof);
  const proofArtifact = useProtocolStore((state) => state.proofArtifact);
  const proofSteps = useProtocolStore((state) => state.proofSteps);
  const stealthIdentity = useProtocolStore((state) => state.stealthIdentity);
  const phase = useProtocolStore((state) => state.phase);
  const running = useProtocolStore((state) => state.demoStatus.running);

  return (
    <div className="hq-route proof-route">
      <PageHeader
        eyebrow="BN254 Proof Engine"
        title="The secret weapon is proof portability."
        body="A Groth16 BN254 proof generated from source-chain events is verified natively on Stellar. This is the moat: privacy proofs become settlement instructions."
      />
      <section className="proof-command page-reveal">
        <Image alt="" className="proof-backplate" src={proofGenerationLayers} />
        <div className="proof-copy">
          <p className="eyebrow">Stellar Verification Layer</p>
          <h2>{proofArtifact?.bn254Status === "verified" ? "BN254 verified." : "Generate the proof."}</h2>
          <p>Commitment, Merkle root, Groth16 digest, nullifier, destination commitment, and epoch are exposed as public inputs only.</p>
          <button className="primary-button" onClick={() => void generateProof()} type="button" disabled={running}>
            {running ? (
              <>
                <Loader2 className="spin" size={15} /> Generating…
              </>
            ) : (
              <>
                <Zap size={15} /> Generate Proof
              </>
            )}
          </button>
        </div>
        <div className="proof-visual">
          {runtime.noWebGL ? <Image alt="Cryptographic proof layers" className="asset-fill" priority src={proofGenerationLayers} /> : <ProofEngineScene />}
        </div>
        <div className="proof-readout">
          <Signal label="Phase" value={phase} />
          <Signal label="Commitment" mono value={proofArtifact ? shorten(proofArtifact.commitment) : "pending"} />
          <Signal label="Merkle root" mono value={proofArtifact ? shorten(proofArtifact.merkleRoot) : "pending"} />
          <Signal label="Groth16 proof" mono value={proofArtifact ? shorten(proofArtifact.groth16Proof) : "pending"} />
          <Signal
            label="On-chain verify"
            mono
            value={
              proofArtifact?.onChain
                ? proofArtifact.onChain.txHash
                  ? shorten(proofArtifact.onChain.txHash)
                  : "verified on Stellar"
                : "run Execute to verify"
            }
            href={proofArtifact?.onChain?.explorer ?? undefined}
          />
          <Signal label="Destination commitment" mono value={stealthIdentity ? shorten(stealthIdentity.destinationCommitment) : "pending"} />
          <Signal label="Nullifier" mono value={stealthIdentity ? shorten(stealthIdentity.nullifierHash) : "pending"} />
        </div>
      </section>
      <SettlementStatus />
      <section className="proof-lifecycle page-reveal">
        {proofSteps.map((step, index) => (
          <motion.article className={`lifecycle-card ${step.status}`} key={step.id} animate={{ opacity: step.status === "idle" ? 0.42 : 1 }}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <h3>{step.label}</h3>
            <p>{step.detail}</p>
          </motion.article>
        ))}
      </section>
      <section className="merkle-console page-reveal">
        <h2>Public inputs exposed to Stellar.</h2>
        <div className="public-input-grid">
          {proofArtifact ? (
            Object.entries(proofArtifact.publicInputs).map(([key, value]) => <Signal key={key} label={key} mono value={shorten(value, 12, 8)} />)
          ) : (
            <p>Generate a proof to materialize public inputs, Merkle path, and verifier state.</p>
          )}
        </div>
        <div className="merkle-path">
          {(proofArtifact?.merklePath ?? Array.from({ length: 8 }, (_, index) => `pending_${index}`)).map((item, index) => (
            <span key={`${item}-${index}`}>{proofArtifact ? shorten(item, 8, 4) : "pending"}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

export function NetworkExperience() {
  const runtime = usePageMotion();
  const phase = useProtocolStore((state) => state.phase);
  const regions = useProtocolStore((state) => state.regions);
  const route = useProtocolStore((state) => state.route);
  const analytics = useProtocolStore((state) => state.analytics);
  const selectedRegionId = useProtocolStore((state) => state.selectedRegionId);
  const selectRegion = useProtocolStore((state) => state.selectRegion);
  const selectedRegion = regions.find((region) => region.id === selectedRegionId) ?? regions[0];
  const solver = useActiveSolver();

  return (
    <div className={runtime.reducedMotion ? "hq-route network-route reduce-motion" : "hq-route network-route"}>
      <PageHeader
        eyebrow="Global Settlement Network"
        title="Private liquidity, coordinated globally."
        body="The globe is operational: regions expose settlement volume, privacy activity, and active private settlement routes."
      />
      <section className="network-stage page-reveal">
        <div className="network-globe-wrap">
          <SettlementGlobe3D
            analytics={analytics}
            noWebGL={runtime.noWebGL}
            onSelectRegion={selectRegion}
            phase={phase}
            reducedMotion={runtime.reducedMotion}
            regions={regions}
            route={route}
            selectedRegionId={selectedRegionId}
            solverName={solver.name}
            variant="network"
          />
        </div>
        <div className="network-control">
          <p className="eyebrow">Region Inspector</p>
          <h2>{selectedRegion.label}</h2>
          <p>
            Settlement heat reflects private route density, active proof verification, and solver liquidity passing
            through Stellar as the coordination layer.
          </p>
          <Signal label="Selected region" value={selectedRegion.label} />
          <Signal label="Settlement volume" value={formatUsd(selectedRegion.volumeUsd)} />
          <Signal label="Privacy activity" value={`${selectedRegion.privacyActivity}/100`} />
          <Signal label="Active routes" value={`${selectedRegion.activeRoutes}`} />
        </div>
      </section>
    </div>
  );
}

export function ComplianceExperience() {
  const runtime = usePageMotion();
  const analytics = useProtocolStore((state) => state.analytics);
  const intent = useProtocolStore((state) => state.intent);
  const setComplianceMode = useProtocolStore((state) => state.setComplianceMode);

  return (
    <div className="hq-route compliance-route">
      <PageHeader
        eyebrow="Institutional Control Center"
        title="Privacy with policy-aware execution."
        body="ZeroPath demonstrates Privacy Pools style compliance: mode selection changes anonymity, compliance score, route availability, and solver eligibility."
      />
      <section className="compliance-command page-reveal">
        <div className="mode-console" role="group" aria-label="Compliance operating mode">
          {complianceModes.map((mode) => (
            <button className={intent.complianceMode === mode.id ? "mode-option active" : "mode-option"} key={mode.id} onClick={() => setComplianceMode(mode.id)} type="button">
              <span>{mode.label}</span>
              <strong>{mode.id === "private" ? "Maximum anonymity" : mode.id === "balanced" ? "Selective disclosure" : "Institutional policy"}</strong>
              <small>{mode.detail}</small>
            </button>
          ))}
        </div>
        <div className="policy-visual">{runtime.noWebGL ? <Image alt="Operations command center" className="asset-fill" priority src={visionCommandCenter} /> : <ComplianceRingsScene />}</div>
      </section>
      <section className="policy-readout page-reveal">
        <Signal label="Mode" value={labelForCompliance(intent.complianceMode as ComplianceMode)} />
        <Signal label="Anonymity score" value={`${analytics.privacyScore}/100`} />
        <Signal label="Compliance score" value={`${analytics.complianceScore}/100`} />
        <Signal label="Route availability" value={`${analytics.routeAvailability}%`} />
        <Signal label="Pool size" value={formatUsd(analytics.poolSizeUsd)} />
      </section>
    </div>
  );
}

export function SolversExperience() {
  usePageMotion();
  const selectSolver = useProtocolStore((state) => state.selectSolver);
  const selectedSolverId = useProtocolStore((state) => state.selectedSolverId);
  const solverQuotes = useProtocolStore((state) => state.solverQuotes);
  const rankedSolvers = useMemo(() => rankSolvers(solverQuotes), [solverQuotes]);

  return (
    <div className="hq-route solvers-route">
      <PageHeader
        eyebrow="Solver Marketplace"
        title="Liquidity competes for private intent flow."
        body="Solvers are ranked by route quality, privacy, success rate, fee, and latency. Selection updates the protocol’s execution estimates."
      />
      <section className="solver-grid page-reveal">
        {rankedSolvers.map((solver, index) => (
          <button className={solver.id === selectedSolverId ? "solver-card active" : "solver-card"} key={solver.id} onClick={() => selectSolver(solver.id)} type="button">
            <span className="solver-rank">0{index + 1}</span>
            <h2>{solver.name}</h2>
            <p>{solver.strategy}</p>
            <div className="solver-meter">
              <i style={{ width: `${solver.routeQuality}%` }} />
            </div>
            <div className="solver-stats">
              <Signal label="Latency" value={`${solver.latencySeconds}s`} />
              <Signal label="Fee" value={`${(solver.feeBps / 100).toFixed(2)}%`} />
              <Signal label="Success" value={`${solver.successRate}%`} />
              <Signal label="Privacy" value={`${solver.privacyScore}/100`} />
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}

export function ExplorerExperience() {
  usePageMotion();
  const analytics = useProtocolStore((state) => state.analytics);
  const events = useProtocolStore((state) => state.events);
  const executeTransfer = useProtocolStore((state) => state.executeTransfer);
  const intent = useProtocolStore((state) => state.intent);
  const phase = useProtocolStore((state) => state.phase);
  const proofArtifact = useProtocolStore((state) => state.proofArtifact);
  const resetDemo = useProtocolStore((state) => state.resetDemo);

  const demoSteps = [
    { id: "deposit", label: getChain(intent.source).name, detail: `${formatAmount(intent.amount)} ${intent.asset} deposit` },
    { id: "commitment", label: "Commitment", detail: "Destination hidden" },
    { id: "proof", label: "Proof", detail: "Groth16 BN254" },
    { id: "verify", label: "Stellar Verification", detail: "Native verifier" },
    { id: "settlement", label: getChain(intent.destination).name, detail: "Private settlement" },
  ] as const;

  return (
    <div className="hq-route explorer-route">
      <PageHeader
        eyebrow="Protocol Explorer"
        title={phase === "complete" ? "Settlement complete." : "Watch one private transfer settle."}
        body="Deposit, commitment, proof, Stellar verification, and final settlement are visualized as one lifecycle."
      />
      <section className="explorer-theater page-reveal">
        <Image alt="" className="ops-backplate" src={visionCommandCenter} />
        <div className="button-row">
          <button className="primary-button" onClick={() => void executeTransfer()} type="button">
            <LockKeyhole size={15} /> Execute Transfer
          </button>
          <button className="ghost-button" onClick={resetDemo} type="button">
            <RotateCcw size={15} /> Reset
          </button>
        </div>
        <div className="settlement-theater" aria-label="End-to-end private settlement flow">
          {demoSteps.map((step) => (
            <motion.div animate={{ opacity: statusForPhase(step.id, phase) === "idle" ? 0.38 : 1 }} className={`settlement-step ${statusForPhase(step.id, phase)}`} key={step.id}>
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
      <section className="event-stream page-reveal">
        {events.length ? (
          events.map((event) => (
            <article key={event.id}>
              <time>{event.timestamp}</time>
              <strong>{event.title}</strong>
              <p>{event.detail}</p>
            </article>
          ))
        ) : (
          <article>
            <time>ready</time>
            <strong>Awaiting transfer</strong>
            <p>Execute the demo to materialize the protocol lifecycle.</p>
          </article>
        )}
      </section>
    </div>
  );
}

export function AboutExperience() {
  const runtime = usePageMotion();

  return (
    <div className="hq-route about-route">
      <PageHeader
        eyebrow="Vision & Architecture"
        title="A private financial operating system."
        body="ZeroPath treats Stellar as the private settlement layer: proof verification, nullifier tracking, liquidity accounting, and cross-chain coordination live behind one user outcome."
      />
      <section className="vision-panel page-reveal">
        <Image alt="ZeroPath command center" className="asset-fill" priority src={visionCommandCenter} />
        <div className="vision-copy">
          <p className="eyebrow">Digital Headquarters</p>
          <h2>Infrastructure for private value transfer.</h2>
          <p>
            The category is not a bridge. It is settlement infrastructure where solvers compete, routes disappear,
            proofs travel, and Stellar coordinates finality.
          </p>
        </div>
      </section>
      <section className="architecture-board page-reveal">
        {[
          ["Intent Layer", "Users request outcomes, not chains."],
          ["Solver Layer", "Liquidity finds the optimal private route."],
          ["Proof Layer", "Groth16 BN254 proofs hide sender, receiver, amount, and route."],
          ["Stellar Settlement", "BN254 verification, nullifier tracking, and liquidity accounting."],
        ].map(([title, body]) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <section className="about-core page-reveal">
        {runtime.noWebGL ? <Image alt="Settlement core" className="asset-fill" priority src={heroSettlementCore} /> : <SettlementCoreScene />}
      </section>
    </div>
  );
}

function PageHeader({ body, eyebrow, title }: { body: string; eyebrow: string; title: string }) {
  return (
    <section className="page-header page-reveal">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{body}</p>
    </section>
  );
}

function PathVisual({ routePath }: { routePath: string[] }) {
  return (
    <div className="path-visual" aria-label="Selected settlement path">
      {routePath.map((label, index) => (
        <motion.div animate={{ opacity: 1, y: 0 }} className={label === "Stellar" ? "path-node stellar" : "path-node"} initial={{ opacity: 0.62, y: 8 }} key={`${label}-${index}`} transition={{ delay: index * 0.08 }}>
          <span>{label}</span>
        </motion.div>
      ))}
    </div>
  );
}

function LegPill({ leg }: { leg: RouteLeg }) {
  return (
    <motion.div animate={{ opacity: leg.status === "idle" ? 0.54 : 1, y: leg.status === "active" ? -2 : 0 }} className={`leg-pill ${leg.status}`}>
      <span>{getChain(leg.from).short}</span>
      <i />
      <span>{getChain(leg.to).short}</span>
    </motion.div>
  );
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
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

function Signal({ label, mono, value, href }: { label: string; mono?: boolean; value: string; href?: string }) {
  return (
    <div className={mono ? "signal mono" : "signal"}>
      <span>{label}</span>
      {href ? (
        <strong>
          <a href={href} target="_blank" rel="noreferrer">{value}</a>
        </strong>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}

function SceneFallback({ label }: { label: string }) {
  return <div className="scene-fallback">{label}</div>;
}

const STAGE_LABEL: Record<DemoStage, string> = {
  idle: "Ready",
  proving: "Generating proof",
  settling: "Verifying on Stellar",
  done: "Complete",
  error: "Interrupted",
};

/**
 * Live, plain-language readout of the demo: what is happening right now, whether
 * the proof is real, and — once verified on Stellar — a link to the transaction.
 * This is the "is it working / did it really work?" surface for judges.
 */
function SettlementStatus() {
  const status = useProtocolStore((state) => state.demoStatus);
  const headline =
    status.stage === "done"
      ? status.onChain
        ? "Settled on Stellar"
        : status.isRealProof
          ? "Proof verified"
          : "Demo complete"
      : STAGE_LABEL[status.stage];

  return (
    <section className="settlement-status page-reveal" data-stage={status.stage} aria-live="polite">
      <div className="status-headline">
        {status.running ? (
          <Loader2 className="spin" size={16} />
        ) : status.stage === "done" ? (
          <CheckCircle2 size={16} />
        ) : status.stage === "error" ? (
          <AlertTriangle size={16} />
        ) : (
          <ShieldCheck size={16} />
        )}
        <strong>{headline}</strong>
        {status.isRealProof ? <span className="status-chip real">Real Groth16 proof</span> : null}
        {status.onChain ? (
          <span className="status-chip onchain">
            <ShieldCheck size={12} /> Verified on Stellar
          </span>
        ) : null}
      </div>
      <p className="status-message">{status.message}</p>
      {status.onChain?.explorer ? (
        <a className="status-tx" href={status.onChain.explorer} target="_blank" rel="noreferrer">
          {status.onChain.txHash ? "View transaction on Stellar Explorer" : "View contract on Stellar Explorer"}
          <ExternalLink size={13} />
        </a>
      ) : null}
    </section>
  );
}

function useActiveSolver() {
  return useProtocolStore((state) => state.solverQuotes.find((solver) => solver.id === state.selectedSolverId) ?? state.solverQuotes[0]);
}

function getRoutePath(route: RouteLeg[], destination: ChainId) {
  const finalRouteLeg = route[route.length - 1];
  return route.map((leg) => getChain(leg.from).name).concat(getChain(finalRouteLeg?.to ?? destination).name);
}

function rankSolvers(solverQuotes: SolverQuote[]) {
  return [...solverQuotes].sort((left, right) => {
    const leftScore = left.routeQuality + left.privacyScore + left.successRate - left.feeBps / 2 - left.latencySeconds / 4;
    const rightScore = right.routeQuality + right.privacyScore + right.successRate - right.feeBps / 2 - right.latencySeconds / 4;
    return rightScore - leftScore;
  });
}

function statusForPhase(stepId: ProtocolPhase, current: ProtocolPhase): ProofStatus {
  if (current === "idle") return "idle";
  const currentIndex = demoPhaseOrder.indexOf(current);
  const stepIndex = demoPhaseOrder.indexOf(stepId);
  if (stepIndex < currentIndex || current === "complete") return "complete";
  if (stepIndex === currentIndex) return "active";
  return "idle";
}

function usePageMotion() {
  const [runtime, setRuntime] = useState({ noWebGL: false, reducedMotion: false });

  useEffect(() => {
    const nextRuntime = readRuntimeFlags();
    const { reducedMotion } = nextRuntime;
    setRuntime(nextRuntime);

    if (!reducedMotion) {
      gsap.fromTo(".page-reveal", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.055 });
      const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
      let animationFrame = 0;
      const raf = (time: number) => {
        lenis.raf(time);
        animationFrame = requestAnimationFrame(raf);
      };
      animationFrame = requestAnimationFrame(raf);
      return () => {
        cancelAnimationFrame(animationFrame);
        lenis.destroy();
      };
    }

    return undefined;
  }, []);

  return runtime;
}

function readRuntimeFlags() {
  if (typeof window === "undefined") {
    return { noWebGL: false, reducedMotion: false };
  }

  const params = new URLSearchParams(window.location.search);
  const search = window.location.search.toLowerCase();
  return {
    noWebGL: params.has("no-webgl") || search.includes("no-webgl"),
    reducedMotion:
      params.has("reduced-motion") ||
      search.includes("reduced-motion") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}
