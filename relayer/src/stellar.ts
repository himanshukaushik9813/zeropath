/**
 * stellar.ts
 *
 * Submits a browser/SDK-generated Groth16 proof to the deployed ZeroPath
 * settlement contract on Stellar testnet, closing the loop:
 *
 *   browser generates proof  ->  relayer POST /v1/settle  ->  contract settle()
 *
 * Submission shells out to the `stellar` CLI (the same tool used by
 * contracts/stellar/deploy-testnet.sh), so custom-struct arguments are encoded
 * from the contract spec automatically. Inputs are validated as strict hex and
 * passed via execFile arg arrays (never a shell string) to avoid injection.
 *
 * Required env for on-chain submission:
 *   ZEROPATH_CONTRACT_ID     C... address of the deployed settlement contract
 *   ZEROPATH_SETTLE_TOKEN    C... address of the payout token (SAC)
 *   ZEROPATH_SETTLE_RECIPIENT G... address to receive the settled funds
 * Optional:
 *   ZEROPATH_STELLAR_IDENTITY (default "zeropath-deployer")
 *   ZEROPATH_NETWORK          (default "testnet")
 *   ZEROPATH_SETTLE_AMOUNT    (default "5000")
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type SettlePayload = {
  publicInputs: {
    batch_root: string;
    source_event_root: string;
    nullifier_hash: string;
    destination_commitment: string;
    asset_id: string;
  };
  epoch: number;
  proof: { a: string; b: string; c: string };
};

export type SettleResult = {
  ok: boolean;
  txHash: string | null;
  contractId: string;
  network: string;
  explorer: string | null;
  raw: string;
};

type StellarConfig = {
  contractId: string;
  identity: string;
  network: string;
  recipient: string;
  token: string;
  amount: string;
};

export class StellarConfigError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new StellarConfigError(
      `${name} is not set — on-chain settlement is disabled. See relayer/.env.example.`
    );
  }
  return value;
}

function getConfig(): StellarConfig {
  return {
    contractId: requireEnv("ZEROPATH_CONTRACT_ID"),
    token: requireEnv("ZEROPATH_SETTLE_TOKEN"),
    recipient: requireEnv("ZEROPATH_SETTLE_RECIPIENT"),
    identity: process.env.ZEROPATH_STELLAR_IDENTITY ?? "zeropath-deployer",
    network: process.env.ZEROPATH_NETWORK ?? "testnet",
    amount: process.env.ZEROPATH_SETTLE_AMOUNT ?? "5000",
  };
}

/** Assert a value is exactly `bytes` bytes of lowercase hex (no 0x prefix). */
function assertHex(name: string, value: unknown, bytes: number): string {
  if (typeof value !== "string") throw new StellarConfigError(`${name} must be a hex string`);
  const v = value.startsWith("0x") ? value.slice(2) : value;
  if (v.length !== bytes * 2 || !/^[0-9a-fA-F]+$/.test(v)) {
    throw new StellarConfigError(`${name} must be ${bytes} bytes (${bytes * 2} hex chars), got "${value}"`);
  }
  return v.toLowerCase();
}

function assertStrkey(name: string, value: string, prefix: string): string {
  if (!value.startsWith(prefix) || !/^[A-Z2-7]+$/.test(value)) {
    throw new StellarConfigError(`${name} must be a ${prefix}... Stellar strkey`);
  }
  return value;
}

/** Best-effort extraction of a 64-hex transaction hash from CLI output. */
function extractTxHash(output: string): string | null {
  const match = output.match(/\b[0-9a-f]{64}\b/i);
  return match ? match[0].toLowerCase() : null;
}

async function stellarInvoke(cfg: StellarConfig, fnArgs: string[]): Promise<string> {
  const args = [
    "contract",
    "invoke",
    "--id",
    cfg.contractId,
    "--source",
    cfg.identity,
    "--network",
    cfg.network,
    "--",
    ...fnArgs,
  ];
  const { stdout, stderr } = await execFileAsync("stellar", args, {
    maxBuffer: 10 * 1024 * 1024,
  });
  return `${stdout}\n${stderr}`;
}

async function resolveAddress(identity: string): Promise<string> {
  const { stdout } = await execFileAsync("stellar", ["keys", "address", identity]);
  return stdout.trim();
}

/**
 * Publish the source-event root the proof commits to. Idempotent: re-publishing
 * an already-known root is a no-op on the contract. Requires the configured
 * identity to be the contract's registered relayer.
 */
async function publishSourceRoot(cfg: StellarConfig, rootHex: string): Promise<void> {
  const relayerAddr = await resolveAddress(cfg.identity);
  await stellarInvoke(cfg, [
    "update_source_root",
    "--relayer",
    relayerAddr,
    "--root",
    rootHex,
  ]);
}

/**
 * Submit a real Groth16 proof to the deployed contract's settle() on testnet.
 * Publishes the source root first (so a fresh contract accepts the proof), then
 * invokes settle with the proof + intent built from the public inputs plus the
 * relayer-configured payout (recipient, token, amount).
 */
export async function submitSettle(payload: SettlePayload): Promise<SettleResult> {
  const cfg = getConfig();

  // Validate the proof-derived fields as strict hex.
  const pi = payload.publicInputs;
  const batchRoot = assertHex("publicInputs.batch_root", pi.batch_root, 32);
  const sourceRoot = assertHex("publicInputs.source_event_root", pi.source_event_root, 32);
  const nullifier = assertHex("publicInputs.nullifier_hash", pi.nullifier_hash, 32);
  const destCommit = assertHex("publicInputs.destination_commitment", pi.destination_commitment, 32);
  const assetId = assertHex("publicInputs.asset_id", pi.asset_id, 32);
  const a = assertHex("proof.a", payload.proof.a, 64);
  const b = assertHex("proof.b", payload.proof.b, 128);
  const c = assertHex("proof.c", payload.proof.c, 64);
  const epoch = Number(payload.epoch);
  if (!Number.isInteger(epoch) || epoch < 0) {
    throw new StellarConfigError(`epoch must be a non-negative integer, got ${payload.epoch}`);
  }

  assertStrkey("ZEROPATH_CONTRACT_ID", cfg.contractId, "C");
  assertStrkey("ZEROPATH_SETTLE_TOKEN", cfg.token, "C");
  assertStrkey("ZEROPATH_SETTLE_RECIPIENT", cfg.recipient, "G");

  const intent = {
    batch_root: batchRoot,
    source_event_root: sourceRoot,
    nullifier_hash: nullifier,
    destination_commitment: destCommit,
    asset_id: assetId,
    epoch,
    recipient: cfg.recipient,
    token: cfg.token,
    amount_bucket: cfg.amount,
  };
  const proof = { a, b, c };

  // Ensure the contract knows this source root before we settle.
  await publishSourceRoot(cfg, sourceRoot);

  const raw = await stellarInvoke(cfg, [
    "settle",
    "--intent",
    JSON.stringify(intent),
    "--proof",
    JSON.stringify(proof),
  ]);

  const txHash = extractTxHash(raw);
  return {
    ok: true,
    txHash,
    contractId: cfg.contractId,
    network: cfg.network,
    explorer: txHash
      ? `https://stellar.expert/explorer/${cfg.network}/tx/${txHash}`
      : `https://stellar.expert/explorer/${cfg.network}/contract/${cfg.contractId}`,
    raw,
  };
}
