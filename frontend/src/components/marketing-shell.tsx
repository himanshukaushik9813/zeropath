"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

// Landing (marketing) navigation ONLY. The application navigation does not
// exist here — it lives entirely inside the /app shell.
const navItems = [
  { href: "/", label: "Home" },
  { href: "/operate", label: "Operate" },
  { href: "/proof", label: "Proof" },
  { href: "/explorer", label: "Explorer" },
  { href: "/about", label: "About" },
] as const;

export function MarketingShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  // Glass-morph the nav once the page leaves the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="company-shell marketing-shell">
      <header className={`hq-nav marketing-nav${scrolled ? " scrolled" : ""}`} aria-label="ZeroPath navigation">
        <Link className="hq-logo" href="/">
          <span aria-hidden="true" />
          ZeroPath
        </Link>
        <nav className="hq-nav-center" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "active" : ""}
                href={item.href}
                key={item.href}
              >
                {item.label}
                {isActive ? <motion.i layoutId="active-nav" transition={{ duration: 0.25 }} /> : null}
              </Link>
            );
          })}
        </nav>
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
