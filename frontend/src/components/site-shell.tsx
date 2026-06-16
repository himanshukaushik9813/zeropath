"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/operate", label: "Operate" },
  { href: "/proof", label: "Proof" },
  { href: "/network", label: "Network" },
  { href: "/compliance", label: "Compliance" },
  { href: "/solvers", label: "Solvers" },
  { href: "/explorer", label: "Explorer" },
  { href: "/about", label: "About" },
] as const;

export function SiteShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="company-shell">
      <header className="hq-nav" aria-label="ZeroPath navigation">
        <Link className="hq-logo" href="/">
          <span aria-hidden="true" />
          ZeroPath
        </Link>
        <nav className="hq-nav-center" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link aria-current={isActive ? "page" : undefined} className={isActive ? "active" : ""} href={item.href} key={item.href}>
                {item.label}
                {isActive ? <motion.i layoutId="active-nav" transition={{ duration: 0.25 }} /> : null}
              </Link>
            );
          })}
        </nav>
        <Link className="launch-cta" href="/operate">
          Launch App
          <ArrowUpRight size={14} />
        </Link>
      </header>
      <motion.main
        animate={{ opacity: 1, y: 0 }}
        className="hq-page"
        initial={{ opacity: 0, y: 14 }}
        key={pathname}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.main>
    </div>
  );
}
