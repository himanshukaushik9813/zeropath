"use client";

import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { MISSION_STAGES, useExecutionStore } from "@/store/execution-store";

/**
 * The mission timeline: an animated execution pipeline. Each stage moves from
 * idle → running (glow + pulse) → done (fill + check). Never instant.
 */
export function MissionTimeline() {
  const active = useExecutionStore((s) => s.active);
  const stage = useExecutionStore((s) => s.stage);
  const complete = useExecutionStore((s) => s.complete);
  const failed = useExecutionStore((s) => s.failed);

  return (
    <div className={active ? "mission active" : "mission"} aria-label="Execution timeline">
      {MISSION_STAGES.map((label, i) => {
        const done = i < stage || (complete && i <= stage);
        const running = active && !complete && i === stage && !failed;
        const state = done ? "done" : running ? "run" : "idle";
        const isLast = i === MISSION_STAGES.length - 1;

        return (
          <div className="mission-row" key={label}>
            <div className="mission-rail">
              <motion.div
                className={`mission-node ${state}`}
                animate={
                  running
                    ? { scale: [1, 1.18, 1], boxShadow: ["0 0 0 rgba(255,139,61,0)", "0 0 22px rgba(255,139,61,0.65)", "0 0 0 rgba(255,139,61,0)"] }
                    : { scale: 1 }
                }
                transition={running ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : { duration: 0.3 }}
                data-sfx={running ? "stage-active" : done ? "stage-complete" : undefined}
              >
                {done ? <Check size={12} /> : running ? <Loader2 size={12} className="spin" /> : <span className="mission-dot" />}
              </motion.div>
              {!isLast ? <span className={i < stage ? "mission-line filled" : "mission-line"} /> : null}
            </div>
            <motion.div
              className={`mission-label ${state}`}
              initial={false}
              animate={{ opacity: state === "idle" ? 0.38 : 1, x: running ? 2 : 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="mission-index">{String(i + 1).padStart(2, "0")}</span>
              <span className="mission-name">{label}</span>
              {running ? <span className="mission-status">executing…</span> : done ? <span className="mission-status ok">done</span> : null}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
