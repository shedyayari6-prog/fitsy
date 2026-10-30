import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Environment, Float, Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei';
import { Box3, Vector3 } from 'three';

/** Normalises any model: scaled to ~2 units tall, centred, resting at y = -1. */
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    const box = new Box3().setFromObject(c);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const s = 2 / Math.max(size.x, size.y, size.z);
    c.scale.setScalar(s);
    c.position.set(-center.x * s, -box.min.y * s - 1, -center.z * s);
    return c;
  }, [scene]);
  return <primitive object={obj} />;
}

function Loader() {
  const { progress } = useProgress();
  return <Html center><span className="mv__loader">{Math.round(progress)}%</span></Html>;
}

export default function ModelViewer({ url, height = 420 }: { url: string; height?: number }) {
  return (
    <div className="mv" style={{ height }}>
      <Canvas dpr={[1, 2]} camera={{ fov: 35, position: [0, 0.6, 5] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 4]} intensity={1.2} />
        <Suspense fallback={<Loader />}>
          <Environment preset="city" />
          <Float speed={1.6} rotationIntensity={0.1} floatIntensity={0.5}>
            <Model url={url} />
          </Float>
          <ContactShadows position={[0, -1.35, 0]} opacity={0.45} scale={7} blur={2.8} far={3} />
        </Suspense>
        <OrbitControls makeDefault enablePan={false} enableZoom minDistance={3} maxDistance={8}
          autoRotate autoRotateSpeed={1.2} minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 1.8} />
      </Canvas>
    </div>
  );
}