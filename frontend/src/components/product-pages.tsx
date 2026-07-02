"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import Lenis from "lenis";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Brain,
  BrainCircuit,
  CheckCircle2,
  Compass,
  Cpu,
  ExternalLink,
  Gauge,
  Layers,
  Loader2,
  LockKeyhole,
  Network,
  Play,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Store,
  Wallet,
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
import { STAGE_COUNT, useExecutionStore } from "@/store/execution-store";
import { CountUp, TypingHash } from "@/components/cinematic";
import { MissionTimeline } from "@/components/mission-timeline";
import { InteractiveCard } from "@/components/ui/interactive-card";
import { ProofEngine } from "@/components/ui/proof-engine";
import { SettlementGlobe } from "@/components/ui/settlement-globe";
import { SettlementEngine } from "@/components/ui/settlement-engine";
import { Parallax, Reveal } from "@/components/ui/reveal";
import { SectionHead } from "@/components/ui/section";

const ComplianceRingsScene = dynamic(
  () => import("@/components/protocol-scenes").then((mod) => mod.ComplianceRingsScene),
  { loading: () => <SceneFallback label="Loading policy engine" />, ssr: false }
);

const demoPhaseOrder: ProtocolPhase[] = ["deposit", "commitment", "proof", "verify", "settlement", "complete"];

const ECOSYSTEM = [
  { index: "01", kicker: "AI Privacy Router", title: "Operate", desc: "Type an outcome. ZeroPath parses intent, routes through Stellar, and executes settlement.", href: "/operate", Icon: ArrowLeftRight },
  { index: "02", kicker: "BN254 Portability Engine", title: "Proof", desc: "A Groth16 proof generated in-browser, verified natively on Stellar. Privacy becomes settlement.", href: "/proof", Icon: Cpu },
  { index: "03", kicker: "Settlement Lifecycle", title: "Explorer", desc: "Watch one private transfer settle end-to-end: deposit, commitment, proof, finality.", href: "/explorer", Icon: Compass },
  { index: "04", kicker: "Vision & Architecture", title: "About", desc: "The category is not a bridge. It is the operating system for private value transfer.", href: "/about", Icon: Layers },
] as const;

/** Local "live network" feel — nudges a couple of headline counters upward over time. */
function useLiveNetwork(settlementCount: number, proofVerifications: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 3400);
    return () => window.clearInterval(id);
  }, []);
  return { settlements: settlementCount + tick * 3, proofs: proofVerifications + tick * 2 };
}

function HeroStat({ label, value, format }: { label: string; value: number; format: (n: number) => string }) {
  return (
    <div className="hero-stat">
      <strong><CountUp value={value} format={(n) => format(Math.round(n))} /></strong>
      <span>{label}</span>
    </div>
  );
}

export function HomeExperience() {
  const runtime = usePageMotion();
  const analytics = useProtocolStore((state) => state.analytics);
  const live = useLiveNetwork(analytics.settlementCount, analytics.proofVerifications);

  return (
    <div className={runtime.reducedMotion ? "hq-route reduce-motion" : "hq-route"}>
      {runtime.reducedMotion ? (
        <Image alt="" className="hq-backplate monolith-backplate" priority src={heroSettlementCore} />
      ) : (
        <>
          <video
            className="hero-bg-video"
            autoPlay
            muted
            loop
            playsInline
            poster="/hero-bg-poster.jpg"
            aria-hidden="true"
          >
            <source src="/hero-bg.mp4" type="video/mp4" />
          </video>
          <div className="hero-bg-scrim" aria-hidden="true" />
        </>
      )}
      <section className="hq-hero solo">
        <div className="hq-hero-copy">
          <Reveal delay={0}>
            <p className="eyebrow"><span className="eyebrow-dot" aria-hidden="true" />Private Cross-Chain Settlement Infrastructure</p>
          </Reveal>
          <Reveal delay={0.09}>
            <h1>Route Intent.<br />Prove Privacy.<br />Settle on Stellar.</h1>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="hero-lede">
              ZeroPath moves value across chains privately. Your transfer becomes a zero-knowledge proof — and a
              Stellar smart contract verifies it on-chain before funds move, never revealing sender, receiver, route,
              or amount.
            </p>
          </Reveal>
          <Reveal delay={0.26}>
            <div className="hero-actions">
              <Link className="primary-button" href="/operate?run=1">
                Run the live demo <ArrowRight size={15} />
              </Link>
              <Link className="secondary-button" href="/proof">
                How the proof works
              </Link>
            </div>
          </Reveal>
          <Reveal delay={0.34}>
            <div className="hero-ticker" aria-label="Live network metrics">
              <HeroStat label="Settlements settled" value={live.settlements} format={formatAmount} />
              <HeroStat label="Anonymity set" value={analytics.anonymitySet} format={formatAmount} />
              <HeroStat label="Proofs verified" value={live.proofs} format={formatAmount} />
              <HeroStat label="Pool liquidity" value={analytics.poolSizeUsd} format={(n) => `$${(n / 1_000_000).toFixed(1)}M`} />
            </div>
          </Reveal>
          <Reveal delay={0.42}>
            <div className="hero-route" aria-hidden="true">
              <span className="hero-route-node">ETH</span>
              <span className="hero-route-link"><b /></span>
              <span className="hero-route-node stellar">Stellar</span>
              <span className="hero-route-link"><b /></span>
              <span className="hero-route-node">SOL</span>
              <span className="hero-route-tag">real Groth16 · verified on Stellar testnet</span>
            </div>
          </Reveal>
        </div>
        <div className="hero-scrollcue" aria-hidden="true"><i /><span>Scroll</span></div>
      </section>

      <section className="ecosystem" id="ecosystem" aria-label="ZeroPath product ecosystem">
        <Reveal>
          <SectionHead
            eyebrow="The ZeroPath OS"
            title="Four surfaces. One protocol."
            body="Every surface of ZeroPath is a view into the same private settlement engine — from natural-language intent to on-chain finality."
          />
        </Reveal>
        <div className="ecosystem-grid">
          {ECOSYSTEM.map((item, i) => {
            const Icon = item.Icon;
            return (
              <Reveal key={item.href} delay={i * 0.07}>
                <InteractiveCard className="eco-card">
                  <span className="eco-index">{item.index}</span>
                  <span className="eco-icon"><Icon size={18} /></span>
                  <span className="eco-kicker">{item.kicker}</span>
                  <strong className="eco-title">{item.title}</strong>
                  <p className="eco-desc">{item.desc}</p>
                  <span className="eco-go">Enter <ArrowRight size={14} /></span>
                  <Link className="eco-hit" href={item.href} aria-label={item.title} />
                </InteractiveCard>
              </Reveal>
            );
          })}
        </div>
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
  const proofArtifact = useProtocolStore((state) => state.proofArtifact);
  const solver = useActiveSolver();
  const routePath = getRoutePath(route, intent.destination);

  // Cinematic execution timeline (shared FSM with the /app console).
  const active = useExecutionStore((s) => s.active);
  const stage = useExecutionStore((s) => s.stage);
  const complete = useExecutionStore((s) => s.complete);
  const begin = useExecutionStore((s) => s.begin);
  const setStage = useExecutionStore((s) => s.setStage);
  const finish = useExecutionStore((s) => s.finish);
  const fail = useExecutionStore((s) => s.fail);
  const reset = useExecutionStore((s) => s.reset);

  // Orchestrate the mission: pre-proof stages advance on a schedule while the
  // real proof generates; final stages gate on the actual work completing.
  const runExecute = () => {
    if (active) return;
    begin();
    const work = executeTransfer();
    const schedule = [0, 650, 1400, 2300, 3300, 4500, 5900];
    schedule.forEach((delay, i) => window.setTimeout(() => setStage(i), delay));
    work
      .then(() => {
        setStage(7);
        window.setTimeout(() => setStage(8), 550);
        window.setTimeout(() => setStage(9), 1100);
        window.setTimeout(() => finish(), 1700);
        window.setTimeout(() => reset(), 6500);
      })
      .catch(() => {
        fail();
        window.setTimeout(() => reset(), 3000);
      });
  };

  // Guided one-click: arriving via /operate?run=1 (the Home "Run live demo"
  // button) kicks off the full cinematic flow automatically.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("run") === "1") runExecute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy = running || active;

  return (
    <div className={`hq-route operate-route${active ? " executing" : ""}${complete ? " complete" : ""}`}>
      <PageHeader
        eyebrow="AI Privacy Router"
        title="A command surface for private settlement."
        body="Type the outcome. ZeroPath parses the intent, selects the route through Stellar, prices solver execution, and prepares private settlement."
      />
      <section className="operate-workbench page-reveal">
        <div className="intent-terminal">
          <div className="terminal-title">
            <span className="term-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <Brain size={16} />
            <span className="term-path">intent://zeropath.router</span>
            <span className="term-live" aria-hidden="true">
              <i /> live
            </span>
          </div>
          <div className="terminal-field">
            <textarea
              aria-label="Private transfer intent"
              onChange={(event) => setPrompt(event.target.value)}
              value={prompt}
            />
            <span className="terminal-scan" aria-hidden="true" />
          </div>
          <div className="button-row">
            <button className="secondary-button" onClick={parsePrompt} type="button" disabled={busy}>
              <Sparkles size={15} /> Parse Intent
            </button>
            <button className="primary-button" onClick={runExecute} type="button" disabled={busy}>
              {busy ? (
                <>
                  <span className="btn-pulse" aria-hidden="true" /> Executing…
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

      <section className="operate-execution page-reveal" aria-label="Execution mission control">
        <div className="exec-panel exec-panel-timeline">
          <div className="exec-panel-head">
            <span>Execution timeline</span>
            <small>{active ? `stage ${Math.min(stage + 1, STAGE_COUNT)} / ${STAGE_COUNT}` : complete ? "complete" : "standby"}</small>
          </div>
          <MissionTimeline />
        </div>
        <div className="exec-panel exec-panel-core">
          <div className="exec-panel-head">
            <span>Proof core</span>
            <small>{complete ? "settlement finalized" : active ? "executing" : "idle"}</small>
          </div>
          <div className="exec-core-stage">
            <ProofEngine intensity={complete ? 0.9 : active ? 0.72 : 0.42} verified={complete} />
            <div className="exec-core-badge">
              <strong>{proofArtifact?.bn254Status === "verified" ? "VERIFIED" : active ? "PROVING" : "BN254"}</strong>
              <small>Stellar pairing check</small>
            </div>
          </div>
          <div className="exec-live-metrics">
            <div className="exec-metric mono">
              <span>Nullifier</span>
              <strong>{proofArtifact ? <TypingHash text={shorten(proofArtifact.publicInputs.nullifier_hash, 8, 6)} /> : "—"}</strong>
            </div>
            <div className="exec-metric mono">
              <span>Commitment</span>
              <strong>{proofArtifact ? <TypingHash text={shorten(proofArtifact.commitment, 8, 6)} /> : "—"}</strong>
            </div>
            <div className="exec-metric">
              <span>Anonymity set</span>
              <strong><CountUp value={analytics.anonymitySet} format={(n) => formatAmount(Math.round(n))} /></strong>
            </div>
            <div className="exec-metric">
              <span>Proof verifications</span>
              <strong><CountUp value={analytics.proofVerifications} format={(n) => formatAmount(Math.round(n))} /></strong>
            </div>
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
  usePageMotion();
  const generateProof = useProtocolStore((state) => state.generateProof);
  const proofArtifact = useProtocolStore((state) => state.proofArtifact);
  const proofSteps = useProtocolStore((state) => state.proofSteps);
  const stealthIdentity = useProtocolStore((state) => state.stealthIdentity);
  const phase = useProtocolStore((state) => state.phase);
  const running = useProtocolStore((state) => state.demoStatus.running);

  const verified = proofArtifact?.bn254Status === "verified";
  const [burst, setBurst] = useState(0);
  const [pulse, setPulse] = useState(false);
  const wasVerified = useRef(false);

  // Generate Proof choreography: the core bursts on click; a success pulse
  // ripples across the section the moment BN254 verification lands.
  const runProof = () => {
    if (running) return;
    setBurst(1);
    window.setTimeout(() => setBurst(0), 1500);
    void generateProof();
  };
  useEffect(() => {
    if (verified && !wasVerified.current) {
      setPulse(true);
      window.setTimeout(() => setPulse(false), 1700);
    }
    wasVerified.current = verified;
  }, [verified]);

  const coreIntensity = verified ? 0.9 : running ? 0.72 : 0.42;

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
          <button className="primary-button" onClick={runProof} type="button" disabled={running}>
            {running ? (
              <>
                <Loader2 className="spin" size={15} /> Generating…
              </>
            ) : verified ? (
              <>
                <CheckCircle2 size={15} /> Proof verified
              </>
            ) : (
              <>
                <Zap size={15} /> Generate Proof
              </>
            )}
          </button>
        </div>
        <div className="proof-visual">
          <ProofEngine intensity={coreIntensity} burst={burst} verified={verified} />
          <div className="proof-hud" aria-hidden="true">
            <span className="hud-grid" />
            <span className="hud-corner tl" />
            <span className="hud-corner tr" />
            <span className="hud-corner bl" />
            <span className="hud-corner br" />
            <span className="hud-scan" />
            <span className="hud-tag">BN254 · GROTH16 · CAP-0074</span>
            <span className={running ? "hud-reticle active" : "hud-reticle"} />
          </div>
        </div>
        <div className="proof-readout">
          <ReadoutRow label="Phase" value={phase} live={phase !== "idle"} />
          <ReadoutRow label="Commitment" mono value={proofArtifact ? shorten(proofArtifact.commitment) : "pending"} live={!!proofArtifact} />
          <ReadoutRow label="Merkle root" mono value={proofArtifact ? shorten(proofArtifact.merkleRoot) : "pending"} live={!!proofArtifact} />
          <ReadoutRow label="Groth16 proof" mono value={proofArtifact ? shorten(proofArtifact.groth16Proof) : "pending"} live={!!proofArtifact} />
          <ReadoutRow
            label="On-chain verify"
            mono
            value={
              proofArtifact?.onChain
                ? proofArtifact.onChain.txHash
                  ? shorten(proofArtifact.onChain.txHash)
                  : "verified on Stellar"
                : "run Execute to verify"
            }
            live={!!proofArtifact?.onChain}
            href={proofArtifact?.onChain?.explorer ?? undefined}
          />
          <ReadoutRow label="Destination commitment" mono value={stealthIdentity ? shorten(stealthIdentity.destinationCommitment) : "pending"} live={!!stealthIdentity} />
          <ReadoutRow label="Nullifier" mono value={stealthIdentity ? shorten(stealthIdentity.nullifierHash) : "pending"} live={!!stealthIdentity} />
        </div>
        <span className={pulse ? "proof-pulse show" : "proof-pulse"} aria-hidden="true" />
        {pulse ? (
          <div className="proof-verified-flash" role="status">
            <CheckCircle2 size={16} /> BN254 verification complete
          </div>
        ) : null}
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
  usePageMotion();
  const regions = useProtocolStore((state) => state.regions);
  const selectedRegionId = useProtocolStore((state) => state.selectedRegionId);
  const selectRegion = useProtocolStore((state) => state.selectRegion);
  const selectedRegion = regions.find((region) => region.id === selectedRegionId) ?? regions[0];

  return (
    <div className="hq-route network-route">
      <PageHeader
        eyebrow="Global Settlement Network"
        title="Private liquidity, coordinated globally."
        body="Regions expose settlement volume, privacy activity, and active private settlement routes coordinated through Stellar."
      />
      <section className="network-stage page-reveal">
        <div className="region-grid" role="group" aria-label="Settlement regions">
          {regions.map((region) => (
            <button
              className={region.id === selectedRegionId ? "region-card active" : "region-card"}
              key={region.id}
              onClick={() => selectRegion(region.id)}
              type="button"
            >
              <span>{region.label}</span>
              <strong>{formatUsd(region.volumeUsd)}</strong>
              <small>{region.activeRoutes} routes · {region.privacyActivity}/100 privacy</small>
            </button>
          ))}
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

const GLOBE_HUBS = ["New York", "London", "Singapore", "Tokyo", "São Paulo", "Frankfurt", "Dubai", "San Francisco", "Sydney", "Mumbai"];
type LiveEvent = { id: string; timestamp: string; title: string; detail: string; kind: "settle" | "proof" | "commit" };

function randomLiveEvent(): LiveEvent {
  const a = GLOBE_HUBS[(Math.random() * GLOBE_HUBS.length) | 0];
  let b = GLOBE_HUBS[(Math.random() * GLOBE_HUBS.length) | 0];
  if (b === a) b = GLOBE_HUBS[(GLOBE_HUBS.indexOf(b) + 1) % GLOBE_HUBS.length];
  const roll = Math.random();
  const hash = Array.from({ length: 6 }, () => "0123456789abcdef"[(Math.random() * 16) | 0]).join("");
  const kind: LiveEvent["kind"] = roll < 0.4 ? "settle" : roll < 0.72 ? "proof" : "commit";
  const title = kind === "settle" ? `Settlement finalized · ${a} → ${b}` : kind === "proof" ? "Groth16 proof verified on Stellar" : `Commitment posted · ${a}`;
  const detail = kind === "settle" ? `Private transfer settled · nullifier 0x${hash}` : kind === "proof" ? `BN254 pairing check passed · 0x${hash}` : `Destination hidden · leaf 0x${hash}`;
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, timestamp: "just now", title, detail, kind };
}

// Deterministic seed rows so server and client render identically (no hydration
// mismatch); random rows only stream in after mount.
const FEED_SEED: LiveEvent[] = [
  { id: "seed-1", timestamp: "just now", title: "Settlement finalized · London → Singapore", detail: "Private transfer settled · nullifier 0x7f3a01", kind: "settle" },
  { id: "seed-2", timestamp: "3s ago", title: "Groth16 proof verified on Stellar", detail: "BN254 pairing check passed · 0x9c22ab", kind: "proof" },
  { id: "seed-3", timestamp: "6s ago", title: "Commitment posted · Frankfurt", detail: "Destination hidden · leaf 0x1de904", kind: "commit" },
  { id: "seed-4", timestamp: "9s ago", title: "Settlement finalized · New York → Tokyo", detail: "Private transfer settled · nullifier 0x44b7c8", kind: "settle" },
  { id: "seed-5", timestamp: "12s ago", title: "Groth16 proof verified on Stellar", detail: "BN254 pairing check passed · 0x08ef21", kind: "proof" },
];

/** Synthetic live network feed so the Explorer feels alive before any transfer runs. */
function useLiveFeed() {
  const [items, setItems] = useState<LiveEvent[]>(FEED_SEED);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setItems((prev) => [randomLiveEvent(), ...prev].slice(0, 7)), 2600);
    return () => window.clearInterval(id);
  }, []);
  return items;
}

// Deployed ZeroPath settlement contract on Stellar testnet — used to verify a
// completed settlement on stellar.expert when there's no per-tx hash.
const STELLAR_TESTNET_CONTRACT = "CCFZ2A3VBMND6P6S4XBVPCWT5CVD7BZBUZBTQ2FTN6B6RIAF6YJF6F3S";

export function ExplorerExperience() {
  usePageMotion();
  const liveFeed = useLiveFeed();
  const analytics = useProtocolStore((state) => state.analytics);
  const events = useProtocolStore((state) => state.events);
  const executeTransfer = useProtocolStore((state) => state.executeTransfer);
  const intent = useProtocolStore((state) => state.intent);
  const phase = useProtocolStore((state) => state.phase);
  const proofArtifact = useProtocolStore((state) => state.proofArtifact);
  const resetDemo = useProtocolStore((state) => state.resetDemo);

  // Where "Transfer complete" links: the real on-chain tx if we have one,
  // otherwise the deployed settlement contract on Stellar testnet.
  const verifyUrl =
    proofArtifact?.onChain?.explorer ??
    `https://stellar.expert/explorer/testnet/contract/${STELLAR_TESTNET_CONTRACT}`;

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
        <div className="explorer-globe">
          <SettlementGlobe active={phase !== "idle" && phase !== "complete"} />
        </div>
        <div className="explorer-globe-label" aria-hidden="true">
          <span className="live-dot" /> Global settlement network · live
        </div>
        <div className="explorer-controls">
          <div className="button-row">
            <button className="primary-button" onClick={() => void executeTransfer()} type="button">
              <LockKeyhole size={15} /> Execute Transfer
            </button>
            <button className="ghost-button" onClick={resetDemo} type="button">
              <RotateCcw size={15} /> Reset
            </button>
          </div>
        </div>
        <div className="explorer-flow">
          <div className="settlement-theater" aria-label="End-to-end private settlement flow">
            {demoSteps.map((step, i) => {
              const status = statusForPhase(step.id, phase);
              return (
                <motion.div animate={{ opacity: status === "idle" ? 0.42 : 1 }} className={`settlement-step ${status}`} key={step.id}>
                  <span />
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                  {i < demoSteps.length - 1 ? <b className="settlement-connector" aria-hidden="true" /> : null}
                </motion.div>
              );
            })}
          </div>
          <div className="completion-strip">
            <Signal label="Privacy" value={`${analytics.privacyScore}/100`} />
            <Signal label="Fee" value={`${(analytics.feeBps / 100).toFixed(2)}%`} />
            <Signal label="Time" value={`${analytics.latencySeconds}s`} />
            <Signal label="Settlement tx" mono value={proofArtifact ? proofArtifact.settlementTx : "pending"} />
          </div>
        </div>
      </section>
      <section className="event-stream page-reveal" aria-label="Live network feed">
        {(events.length ? events.map((e) => ({ ...e, kind: "settle" as const })) : liveFeed).map((event) => {
          const isComplete = "phase" in event && event.phase === "complete";
          return (
            <motion.article
              key={event.id}
              className={`feed-row ${"kind" in event ? event.kind : "settle"}${isComplete ? " verify" : ""}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="feed-dot" aria-hidden="true" />
              <time>{event.timestamp}</time>
              <strong>
                {event.title}
                {isComplete ? (
                  <span className="feed-verify-tag">Verify on Stellar <ExternalLink size={12} /></span>
                ) : null}
              </strong>
              <p>{event.detail}</p>
              {isComplete ? (
                <a
                  className="feed-verify-hit"
                  href={verifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Verify settlement on Stellar testnet explorer"
                />
              ) : null}
            </motion.article>
          );
        })}
      </section>
    </div>
  );
}

const ARCH_NODES = [
  { icon: Brain, label: "Intent", note: "Natural-language outcome" },
  { icon: Sparkles, label: "AI Router", note: "Parses & routes privately" },
  { icon: Network, label: "Solver Network", note: "Liquidity competes" },
  { icon: Cpu, label: "Proof Engine", note: "Groth16 · BN254" },
  { icon: ShieldCheck, label: "Stellar", note: "Native verification" },
  { icon: Wallet, label: "Destination", note: "Funds, unlinked" },
] as const;

const HQ_MODULES = [
  { icon: BrainCircuit, name: "AI Router", desc: "Turns a plain-language intent into an optimal private route." },
  { icon: Store, name: "Solver Market", desc: "Solvers bid on privacy, price, and latency for your flow." },
  { icon: Cpu, name: "Proof Engine", desc: "Generates real Groth16 proofs over BN254, in your browser." },
  { icon: ShieldCheck, name: "Settlement Layer", desc: "Stellar verifies the proof on-chain before funds move." },
  { icon: Scale, name: "Compliance Engine", desc: "Selective disclosure without leaking the transaction graph." },
  { icon: Compass, name: "Explorer", desc: "Every settlement, provable and auditable end to end." },
] as const;

const HQ_TIMELINE = [
  { year: "2025", label: "Research", note: "Private settlement thesis" },
  { year: "2025", label: "BN254", note: "On-chain pairing verifier" },
  { year: "2025", label: "Proof Engine", note: "Real Groth16 in-browser" },
  { year: "2025", label: "AI Router", note: "Intent → private route" },
  { year: "Next", label: "Mainnet Ready", note: "Institutional pilots" },
] as const;

const HQ_TECH = [
  { icon: Cpu, title: "Groth16 / BN254", short: "Succinct zk-SNARK proofs", detail: "Constant-size proofs over the BN254 curve, verified natively on Stellar via CAP-0074 pairing checks." },
  { icon: Zap, title: "In-browser proving", short: "snarkjs · no server", detail: "Witnesses and proofs are generated client-side. Secrets never leave the device." },
  { icon: ShieldCheck, title: "Nullifier registry", short: "Double-spend safety", detail: "Each settlement burns a unique nullifier, preventing replay without revealing identity." },
  { icon: Layers, title: "Stealth addresses", short: "Unlinkable receivers", detail: "One-time destinations bind a commitment and route salt — the receiver is never posted." },
  { icon: Network, title: "Solver auctions", short: "Competitive routing", detail: "Solvers compete on privacy, route quality, latency, and fee for every intent." },
  { icon: Activity, title: "Portable proofs", short: "Cross-chain settlement", detail: "A proof from source-chain events becomes a settlement instruction on Stellar." },
] as const;

/** Deterministic sparkline (stable across SSR/CSR — no random). */
function Sparkline({ seed }: { seed: number }) {
  const n = 18;
  const pts = Array.from({ length: n }, (_, i) => 0.5 + 0.36 * Math.sin(i * 0.55 + seed) + 0.12 * Math.sin(i * 1.7 + seed * 2));
  const W = 100;
  const H = 30;
  const line = pts.map((v, i) => `${((i / (n - 1)) * W).toFixed(1)},${(H - v * H).toFixed(1)}`).join(" ");
  return (
    <svg className="hq-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Deterministic base + client-only increment (avoids SSR hydration mismatch). */
function useTodayCounter(base: number) {
  const [n, setN] = useState(base);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setN((v) => v + 1 + Math.floor(Math.random() * 3)), 2800);
    return () => window.clearInterval(id);
  }, []);
  return n;
}

export function AboutExperience() {
  usePageMotion();
  const analytics = useProtocolStore((state) => state.analytics);
  const solverCount = useProtocolStore((state) => state.solverQuotes.length);
  const settlementsToday = useTodayCounter(1284);

  const metrics = [
    { label: "Private settlements today", value: settlementsToday, format: (n: number) => formatAmount(Math.round(n)), seed: 1 },
    { label: "Proofs generated", value: analytics.proofVerifications, format: (n: number) => formatAmount(Math.round(n)), seed: 2 },
    { label: "Median latency", value: analytics.latencySeconds, format: (n: number) => `${n.toFixed(1)}s`, seed: 3 },
    { label: "Available solvers", value: solverCount, format: (n: number) => `${Math.round(n)}`, seed: 4 },
    { label: "Verification success", value: 99.98, format: (n: number) => `${n.toFixed(2)}%`, seed: 5 },
    { label: "Settlement value", value: analytics.poolSizeUsd, format: (n: number) => `$${(n / 1_000_000).toFixed(1)}M`, seed: 6 },
  ];

  return (
    <div className="about-hq">
      {/* SECTION 1 — HERO */}
      <section className="hq-hero-hq">
        <div className="hq-hero-hq-copy">
          <Reveal delay={0}>
            <p className="hq-kicker"><span className="live-dot" aria-hidden="true" /> ZeroPath Headquarters</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h1>ZeroPath isn&apos;t another bridge.<br /><span className="hq-dim">It is the operating system behind</span> private settlement.</h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="hq-lede">A private financial engine: intent in, routed through solver competition and a portable zero-knowledge proof, settled on Stellar — without ever revealing sender, receiver, route, or amount.</p>
          </Reveal>
        </div>
        <Reveal delay={0.12} className="hq-hero-hq-stage">
          <div className="hq-engine-room">
            <SettlementEngine intensity={0.6} />
            <span className="hq-engine-tag" aria-hidden="true">SETTLEMENT ENGINE · LIVE</span>
          </div>
        </Reveal>
      </section>

      {/* SECTION 2 — HOW ZEROPATH THINKS (architecture rail) */}
      <section className="hq-section">
        <Reveal><SectionHead eyebrow="How ZeroPath thinks" title="One intent. Six moves. Zero exposure." body="An outcome flows left to right through the protocol — each hop hiding more than the last." /></Reveal>
        <Reveal delay={0.08}>
          <div className="hq-rail" role="list">
            {ARCH_NODES.map((node, i) => {
              const Icon = node.icon;
              return (
                <div className="hq-rail-node" role="listitem" key={node.label}>
                  <span className="hq-rail-icon"><Icon size={18} /></span>
                  <strong>{node.label}</strong>
                  <small>{node.note}</small>
                  {i < ARCH_NODES.length - 1 ? <span className="hq-rail-link" aria-hidden="true"><b /></span> : null}
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* SECTION 3 — INSIDE ZEROPATH (floating glass modules) */}
      <section className="hq-section">
        <Reveal><SectionHead eyebrow="Inside ZeroPath" title="Six systems, one protocol." body="Independent modules that compose into a single private settlement fabric." /></Reveal>
        <div className="hq-modules">
          {HQ_MODULES.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <Reveal key={mod.name} delay={i * 0.05}>
                <InteractiveCard className="hq-module">
                  <span className="hq-module-live" aria-hidden="true" />
                  <span className="hq-module-icon"><Icon size={20} /></span>
                  <strong className="hq-module-name">{mod.name}</strong>
                  <p className="hq-module-desc">{mod.desc}</p>
                </InteractiveCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* SECTION 4 — INFRASTRUCTURE METRICS (ops dashboard) */}
      <section className="hq-section">
        <Reveal><SectionHead eyebrow="Infrastructure" title="The network, in real time." body="Live protocol telemetry across proofs, solvers, latency and settled value." /></Reveal>
        <div className="hq-dash">
          {metrics.map((m, i) => (
            <Reveal key={m.label} delay={i * 0.05}>
              <div className="hq-metric">
                <span className="hq-metric-label">{m.label}</span>
                <strong className="hq-metric-value"><CountUp value={m.value} format={m.format} /></strong>
                <Sparkline seed={m.seed} />
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SECTION 5 — MISSION */}
      <section className="hq-mission">
        <Reveal>
          <p className="hq-kicker center"><span className="live-dot" aria-hidden="true" /> Mission</p>
          <h2 className="hq-mission-line">
            The future of finance won&apos;t be public.
            <br />
            <span className="hq-accent">It will be provable.</span>
          </h2>
        </Reveal>
      </section>

      {/* SECTION 6 — TIMELINE */}
      <section className="hq-section">
        <Reveal><SectionHead eyebrow="Trajectory" title="From research to mainnet-ready." /></Reveal>
        <div className="hq-timeline">
          <span className="hq-timeline-track" aria-hidden="true" />
          {HQ_TIMELINE.map((step, i) => (
            <Reveal key={step.label} delay={i * 0.08} className="hq-timeline-step">
              <span className="hq-timeline-node" aria-hidden="true" />
              <span className="hq-timeline-year">{step.year}</span>
              <strong className="hq-timeline-label">{step.label}</strong>
              <small className="hq-timeline-note">{step.note}</small>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SECTION 7 — TECHNOLOGY GRID */}
      <section className="hq-section">
        <Reveal><SectionHead eyebrow="Technology" title="What makes it provable." body="The cryptographic machinery behind every private settlement." /></Reveal>
        <div className="hq-tech-grid">
          {HQ_TECH.map((tech, i) => {
            const Icon = tech.icon;
            return (
              <Reveal key={tech.title} delay={i * 0.05}>
                <InteractiveCard className="hq-tech" glow="orange">
                  <span className="hq-tech-live" aria-hidden="true" />
                  <span className="hq-tech-icon"><Icon size={18} /></span>
                  <strong className="hq-tech-title">{tech.title}</strong>
                  <span className="hq-tech-short">{tech.short}</span>
                  <p className="hq-tech-detail">{tech.detail}</p>
                </InteractiveCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* SECTION 8 — FOOTER */}
      <footer className="hq-footer">
        <Reveal>
          <div className="hq-footer-top">
            <span className="hq-footer-mark"><span aria-hidden="true" /> ZeroPath</span>
            <p>The operating system for private settlement.</p>
          </div>
          <div className="hq-footer-links">
            <Link href="/operate">Operate</Link>
            <Link href="/proof">Proof</Link>
            <Link href="/explorer">Explorer</Link>
            <Link href="/app">Launch App</Link>
          </div>
          <div className="hq-footer-legal">
            <span>Built on Stellar · BN254 · Groth16</span>
            <span>© 2025 ZeroPath</span>
          </div>
        </Reveal>
      </footer>
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
  const count = routePath.length;
  const roleFor = (label: string, index: number) =>
    label === "Stellar"
      ? "Private settlement layer"
      : index === 0
        ? "Source chain"
        : index === count - 1
          ? "Destination chain"
          : "Relay hop";

  return (
    <div className="path-visual" aria-label="Selected settlement path" style={{ ["--path-count" as string]: count }}>
      {routePath.map((label, index) => {
        const isStellar = label === "Stellar";
        const isLast = index === count - 1;
        return (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className={isStellar ? "path-node stellar" : "path-node"}
            initial={{ opacity: 0.5, y: 12 }}
            key={`${label}-${index}`}
            transition={{ delay: index * 0.09, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="path-node-sheen" aria-hidden="true" />
            {isStellar ? <span className="path-node-ring" aria-hidden="true" /> : null}
            <em className="path-role">{roleFor(label, index)}</em>
            <strong className="path-name">{label}</strong>
            <span className="path-node-dot" aria-hidden="true" />
            {!isLast ? (
              <span className="path-link" aria-hidden="true">
                <b className="path-link-pulse" />
              </span>
            ) : null}
          </motion.div>
        );
      })}
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

/**
 * A live status row for the proof readout rail: a state dot (idle → pulsing amber
 * while pending → solid green once materialized) connected by a vertical rail.
 */
function ReadoutRow({ label, value, mono, href, live }: { label: string; value: string; mono?: boolean; href?: string; live?: boolean }) {
  return (
    <div className={`readout-row${live ? " live" : ""}${mono ? " mono" : ""}`}>
      <span className="readout-dot" aria-hidden="true" />
      <span className="readout-label">{label}</span>
      {href ? (
        <strong className="readout-value">
          <a href={href} target="_blank" rel="noreferrer">{value}</a>
        </strong>
      ) : (
        <strong className="readout-value">{value}</strong>
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
