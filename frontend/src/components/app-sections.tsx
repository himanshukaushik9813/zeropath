"use client";

import { useMemo } from "react";
import {
  ArrowLeftRight,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  ExternalLink,
  EyeOff,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
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
} from "@/lib/protocol-engine";
import { useProtocolStore } from "@/store/protocol-store";
import { STAGE_COUNT, useExecutionStore } from "@/store/execution-store";
import { CountUp, MagneticButton, ProofCore, TiltCard, TypingHash } from "./cinematic";
import { MissionTimeline } from "./mission-timeline";

// ---------------------------------------------------------------------------
// Shared app-panel primitives
// ---------------------------------------------------------------------------

function Panel({
  title,
  hint,
  children,
  wide,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Every panel is a physical glass object — mouse tilt + ambient light that
  // follows the cursor. No flat dashboard cards anywhere in the OS.
  return (
    <TiltCard className={wide ? "app-panel wide" : "app-panel"} intensity={5}>
      <header className="app-panel-head">
        <h3>{title}</h3>
        {hint ? <span>{hint}</span> : null}
      </header>
      {children}
    </TiltCard>
  );
}

function Sig({ label, value, mono, href }: { label: string; value: string; mono?: boolean; href?: string }) {
  return (
    <div className={mono ? "app-sig mono" : "app-sig"}>
      <span>{label}</span>
      {href ? (
        <strong>
          <a href={href} target="_blank" rel="noreferrer">
            {value}
          </a>
        </strong>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="app-section-title">
      <div className="app-section-icon">{icon}</div>
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
    </div>
  );
}

function StatusReadout() {
  const status = useProtocolStore((state) => state.demoStatus);
  const headline =
    status.stage === "done"
      ? status.onChain
        ? "Settled on Stellar"
        : status.isRealProof
          ? "Proof verified"
          : "Demo complete"
      : status.stage === "proving"
        ? "Generating proof"
        : status.stage === "settling"
          ? "Verifying on Stellar"
          : status.stage === "error"
            ? "Interrupted"
            : "Idle";

  return (
    <div className="app-status-readout" data-stage={status.stage}>
      <div className="app-status-line">
        {status.running ? (
          <Loader2 className="spin" size={15} />
        ) : status.stage === "done" ? (
          <CheckCircle2 size={15} />
        ) : (
          <span className="app-status-dot" />
        )}
        <strong>{headline}</strong>
        {status.isRealProof ? <span className="app-chip real">Real Groth16</span> : null}
        {status.onChain ? <span className="app-chip onchain">On-chain ✓</span> : null}
      </div>
      <p>{status.message}</p>
      {status.onChain?.explorer ? (
        <a className="app-tx" href={status.onChain.explorer} target="_blank" rel="noreferrer">
          View transaction <ExternalLink size={12} />
        </a>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Transfer
// ---------------------------------------------------------------------------

// Settlement route: packet travels Ethereum -> Commitment -> Proof -> BN254 ->
// Settlement -> Solana. Each node lights up as the mission reaches its stage.
const ROUTE_NODES = [
  { label: "Ethereum", stage: 0 },
  { label: "Commitment", stage: 3 },
  { label: "Proof", stage: 6 },
  { label: "BN254", stage: 7 },
  { label: "Settlement", stage: 9 },
  { label: "Solana", stage: 10 },
] as const;

function SettlementRoute() {
  const stage = useExecutionStore((s) => s.stage);
  const active = useExecutionStore((s) => s.active);
  const progress = active ? Math.min(1, Math.max(0, stage / (STAGE_COUNT - 1))) : 0;

  return (
    <div className="route-strip" aria-label="Settlement route">
      <div className="route-track">
        <div className="route-fill" style={{ width: `${progress * 100}%` }} />
        <div className={active ? "route-packet live" : "route-packet"} style={{ left: `${progress * 100}%` }} />
      </div>
      <div className="route-nodes">
        {ROUTE_NODES.map((node) => {
          const reached = active && stage >= node.stage;
          return (
            <div className={reached ? "route-node reached" : "route-node"} key={node.label}>
              <i />
              <span>{node.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TransferSection() {
  const prompt = useProtocolStore((state) => state.prompt);
  const intent = useProtocolStore((state) => state.intent);
  const analytics = useProtocolStore((state) => state.analytics);
  const proofArtifact = useProtocolStore((state) => state.proofArtifact);
  const setPrompt = useProtocolStore((state) => state.setPrompt);
  const updateIntent = useProtocolStore((state) => state.updateIntent);
  const executeTransfer = useProtocolStore((state) => state.executeTransfer);
  const resetDemo = useProtocolStore((state) => state.resetDemo);

  const active = useExecutionStore((s) => s.active);
  const complete = useExecutionStore((s) => s.complete);
  const stage = useExecutionStore((s) => s.stage);
  const begin = useExecutionStore((s) => s.begin);
  const setStage = useExecutionStore((s) => s.setStage);
  const finish = useExecutionStore((s) => s.finish);
  const fail = useExecutionStore((s) => s.fail);
  const reset = useExecutionStore((s) => s.reset);

  // Orchestrate the mission: pre-proof stages advance on a schedule while the
  // real proof generates; final stages gate on the actual work completing.
  const runMission = () => {
    if (active) return;
    begin();
    const work = executeTransfer();

    // Stages 0..6 (Intent Parsed -> Groth16 Proof Generation) during proving.
    const schedule = [0, 650, 1400, 2300, 3300, 4500, 5900];
    schedule.forEach((delay, i) => window.setTimeout(() => setStage(i), delay));

    work
      .then(() => {
        setStage(7); // BN254 Verification
        window.setTimeout(() => setStage(8), 550); // Nullifier Consumption
        window.setTimeout(() => setStage(9), 1100); // Stellar Finality
        window.setTimeout(() => finish(), 1700); // Settlement Complete
        window.setTimeout(() => reset(), 6000); // release execution mode
      })
      .catch(() => {
        fail();
        window.setTimeout(() => reset(), 3000);
      });
  };

  const intensity = complete ? 0.85 : active ? 0.7 : 0.32;

  return (
    <div className="app-view">
      <SectionTitle
        icon={<ArrowLeftRight size={18} />}
        title="Transfer"
        sub="Describe a private cross-chain transfer. One command runs a real proof and settles it on Stellar."
      />

      <div className="exec-stage">
        <TiltCard className="exec-core" intensity={5}>
          <div className="exec-core-head">
            <span>Proof Core</span>
            <small>{complete ? "settlement finalized" : active ? "executing" : "idle"}</small>
          </div>
          <div className="exec-core-viz">
            <ProofCore intensity={intensity} />
            <div className="exec-core-label">
              <strong>{proofArtifact?.bn254Status === "verified" ? "VERIFIED" : active ? "PROVING" : "BN254"}</strong>
              <small>Stellar pairing check</small>
            </div>
          </div>
        </TiltCard>

        <TiltCard className="exec-timeline" intensity={4}>
          <div className="exec-core-head">
            <span>Mission Timeline</span>
            <small>{active ? `stage ${Math.min(stage + 1, STAGE_COUNT)}/${STAGE_COUNT}` : "standby"}</small>
          </div>
          <MissionTimeline />
        </TiltCard>
      </div>

      <SettlementRoute />

      <div className="app-grid two">
        <TiltCard className="app-panel">
          <div className="app-panel-head">
            <h3>Intent</h3>
            <span>natural language</span>
          </div>
          <textarea
            className="app-textarea"
            aria-label="Transfer intent"
            value={prompt}
            disabled={active}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="app-controls">
            <label className="app-field">
              <span>Source</span>
              <select disabled={active} value={intent.source} onChange={(e) => updateIntent({ source: e.target.value as ChainId })}>
                {chains.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </label>
            <label className="app-field">
              <span>Destination</span>
              <select disabled={active} value={intent.destination} onChange={(e) => updateIntent({ destination: e.target.value as ChainId })}>
                {chains.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </label>
            <label className="app-field">
              <span>Asset</span>
              <select disabled={active} value={intent.asset} onChange={(e) => updateIntent({ asset: e.target.value as AssetId })}>
                {assets.map((a) => (<option key={a} value={a}>{a}</option>))}
              </select>
            </label>
            <label className="app-field">
              <span>Amount</span>
              <input type="number" min={1} disabled={active} value={intent.amount} onChange={(e) => updateIntent({ amount: Number(e.target.value) })} />
            </label>
          </div>
          <div className="app-btn-row">
            <MagneticButton className="app-btn primary magnetic" disabled={active} onClick={runMission}>
              {active ? <><Loader2 className="spin" size={15} /> Executing…</> : <><Play size={15} /> Execute settlement</>}
            </MagneticButton>
            <button className="app-btn ghost" disabled={active} onClick={() => { resetDemo(); reset(); }} type="button">
              <RotateCcw size={14} /> Reset
            </button>
          </div>
        </TiltCard>

        <TiltCard className="app-panel">
          <div className="app-panel-head">
            <h3>Settlement</h3>
            <span>live</span>
          </div>
          <StatusReadout />
          <div className="app-sig-grid">
            <Sig label="Route" value={`${getChain(intent.source).short} → XLM → ${getChain(intent.destination).short}`} />
            <Sig label="Amount" value={`${formatAmount(intent.amount)} ${intent.asset}`} />
            <div className="app-sig">
              <span>Anonymity set</span>
              <strong><CountUp value={analytics.anonymitySet} format={(n) => formatAmount(Math.round(n))} /></strong>
            </div>
            <div className="app-sig">
              <span>Proof verifications</span>
              <strong><CountUp value={analytics.proofVerifications} format={(n) => formatAmount(Math.round(n))} /></strong>
            </div>
            <div className="app-sig mono">
              <span>Nullifier</span>
              <strong>{proofArtifact ? <TypingHash text={shorten(proofArtifact.publicInputs.nullifier_hash, 10, 8)} /> : "—"}</strong>
            </div>
            <div className="app-sig mono">
              <span>Commitment</span>
              <strong>{proofArtifact ? <TypingHash text={shorten(proofArtifact.commitment, 10, 8)} /> : "—"}</strong>
            </div>
          </div>
        </TiltCard>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. AI Router
// ---------------------------------------------------------------------------

export function RouterSection() {
  const prompt = useProtocolStore((state) => state.prompt);
  const parsedIntent = useProtocolStore((state) => state.parsedIntent);
  const analytics = useProtocolStore((state) => state.analytics);
  const route = useProtocolStore((state) => state.route);
  const intent = useProtocolStore((state) => state.intent);
  const setPrompt = useProtocolStore((state) => state.setPrompt);
  const parsePrompt = useProtocolStore((state) => state.parsePrompt);
  const running = useProtocolStore((state) => state.demoStatus.running);
  const routePath = useMemo(() => {
    const last = route[route.length - 1];
    return route.map((leg) => getChain(leg.from).name).concat(getChain(last?.to ?? intent.destination).name);
  }, [route, intent.destination]);

  return (
    <div className="app-view">
      <SectionTitle
        icon={<BrainCircuit size={18} />}
        title="AI Router"
        sub="Parse an outcome into a private route through Stellar and rank solver execution."
      />
      <div className="app-grid two">
        <Panel title="Intent parser">
          <textarea className="app-textarea" aria-label="Router intent" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <div className="app-btn-row">
            <button className="app-btn primary" disabled={running} onClick={parsePrompt} type="button">
              <Sparkles size={15} /> Parse & route
            </button>
          </div>
          <div className="app-route">
            {routePath.map((label, i) => (
              <span className={label === "Stellar" ? "app-route-node stellar" : "app-route-node"} key={`${label}-${i}`}>
                {label}
              </span>
            ))}
          </div>
        </Panel>
        <Panel title="Routing decision">
          <div className="app-sig-grid">
            <Sig label="Parsed" value={parsedIntent.summary} />
            <Sig label="Confidence" value={`${parsedIntent.confidence}%`} />
            <Sig label="Fee" value={`${(analytics.feeBps / 100).toFixed(2)}%`} />
            <Sig label="Privacy" value={`${analytics.privacyScore}/100`} />
          </div>
          <div className="app-reasoning">
            {parsedIntent.reasoning.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Proof Engine
// ---------------------------------------------------------------------------

export function ProofSection() {
  const generateProof = useProtocolStore((state) => state.generateProof);
  const proofArtifact = useProtocolStore((state) => state.proofArtifact);
  const stealthIdentity = useProtocolStore((state) => state.stealthIdentity);
  const phase = useProtocolStore((state) => state.phase);
  const running = useProtocolStore((state) => state.demoStatus.running);

  return (
    <div className="app-view">
      <SectionTitle
        icon={<Cpu size={18} />}
        title="Proof Engine"
        sub="Generate a real Groth16 BN254 proof in-browser; verify it on Stellar via CAP-0074 pairing check."
      />
      <div className="app-grid two">
        <Panel title="BN254 verifier">
          <div className="app-verifier">
            <Cpu size={26} />
            <strong>{proofArtifact?.bn254Status ?? "pending"}</strong>
            <span>Stellar pairing check</span>
          </div>
          <div className="app-btn-row">
            <button className="app-btn primary" disabled={running} onClick={() => void generateProof()} type="button">
              {running ? <><Loader2 className="spin" size={15} /> Generating…</> : <><Zap size={15} /> Generate proof</>}
            </button>
          </div>
          <StatusReadout />
        </Panel>
        <Panel title="Public inputs & proof">
          <div className="app-sig-grid">
            <Sig label="Phase" value={phase} />
            <Sig label="Commitment" mono value={proofArtifact ? shorten(proofArtifact.commitment) : "pending"} />
            <Sig label="Merkle root" mono value={proofArtifact ? shorten(proofArtifact.merkleRoot) : "pending"} />
            <Sig label="Groth16" mono value={proofArtifact ? shorten(proofArtifact.groth16Proof) : "pending"} />
            <Sig
              label="On-chain verify"
              mono
              value={proofArtifact?.onChain ? (proofArtifact.onChain.txHash ? shorten(proofArtifact.onChain.txHash) : "verified") : "run Transfer"}
              href={proofArtifact?.onChain?.explorer ?? undefined}
            />
            <Sig label="Nullifier" mono value={stealthIdentity ? shorten(stealthIdentity.nullifierHash) : "pending"} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Stealth
// ---------------------------------------------------------------------------

export function StealthSection() {
  const stealthIdentity = useProtocolStore((state) => state.stealthIdentity);
  const generateStealthAddress = useProtocolStore((state) => state.generateStealthAddress);

  return (
    <div className="app-view">
      <SectionTitle
        icon={<EyeOff size={18} />}
        title="Stealth"
        sub="One-time stealth receivers. The destination is never posted publicly — only commitments."
      />
      <div className="app-grid two">
        <Panel title="Stealth identity">
          <div className="app-btn-row">
            <button className="app-btn primary" onClick={() => void generateStealthAddress()} type="button">
              <Sparkles size={15} /> Generate stealth address
            </button>
          </div>
          <div className="app-sig-grid">
            <Sig label="Stealth receiver" mono value={stealthIdentity ? shorten(stealthIdentity.stealthReceiver, 10, 8) : "not generated"} />
            <Sig label="Ephemeral key" mono value={stealthIdentity ? shorten(stealthIdentity.ephemeralPublicKey, 10, 8) : "pending"} />
            <Sig label="Destination commitment" mono value={stealthIdentity ? shorten(stealthIdentity.destinationCommitment) : "pending"} />
            <Sig label="Route commitment" mono value={stealthIdentity ? shorten(stealthIdentity.routeCommitment) : "pending"} />
            <Sig label="Nullifier" mono value={stealthIdentity ? shorten(stealthIdentity.nullifierHash) : "pending"} />
          </div>
        </Panel>
        <Panel title="Privacy guarantees">
          <ul className="app-list">
            {(stealthIdentity?.metadata ?? [
              "Receiver address is never posted publicly.",
              "Destination commitment binds a one-time receiver and route salt.",
              "Nullifier prevents replay during Stellar settlement.",
            ]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Compliance
// ---------------------------------------------------------------------------

export function ComplianceSection() {
  const intent = useProtocolStore((state) => state.intent);
  const analytics = useProtocolStore((state) => state.analytics);
  const setComplianceMode = useProtocolStore((state) => state.setComplianceMode);

  return (
    <div className="app-view">
      <SectionTitle
        icon={<Sparkles size={18} />}
        title="Compliance"
        sub="Private, balanced, and institutional modes — same flow, different disclosure constraints."
      />
      <div className="app-mode-row">
        {complianceModes.map((mode) => (
          <button
            className={intent.complianceMode === mode.id ? "app-mode active" : "app-mode"}
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
      <Panel title="Policy readout" wide>
        <div className="app-sig-grid">
          <Sig label="Mode" value={labelForCompliance(intent.complianceMode as ComplianceMode)} />
          <Sig label="Anonymity" value={`${analytics.privacyScore}/100`} />
          <Sig label="Compliance" value={`${analytics.complianceScore}/100`} />
          <Sig label="Route availability" value={`${analytics.routeAvailability}%`} />
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6. Marketplace
// ---------------------------------------------------------------------------

export function MarketplaceSection() {
  const solverQuotes = useProtocolStore((state) => state.solverQuotes);
  const selectedSolverId = useProtocolStore((state) => state.selectedSolverId);
  const selectSolver = useProtocolStore((state) => state.selectSolver);

  const ranked = useMemo(
    () =>
      [...solverQuotes].sort((a, b) => {
        const sa = a.routeQuality + a.privacyScore + a.successRate - a.feeBps / 2 - a.latencySeconds / 4;
        const sb = b.routeQuality + b.privacyScore + b.successRate - b.feeBps / 2 - b.latencySeconds / 4;
        return sb - sa;
      }),
    [solverQuotes]
  );

  return (
    <div className="app-view">
      <SectionTitle
        icon={<Sparkles size={18} />}
        title="Marketplace"
        sub="Solvers compete on privacy, route quality, latency, and fee for the intent."
      />
      <div className="app-solvers">
        {ranked.map((solver, index) => (
          <button
            className={solver.id === selectedSolverId ? "app-solver active" : "app-solver"}
            key={solver.id}
            onClick={() => selectSolver(solver.id)}
            type="button"
          >
            <span className="app-solver-rank">0{index + 1}</span>
            <span className="app-solver-name">
              <strong>{solver.name}</strong>
              <small>{solver.strategy}</small>
            </span>
            <span className="app-solver-bar">
              <i style={{ width: `${Math.max(18, solver.routeQuality)}%` }} />
            </span>
            <span className="app-solver-meta">{solver.latencySeconds}s</span>
            <span className="app-solver-meta">{(solver.feeBps / 100).toFixed(2)}%</span>
            <span className="app-solver-meta">{solver.privacyScore}/100</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. Analytics
// ---------------------------------------------------------------------------

export function AnalyticsSection() {
  const analytics = useProtocolStore((state) => state.analytics);
  const regions = useProtocolStore((state) => state.regions);
  const selectedRegionId = useProtocolStore((state) => state.selectedRegionId);
  const selectRegion = useProtocolStore((state) => state.selectRegion);

  return (
    <div className="app-view">
      <SectionTitle
        icon={<ArrowLeftRight size={18} />}
        title="Analytics"
        sub="Privacy metrics and regional settlement activity across the network."
      />
      <div className="app-metric-row">
        <div className="app-metric">
          <span>Anonymity set</span>
          <strong>{formatAmount(analytics.anonymitySet)}</strong>
        </div>
        <div className="app-metric">
          <span>Pool size</span>
          <strong>{formatUsd(analytics.poolSizeUsd)}</strong>
        </div>
        <div className="app-metric">
          <span>Proof verifications</span>
          <strong>{formatAmount(analytics.proofVerifications)}</strong>
        </div>
        <div className="app-metric">
          <span>Settlements</span>
          <strong>{formatAmount(analytics.settlementCount)}</strong>
        </div>
      </div>
      <Panel title="Regional activity" wide>
        <div className="app-region-grid">
          {regions.map((region) => (
            <button
              className={region.id === selectedRegionId ? "app-region active" : "app-region"}
              key={region.id}
              onClick={() => selectRegion(region.id)}
              type="button"
            >
              <span>{region.label}</span>
              <strong>{formatUsd(region.volumeUsd)}</strong>
              <small>{region.activeRoutes} routes · {region.privacyActivity}/100</small>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Settings
// ---------------------------------------------------------------------------

export function SettingsSection() {
  const intent = useProtocolStore((state) => state.intent);
  const setComplianceMode = useProtocolStore((state) => state.setComplianceMode);
  const resetDemo = useProtocolStore((state) => state.resetDemo);
  const relayerUrl = process.env.NEXT_PUBLIC_RELAYER_URL ?? "http://localhost:8787";

  return (
    <div className="app-view">
      <SectionTitle
        icon={<Sparkles size={18} />}
        title="Settings"
        sub="Session preferences and connection endpoints."
      />
      <div className="app-grid two">
        <Panel title="Default compliance mode">
          <div className="app-mode-row compact">
            {complianceModes.map((mode) => (
              <button
                className={intent.complianceMode === mode.id ? "app-mode active" : "app-mode"}
                key={mode.id}
                onClick={() => setComplianceMode(mode.id)}
                type="button"
              >
                <span>{mode.label}</span>
                <small>{mode.detail}</small>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Connections">
          <div className="app-sig-grid">
            <Sig label="Relayer" mono value={relayerUrl} />
            <Sig label="Network" value="Stellar Testnet" />
            <Sig label="Source chain" value="Ethereum Sepolia" />
          </div>
          <div className="app-btn-row">
            <button className="app-btn ghost" onClick={resetDemo} type="button">
              <RotateCcw size={14} /> Reset session
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9. Wallet
// ---------------------------------------------------------------------------

const CONTRACT_ID = "CCFZ2A3VBMND6P6S4XBVPCWT5CVD7BZBUZBTQ2FTN6B6RIAF6YJF6F3S";
const SEPOLIA_ESCROW = "0xc9f3bcb09b41057a105A7b0598962D8738c4cf8A";

export function WalletSection() {
  return (
    <div className="app-view">
      <SectionTitle
        icon={<Sparkles size={18} />}
        title="Wallet"
        sub="Connected settlement identity and on-chain endpoints."
      />
      <div className="app-grid two">
        <Panel title="Stellar (destination)">
          <div className="app-sig-grid">
            <Sig label="Network" value="Testnet" />
            <Sig
              label="Settlement contract"
              mono
              value={shorten(CONTRACT_ID, 8, 6)}
              href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
            />
            <Sig label="Verifier" value="BN254 Groth16 (CAP-0074)" />
          </div>
        </Panel>
        <Panel title="Ethereum Sepolia (source)">
          <div className="app-sig-grid">
            <Sig label="Network" value="Sepolia" />
            <Sig
              label="Source escrow"
              mono
              value={shorten(SEPOLIA_ESCROW, 8, 6)}
              href={`https://sepolia.etherscan.io/address/${SEPOLIA_ESCROW}`}
            />
            <Sig label="Deposits" value="4 real commitments" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
