"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeftRight,
  BrainCircuit,
  ChevronLeft,
  Cpu,
  EyeOff,
  Scale,
  Settings,
  Store,
  Wallet,
} from "lucide-react";
import { useTransitionStore } from "@/store/transition-store";
import { useExecutionStore } from "@/store/execution-store";
import { Atmosphere } from "./cinematic";

// Application navigation — mission control. This does NOT exist on the landing
// site; it only mounts once the user has entered /app.
const appNav = [
  { href: "/app/transfer", label: "Transfer", icon: ArrowLeftRight },
  { href: "/app/router", label: "AI Router", icon: BrainCircuit },
  { href: "/app/proof", label: "Proof Engine", icon: Cpu },
  { href: "/app/stealth", label: "Stealth", icon: EyeOff },
  { href: "/app/compliance", label: "Compliance", icon: Scale },
  { href: "/app/marketplace", label: "Marketplace", icon: Store },
  { href: "/app/analytics", label: "Analytics", icon: Activity },
  { href: "/app/settings", label: "Settings", icon: Settings },
  { href: "/app/wallet", label: "Wallet", icon: Wallet },
] as const;

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const start = useTransitionStore((state) => state.start);
  const clear = useTransitionStore((state) => state.clear);
  const executing = useExecutionStore((state) => state.active);
  const complete = useExecutionStore((state) => state.complete);

  // Reveal the app: dismiss the launch overlay shortly after mount so the app
  // has painted behind it (seamless handoff from the marketing site).
  useEffect(() => {
    const timer = window.setTimeout(() => clear(), 520);
    return () => window.clearTimeout(timer);
  }, [clear]);

  const exitToSite = () => {
    start("exit");
    router.prefetch("/");
    window.setTimeout(() => router.push("/"), 340);
  };

  return (
    <div className={`app-shell${executing ? " executing" : ""}${complete ? " complete" : ""}`}>
      <Atmosphere />
      <aside className="app-sidebar">
        <div className="app-brand">
          <span aria-hidden="true" />
          ZeroPath <em>OS</em>
        </div>
        <nav className="app-nav" aria-label="Application navigation">
          {appNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "app-nav-item active" : "app-nav-item"}
                href={item.href}
                key={item.href}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <button className="app-exit" onClick={exitToSite} type="button">
          <ChevronLeft size={14} /> Exit to site
        </button>
      </aside>

      <div className="app-body">
        <header className="app-topbar">
          <div className="app-status-group">
            <span className="app-status ok">
              <i /> Relayer online
            </span>
            <span className="app-status ok">
              <i /> Stellar Testnet
            </span>
            <span className="app-status warn">
              <i /> Sepolia source
            </span>
          </div>
          <div className="app-topbar-meta">
            <span className="mono">CCFZ2A3V…F3S</span>
            <span className="app-env">TESTNET</span>
          </div>
        </header>

        <motion.main
          className="app-main"
          key={pathname}
          initial={{ opacity: 0, scale: 0.985, filter: "blur(6px)" }}
          animate={{ opacity: 1, scale: executing ? 1.008 : 1, filter: "blur(0px)" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.main>
      </div>

      {/* Execution mode: ambient orange + vignette + film grain across the OS. */}
      <div className="exec-vignette" aria-hidden="true" />
      <div className="exec-ambient" aria-hidden="true" />
      <div className="exec-grain" aria-hidden="true" />
    </div>
  );
}
