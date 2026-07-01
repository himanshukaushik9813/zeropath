/**
 * ethereum.ts
 *
 * Reads REAL source-chain deposits from the ZeroPathSepoliaEscrow contract on
 * Ethereum Sepolia. When configured, the relayer builds its source Merkle tree
 * from these on-chain commitments instead of the hardcoded demo leaves — turning
 * the "source chain" leg from simulated into a real cross-chain flow.
 *
 * Enable by setting:
 *   ZEROPATH_ETH_RPC     an Ethereum Sepolia JSON-RPC URL
 *   ZEROPATH_ETH_ESCROW  the deployed ZeroPathSepoliaEscrow address (0x...)
 *
 * Trust model: relayer-attested. The escrow proves a real on-chain deposit; the
 * relayer reports the resulting root to Stellar.
 */

import { JsonRpcProvider, Contract } from "ethers";

const ESCROW_ABI = [
  "function allCommitments() view returns (uint256[])",
  "function count() view returns (uint256)",
];

export type OnchainSource = {
  mode: "ethereum-sepolia";
  rpc: string;
  escrow: string;
  /** Commitments in leaf order (index == Merkle leaf index). */
  commitments: bigint[];
};

/**
 * Fetch on-chain source commitments if the escrow is configured and reachable.
 * Returns null when unconfigured; throws only on unexpected read errors (the
 * caller decides whether to fall back to demo data).
 */
export async function fetchOnchainCommitments(): Promise<OnchainSource | null> {
  const rpc = process.env.ZEROPATH_ETH_RPC;
  const escrow = process.env.ZEROPATH_ETH_ESCROW;
  if (!rpc || !escrow) return null;

  const provider = new JsonRpcProvider(rpc);
  const contract = new Contract(escrow, ESCROW_ABI, provider);
  const raw = (await contract.allCommitments()) as bigint[];
  return {
    mode: "ethereum-sepolia",
    rpc,
    escrow,
    commitments: raw.map((value) => BigInt(value)),
  };
}
