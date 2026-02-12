import { Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, PerspectiveCamera, Environment, Stars } from "@react-three/drei";
import * as THREE from "three";

function Rig() {
  const { camera, pointer } = useThree();
  const vec = new THREE.Vector3();
  return useFrame(() => {
    camera.position.lerp(vec.set(pointer.x * 0.2, pointer.y * 0.2, camera.position.z), 0.05);
    camera.lookAt(0, 0, 0);
  });
}

export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden bg-[#000000]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#1a1a1a,transparent)] opacity-50"></div>
      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={40} />
        <Suspense fallback={null}>
          <Environment preset="night" />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <Sphere args={[1.2, 64, 64]} position={[5, 2, -5]}>
              <MeshDistortMaterial 
                color="#d4af37" 
                speed={2} 
                distort={0.4} 
                metalness={1} 
                roughness={0.1} 
              />
            </Sphere>
          </Float>

          <Float speed={3} rotationIntensity={1} floatIntensity={1}>
            <Sphere args={[0.8, 64, 64]} position={[-6, -3, -8]}>
              <MeshDistortMaterial 
                color="#c0c0c0" 
                speed={3} 
                distort={0.3} 
                metalness={1} 
                roughness={0.2} 
              />
            </Sphere>
          </Float>

          <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
            <Sphere args={[0.5, 32, 32]} position={[0, 4, -10]}>
              <MeshDistortMaterial 
                color="#ffffff" 
                speed={1} 
                distort={0.2} 
                metalness={1} 
                roughness={0} 
              />
            </Sphere>
          </Float>

          <Rig />
        </Suspense>
      </Canvas>
    </div>
  );
}
