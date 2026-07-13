import { useGLTF } from '@react-three/drei';
import { Component, Suspense, useMemo, type ErrorInfo, type ReactNode } from 'react';
import type { Group, Mesh, Object3D } from 'three';

import kitUrl from '../../assets/runtime/confluence-world-kit.glb?url';

export type ConfluenceAssetName =
  | 'Asset_Bench'
  | 'Asset_CargoCart'
  | 'Asset_FarmStand'
  | 'Asset_Generator'
  | 'Asset_MarketStall'
  | 'Asset_StoneDepot'
  | 'Asset_StreetLamp'
  | 'Asset_TimberYard'
  | 'Asset_WaterWorks';

interface ConfluenceAssetProps {
  name: ConfluenceAssetName;
  position?: readonly [number, number, number];
  rotation?: readonly [number, number, number];
  scale?: number | readonly [number, number, number];
}

function prepareClone(source: Object3D): Group {
  const clone = source.clone(true) as Group;
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  clone.scale.set(1, 1, 1);
  clone.traverse((object) => {
    if ((object as Mesh).isMesh) {
      const mesh = object as Mesh;
      // The procedural foundations and citizens provide contact shadows.
      // Keeping every small kit primitive in the shadow pass doubled draw
      // submissions without a measurable silhouette benefit.
      mesh.castShadow = false;
      mesh.receiveShadow = true;
    }
  });
  return clone;
}

function LoadedConfluenceAsset({ name, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }: ConfluenceAssetProps) {
  const { scene } = useGLTF(kitUrl, false, true);
  const source = scene.getObjectByName(name);
  const clone = useMemo(() => source === undefined ? null : prepareClone(source), [source]);

  if (clone === null) return null;
  return <primitive object={clone} position={position} rotation={rotation} scale={scale} />;
}

interface AssetBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface AssetBoundaryState {
  failed: boolean;
}

class AssetBoundary extends Component<AssetBoundaryProps, AssetBoundaryState> {
  public state: AssetBoundaryState = { failed: false };

  public static getDerivedStateFromError(): AssetBoundaryState {
    return { failed: true };
  }

  public componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn('Optional Confluence visual kit failed to load; procedural fallbacks remain active.', error, info);
  }

  public render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export function ConfluenceAsset(props: ConfluenceAssetProps) {
  return (
    <AssetBoundary>
      <Suspense fallback={null}>
        <LoadedConfluenceAsset {...props} />
      </Suspense>
    </AssetBoundary>
  );
}

useGLTF.preload(kitUrl, false, true);
