"use client";

import { create } from "zustand";

/**
 * Drives the premium full-screen transition between the marketing site (/) and
 * the application (/app). Lives at the root layout so the overlay persists
 * across the route change (marketing shell unmounts, app shell mounts).
 */
type TransitionStore = {
  /** "launch" = entering the app, "exit" = returning to marketing, null = idle. */
  mode: "launch" | "exit" | null;
  start: (mode: "launch" | "exit") => void;
  clear: () => void;
};

export const useTransitionStore = create<TransitionStore>((set) => ({
  mode: null,
  start: (mode) => set({ mode }),
  clear: () => set({ mode: null }),
}));
