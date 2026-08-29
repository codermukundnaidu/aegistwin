"use client";

import { Center, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import type { Group } from "three";

const MODEL_PATH = "/models/aegis-twin-model.glb";

function SpinningModel() {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF(MODEL_PATH);
  const model = useMemo(() => scene.clone(true), [scene]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.55;
    groupRef.current.rotation.x = Math.sin(performance.now() * 0.00042) * 0.18;
  });

  return (
    <group ref={groupRef} scale={0.62}>
      <Center>
        <primitive object={model} />
      </Center>
    </group>
  );
}

export function BrandCubeSat() {
  return (
    <Canvas
      camera={{ position: [0, 0.4, 3.2], fov: 36 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      dpr={[1, 1.5]}
      style={{ width: 68, height: 68, flexShrink: 0 }}
    >
      <ambientLight intensity={0.32} />
      <directionalLight position={[2.4, 3.2, 2.8]} color="#fff5e0" intensity={3.0} />
      <pointLight position={[-1.8, 1.2, 1.2]} color="#00F0FF" intensity={1.1} distance={6} />
      <Suspense fallback={null}>
        <SpinningModel />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_PATH);
