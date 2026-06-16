"use client";

import { Canvas } from "@react-three/fiber";

function SceneFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="r3f-stage" aria-label={label}>
      <Canvas camera={{ fov: 38, position: [0, 0.4, 7] }} dpr={[1, 1]} frameloop="demand" gl={{ antialias: true, alpha: true }}>
        <color args={["#030405"]} attach="background" />
        <ambientLight intensity={0.72} />
        <spotLight angle={0.42} intensity={3.4} penumbra={0.62} position={[4, 5, 5]} />
        <pointLight color="#ff8b3d" intensity={1.4} position={[-3, -2, 3]} />
        {children}
      </Canvas>
      <div className="scene-caption">{label}</div>
    </div>
  );
}

export function SettlementCoreScene() {
  return (
    <SceneFrame label="3D settlement core">
      <group rotation={[0.05, -0.3, 0]}>
          <mesh rotation={[0.28, -0.56, 0.18]}>
            <boxGeometry args={[2.15, 2.15, 2.15]} />
            <meshPhysicalMaterial
              clearcoat={1}
              clearcoatRoughness={0.2}
              color="#08090b"
              metalness={0.92}
              roughness={0.24}
            />
          </mesh>
          <mesh rotation={[0.28, -0.56, 0.18]} scale={[1.015, 1.015, 1.015]}>
            <boxGeometry args={[2.15, 2.15, 2.15]} />
            <meshBasicMaterial color="#ffffff" opacity={0.08} transparent wireframe />
          </mesh>
          <CoreRings />
      </group>
    </SceneFrame>
  );
}

export function ProofEngineScene() {
  return (
    <SceneFrame label="3D BN254 proof engine">
      <group rotation={[0.1, -0.26, 0]}>
          <group>
            {[-2.1, -1.25, -0.35, 0.55, 1.45, 2.25].map((x, index) => (
              <mesh key={x} position={[x, index % 2 ? 0.35 : -0.25, 0]} rotation={[0.75, 0, 0.72]}>
                <boxGeometry args={[0.42, 0.42, 0.42]} />
                <meshPhysicalMaterial color="#0e1014" metalness={0.84} roughness={0.28} clearcoat={1} />
              </mesh>
            ))}
            {[-1.65, -0.8, 0.1, 1.0, 1.85].map((x) => (
              <mesh key={x} position={[x, 0.04, -0.02]} rotation={[0, 0, -0.18]}>
                <boxGeometry args={[0.72, 0.018, 0.018]} />
                <meshBasicMaterial color="#ff8b3d" opacity={0.72} transparent />
              </mesh>
            ))}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.48, 0.014, 16, 96]} />
              <meshBasicMaterial color="#ffffff" opacity={0.34} transparent />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0.75]}>
              <torusGeometry args={[2.22, 0.01, 16, 96]} />
              <meshBasicMaterial color="#ff8b3d" opacity={0.44} transparent />
            </mesh>
          </group>
      </group>
    </SceneFrame>
  );
}

export function ComplianceRingsScene() {
  return (
    <SceneFrame label="3D compliance policy engine">
      <group rotation={[0.12, -0.28, 0]}>
        {[0.9, 1.38, 1.86, 2.34].map((radius, index) => (
          <mesh key={radius} rotation={[Math.PI / 2, index * 0.4, index * 0.22]}>
            <torusGeometry args={[radius, 0.018, 14, 100]} />
            <meshBasicMaterial color={index === 2 ? "#ff8b3d" : "#f7f8f8"} opacity={index === 2 ? 0.64 : 0.24} transparent />
          </mesh>
        ))}
        <mesh>
          <icosahedronGeometry args={[0.62, 1]} />
          <meshPhysicalMaterial color="#0b0d10" clearcoat={1} metalness={0.88} roughness={0.22} />
        </mesh>
      </group>
    </SceneFrame>
  );
}

function CoreRings() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.28, 0.014, 12, 120]} />
        <meshBasicMaterial color="#ffffff" opacity={0.28} transparent />
      </mesh>
      <mesh rotation={[1.18, 0.45, 0.18]}>
        <torusGeometry args={[2.76, 0.01, 12, 120]} />
        <meshBasicMaterial color="#ff8b3d" opacity={0.48} transparent />
      </mesh>
      <mesh rotation={[0.86, -0.66, -0.34]}>
        <torusGeometry args={[3.05, 0.01, 12, 120]} />
        <meshBasicMaterial color="#ffffff" opacity={0.18} transparent />
      </mesh>
    </group>
  );
}
