import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  MathUtils,
  PerspectiveCamera,
  Raycaster,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { CameraMode } from '../app/types';
import type { PersonProjection } from '../simulation';
import { dampCameraFov } from './cameraFov';
import { resolveCameraCollision } from './cameraCollision';
import { terrainHeight } from './terrain';

interface SpectatorCameraProps {
  mode: CameraMode;
  selectedPerson: PersonProjection | null;
  focusPosition: readonly [number, number, number] | null;
  onDiagnostics: (diagnostics: CameraDiagnostics) => void;
}

export interface CameraDiagnostics {
  position: readonly [number, number, number];
  transitioning: boolean;
}

export function SpectatorCamera({ mode, selectedPerson, focusPosition, onDiagnostics }: SpectatorCameraProps) {
  const { camera, gl, scene } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const modeRef = useRef<CameraMode>(mode);
  const transitionRef = useRef(1);
  const priorTargetRef = useRef(new Vector3());
  const target = useMemo(() => new Vector3(), []);
  const desired = useMemo(() => new Vector3(), []);
  const direction = useMemo(() => new Vector3(), []);
  const targetDelta = useMemo(() => new Vector3(), []);
  const followLift = useMemo(() => new Vector3(0, 3.15, 0), []);
  const followSide = useMemo(() => new Vector3(), []);
  const orbitalOffset = useMemo(() => new Vector3(58, 45, 58), []);
  const raycaster = useMemo(() => new Raycaster(), []);
  const lastDiagnosticsAtRef = useRef(-1);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = true;
    controls.minDistance = 4;
    controls.maxDistance = 235;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minPolarAngle = 0.08;
    controls.rotateSpeed = 0.54;
    controls.zoomSpeed = 0.78;
    controls.panSpeed = 0.66;
    controls.screenSpacePanning = false;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;
    priorTargetRef.current.copy(controls.target);
    return () => {
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  useEffect(() => {
    if (modeRef.current !== mode) {
      modeRef.current = mode;
      transitionRef.current = 0;
    }
  }, [mode]);

  useFrame(({ clock }, delta) => {
    const controls = controlsRef.current;
    if (controls === null) return;
    transitionRef.current = Math.min(1, transitionRef.current + delta * 1.25);
    const transition = MathUtils.smoothstep(transitionRef.current, 0, 1);
    if (camera instanceof PerspectiveCamera) {
      const health = selectedPerson?.health ?? 100;
      const nextFov = dampCameraFov(camera.fov, mode, health, delta);
      if (Math.abs(nextFov - camera.fov) > 0.0001) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    }

    if (selectedPerson !== null && (mode === 'follow' || mode === 'first-person')) {
      const ground = terrainHeight(selectedPerson.position.x, selectedPerson.position.z);
      const eyeHeight = selectedPerson.heightMeters * 0.91;
      target.set(selectedPerson.position.x, ground + eyeHeight * 0.68, selectedPerson.position.z);

      if (mode === 'first-person') {
        controls.enabled = false;
        // The view stays at the autonomous NPC's eye position. Building wall
        // shells are real, double-sided geometry, so depth testing naturally
        // blocks sight through walls without displacing or steering the NPC.
        desired.set(selectedPerson.position.x, ground + eyeHeight, selectedPerson.position.z);
        camera.position.lerp(desired, 1 - Math.exp(-delta * (5 + transition * 8)));
        direction.set(
          selectedPerson.destination.x - selectedPerson.position.x,
          0,
          selectedPerson.destination.z - selectedPerson.position.z,
        );
        if (direction.lengthSq() < 0.001) {
          direction.set(Math.sin(selectedPerson.yaw), 0, Math.cos(selectedPerson.yaw));
        } else {
          direction.normalize();
        }
        target.copy(camera.position).addScaledVector(direction, 8);
        target.y += selectedPerson.health < 35 ? Math.sin(clock.elapsedTime * 8) * 0.035 : 0;
        camera.lookAt(target);
        if (clock.elapsedTime - lastDiagnosticsAtRef.current >= 0.2) {
          lastDiagnosticsAtRef.current = clock.elapsedTime;
          onDiagnostics({
            position: [camera.position.x, camera.position.y, camera.position.z],
            transitioning: transitionRef.current < 0.99,
          });
        }
        return;
      }

      controls.enabled = true;
      controls.enablePan = false;
      targetDelta.copy(target).sub(priorTargetRef.current);
      camera.position.add(targetDelta);
      controls.target.lerp(target, 1 - Math.exp(-delta * 9));
      if (transitionRef.current < 1) {
        direction.set(Math.sin(selectedPerson.yaw), 0, Math.cos(selectedPerson.yaw));
        followSide.set(direction.z, 0, -direction.x);
        desired.copy(target)
          .addScaledVector(direction, -7.8)
          .addScaledVector(followSide, 2.8)
          .add(followLift);
        camera.position.lerp(desired, 1 - Math.exp(-delta * 4.5));
      }
    } else {
      controls.enabled = true;
      controls.enablePan = true;
      if (transitionRef.current < 1) {
        if (focusPosition === null) target.set(0, 0.4, 0);
        else target.set(focusPosition[0], focusPosition[1], focusPosition[2]);
        controls.target.lerp(target, 1 - Math.exp(-delta * 4.2));
        desired.copy(target).add(orbitalOffset);
        camera.position.lerp(desired, 1 - Math.exp(-delta * 3.3));
      }
    }

    controls.update();
    priorTargetRef.current.copy(controls.target);

    // OrbitControls may enforce its minimum radius while updating, so camera
    // collision must be the final positional operation for this frame.
    resolveCameraCollision({
      desiredCamera: camera.position,
      obstacleRoot: scene,
      output: desired,
      raycaster,
      target: controls.target,
    });
    camera.position.copy(desired);

    const ground = terrainHeight(camera.position.x, camera.position.z) + 0.85;
    if (camera.position.y < ground) camera.position.y = ground;
    if (clock.elapsedTime - lastDiagnosticsAtRef.current >= 0.2) {
      lastDiagnosticsAtRef.current = clock.elapsedTime;
      onDiagnostics({
        position: [camera.position.x, camera.position.y, camera.position.z],
        transitioning: transitionRef.current < 0.99,
      });
    }
  });

  return null;
}
