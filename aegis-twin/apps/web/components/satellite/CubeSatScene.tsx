"use client";

import { Center, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Cpu, Radio, ShieldCheck, Thermometer, Zap } from "lucide-react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group, PointLight } from "three";

type Vec3 = [number, number, number];
type MouseNorm = { x: number; y: number };
const SATELLITE_MODEL_PATH = "/models/aegis-twin-model.glb";

const subsystems: {
  id: string;
  label: string;
  pos: Vec3;
  color: string;
  size: Vec3;
  description: string;
}[] = [
  {
    id: "master-obc",
    label: "Master OBC",
    pos: [-0.45, 0.55, 0.77],
    color: "#31d3c6",
    size: [0.5, 0.36, 0.1],
    description: "Trusted deterministic authority. It owns whitelists, safety gates, timing, and execution.",
  },
  {
    id: "edge-ai",
    label: "Edge AI",
    pos: [0.42, 0.55, 0.79],
    color: "#4aa3ff",
    size: [0.42, 0.42, 0.12],
    description: "Subordinate adviser. It wakes only during ambiguous anomalies and returns no actuator commands.",
  },
  {
    id: "eps",
    label: "EPS / Battery",
    pos: [-0.48, -0.48, 0.78],
    color: "#5de38a",
    size: [0.55, 0.38, 0.14],
    description: "Electrical source of truth. Voltage, current, SOC, solar input, and load drive the safety result.",
  },
  {
    id: "watchdog",
    label: "Watchdog",
    pos: [0.32, -0.55, 0.81],
    color: "#ffb454",
    size: [0.34, 0.28, 0.12],
    description: "Deadline and containment mechanism. Timeout injection proves the AI can fail safely.",
  },
  {
    id: "adcs",
    label: "ADCS",
    pos: [0.86, -0.1, 0.12],
    color: "#9d8cff",
    size: [0.12, 0.54, 0.54],
    description: "A restart candidate includes a transient power spike that can cross the voltage floor.",
  },
  {
    id: "payload",
    label: "Payload",
    pos: [0, 1.18, -0.15],
    color: "#ff6370",
    size: [0.64, 0.12, 0.5],
    description: "Payload shedding is a pre-approved recovery template with power and heat reductions.",
  },
  {
    id: "comms",
    label: "Comms",
    pos: [0, -1.18, -0.12],
    color: "#66a6ff",
    size: [0.66, 0.12, 0.44],
    description: "Protocol view shows structured messages and malformed-message rejection.",
  },
  {
    id: "thermal",
    label: "Thermal Sensors",
    pos: [0.75, 0.72, 0.62],
    color: "#ff8a4c",
    size: [0.16, 0.16, 0.16],
    description: "Battery and electronics nodes are propagated through a reduced-order thermal model.",
  },
];

type Props = {
  activeSubsystem: string;
  onSubsystem: (id: string) => void;
};

export function CubeSatScene({ activeSubsystem, onSubsystem }: Props) {
  const active = subsystems.find((system) => system.id === activeSubsystem) ?? subsystems[0];
  const [hovered, setHovered] = useState(false);
  const [mouseNorm, setMouseNorm] = useState<MouseNorm>({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMouseNorm({
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    });
  };

  return (
    <div
      className="panel scene-panel"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="bubble">
        <strong>{active.label}</strong>
        {active.description}
      </div>
      <Canvas
        id="cubesat-canvas"
        camera={{ position: [4.4, 3.1, 5.2], fov: 39 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={["#02070d"]} />
        <ambientLight intensity={0.72} />
        <hemisphereLight args={["#e8f6ff", "#06111f", 1.05]} />
        <SunLightRig />
        <pointLight position={[-2.5, 1.2, 2.6]} color="#49d8ff" intensity={2.2} />
        <pointLight position={[2.8, -1.5, 2.5]} color="#ffb454" intensity={1.4} />
        {/* rim back-light for edge reflections */}
        <pointLight position={[0, 1.5, -4.5]} color="#99ccff" intensity={3.1} />
        {/* top specular key */}
        <pointLight position={[0, 6, 0.5]} color="#ffffff" intensity={2.8} />
        <CursorLight mouseNorm={mouseNorm} hovered={hovered} />
        <SpaceGrid />
        <Suspense fallback={<ModelLoadingFallback />}>
          <ImportedCubeSatModel mouseNorm={mouseNorm} hovered={hovered} />
        </Suspense>
        <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minDistance={3.2} maxDistance={8} />
      </Canvas>
      <SubsystemToolbar activeSubsystem={activeSubsystem} onSubsystem={onSubsystem} />
    </div>
  );
}

function CursorLight({ mouseNorm, hovered }: { mouseNorm: MouseNorm; hovered: boolean }) {
  const lightRef = useRef<PointLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    const tx = mouseNorm.x * 5.5;
    const ty = mouseNorm.y * 4;
    lightRef.current.position.x += (tx - lightRef.current.position.x) * 0.09;
    lightRef.current.position.y += (ty - lightRef.current.position.y) * 0.09;
    const targetIntensity = hovered ? 3.2 : 0;
    lightRef.current.intensity += (targetIntensity - lightRef.current.intensity) * 0.09;
  });

  return <pointLight ref={lightRef} color="#d8f0ff" intensity={0} position={[0, 0, 4.5]} />;
}

function SunLightRig() {
  return (
    <group position={[3.8, 4.6, 3.2]}>
      <directionalLight color="#fff3d6" intensity={5.8} position={[0, 0, 0]} />
      <pointLight color="#ffd89a" intensity={3.6} distance={11} decay={1.4} />
      <mesh position={[0.24, 0.18, 0]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshBasicMaterial color="#fff4bf" transparent opacity={0.9} />
      </mesh>
      <mesh position={[0.24, 0.18, 0]}>
        <sphereGeometry args={[0.46, 32, 32]} />
        <meshBasicMaterial color="#ffd166" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

function ImportedCubeSatModel({ mouseNorm, hovered }: { mouseNorm: MouseNorm; hovered: boolean }) {
  const groupRef = useRef<Group>(null);
  const autoY = useRef(-0.45);
  const tiltX = useRef(0);
  const tiltZ = useRef(0);
  const { scene } = useGLTF(SATELLITE_MODEL_PATH);
  const model = useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((object) => {
      if (!("isMesh" in object) || !object.isMesh) return;
      const mesh = object as { material?: unknown };
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      materials.forEach((material) => {
        if (!material || typeof material !== "object") return;
        if ("metalness" in material && typeof material.metalness === "number") material.metalness = Math.min(1, material.metalness + 0.12);
        if ("roughness" in material && typeof material.roughness === "number") material.roughness = Math.max(0.18, material.roughness * 0.72);
        if ("envMapIntensity" in material && typeof material.envMapIntensity === "number") material.envMapIntensity = 1.8;
        if ("needsUpdate" in material) material.needsUpdate = true;
      });
    });
    return cloned;
  }, [scene]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    autoY.current += delta * 0.035;
    const targetTiltX = hovered ? -mouseNorm.y * 0.26 : 0;
    const targetTiltZ = hovered ? -mouseNorm.x * 0.13 : 0;
    tiltX.current += (targetTiltX - tiltX.current) * 0.07;
    tiltZ.current += (targetTiltZ - tiltZ.current) * 0.07;
    groupRef.current.rotation.set(0.16 + tiltX.current, autoY.current, 0.02 + tiltZ.current);
  });

  return (
    <group ref={groupRef} position={[0, -0.2, 0]} scale={3.25}>
      <Center>
        <primitive object={model} />
      </Center>
    </group>
  );
}

function ModelLoadingFallback() {
  return (
    <group position={[0, -0.1, 0]}>
      <mesh>
        <boxGeometry args={[1.2, 1.6, 1.2]} />
        <meshStandardMaterial color="#0f172a" emissive="#00f0ff" emissiveIntensity={0.18} wireframe />
      </mesh>
      <Html distanceFactor={7.2} position={[0, 1.15, 0]}>
        <span className="callout-chip active">Loading spacecraft model</span>
      </Html>
    </group>
  );
}

function CubeSatAssembly({
  activeSubsystem,
  onSubsystem,
  mouseNorm,
  hovered,
}: Props & { mouseNorm: MouseNorm; hovered: boolean }) {
  const groupRef = useRef<Group>(null);
  const autoY = useRef(-0.5);
  const tiltX = useRef(0);
  const tiltZ = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    autoY.current += delta * 0.035;
    const targetTiltX = hovered ? -mouseNorm.y * 0.38 : 0;
    const targetTiltZ = hovered ? -mouseNorm.x * 0.18 : 0;
    tiltX.current += (targetTiltX - tiltX.current) * 0.07;
    tiltZ.current += (targetTiltZ - tiltZ.current) * 0.07;
    groupRef.current.rotation.set(0.18 + tiltX.current, autoY.current, 0.02 + tiltZ.current);
  });

  return (
    <group ref={groupRef} position={[0, -0.08, 0]}>
      <CubeSatBus activeSubsystem={activeSubsystem} onSubsystem={onSubsystem} />
      <SolarWing side="left" />
      <SolarWing side="right" />
      <Antenna position={[-0.54, 1.48, 0.18]} rotation={[0.45, 0.2, -0.65]} />
      <Antenna position={[0.54, 1.48, 0.18]} rotation={[0.45, -0.2, 0.65]} />
      <Antenna position={[0.12, -1.48, -0.25]} rotation={[1.1, 0.25, 0.15]} />
      <FutureBranch position={[-2.85, 1.4, -0.35]} color="#5de38a" label="SAFE_MODE" verdict="PASS" />
      <FutureBranch position={[0, 1.85, -0.55]} color="#ff6370" label="RESTART_ADCS" verdict="BLOCK" />
      <FutureBranch position={[2.85, 1.4, -0.35]} color="#31d3c6" label="SHED_PAYLOAD" verdict="PASS" />
    </group>
  );
}

function CubeSatBus({ activeSubsystem, onSubsystem }: Props) {
  return (
    <group>
      <StructuralFrame />
      <BodyPanels />
      <AvionicsStack />
      {subsystems.map((system) => (
        <SubsystemModule
          key={system.id}
          id={system.id}
          label={system.label}
          position={system.pos}
          size={system.size}
          color={system.color}
          active={system.id === activeSubsystem}
          onClick={() => onSubsystem(system.id)}
        />
      ))}
    </group>
  );
}

function StructuralFrame() {
  const x = 0.95;
  const y = 1.35;
  const z = 0.72;
  const railColor = "#ddeeff";

  return (
    <group>
      {[-x, x].map((cx) =>
        [-z, z].map((cz) => (
          <Rail key={`vertical-${cx}-${cz}`} position={[cx, 0, cz]} rotation={[0, 0, 0]} length={2.7} radius={0.035} color={railColor} />
        )),
      )}
      {[-y, y].map((cy) =>
        [-z, z].map((cz) => (
          <Rail key={`x-${cy}-${cz}`} position={[0, cy, cz]} rotation={[0, 0, Math.PI / 2]} length={1.9} radius={0.032} color={railColor} />
        )),
      )}
      {[-y, y].map((cy) =>
        [-x, x].map((cx) => (
          <Rail key={`z-${cy}-${cx}`} position={[cx, cy, 0]} rotation={[Math.PI / 2, 0, 0]} length={1.44} radius={0.032} color={railColor} />
        )),
      )}
      {[-x, x].map((cx) =>
        [-y, y].map((cy) =>
          [-z, z].map((cz) => <CornerBlock key={`corner-${cx}-${cy}-${cz}`} position={[cx, cy, cz]} />),
        ),
      )}
    </group>
  );
}

function BodyPanels() {
  return (
    <group>
      <mesh position={[0, 0, -0.73]}>
        <boxGeometry args={[1.72, 2.38, 0.045]} />
        <meshStandardMaterial color="#0d1825" metalness={0.72} roughness={0.10} />
      </mesh>
      <mesh position={[-0.98, 0, 0]}>
        <boxGeometry args={[0.045, 2.34, 1.18]} />
        <meshStandardMaterial color="#111d2c" metalness={0.76} roughness={0.08} />
      </mesh>
      <mesh position={[0.98, 0, 0]}>
        <boxGeometry args={[0.045, 2.34, 1.18]} />
        <meshStandardMaterial color="#111d2c" metalness={0.76} roughness={0.08} />
      </mesh>
      <mesh position={[0, 1.38, 0]}>
        <boxGeometry args={[1.65, 0.06, 1.15]} />
        <meshStandardMaterial color="#182435" metalness={0.82} roughness={0.06} />
      </mesh>
      <mesh position={[0, -1.38, 0]}>
        <boxGeometry args={[1.65, 0.06, 1.15]} />
        <meshStandardMaterial color="#182435" metalness={0.82} roughness={0.06} />
      </mesh>
      <SolarCellGrid position={[0, 0, -0.765]} rotation={[0, 0, 0]} rows={5} cols={3} cell={[0.43, 0.34, 0.012]} />
    </group>
  );
}

function AvionicsStack() {
  return (
    <group>
      <CircuitBoard position={[0, 0.58, 0.67]} color="#113f48" />
      <CircuitBoard position={[0, 0.02, 0.68]} color="#17314d" />
      <CircuitBoard position={[0, -0.54, 0.67]} color="#243a2f" />
      <Chip position={[-0.2, 0.07, 0.75]} size={[0.22, 0.18, 0.06]} color="#7ff3ff" />
      <Chip position={[0.22, 0.08, 0.75]} size={[0.18, 0.18, 0.05]} color="#ffb454" />
      <Chip position={[0.03, -0.32, 0.75]} size={[0.32, 0.12, 0.05]} color="#a7f3d0" />
      {[-0.62, -0.35, 0, 0.35, 0.62].map((x) => (
        <mesh key={`trace-v-${x}`} position={[x, 0.02, 0.755]}>
          <boxGeometry args={[0.012, 1.52, 0.012]} />
          <meshStandardMaterial color="#49d8ff" emissive="#49d8ff" emissiveIntensity={0.28} />
        </mesh>
      ))}
      {[-0.72, -0.25, 0.28, 0.75].map((y) => (
        <mesh key={`trace-h-${y}`} position={[0, y, 0.758]}>
          <boxGeometry args={[1.3, 0.012, 0.012]} />
          <meshStandardMaterial color="#ffb454" emissive="#ffb454" emissiveIntensity={0.2} />
        </mesh>
      ))}
    </group>
  );
}

function SolarWing({ side }: { side: "left" | "right" }) {
  const sign = side === "left" ? -1 : 1;
  return (
    <group position={[sign * 1.86, -0.1, -0.04]} rotation={[0, 0, sign * -0.08]}>
      <Rail position={[sign * -0.52, 0, 0]} rotation={[0, 0, Math.PI / 2]} length={1.05} radius={0.025} color="#c8ddf0" />
      <mesh>
        <boxGeometry args={[1.55, 2.65, 0.05]} />
        <meshStandardMaterial color="#071a2d" metalness={0.22} roughness={0.18} />
      </mesh>
      <SolarCellGrid position={[0, 0, 0.035]} rotation={[0, 0, 0]} rows={6} cols={3} cell={[0.39, 0.34, 0.012]} />
    </group>
  );
}

function SolarCellGrid({
  position,
  rotation,
  rows,
  cols,
  cell,
}: {
  position: Vec3;
  rotation: Vec3;
  rows: number;
  cols: number;
  cell: Vec3;
}) {
  const gapX = cell[0] + 0.06;
  const gapY = cell[1] + 0.06;

  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: cols }).map((__, col) => {
          const x = (col - (cols - 1) / 2) * gapX;
          const y = (row - (rows - 1) / 2) * gapY;
          return (
            <mesh key={`${row}-${col}`} position={[x, y, 0]}>
              <boxGeometry args={cell} />
              <meshStandardMaterial color="#123c68" emissive="#0d65a8" emissiveIntensity={0.28} metalness={0.35} roughness={0.12} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function SubsystemModule({
  id,
  label,
  position,
  size,
  color,
  active,
  onClick,
}: {
  id: string;
  label: string;
  position: Vec3;
  size: Vec3;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <mesh
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <boxGeometry args={active ? size.map((value) => value * 1.12) as Vec3 : size} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.72 : 0.22} metalness={0.18} roughness={0.24} />
      <Html distanceFactor={7.6} position={[0, size[1] * 0.8 + 0.1, 0]}>
        <span className={`callout-chip ${active ? "active" : ""}`}>{label}</span>
      </Html>
      {id === "thermal" ? (
        <mesh>
          <sphereGeometry args={[0.14, 18, 18]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
        </mesh>
      ) : null}
    </mesh>
  );
}

function CircuitBoard({ position, color }: { position: Vec3; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[1.34, 0.38, 0.035]} />
      <meshStandardMaterial color={color} metalness={0.22} roughness={0.38} emissive={color} emissiveIntensity={0.08} />
    </mesh>
  );
}

function Chip({ position, size, color }: { position: Vec3; size: Vec3; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.42} roughness={0.18} metalness={0.35} />
    </mesh>
  );
}

function CornerBlock({ position }: { position: Vec3 }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.16, 0.16, 0.16]} />
      <meshStandardMaterial color="#eef6ff" metalness={0.94} roughness={0.04} />
    </mesh>
  );
}

function Rail({ position, rotation, length, radius, color }: { position: Vec3; rotation: Vec3; length: number; radius: number; color: string }) {
  return (
    <mesh position={position} rotation={rotation}>
      <cylinderGeometry args={[radius, radius, length, 14]} />
      <meshStandardMaterial color={color} metalness={0.92} roughness={0.05} />
    </mesh>
  );
}

function Antenna({ position, rotation }: { position: Vec3; rotation: Vec3 }) {
  return (
    <group position={position} rotation={rotation}>
      <Rail position={[0, 0.25, 0]} rotation={[0, 0, 0]} length={0.7} radius={0.01} color="#d8f4ff" />
      <mesh position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color="#49d8ff" emissive="#49d8ff" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function FutureBranch({ position, color, label, verdict }: { position: Vec3; color: string; label: string; verdict: string }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial color={color} transparent opacity={0.48} emissive={color} emissiveIntensity={0.7} />
      </mesh>
      <Rail position={[0, -0.36, 0]} rotation={[0, 0, 0]} length={0.68} radius={0.012} color={color} />
      <mesh position={[0, -0.76, 0]}>
        <boxGeometry args={[0.44, 0.44, 0.28]} />
        <meshStandardMaterial color={color} transparent opacity={0.16} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <Html distanceFactor={7.2} position={[0, 0.26, 0]}>
        <span className="future-chip" style={{ borderColor: color, color }}>
          {label} · {verdict}
        </span>
      </Html>
    </group>
  );
}

function SpaceGrid() {
  return (
    <group position={[0, -1.65, -0.35]}>
      <gridHelper args={[8, 32, "#14334a", "#0a2236"]} />
      {[-3, -1.5, 0, 1.5, 3].map((x) => (
        <mesh key={`star-${x}`} position={[x, 2.3 + Math.abs(x) * 0.08, -2.2]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color="#49d8ff" emissive="#49d8ff" emissiveIntensity={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function SubsystemToolbar({ activeSubsystem, onSubsystem }: Props) {
  return (
    <div className="subsystem-toolbar">
      {subsystems.map((system) => (
        <button
          className={`icon-button ${system.id === activeSubsystem ? "active" : ""}`}
          key={system.id}
          onClick={() => onSubsystem(system.id)}
          title={system.label}
        >
          {icon(system.id)}
          {system.label}
        </button>
      ))}
    </div>
  );
}

function icon(id: string) {
  if (id === "eps") return <Zap size={14} />;
  if (id === "comms") return <Radio size={14} />;
  if (id === "thermal") return <Thermometer size={14} />;
  if (id === "watchdog") return <ShieldCheck size={14} />;
  return <Cpu size={14} />;
}

useGLTF.preload(SATELLITE_MODEL_PATH);
