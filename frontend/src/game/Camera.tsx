import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

const CLASSIC_CAMERA = {
    height: 45,
    offsetZ: 35,
    lerp: 3.5,
    fov: 50,
};

const REPO_CITY_CAMERA = {
    height: 62,
    offsetZ: 14,
    lerp: 4.2,
    fov: 42,
};

const FOV_LERP = 6;

export function Camera() {
    const playerPosition = useGameStore((state) => state.playerPosition);
    const phase = useGameStore((state) => state.phase);
    const repoCityMode = useGameStore((state) => state.repoCityMode);

    useFrame((state, delta) => {
        if (phase === 'menu') return;

        const cam = state.camera as THREE.PerspectiveCamera;
        const cameraProfile = repoCityMode ? REPO_CITY_CAMERA : CLASSIC_CAMERA;
        const targetX = playerPosition[0];
        const targetZ = playerPosition[2] + cameraProfile.offsetZ;
        const targetY = cameraProfile.height;

        cam.position.x += (targetX - cam.position.x) * cameraProfile.lerp * delta;
        cam.position.y += (targetY - cam.position.y) * cameraProfile.lerp * delta;
        cam.position.z += (targetZ - cam.position.z) * cameraProfile.lerp * delta;

        const nextFov = cam.fov + (cameraProfile.fov - cam.fov) * FOV_LERP * delta;
        if (Math.abs(nextFov - cam.fov) > 0.01) {
            cam.fov = nextFov;
            cam.updateProjectionMatrix();
        }

        cam.lookAt(playerPosition[0], 0, playerPosition[2]);
    });

    return null;
}
