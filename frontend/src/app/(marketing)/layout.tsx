import { MarketingShell } from "@/components/marketing-shell";

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <MarketingShell>{children}</MarketingShell>;
}
