"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTransitionStore } from "@/store/transition-store";

/**
 * Full-screen glass-morph transition rendered in the root layout so it survives
 * the /  <->  /app route change. Blur + fade + slight zoom, Apple-style easing.
 */
export function LaunchOverlay() {
  const mode = useTransitionStore((state) => state.mode);

  return (
    <AnimatePresence>
      {mode ? (
        <motion.div
          key="launch-overlay"
          className="launch-overlay"
          initial={{ opacity: 0, backdropFilter: "blur(0px)", scale: 1.02 }}
          animate={{ opacity: 1, backdropFilter: "blur(22px)", scale: 1 }}
          exit={{ opacity: 0, backdropFilter: "blur(0px)", scale: 1.04 }}
          transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          <motion.div
            className="launch-overlay-mark"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="launch-overlay-glyph" />
            <strong>{mode === "launch" ? "Entering ZeroPath OS" : "Returning"}</strong>
            <small>{mode === "launch" ? "Initializing mission control…" : "Back to the story"}</small>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
