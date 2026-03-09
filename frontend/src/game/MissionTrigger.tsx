import { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';

interface MissionTriggerProps {
    districtId: string;
    position: [number, number, number];
    radius: number;
    color: string;
}

function calmColor(source: string, amount: number) {
    return `#${new THREE.Color(source).lerp(new THREE.Color('#c5d3e2'), amount).getHexString()}`;
}

export function MissionTrigger({ districtId, position, radius, color }: MissionTriggerProps) {
    const ringRef = useRef<THREE.Mesh>(null);
    // Track previous proximity to open the panel only on entry, not on every frame.
    // Without this edge-trigger, the panel reopens instantly after the player closes it.
    const prevIsNearRef = useRef(false);
    const { playerPosition, phase, setShowMissionPanel, missions, activeMission, repoCityMode, repoCityTransit } = useGameStore(useShallow((state) => ({
        playerPosition: state.playerPosition,
        phase: state.phase,
        setShowMissionPanel: state.setShowMissionPanel,
        missions: state.missions,
        activeMission: state.activeMission,
        repoCityMode: state.repoCityMode,
        repoCityTransit: state.repoCityTransit,
    })));

    const districtMissions = missions.filter(
        (m) => m.districtId === districtId && m.status === 'available'
    );
    const markerColor = repoCityMode ? calmColor(color, 0.58) : color;
    const glowColor = repoCityMode ? calmColor(color, 0.76) : color;

    const checkProximity = useCallback(() => {
        const dx = playerPosition[0] - position[0];
        const dz = playerPosition[2] - position[2];
        return Math.sqrt(dx * dx + dz * dz) < radius;
    }, [playerPosition, position, radius]);

    useFrame((state) => {
        if (!ringRef.current) return;

        const isNear = checkProximity();
        const mat = ringRef.current.material as THREE.MeshStandardMaterial;
        const t = state.clock.elapsedTime;

        // Pulse effect
        mat.opacity = isNear
            ? (repoCityMode ? 0.24 + Math.sin(t * 3) * 0.08 : 0.6 + Math.sin(t * 3) * 0.2)
            : (repoCityMode ? 0.1 + Math.sin(t * 1.5) * 0.04 : 0.2 + Math.sin(t * 1.5) * 0.1);
        ringRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.05);

        // Auto-show mission panel on district entry only (edge trigger, not continuous).
        // This allows the player to close the panel and keep it closed while nearby.
        if (
            isNear
            && !prevIsNearRef.current
            && phase === 'playing'
            && !activeMission
            && districtMissions.length > 0
            && (!repoCityTransit || repoCityTransit.districtId === districtId)
        ) {
            setShowMissionPanel(true);
        }
        prevIsNearRef.current = isNear;
    });

    if (districtMissions.length === 0) return null;

    return (
        <group position={position}>
            {/* Trigger ring */}
            <mesh
                ref={ringRef}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.05, 0]}
            >
                <ringGeometry args={[radius - 0.3, radius, 32]} />
                <meshStandardMaterial
                    color={markerColor}
                    emissive={glowColor}
                    emissiveIntensity={repoCityMode ? 0.18 : 1}
                    transparent
                    opacity={repoCityMode ? 0.16 : 0.3}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Center marker */}
            <mesh position={[0, 0.5, 0]}>
                <octahedronGeometry args={[0.4, 0]} />
                <meshStandardMaterial
                    color={markerColor}
                    emissive={glowColor}
                    emissiveIntensity={repoCityMode ? 0.28 : 1.5}
                    transparent
                    opacity={repoCityMode ? 0.76 : 0.7}
                    metalness={repoCityMode ? 0.24 : 0}
                    roughness={repoCityMode ? 0.76 : 1}
                />
            </mesh>

            {/* Vertical beam */}
            <mesh position={[0, 5, 0]}>
                <cylinderGeometry args={[0.03, 0.03, 10, 8]} />
                <meshStandardMaterial
                    color={glowColor}
                    emissive={glowColor}
                    emissiveIntensity={repoCityMode ? 0.22 : 2}
                    transparent
                    opacity={repoCityMode ? 0.1 : 0.3}
                />
            </mesh>

            <pointLight
                color={glowColor}
                intensity={repoCityMode ? 0.5 : 1}
                distance={repoCityMode ? radius * 1.2 : radius * 2}
                position={[0, 2, 0]}
            />
        </group>
    );
}

export function MissionTriggers() {
    const districts = useGameStore((state) => state.districts);

    return (
        <>
            {districts.map((d) => (
                <MissionTrigger
                    key={d.id}
                    districtId={d.id}
                    position={[d.position[0], 0, d.position[1]]}
                    radius={5}
                    color={d.color}
                />
            ))}
        </>
    );
}
