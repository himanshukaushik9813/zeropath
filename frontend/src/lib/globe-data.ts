import type { ChainId, RegionId, RouteLeg } from "@/lib/protocol-engine";

export type GlobeNode = {
  id: ChainId;
  label: string;
  short: string;
  lat: number;
  lon: number;
  region: RegionId;
};

export type GlobeRouteSpec = {
  id: string;
  label: string;
  path: ChainId[];
  priority: number;
};

export type GlobeRegionAnchor = {
  id: RegionId;
  label: string;
  lat: number;
  lon: number;
};

export const globeNodes: Record<ChainId, GlobeNode> = {
  ethereum: { id: "ethereum", label: "Ethereum", short: "ETH", lat: 40.72, lon: -74.0, region: "americas" },
  stellar: { id: "stellar", label: "Stellar", short: "XLM", lat: 46.2, lon: 6.15, region: "europe" },
  solana: { id: "solana", label: "Solana", short: "SOL", lat: 1.35, lon: 103.82, region: "apac" },
  base: { id: "base", label: "Base", short: "BASE", lat: 37.77, lon: -122.42, region: "americas" },
  polygon: { id: "polygon", label: "Polygon", short: "POL", lat: 19.07, lon: 72.88, region: "apac" },
  arbitrum: { id: "arbitrum", label: "Arbitrum", short: "ARB", lat: 51.5, lon: -0.12, region: "europe" },
};

export const regionAnchors: Record<RegionId, GlobeRegionAnchor> = {
  americas: { id: "americas", label: "Americas", lat: 31, lon: -99 },
  europe: { id: "europe", label: "Europe", lat: 50, lon: 12 },
  apac: { id: "apac", label: "APAC", lat: 16, lon: 105 },
  mena: { id: "mena", label: "MENA", lat: 25, lon: 45 },
};

const canonicalRoutes: GlobeRouteSpec[] = [
  { id: "ethereum-stellar-solana", label: "Ethereum to Stellar to Solana", path: ["ethereum", "stellar", "solana"], priority: 1 },
  { id: "base-stellar-polygon", label: "Base to Stellar to Polygon", path: ["base", "stellar", "polygon"], priority: 0.72 },
  { id: "arbitrum-stellar-ethereum", label: "Arbitrum to Stellar to Ethereum", path: ["arbitrum", "stellar", "ethereum"], priority: 0.62 },
];

export function getGlobeRouteSpecs(route: RouteLeg[]) {
  const activePath = getPathFromRoute(route);
  const activeKey = getRouteKey(activePath);
  const routes = canonicalRoutes.map((item) => ({
    ...item,
    active: item.id === activeKey,
  }));

  if (activePath.length > 1 && !routes.some((item) => item.id === activeKey)) {
    routes.unshift({
      id: activeKey,
      label: activePath.map((item) => globeNodes[item].label).join(" to "),
      path: activePath,
      priority: 1,
      active: true,
    });
  }

  return routes;
}

export function getPathFromRoute(route: RouteLeg[]) {
  const finalLeg = route[route.length - 1];
  if (!finalLeg) return canonicalRoutes[0].path;
  return route.map((leg) => leg.from).concat(finalLeg.to);
}

function getRouteKey(path: ChainId[]) {
  return path.join("-");
}
