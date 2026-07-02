import type { Metadata } from "next";
import { LaunchOverlay } from "@/components/launch-overlay";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZeroPath — Private Cross-Chain Settlement on Stellar",
  description:
    "ZeroPath moves value across chains privately: transfers become zero-knowledge proofs verified on-chain by a Stellar contract before funds are released.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <LaunchOverlay />
      </body>
    </html>
  );
}
