export type Asset = "ETH" | "USDC";

export type BridgeMode = "deposit" | "withdraw";

export type Page = "bridge" | "activity" | "about";

export type BridgeNote = {
  version: 1;
  asset: Asset;
  amount: string;
  destination: string;
  secret: string;
  nullifier: string;
  commitment: string;
  createdAt: string;
};

export type ActivityItem = {
  id: string;
  kind: "deposit" | "withdrawal";
  asset: Asset;
  amount: string;
  status: "prepared" | "pending" | "proving" | "verified" | "complete";
  commitment?: string;
  nullifier?: string;
  destination?: string;
  txHash?: string;
  createdAt: string;
};
