import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';

export interface RenderDiagnostics {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  fps: number;
}
interface DiagnosticsBridgeProps {
  onSample: (diagnostics: RenderDiagnostics) => void;
}

export function DiagnosticsBridge({ onSample }: DiagnosticsBridgeProps) {
  const { gl } = useThree();
  const elapsedRef = useRef(0);
  const framesRef = useRef(0);

  useFrame((_, delta) => {
    elapsedRef.current += delta;
    framesRef.current += 1;
    if (elapsedRef.current < 1) return;
    onSample({
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      fps: Math.round(framesRef.current / elapsedRef.current),
    });
    elapsedRef.current = 0;
    framesRef.current = 0;
  });
  return null;
}
