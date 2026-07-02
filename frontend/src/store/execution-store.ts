"use client";

import { create } from "zustand";

/**
 * Drives the cinematic "execution mode" — when a settlement is executing, the
 * whole app locks into an intense state and the mission timeline advances stage
 * by stage. Stages map to the real proof + on-chain settlement lifecycle.
 */
export const MISSION_STAGES = [
  "Intent Parsed",
  "Route Discovery",
  "Solver Competition",
  "Liquidity Reserved",
  "Commitment Generated",
  "Merkle Tree",
  "Witness",
  "Groth16 Proof",
  "BN254 Verification",
  "Settlement",
  "Transfer Complete",
] as const;

export const STAGE_COUNT = MISSION_STAGES.length;

type ExecutionStore = {
  /** Execution mode active — the UI locks and intensifies. */
  active: boolean;
  /** Index of the currently-executing stage (-1 = none). Stages < this are done. */
  stage: number;
  /** True once Settlement Complete is reached. */
  complete: boolean;
  /** True if the run failed. */
  failed: boolean;
  begin: () => void;
  setStage: (stage: number) => void;
  finish: () => void;
  fail: () => void;
  reset: () => void;
};

export const useExecutionStore = create<ExecutionStore>((set) => ({
  active: false,
  stage: -1,
  complete: false,
  failed: false,
  begin: () => set({ active: true, stage: 0, complete: false, failed: false }),
  setStage: (stage) => set((s) => ({ stage: Math.max(s.stage, stage) })),
  finish: () => set({ stage: STAGE_COUNT - 1, complete: true }),
  fail: () => set({ failed: true }),
  reset: () => set({ active: false, stage: -1, complete: false, failed: false }),
}));
