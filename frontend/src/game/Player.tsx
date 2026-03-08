import { useEffect, useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';

const CLASSIC_BASE_SPEED = 12;
const CLASSIC_SPRINT_MULTIPLIER = 1.8;
const REPO_CITY_BASE_SPEED = 8.5;
const REPO_CITY_SPRINT_MULTIPLIER = 1.35;
const REPO_CITY_ACCELERATION = 10;
const REPO_CITY_DECELERATION = 14;
const REPO_CITY_ROTATION_LERP = 12;
const REPO_CITY_MIN_MOVEMENT = 0.16;
const REPO_CITY_TRANSIT_SPEED = 22;
const REPO_CITY_TRANSIT_ARRIVAL_RADIUS = 1.1;
const PLAYER_SIZE = 0.8;
const GLOBAL_POSITION_SYNC_MS = 200;

const keys: Record<string, boolean> = {};

type PlayerPosition = [number, number, number];

function clonePosition([x, y, z]: PlayerPosition): PlayerPosition {
    return [x, y, z];
}

function positionsMatch(a: PlayerPosition, b: PlayerPosition) {
    return (
        Math.abs(a[0] - b[0]) <= 0.001 &&
        Math.abs(a[1] - b[1]) <= 0.001 &&
        Math.abs(a[2] - b[2]) <= 0.001
    );
}

export function Player() {
    const playerPosition = useGameStore((state) => state.playerPosition);
    const currentDistrict = useGameStore((state) => state.currentDistrict);
    const setPlayerPosition = useGameStore((state) => state.setPlayerPosition);
    const phase = useGameStore((state) => state.phase);
    const districts = useGameStore((state) => state.districts);
    const setCurrentDistrict = useGameStore((state) => state.setCurrentDistrict);
    const isSprinting = useGameStore((state) => state.isSprinting);
    const setSprinting = useGameStore((state) => state.setSprinting);
    const repoCityMode = useGameStore((state) => state.repoCityMode);
    const repoCityTransit = useGameStore((state) => state.repoCityTransit);
    const advanceRepoCityTransit = useGameStore((state) => state.advanceRepoCityTransit);
    const clearRepoCityTransit = useGameStore((state) => state.clearRepoCityTransit);
    const meshRef = useRef<THREE.Group>(null);
    const trailRef = useRef<THREE.Mesh>(null);
    const velocityRef = useRef(new THREE.Vector3());
    const localPositionRef = useRef<PlayerPosition>(clonePosition(playerPosition));
    const localDistrictRef = useRef(currentDistrict);
    const lastStorePositionRef = useRef<PlayerPosition>(clonePosition(playerPosition));
    const lastFlushedPositionRef = useRef<PlayerPosition>(clonePosition(playerPosition));
    const lastPositionSyncAtRef = useRef(-GLOBAL_POSITION_SYNC_MS);
    const positionSyncTimeoutRef = useRef<number | null>(null);

    const playerColor = repoCityMode
        ? (isSprinting ? '#9ad7c0' : '#d7e3ef')
        : (isSprinting ? '#00ffcc' : '#00f0ff');
    const playerEmissive = repoCityMode
        ? (isSprinting ? '#567f70' : '#607688')
        : (isSprinting ? '#00ffcc' : '#00f0ff');
    const visorColor = repoCityMode ? '#9ab8d1' : '#ff00ff';
    const ringOpacity = repoCityMode ? (isSprinting ? 0.24 : 0.16) : 0.4;
    const pointLightIntensity = repoCityMode ? (isSprinting ? 1.2 : 0.75) : (isSprinting ? 3 : 2);
    const pointLightDistance = repoCityMode ? (isSprinting ? 8 : 6) : (isSprinting ? 12 : 8);

    // Track key state
    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            keys[e.key.toLowerCase()] = true;
            if (e.key === 'Shift') setSprinting(true);
        };
        const onUp = (e: KeyboardEvent) => {
            keys[e.key.toLowerCase()] = false;
            if (e.key === 'Shift') setSprinting(false);
        };
        window.addEventListener('keydown', onDown);
        window.addEventListener('keyup', onUp);
        return () => {
            window.removeEventListener('keydown', onDown);
            window.removeEventListener('keyup', onUp);
        };
    }, [setSprinting]);

    useEffect(() => {
        return () => {
            if (positionSyncTimeoutRef.current !== null) {
                window.clearTimeout(positionSyncTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        localDistrictRef.current = currentDistrict;
    }, [currentDistrict]);

    useLayoutEffect(() => {
        if (meshRef.current) {
            meshRef.current.position.set(localPositionRef.current[0], localPositionRef.current[1], localPositionRef.current[2]);
        }
    }, []);

    useEffect(() => {
        if (positionsMatch(playerPosition, lastStorePositionRef.current)) {
            return;
        }

        const nextPosition = clonePosition(playerPosition);
        lastStorePositionRef.current = nextPosition;

        if (!positionsMatch(playerPosition, localPositionRef.current)) {
            velocityRef.current.set(0, 0, 0);
            localPositionRef.current = nextPosition;
            lastFlushedPositionRef.current = nextPosition;
            lastPositionSyncAtRef.current = performance.now();
            if (positionSyncTimeoutRef.current !== null) {
                window.clearTimeout(positionSyncTimeoutRef.current);
                positionSyncTimeoutRef.current = null;
            }
            if (meshRef.current) {
                meshRef.current.position.set(playerPosition[0], playerPosition[1], playerPosition[2]);
            }
        } else {
            lastFlushedPositionRef.current = nextPosition;
        }
    }, [playerPosition]);

    const flushPlayerPosition = (position: PlayerPosition) => {
        if (positionSyncTimeoutRef.current !== null) {
            window.clearTimeout(positionSyncTimeoutRef.current);
            positionSyncTimeoutRef.current = null;
        }

        const syncedPosition = clonePosition(position);
        lastFlushedPositionRef.current = syncedPosition;
        lastStorePositionRef.current = syncedPosition;
        lastPositionSyncAtRef.current = performance.now();
        setPlayerPosition(syncedPosition);
    };

    const schedulePlayerPositionSync = () => {
        if (positionSyncTimeoutRef.current !== null) {
            return;
        }

        const elapsed = performance.now() - lastPositionSyncAtRef.current;
        const delay = Math.max(0, GLOBAL_POSITION_SYNC_MS - elapsed);

        positionSyncTimeoutRef.current = window.setTimeout(() => {
            positionSyncTimeoutRef.current = null;

            if (!positionsMatch(localPositionRef.current, lastFlushedPositionRef.current)) {
                flushPlayerPosition(localPositionRef.current);
            }
        }, delay);
    };

    const commitPosition = (x: number, z: number) => {
        if (!meshRef.current) {
            return;
        }

        const clampedX = Math.max(-95, Math.min(95, x));
        const clampedZ = Math.max(-95, Math.min(95, z));

        meshRef.current.position.x = clampedX;
        meshRef.current.position.z = clampedZ;

        const nextPosition: PlayerPosition = [clampedX, localPositionRef.current[1], clampedZ];
        localPositionRef.current = nextPosition;

        if (performance.now() - lastPositionSyncAtRef.current >= GLOBAL_POSITION_SYNC_MS) {
            flushPlayerPosition(nextPosition);
        } else {
            schedulePlayerPositionSync();
        }

        let nextDistrict: typeof currentDistrict = null;
        for (const d of districts) {
            const [dx, dz] = d.position;
            const [dw, dd] = d.size;
            if (
                clampedX >= dx - dw / 2 && clampedX <= dx + dw / 2 &&
                clampedZ >= dz - dd / 2 && clampedZ <= dz + dd / 2
            ) {
                nextDistrict = d;
                break;
            }
        }

        if (nextDistrict?.id !== localDistrictRef.current?.id || nextDistrict !== localDistrictRef.current) {
            localDistrictRef.current = nextDistrict;
            setCurrentDistrict(nextDistrict);
        }
    };

    useFrame((state, delta) => {
        if (!meshRef.current) return;
        if (phase === 'menu' || phase === 'boss' || phase === 'paused') return;

        const dir = new THREE.Vector3();
        if (keys['w'] || keys['arrowup']) dir.z -= 1;
        if (keys['s'] || keys['arrowdown']) dir.z += 1;
        if (keys['a'] || keys['arrowleft']) dir.x -= 1;
        if (keys['d'] || keys['arrowright']) dir.x += 1;

        const hasInput = dir.lengthSq() > 0;
        let movementVector = new THREE.Vector3();
        let transitMoving = false;

        if (repoCityMode && repoCityTransit) {
            if (hasInput) {
                velocityRef.current.set(0, 0, 0);
                clearRepoCityTransit();
            } else {
                const activeTransitPoint = repoCityTransit.pathPoints[repoCityTransit.pathIndex] ?? repoCityTransit.targetPosition;
                const targetX = activeTransitPoint[0];
                const targetZ = activeTransitPoint[2];
                const toTarget = new THREE.Vector3(
                    targetX - meshRef.current.position.x,
                    0,
                    targetZ - meshRef.current.position.z,
                );
                const remainingDistance = toTarget.length();

                if (remainingDistance <= REPO_CITY_TRANSIT_ARRIVAL_RADIUS) {
                    velocityRef.current.set(0, 0, 0);
                    commitPosition(targetX, targetZ);
                    if (repoCityTransit.pathIndex < repoCityTransit.pathPoints.length - 1) {
                        advanceRepoCityTransit();
                    } else {
                        clearRepoCityTransit();
                    }
                } else {
                    transitMoving = true;
                    movementVector = toTarget.normalize().multiplyScalar(Math.min(remainingDistance, REPO_CITY_TRANSIT_SPEED * delta));
                    velocityRef.current.copy(movementVector).multiplyScalar(1 / Math.max(delta, 0.0001));
                }
            }
        }

        if (!transitMoving && repoCityMode) {
            const targetVelocity = new THREE.Vector3();
            if (hasInput) {
                dir.normalize();
                const targetSpeed = REPO_CITY_BASE_SPEED * (isSprinting ? REPO_CITY_SPRINT_MULTIPLIER : 1);
                targetVelocity.copy(dir).multiplyScalar(targetSpeed);
            }

            const damping = hasInput ? REPO_CITY_ACCELERATION : REPO_CITY_DECELERATION;
            velocityRef.current.x = THREE.MathUtils.damp(velocityRef.current.x, targetVelocity.x, damping, delta);
            velocityRef.current.z = THREE.MathUtils.damp(velocityRef.current.z, targetVelocity.z, damping, delta);

            if (!hasInput && velocityRef.current.lengthSq() < REPO_CITY_MIN_MOVEMENT * REPO_CITY_MIN_MOVEMENT) {
                velocityRef.current.set(0, 0, 0);
            }

            movementVector = velocityRef.current.clone().multiplyScalar(delta);
        } else if (!transitMoving && hasInput) {
            const speed = CLASSIC_BASE_SPEED * (isSprinting ? CLASSIC_SPRINT_MULTIPLIER : 1);
            movementVector = dir.normalize().multiplyScalar(speed * delta);
        }

        if (movementVector.lengthSq() > 0) {
            const nextX = meshRef.current.position.x + movementVector.x;
            const nextZ = meshRef.current.position.z + movementVector.z;

            // Face movement direction
            const angle = Math.atan2(movementVector.x, movementVector.z);
            if (repoCityMode) {
                const deltaAngle = Math.atan2(
                    Math.sin(angle - meshRef.current.rotation.y),
                    Math.cos(angle - meshRef.current.rotation.y),
                );
                meshRef.current.rotation.y += deltaAngle * Math.min(1, delta * REPO_CITY_ROTATION_LERP);
            } else {
                meshRef.current.rotation.y = angle;
            }

            commitPosition(nextX, nextZ);
        }

        // Sprint trail effect
        if (trailRef.current) {
            const mat = trailRef.current.material as THREE.MeshStandardMaterial;
            const moving = repoCityMode
                ? transitMoving || velocityRef.current.lengthSq() > REPO_CITY_MIN_MOVEMENT * REPO_CITY_MIN_MOVEMENT
                : hasInput;
            const targetOpacity = isSprinting && moving && !transitMoving ? (repoCityMode ? 0.18 : 0.5) : 0;
            mat.opacity += (targetOpacity - mat.opacity) * 0.1;
            const targetScaleY = isSprinting && moving && !transitMoving ? (repoCityMode ? 1.35 : 2.0) : 1.0;
            trailRef.current.scale.y += (targetScaleY - trailRef.current.scale.y) * 0.15;
        }
    });

    return (
        <group ref={meshRef}>
            {/* Body */}
            <mesh position={[0, 0.5, 0]} castShadow>
                <capsuleGeometry args={[PLAYER_SIZE * 0.35, PLAYER_SIZE * 0.6, 8, 16]} />
                <meshStandardMaterial
                    color={playerColor}
                    emissive={playerEmissive}
                    emissiveIntensity={repoCityMode ? (isSprinting ? 0.24 : 0.14) : (isSprinting ? 1.2 : 0.8)}
                    metalness={repoCityMode ? 0.28 : 0.7}
                    roughness={repoCityMode ? 0.72 : 0.2}
                />
            </mesh>

            {/* Visor / Eye line */}
            <mesh position={[0, 0.85, 0.2]} castShadow>
                <boxGeometry args={[0.5, 0.08, 0.15]} />
                <meshStandardMaterial
                    color={visorColor}
                    emissive={visorColor}
                    emissiveIntensity={repoCityMode ? 0.35 : 1.5}
                />
            </mesh>

            {/* Ground glow ring */}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.6, 0.75, 32]} />
                <meshStandardMaterial
                    color={playerColor}
                    emissive={playerEmissive}
                    emissiveIntensity={repoCityMode ? 0.18 : 1}
                    transparent
                    opacity={ringOpacity}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Sprint trail (elongated glow behind player) */}
            <mesh ref={trailRef} position={[0, 0.3, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.4, 1.5]} />
                <meshStandardMaterial
                    color={repoCityMode ? '#9ad7c0' : '#00ffcc'}
                    emissive={repoCityMode ? '#567f70' : '#00ffcc'}
                    emissiveIntensity={repoCityMode ? 0.22 : 2}
                    transparent
                    opacity={0}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Point light on player */}
            <pointLight
                color={playerColor}
                intensity={pointLightIntensity}
                distance={pointLightDistance}
                position={[0, 1.5, 0]}
            />
        </group>
    );
}
