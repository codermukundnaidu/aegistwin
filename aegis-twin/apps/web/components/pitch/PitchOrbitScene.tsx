"use client";

import { Center, Html, useAnimations, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import type { RefObject } from "react";
import { Box3, Color, DoubleSide, Quaternion, Vector3 } from "three";

const REPORT_LINES = [
  "T+0.0s  OBC: CRITICAL — Thermal spike 85.4°C",
  "T+0.5s  OBC: AI coprocessor WAKE (GPIO_4 HIGH)",
  "T+1.1s  AI:  Fault diagnosed — 96.4% confidence",
  "T+1.7s  TWIN: Branch α EMERGENCY_SAFE_MODE sim",
  "T+2.0s  TWIN: Branch β RESTART_ADCS_CTRL sim",
  "T+2.8s  GATE: Branch β PASS — Temp 31°C / 7.1V",
  "T+3.9s  OBC: Template #14 EXEC — ADCS restart",
  "T+5.2s  OBC: AI entering DEEP_SLEEP (GPIO_4 LOW)",
  "T+6.1s  VERIFIED: System NOMINAL — 98.6% BW saved",
];

type PitchOrbitSceneProps = {
  transitioning: boolean;
};

const stationNormal = new Vector3(0.78, -0.34, 0.52).normalize();
const groundPosition = stationNormal.clone().multiplyScalar(1.52);
const axisY = new Vector3(0, 1, 0);
const projectedSatellite = new Vector3();
const SATELLITE_MODEL_PATH = "/models/aegis-twin-model.glb";
const EARTH_MODEL_PATH = "/models/photoreal-earth.glb";

export function PitchOrbitScene({ transitioning }: PitchOrbitSceneProps) {
  return (
    <Canvas
      className="pitch-orbit-canvas"
      camera={{ position: [0, 2.8, 6.8], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.06} />
      <hemisphereLight args={["#8ab4d4", "#020810", 0.14]} />
      <directionalLight position={[4.8, 4.2, 5.6]} color="#fff5e0" intensity={5.2} />
      <PitchWorld transitioning={transitioning} />
    </Canvas>
  );
}

function PitchWorld({ transitioning }: { transitioning: boolean }) {
  const worldRef = useRef<Group>(null);
  const earthRef = useRef<Group>(null);
  const satelliteRef = useRef<Group>(null);
  const satelliteSignalRef = useRef<Mesh>(null);
  const linkRef = useRef<Mesh>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);
  const frameRef = useRef(0);
  const { camera } = useThree();
  const orbitRadius = 2.85;

  const blackoutSecs = useRef(0);
  const fdirDone = useRef(false);
  const prevActiveRef = useRef(false);
  const satWorldPos = useRef(new Vector3());
  const transmitGuard = useRef(false);
  const transmittingRef = useRef(false);
  const [transmitting, setTransmitting] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useFrame((_, delta) => {
    frameRef.current += 1;
    const t = performance.now() * 0.00028;

    if (earthRef.current) earthRef.current.rotation.y += delta * 0.055;

    const satPosition = new Vector3(
      Math.cos(t) * orbitRadius,
      Math.sin(t * 0.72) * 0.42,
      Math.sin(t) * orbitRadius,
    );
    satelliteRef.current?.position.copy(satPosition);
    satelliteRef.current?.lookAt(0, 0, 0);
    satWorldPos.current.copy(satPosition);

    const active = satPosition.clone().normalize().dot(stationNormal) > 0.72;
    activeRef.current = active;
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;

    // ── Blackout timer & FDIR resolution ─────────────────────────────────
    if (!active) {
      blackoutSecs.current = Math.min(blackoutSecs.current + delta, 120);
      if (blackoutSecs.current >= 10 && !fdirDone.current) fdirDone.current = true;
      transmitGuard.current = false;
    } else if (!wasActive) {
      // Rising edge: satellite re-entered ground contact after a blackout
      if (blackoutSecs.current > 2 && !transmitGuard.current) {
        transmitGuard.current = true;
        transmittingRef.current = true;
        setTransmitting(true);
        setShowReport(true);
        setTimeout(() => { transmittingRef.current = false; setTransmitting(false); }, 5200);
        setTimeout(() => setShowReport(false), 11000);
      }
      blackoutSecs.current = 0;
      fdirDone.current = false;
    }

    // ── Signal sphere: green=comms · amber=fdir resolved · red=fault ─────
    if (satelliteSignalRef.current) {
      const material = satelliteSignalRef.current.material as MeshStandardMaterial;
      const target = active
        ? new Color("#10B981")
        : fdirDone.current
        ? new Color("#F59E0B")
        : new Color("#F43F5E");
      material.color.lerp(target, 0.12);
      material.emissive.lerp(target, 0.12);
      material.emissiveIntensity += ((active ? 0.26 : fdirDone.current ? 0.32 : 0.34) - material.emissiveIntensity) * 0.12;
      material.opacity += ((active ? 0.07 : 0.12) - material.opacity) * 0.12;
    }

    if (labelRef.current && frameRef.current % 8 === 0) {
      projectedSatellite.copy(satPosition).project(camera);
      const crossingPitchText = projectedSatellite.x < -0.16 && projectedSatellite.y > -0.38;
      if (active) {
        labelRef.current.dataset.state = "comms";
        labelRef.current.textContent = transmittingRef.current ? "TRANSMITTING REPORT…" : "COMMS LINK ACTIVE";
      } else if (fdirDone.current) {
        labelRef.current.dataset.state = "resolved";
        labelRef.current.textContent = `FDIR RESOLVED — ${Math.floor(blackoutSecs.current)}s`;
      } else {
        labelRef.current.dataset.state = "blackout";
        labelRef.current.textContent = `BLACKOUT ${Math.floor(blackoutSecs.current)}s`;
      }
      labelRef.current.style.opacity = crossingPitchText ? "0" : "1";
    }

    if (linkRef.current) {
      linkRef.current.visible = active;
      if (active) alignCylinder(linkRef.current, groundPosition, satPosition);
    }

    const zoomTarget = transitioning ? satPosition.clone().add(new Vector3(0.2, 0.36, 1.0)) : new Vector3(0, 2.8, 6.8);
    camera.position.lerp(zoomTarget, transitioning ? 0.055 : 0.035);
    camera.lookAt(transitioning ? satPosition : new Vector3(0, 0, 0));

    if (worldRef.current) {
      const targetScale = transitioning ? 1.32 : 1;
      worldRef.current.scale.lerp(new Vector3(targetScale, targetScale, targetScale), 0.035);
    }
  });

  return (
    <group ref={worldRef} rotation={[0.08, -0.38, 0.03]}>
      <Suspense fallback={<EarthFallback earthRef={earthRef} />}>
        <PhotorealEarth earthRef={earthRef} />
      </Suspense>
      <mesh>
        <sphereGeometry args={[1.53, 96, 96]} />
        <meshStandardMaterial color="#00F0FF" transparent opacity={0.055} emissive="#00F0FF" emissiveIntensity={0.18} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[orbitRadius, 0.006, 8, 180]} />
        <meshStandardMaterial color="#94A3B8" emissive="#00F0FF" emissiveIntensity={0.08} />
      </mesh>
      <GroundStation />
      <GroundCone />
      <mesh ref={linkRef} visible={false}>
        <cylinderGeometry args={[0.01, 0.01, 1, 12]} />
        <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={1.35} transparent opacity={0.78} />
      </mesh>
      {transmitting && [0, 0.38, 0.76, 1.14, 1.52].map((delay, i) => (
        <DataPulse key={i} satPosRef={satWorldPos} to={groundPosition} delay={delay} />
      ))}
      {showReport && (
        <Html
          position={[groundPosition.x + 0.18, groundPosition.y + 0.32, groundPosition.z]}
          distanceFactor={5.8}
          zIndexRange={[6, 0]}
        >
          <div className="pitch-report-panel">
            <div className="pitch-report-title">▼ BLACKOUT REPORT RECEIVED</div>
            {REPORT_LINES.map((line, i) => (
              <div key={i} className="pitch-report-entry" style={{ animationDelay: `${i * 0.14}s` }}>
                {line}
              </div>
            ))}
            <div className="pitch-report-footer">XAI Log: 128 B · Raw: 4.2 MB · Saved 98.6 %</div>
          </div>
        </Html>
      )}
      <group ref={satelliteRef}>
        <Suspense fallback={<PitchSatelliteFallback signalRef={satelliteSignalRef} />}>
          <PitchCubeSatModel signalRef={satelliteSignalRef} />
        </Suspense>
        <Html distanceFactor={8.6} position={[0, 0.42, 0]} zIndexRange={[2, 0]}>
          <div ref={labelRef} className="pitch-sat-label" data-state="blackout">
            BLACKOUT ZONE
          </div>
        </Html>
      </group>
      <StarField />
    </group>
  );
}

function PhotorealEarth({ earthRef }: { earthRef: RefObject<Group | null> }) {
  const animationRootRef = useRef<Group>(null);
  const { scene, animations } = useGLTF(EARTH_MODEL_PATH);
  const { actions } = useAnimations(animations, animationRootRef);
  const { model, scale } = useMemo(() => {
    const cloned = scene.clone(true);

    const bounds = new Box3().setFromObject(cloned);
    const size = new Vector3();
    bounds.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;

    return { model: cloned, scale: 3 / maxDimension };
  }, [scene]);

  useEffect(() => {
    Object.values(actions).forEach((action) => {
      action?.reset().fadeIn(0.35).play();
    });
  }, [actions]);

  return (
    <group ref={earthRef}>
      <Center>
        <group ref={animationRootRef} rotation={[0, -0.34, 0]}>
          <primitive object={model} scale={scale} />
        </group>
      </Center>
    </group>
  );
}

function EarthFallback({ earthRef }: { earthRef: RefObject<Group | null> }) {
  return (
    <group ref={earthRef}>
      <mesh>
        <sphereGeometry args={[1.5, 96, 96]} />
        <meshStandardMaterial color="#10243d" emissive="#05111f" roughness={0.62} metalness={0.04} />
      </mesh>
    </group>
  );
}

function GroundStation() {
  return (
    <group position={groundPosition} quaternion={normalQuaternion(stationNormal)}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.035, 0.06, 0.1, 16]} />
        <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={0.75} />
      </mesh>
      <Html distanceFactor={8.8} position={[0, 0.22, 0]} zIndexRange={[2, 0]}>
        <span className="pitch-ground-label">GROUND STATION</span>
      </Html>
    </group>
  );
}

function GroundCone() {
  return (
    <group position={groundPosition} quaternion={normalQuaternion(stationNormal)}>
      <mesh position={[0, 0.58, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.58, 1.12, 48, 1, true]} />
        <meshStandardMaterial color="#10B981" transparent opacity={0.18} emissive="#10B981" emissiveIntensity={0.28} side={DoubleSide} />
      </mesh>
    </group>
  );
}

function PitchCubeSatModel({ signalRef }: { signalRef: RefObject<Mesh | null> }) {
  const { scene } = useGLTF(SATELLITE_MODEL_PATH);
  const model = useMemo(() => {
    const cloned = scene.clone(true);
    return cloned;
  }, [scene]);

  return (
    <group scale={1.18} rotation={[0, Math.PI, 0]}>
      <pointLight position={[0.2, 0.35, 0.75]} color="#ffffff" intensity={0.62} distance={1.8} decay={1.1} />
      <mesh ref={signalRef}>
        <sphereGeometry args={[0.72, 24, 24]} />
        <meshStandardMaterial color="#F43F5E" emissive="#F43F5E" emissiveIntensity={0.34} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <Center>
        <primitive object={model} />
      </Center>
    </group>
  );
}

function PitchSatelliteFallback({ signalRef }: { signalRef: RefObject<Mesh | null> }) {
  return (
    <group scale={0.34}>
      <mesh ref={signalRef}>
        <sphereGeometry args={[0.62, 18, 18]} />
        <meshStandardMaterial color="#F43F5E" emissive="#F43F5E" emissiveIntensity={1.08} transparent opacity={0.34} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.42]} />
        <meshStandardMaterial color="#CBD5E1" emissive="#00F0FF" emissiveIntensity={0.18} metalness={0.28} roughness={0.24} />
      </mesh>
    </group>
  );
}

function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 92 }, (_, index) => {
        const angle = index * 2.399;
        const radius = 5.6 + (index % 17) * 0.18;
        return [Math.cos(angle) * radius, ((index % 19) - 9) * 0.24, Math.sin(angle) * radius] as [number, number, number];
      }),
    [],
  );

  return (
    <group>
      {stars.map((position, index) => (
        <mesh key={`${position[0]}-${index}`} position={position}>
          <sphereGeometry args={[index % 7 === 0 ? 0.016 : 0.009, 8, 8]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={index % 5 === 0 ? 0.72 : 0.42} />
        </mesh>
      ))}
    </group>
  );
}

function DataPulse({
  satPosRef,
  to,
  delay,
}: {
  satPosRef: RefObject<Vector3>;
  to: Vector3;
  delay: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const t0 = useRef(performance.now() + delay * 1000);

  useFrame(() => {
    if (!meshRef.current || !satPosRef.current) return;
    const elapsed = (performance.now() - t0.current) / 1000;
    if (elapsed < 0) { meshRef.current.visible = false; return; }
    const cycle = 1.6;
    const frac = (elapsed % cycle) / cycle;
    meshRef.current.visible = true;
    meshRef.current.position.copy(satPosRef.current).lerp(to, frac);
    const mat = meshRef.current.material as MeshBasicMaterial;
    mat.opacity = frac < 0.15 ? frac / 0.15 * 0.85 : 0.85 * (1 - (frac - 0.15) / 0.85);
  });

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[0.028, 8, 8]} />
      <meshBasicMaterial color="#10B981" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function alignCylinder(mesh: Mesh, from: Vector3, to: Vector3) {
  const midpoint = from.clone().add(to).multiplyScalar(0.5);
  const direction = to.clone().sub(from);
  const length = direction.length();
  mesh.position.copy(midpoint);
  mesh.scale.set(1, length, 1);
  mesh.quaternion.setFromUnitVectors(axisY, direction.normalize());
}

function normalQuaternion(normal: Vector3) {
  return new Quaternion().setFromUnitVectors(axisY, normal);
}

useGLTF.preload(SATELLITE_MODEL_PATH);
useGLTF.preload(EARTH_MODEL_PATH);
