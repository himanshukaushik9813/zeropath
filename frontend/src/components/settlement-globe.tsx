"use client";

import { SettlementGlobe3D } from "@/components/settlement-globe-3d";
import type { PrivacyAnalytics, ProtocolPhase, RegionActivity, RegionId, RouteLeg } from "@/lib/protocol-engine";

type SettlementGlobeProps = {
  noWebGL: boolean;
  onSelectRegion: (regionId: RegionId) => void;
  phase: ProtocolPhase;
  regions: RegionActivity[];
  route: RouteLeg[];
  selectedRegionId: RegionId;
};

const fallbackAnalytics: PrivacyAnalytics = {
  anonymitySet: 42180,
  complianceScore: 82,
  feeBps: 12,
  latencySeconds: 24,
  poolSizeUsd: 264_000_000,
  privacyScore: 94,
  proofVerifications: 921_532,
  routeAvailability: 76,
  settlementCount: 184_212,
};

export function SettlementGlobe(props: SettlementGlobeProps) {
  return (
    <SettlementGlobe3D
      {...props}
      analytics={fallbackAnalytics}
      reducedMotion={props.noWebGL}
      solverName="Northstar"
      variant="network"
    />
  );
}
