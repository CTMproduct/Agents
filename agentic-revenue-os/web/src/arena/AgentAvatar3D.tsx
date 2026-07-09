import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei';

type Props = { avatarUrl?: string | null; level: number; elo: number; isWinner?: boolean };

const FALLBACK = 'https://models.readyplayer.me/64bfa15f0e72c63d7c3934a6.glb';

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1.2} position={[0, -1, 0]} />;
}

function Loader() {
  const { progress } = useProgress();
  return <Html center><span style={{ fontSize: 12, color: '#fff' }}>{Math.round(progress)}%…</span></Html>;
}

export default function AgentAvatar3D({ avatarUrl, level, elo, isWinner = false }: Props) {
  const url = avatarUrl || FALLBACK;
  return (
    <div style={{
      position: 'relative', height: 240, width: '100%', overflow: 'hidden', borderRadius: 14,
      background: '#0b1220',
      border: isWinner ? '2px solid var(--accent)' : '2px solid #2a3444',
      boxShadow: isWinner ? '0 0 18px rgba(89,193,25,0.45)' : 'none',
    }}>
      <Canvas camera={{ position: [0, 1, 3], fov: 40 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 2, 2]} intensity={1.5} />
        <Suspense fallback={<Loader />}>
          <Model url={url} />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
      <div style={{ position: 'absolute', left: 12, top: 12, borderRadius: 10, background: 'rgba(0,0,0,.6)', padding: 8, color: '#fff', fontSize: 12 }}>
        <div style={{ fontWeight: 800 }}>Lvl {level}</div>
        <div style={{ color: '#8fd0ff' }}>ELO: {elo}</div>
      </div>
    </div>
  );
}
