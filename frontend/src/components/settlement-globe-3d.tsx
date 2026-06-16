"use client";

import Image from "next/image";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, Preload } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import globalSettlementGlobe from "@/assets/visuals/global-settlement-globe.png";
import {
  getGlobeRouteSpecs,
  globeNodes,
  regionAnchors,
  type GlobeRouteSpec,
} from "@/lib/globe-data";
import { formatUsd, type PrivacyAnalytics, type ProtocolPhase, type RegionActivity, type RegionId, type RouteLeg } from "@/lib/protocol-engine";

type SettlementGlobe3DProps = {
  analytics: PrivacyAnalytics;
  noWebGL: boolean;
  onSelectRegion: (regionId: RegionId) => void;
  phase: ProtocolPhase;
  reducedMotion: boolean;
  regions: RegionActivity[];
  route: RouteLeg[];
  selectedRegionId: RegionId;
  solverName: string;
  variant?: "hero" | "network";
};

type ComputedRoute = GlobeRouteSpec & {
  active?: boolean;
  curve: THREE.Vector3[];
};

const EARTH_RADIUS = 2.08;
const ATMOSPHERE_RADIUS = 2.22;
const NODE_RADIUS = 2.17;
const ROUTE_RADIUS = 2.24;

const phaseIntensity: Record<ProtocolPhase, number> = {
  idle: 0.42,
  deposit: 0.58,
  commitment: 0.68,
  proof: 0.8,
  verify: 0.94,
  settlement: 1,
  complete: 0.82,
};

export function SettlementGlobe3D(props: SettlementGlobe3DProps) {
  const webglSupported = useWebGLSupport();
  const selectedRegion = props.regions.find((region) => region.id === props.selectedRegionId) ?? props.regions[0];

  if (props.noWebGL || !webglSupported) {
    return <GlobeFallback {...props} selectedRegion={selectedRegion} />;
  }

  return (
    <section className={`settlement-globe-v2 variant-${props.variant ?? "network"}`} aria-label="Civilization-scale private settlement globe">
      <div className="globe-canvas-shell">
        <Canvas
          camera={{ fov: 34, position: [0, 0.24, 7.45] }}
          dpr={[1, 1.45]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
            stencil: false,
          }}
        >
          <color args={["#010203"]} attach="background" />
          <fog attach="fog" args={["#010203", 6.2, 12.2]} />
          <GlobeScene {...props} selectedRegion={selectedRegion} />
          <EffectComposer enableNormalPass={false} multisampling={0}>
            <Bloom intensity={0.74} luminanceSmoothing={0.42} luminanceThreshold={0.16} mipmapBlur />
            <Vignette darkness={0.72} offset={0.18} />
          </EffectComposer>
          <Preload all />
        </Canvas>
        <RegionSelector
          onSelectRegion={props.onSelectRegion}
          regions={props.regions}
          selectedRegionId={props.selectedRegionId}
        />
        <HudPanel analytics={props.analytics} selectedRegion={selectedRegion} solverName={props.solverName} />
      </div>
    </section>
  );
}

const GlobeScene = memo(function GlobeScene({
  analytics,
  onSelectRegion,
  phase,
  reducedMotion,
  regions,
  route,
  selectedRegion,
  selectedRegionId,
}: SettlementGlobe3DProps & { selectedRegion: RegionActivity }) {
  const groupRef = useRef<THREE.Group>(null);
  const earthMaterial = useEarthMaterial(phase);
  const atmosphereMaterial = useAtmosphereMaterial();
  const particleMaterial = useLandParticleMaterial();
  const quality = useMemo(getGlobeQuality, []);
  const landGeometry = useMemo(() => buildLandParticleGeometry(quality.landPoints), [quality.landPoints]);
  const routes = useMemo(() => buildComputedRoutes(route), [route]);
  const regionHeat = useMemo(() => buildRegionHeat(regions), [regions]);
  const disposableResources = useMemo(
    () => [landGeometry, earthMaterial, atmosphereMaterial, particleMaterial],
    [atmosphereMaterial, earthMaterial, landGeometry, particleMaterial]
  );

  useDispose(disposableResources);

  useFrame(({ camera, clock, pointer }, delta) => {
    const time = clock.getElapsedTime();
    earthMaterial.uniforms.uTime.value = time;
    atmosphereMaterial.uniforms.uTime.value = time;
    particleMaterial.uniforms.uTime.value = time;
    particleMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 1.45);

    if (!groupRef.current) return;

    const phaseLift = phaseIntensity[phase];
    const targetY = -0.64 + (reducedMotion ? 0 : time * 0.026) + pointer.x * 0.1;
    const targetX = 0.03 + pointer.y * 0.045;
    groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, targetY, 1.8, delta);
    groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, targetX, 1.8, delta);
    groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, -0.07, 1.6, delta);

    if (!reducedMotion) {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, pointer.x * 0.18, 2.2, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, 0.24 + pointer.y * 0.12, 2.2, delta);
      camera.lookAt(0, 0, 0);
    }

    earthMaterial.uniforms.uPhase.value = phaseLift;
    atmosphereMaterial.uniforms.uPhase.value = phaseLift;
  });

  return (
    <>
      <ambientLight intensity={0.24} />
      <directionalLight color="#f6f1e8" intensity={2.9} position={[4.5, 2.6, 5.2]} />
      <pointLight color="#ff9b45" intensity={1.85} position={[-3.3, -1.4, 3.2]} />
      <pointLight color="#ffffff" intensity={0.82} position={[0.8, 2.8, -2.6]} />
      <CameraRig reducedMotion={reducedMotion} />
      <group ref={groupRef}>
        <mesh>
          <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
          <primitive attach="material" object={earthMaterial} />
        </mesh>
        <points geometry={landGeometry}>
          <primitive attach="material" object={particleMaterial} />
        </points>
        <mesh scale={1.004}>
          <sphereGeometry args={[EARTH_RADIUS + 0.012, 96, 96]} />
          <meshBasicMaterial color="#ffffff" opacity={0.025} transparent wireframe />
        </mesh>
        <mesh>
          <sphereGeometry args={[ATMOSPHERE_RADIUS, 96, 96]} />
          <primitive attach="material" object={atmosphereMaterial} />
        </mesh>
        <SettlementRoutes phase={phase} reducedMotion={reducedMotion} routes={routes} />
        <SettlementNodes analytics={analytics} phase={phase} routes={routes} selectedRegion={selectedRegion} />
        {Object.values(regionAnchors).map((anchor) => {
          const heat = regionHeat[anchor.id] ?? 0.5;
          return (
            <RegionHeatBeacon
              active={anchor.id === selectedRegionId}
              anchor={anchor}
              heat={heat}
              key={anchor.id}
            />
          );
        })}
      </group>
    </>
  );
});

function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 0.24, 7.45);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const time = clock.getElapsedTime();
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 7.26 + Math.sin(time * 0.12) * 0.16, 0.015);
  });

  return null;
}

function SettlementRoutes({
  phase,
  reducedMotion,
  routes,
}: {
  phase: ProtocolPhase;
  reducedMotion: boolean;
  routes: ComputedRoute[];
}) {
  return (
    <group>
      {routes.map((route, index) => {
        const opacity = route.active ? 0.76 : 0.23 + route.priority * 0.15;
        return (
          <group key={route.id}>
            <Line
              blending={THREE.AdditiveBlending}
              color={route.active ? "#ffb15e" : "#f6f1e8"}
              depthWrite={false}
              lineWidth={route.active ? 1.35 : 0.72}
              opacity={opacity}
              points={route.curve}
              transparent
            />
            <Line
              blending={THREE.AdditiveBlending}
              color={route.active ? "#ffffff" : "#ff9b45"}
              depthWrite={false}
              lineWidth={route.active ? 3.4 : 1.6}
              opacity={route.active ? 0.12 : 0.055}
              points={route.curve}
              transparent
            />
            <RoutePacket
              color={route.active ? "#ffffff" : "#ffad54"}
              offset={index * 0.24}
              phase={phase}
              reducedMotion={reducedMotion}
              route={route}
            />
            <RoutePacket
              color="#ff8b3d"
              offset={index * 0.24 + 0.48}
              phase={phase}
              reducedMotion={reducedMotion}
              route={route}
              secondary
            />
          </group>
        );
      })}
    </group>
  );
}

function SettlementNodes({
  analytics,
  phase,
  routes,
  selectedRegion,
}: {
  analytics: PrivacyAnalytics;
  phase: ProtocolPhase;
  routes: ComputedRoute[];
  selectedRegion: RegionActivity;
}) {
  const activeNodeIds = new Set(routes.flatMap((route) => route.path));

  return (
    <group>
      {Object.values(globeNodes).map((node) => {
        const activity = activeNodeIds.has(node.id) ? 1 : 0.55;
        const regionBias = node.region === selectedRegion.id ? 0.18 : 0;
        return (
          <NodeBeacon
            active={activeNodeIds.has(node.id)}
            intensity={activity + regionBias + analytics.privacyScore / 420}
            key={node.id}
            lat={node.lat}
            lon={node.lon}
            phase={phase}
          />
        );
      })}
    </group>
  );
}

function NodeBeacon({
  active,
  intensity,
  lat,
  lon,
  phase,
}: {
  active: boolean;
  intensity: number;
  lat: number;
  lon: number;
  phase: ProtocolPhase;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const position = useMemo(() => latLonToVector3(lat, lon, NODE_RADIUS), [lat, lon]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const pulse = active ? 1 + Math.sin(time * 2.2 + lat) * 0.16 : 1;
    const phaseBoost = phase === "settlement" || phase === "complete" ? 1.18 : 1;
    ref.current?.scale.setScalar((0.72 + intensity * 0.48) * pulse * phaseBoost);
    glowRef.current?.scale.setScalar((1.7 + intensity * 1.3) * pulse);
  });

  return (
    <group position={position}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.055, 24, 24]} />
        <meshBasicMaterial blending={THREE.AdditiveBlending} color="#ff8b3d" depthWrite={false} opacity={active ? 0.34 : 0.16} transparent />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[0.024, 24, 24]} />
        <meshBasicMaterial color={active ? "#ffffff" : "#ffb45c"} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RoutePacket({
  color,
  offset,
  phase,
  reducedMotion,
  route,
  secondary,
}: {
  color: string;
  offset: number;
  phase: ProtocolPhase;
  reducedMotion: boolean;
  route: ComputedRoute;
  secondary?: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const trailRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ref.current || !trailRef.current) return;
    const speed = route.active ? 0.092 : 0.055;
    const phaseBoost = phase === "idle" ? 0.22 : phaseIntensity[phase];
    const progress = reducedMotion ? 0.62 : (clock.getElapsedTime() * speed + offset) % 1;
    const position = samplePolyline(route.curve, progress);
    ref.current.position.copy(position);
    trailRef.current.position.copy(position);
    const packetScale = (secondary ? 0.62 : 1) * (route.active ? 1.0 : 0.68) * (0.76 + phaseBoost * 0.5);
    ref.current.scale.setScalar(packetScale);
    trailRef.current.scale.setScalar(packetScale * 2.8);
  });

  return (
    <group>
      <mesh ref={trailRef}>
        <sphereGeometry args={[0.04, 18, 18]} />
        <meshBasicMaterial blending={THREE.AdditiveBlending} color={color} depthWrite={false} opacity={route.active ? 0.18 : 0.08} transparent />
      </mesh>
      <mesh ref={ref}>
        <sphereGeometry args={[0.024, 18, 18]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RegionHeatBeacon({
  active,
  anchor,
  heat,
}: {
  active: boolean;
  anchor: { id: RegionId; label: string; lat: number; lon: number };
  heat: number;
}) {
  const glowRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const position = useMemo(() => latLonToVector3(anchor.lat, anchor.lon, NODE_RADIUS + 0.05), [anchor.lat, anchor.lon]);

  useFrame(({ clock }) => {
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 1.35 + heat * 3.4) * 0.12;
    glowRef.current?.scale.setScalar((2.2 + heat * 1.2) * pulse);
    coreRef.current?.scale.setScalar((0.82 + heat * 0.4) * pulse);
  });

  return (
    <group position={position}>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.044, 24, 24]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color={active ? "#ffffff" : "#ff8b3d"}
          depthWrite={false}
          opacity={active ? 0.28 : 0.15 + heat * 0.08}
          transparent
        />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.018, 18, 18]} />
        <meshBasicMaterial color={active ? "#ffffff" : "#ff9b45"} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RegionSelector({
  onSelectRegion,
  regions,
  selectedRegionId,
}: {
  onSelectRegion: (regionId: RegionId) => void;
  regions: RegionActivity[];
  selectedRegionId: RegionId;
}) {
  return (
    <div className="globe-region-selector" aria-label="Settlement regions">
      {regions.map((region) => (
        <button
          aria-pressed={selectedRegionId === region.id}
          className={selectedRegionId === region.id ? "globe-region-chip active" : "globe-region-chip"}
          key={region.id}
          onClick={() => onSelectRegion(region.id)}
          type="button"
        >
          <span>{region.label}</span>
          <strong>{region.privacyActivity}/100</strong>
        </button>
      ))}
    </div>
  );
}

function HudPanel({
  analytics,
  selectedRegion,
  solverName,
}: {
  analytics: PrivacyAnalytics;
  selectedRegion: RegionActivity;
  solverName: string;
}) {
  const metrics = [
    ["Settlement Volume", formatUsd(selectedRegion.volumeUsd)],
    ["Proofs Verified", analytics.proofVerifications.toLocaleString()],
    ["Active Solvers", solverName],
    ["Privacy Score", `${analytics.privacyScore}/100`],
    ["Latency", `${analytics.latencySeconds}s`],
  ];

  return (
    <div className="settlement-hud" aria-label="Live settlement telemetry">
      {metrics.map(([label, value]) => (
        <div className="hud-metric" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function GlobeFallback({
  analytics,
  onSelectRegion,
  phase,
  regions,
  selectedRegion,
  selectedRegionId,
  solverName,
}: SettlementGlobe3DProps & { selectedRegion: RegionActivity }) {
  return (
    <section className="settlement-globe-v2 no-webgl" aria-label="Global private settlement globe fallback">
      <div className="globe-fallback-stage">
        <Image
          alt="Global private settlement network"
          className="globe-fallback-image"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 54vw"
          src={globalSettlementGlobe}
        />
        <span className={`fallback-route phase-${phase}`} aria-hidden="true" />
        <div className="fallback-region-row" aria-label="Settlement regions">
          {regions.map((region) => (
            <button
              aria-pressed={selectedRegionId === region.id}
              className={selectedRegionId === region.id ? "fallback-region active" : "fallback-region"}
              key={region.id}
              onClick={() => onSelectRegion(region.id)}
              type="button"
            >
              <span>{region.label}</span>
              <strong>{region.privacyActivity}/100</strong>
            </button>
          ))}
        </div>
        <HudPanel analytics={analytics} selectedRegion={selectedRegion} solverName={solverName} />
      </div>
    </section>
  );
}

function useWebGLSupport() {
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    setSupported(Boolean(context));
  }, []);

  return supported;
}

function useEarthMaterial(phase: ProtocolPhase) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uPhase: { value: phaseIntensity[phase] },
          uTime: { value: 0 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          varying vec2 vUv;

          void main() {
            vNormal = normalize(normalMatrix * normal);
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uPhase;
          uniform float uTime;
          varying vec3 vNormal;
          varying vec3 vWorldPosition;
          varying vec2 vUv;

          void main() {
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.35);
            float grid = smoothstep(0.985, 1.0, sin((vUv.x + uTime * 0.0012) * 360.0) * 0.5 + 0.5) * 0.028;
            float latitude = smoothstep(0.988, 1.0, sin(vUv.y * 220.0) * 0.5 + 0.5) * 0.022;
            vec3 base = vec3(0.006, 0.010, 0.014);
            vec3 metal = vec3(0.025, 0.032, 0.04) * (0.52 + fresnel * 1.8);
            vec3 warm = vec3(1.0, 0.43, 0.13) * fresnel * 0.18 * uPhase;
            vec3 color = base + metal + warm + vec3(grid + latitude);
            gl_FragColor = vec4(color, 0.92);
          }
        `,
        transparent: true,
      }),
    [phase]
  );
}

function useAtmosphereMaterial() {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide,
        transparent: true,
        uniforms: {
          uPhase: { value: 0.6 },
          uTime: { value: 0 },
        },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vWorldPosition;

          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uPhase;
          varying vec3 vNormal;
          varying vec3 vWorldPosition;

          void main() {
            vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
            float edge = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.0);
            vec3 color = mix(vec3(0.12, 0.18, 0.22), vec3(1.0, 0.48, 0.16), uPhase * 0.34);
            gl_FragColor = vec4(color, edge * 0.58);
          }
        `,
      }),
    []
  );
}

function useLandParticleMaterial() {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        uniforms: {
          uPixelRatio: { value: 1 },
          uTime: { value: 0 },
        },
        vertexShader: `
          attribute float intensity;
          varying vec3 vColor;
          varying float vIntensity;
          uniform float uPixelRatio;
          uniform float uTime;

          void main() {
            vColor = color;
            vIntensity = intensity;
            vec3 animatedPosition = position * (1.0 + sin(uTime * 0.22 + intensity * 6.2831) * 0.0018);
            vec4 mvPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
            gl_PointSize = clamp((0.52 + intensity * 1.05) * uPixelRatio * (220.0 / -mvPosition.z), 0.45, 2.05);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying vec3 vColor;
          varying float vIntensity;

          void main() {
            float dist = length(gl_PointCoord - vec2(0.5));
            if (dist > 0.5) discard;
            float alpha = smoothstep(0.5, 0.04, dist) * (0.18 + vIntensity * 0.24);
            gl_FragColor = vec4(vColor, alpha);
          }
        `,
        vertexColors: true,
      }),
    []
  );
}

function useDispose(items: Array<THREE.Material | THREE.BufferGeometry>) {
  useEffect(
    () => () => {
      items.forEach((item) => item.dispose());
    },
    [items]
  );
}

function buildComputedRoutes(route: RouteLeg[]): ComputedRoute[] {
  return getGlobeRouteSpecs(route).map((spec) => {
    const curve = buildRouteCurve(spec.path);
    return { ...spec, curve };
  });
}

function buildRouteCurve(path: GlobeRouteSpec["path"]) {
  const points: THREE.Vector3[] = [];
  path.slice(0, -1).forEach((from, index) => {
    const to = path[index + 1];
    const leg = greatCirclePoints(globeNodes[from].lat, globeNodes[from].lon, globeNodes[to].lat, globeNodes[to].lon, ROUTE_RADIUS, 42);
    points.push(...(index === 0 ? leg : leg.slice(1)));
  });
  return points;
}

function greatCirclePoints(fromLat: number, fromLon: number, toLat: number, toLon: number, radius: number, segments: number) {
  const start = latLonToVector3(fromLat, fromLon, 1).normalize();
  const end = latLonToVector3(toLat, toLon, 1).normalize();
  const angle = start.angleTo(end);
  return Array.from({ length: segments + 1 }, (_, index) => {
    const t = index / segments;
    const sinTotal = Math.sin(angle);
    const vector =
      sinTotal < 0.0001
        ? start.clone()
        : start
            .clone()
            .multiplyScalar(Math.sin((1 - t) * angle) / sinTotal)
            .add(end.clone().multiplyScalar(Math.sin(t * angle) / sinTotal))
            .normalize();
    const lift = Math.sin(Math.PI * t) * 0.28;
    return vector.multiplyScalar(radius + lift);
  });
}

function samplePolyline(points: THREE.Vector3[], progress: number) {
  const index = Math.min(points.length - 2, Math.max(0, Math.floor(progress * (points.length - 1))));
  const local = progress * (points.length - 1) - index;
  return points[index].clone().lerp(points[index + 1], local);
}

function buildLandParticleGeometry(pointCount: number) {
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const intensity = new Float32Array(pointCount);
  let cursor = 0;
  let attempt = 0;

  while (cursor < pointCount && attempt < pointCount * 9) {
    const u = halton(attempt + 17, 2);
    const v = halton(attempt + 31, 3);
    const lon = u * 360 - 180;
    const lat = Math.asin(v * 2 - 1) * (180 / Math.PI);
    const land = landMask(lat, lon);
    attempt += 1;
    if (land <= 0) continue;

    const jitterLat = (halton(attempt + 73, 5) - 0.5) * 0.34;
    const jitterLon = (halton(attempt + 97, 7) - 0.5) * 0.34;
    const point = latLonToVector3(lat + jitterLat, lon + jitterLon, EARTH_RADIUS + 0.022 + land * 0.008);
    positions[cursor * 3] = point.x;
    positions[cursor * 3 + 1] = point.y;
    positions[cursor * 3 + 2] = point.z;

    const heat = settlementHeat(lat, lon);
    colors[cursor * 3] = 0.42 + heat * 0.48;
    colors[cursor * 3 + 1] = 0.47 + heat * 0.02;
    colors[cursor * 3 + 2] = 0.5 - heat * 0.34;
    intensity[cursor] = Math.min(1, 0.18 + land * 0.46 + heat * 0.5);
    cursor += 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("intensity", new THREE.BufferAttribute(intensity, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function getGlobeQuality() {
  if (typeof window === "undefined") return { landPoints: 70000 };
  const width = window.innerWidth;
  const hardware = navigator.hardwareConcurrency ?? 6;
  if (width < 620) return { landPoints: 24000 };
  if (width < 980 || hardware <= 4) return { landPoints: 46000 };
  return { landPoints: 86000 };
}

function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

function buildRegionHeat(regions: RegionActivity[]) {
  return regions.reduce<Record<RegionId, number>>((acc, region) => {
    acc[region.id] = Math.min(1, Math.max(0.2, region.privacyActivity / 100));
    return acc;
  }, {} as Record<RegionId, number>);
}

function landMask(lat: number, lon: number) {
  const normalizedLon = normalizeLon(lon);
  const shapes = [
    ellipse(lat, normalizedLon, 48, -105, 28, 46),
    ellipse(lat, normalizedLon, 38, -83, 17, 24),
    ellipse(lat, normalizedLon, 22, -102, 12, 22),
    ellipse(lat, normalizedLon, 64, -150, 11, 23),
    ellipse(lat, normalizedLon, 15, -88, 7, 18),
    ellipse(lat, normalizedLon, -15, -60, 32, 22),
    ellipse(lat, normalizedLon, -39, -70, 17, 11),
    ellipse(lat, normalizedLon, 50, 10, 15, 28),
    ellipse(lat, normalizedLon, 62, 18, 13, 17),
    ellipse(lat, normalizedLon, 54, -3, 6, 6),
    ellipse(lat, normalizedLon, 2, 20, 34, 24),
    ellipse(lat, normalizedLon, -23, 24, 17, 18),
    ellipse(lat, normalizedLon, 42, 82, 28, 67),
    ellipse(lat, normalizedLon, 22, 78, 14, 12),
    ellipse(lat, normalizedLon, 9, 106, 13, 20),
    ellipse(lat, normalizedLon, 23, 45, 12, 18),
    ellipse(lat, normalizedLon, 37, 139, 8, 7),
    ellipse(lat, normalizedLon, -25, 134, 14, 23),
    ellipse(lat, normalizedLon, 72, -42, 14, 20),
    ellipse(lat, normalizedLon, -6, 145, 9, 13),
  ];
  return Math.max(0, Math.min(1, Math.max(...shapes)));
}

function settlementHeat(lat: number, lon: number) {
  return Math.max(
    ellipse(lat, lon, globeNodes.ethereum.lat, globeNodes.ethereum.lon, 10, 13),
    ellipse(lat, lon, globeNodes.stellar.lat, globeNodes.stellar.lon, 9, 12),
    ellipse(lat, lon, globeNodes.solana.lat, globeNodes.solana.lon, 10, 12),
    ellipse(lat, lon, globeNodes.base.lat, globeNodes.base.lon, 8, 10),
    ellipse(lat, lon, globeNodes.polygon.lat, globeNodes.polygon.lon, 9, 11),
    ellipse(lat, lon, globeNodes.arbitrum.lat, globeNodes.arbitrum.lon, 8, 10)
  );
}

function ellipse(lat: number, lon: number, centerLat: number, centerLon: number, latRadius: number, lonRadius: number) {
  const dLat = (lat - centerLat) / latRadius;
  const dLon = normalizeLon(lon - centerLon) / lonRadius;
  const value = 1 - (dLat * dLat + dLon * dLon);
  return Math.max(0, value);
}

function normalizeLon(lon: number) {
  let value = lon;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function halton(index: number, base: number) {
  let result = 0;
  let fraction = 1 / base;
  let cursor = index;
  while (cursor > 0) {
    result += fraction * (cursor % base);
    cursor = Math.floor(cursor / base);
    fraction /= base;
  }
  return result;
}
