import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { Html } from '@react-three/drei';
import { getWaypointDistanceAndText } from './waypointUtils';

const MISSION_TYPE_COLORS: Record<string, string> = {
    delivery: '#00ff88',
    escape: '#ff4444',
    recovery: '#4488ff',
    defense: '#ff8800',
    boss: '#ffdd00',
};

function calmColor(source: string, amount: number) {
    return `#${new THREE.Color(source).lerp(new THREE.Color('#c5d3e2'), amount).getHexString()}`;
}

export function Waypoint() {
    const markerRef = useRef<THREE.Group>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const beamRef = useRef<THREE.Mesh>(null);
    const { activeMission, currentWaypointIndex, playerPosition, reachWaypoint, phase, repoCityMode } = useGameStore(useShallow((state) => ({
        activeMission: state.activeMission,
        currentWaypointIndex: state.currentWaypointIndex,
        playerPosition: state.playerPosition,
        reachWaypoint: state.reachWaypoint,
        phase: state.phase,
        repoCityMode: state.repoCityMode,
    })));

    useFrame((state) => {
        if (!markerRef.current || !ringRef.current || !beamRef.current) return;
        if (!activeMission || phase === 'boss' || phase === 'menu') return;

        const waypoint = activeMission.waypoints[currentWaypointIndex];
        if (!waypoint) return;

        const t = state.clock.elapsedTime;

        // Bob up and down
        markerRef.current.position.y = waypoint.position[1] + 2 + Math.sin(t * 2) * 0.5;

        // Spin slowly
        markerRef.current.rotation.y = t * 1.5;

        // Ring pulse
        const ringMat = ringRef.current.material as THREE.MeshStandardMaterial;
        ringMat.opacity = repoCityMode
            ? 0.18 + Math.sin(t * 3) * 0.06
            : 0.3 + Math.sin(t * 3) * 0.15;
        ringRef.current.scale.setScalar(1 + Math.sin(t * 2) * 0.1);

        // Beam pulse
        const beamMat = beamRef.current.material as THREE.MeshStandardMaterial;
        beamMat.opacity = repoCityMode
            ? 0.09 + Math.sin(t * 2.5) * 0.04
            : 0.15 + Math.sin(t * 2.5) * 0.1;

        // Check proximity
        const { distance } = getWaypointDistanceAndText(playerPosition, waypoint.position);

        if (distance < waypoint.radius) {
            reachWaypoint(waypoint.id);
        }
    });

    if (!activeMission || phase === 'boss' || phase === 'menu') return null;

    const waypoint = activeMission.waypoints[currentWaypointIndex];
    if (!waypoint) return null;

    const color = MISSION_TYPE_COLORS[activeMission.type] || '#00ff88';
    const markerColor = repoCityMode ? calmColor(color, 0.55) : color;
    const beamColor = repoCityMode ? calmColor(color, 0.72) : color;

    // Calculate distance to player
    const { text: distanceText } = getWaypointDistanceAndText(playerPosition, waypoint.position);

    return (
        <group position={waypoint.position}>
            {/* Ground ring */}
            <mesh
                ref={ringRef}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.06, 0]}
            >
                <ringGeometry args={[waypoint.radius - 0.5, waypoint.radius, 48]} />
                <meshStandardMaterial
                    color={markerColor}
                    emissive={beamColor}
                    emissiveIntensity={repoCityMode ? 0.2 : 1.5}
                    transparent
                    opacity={repoCityMode ? 0.18 : 0.35}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Inner glow disc */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
                <circleGeometry args={[waypoint.radius * 0.6, 32]} />
                <meshStandardMaterial
                    color={markerColor}
                    emissive={beamColor}
                    emissiveIntensity={repoCityMode ? 0.08 : 0.5}
                    transparent
                    opacity={repoCityMode ? 0.06 : 0.1}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Float diamond marker */}
            <group ref={markerRef} position={[0, 2.5, 0]}>
                <mesh>
                    <octahedronGeometry args={[0.6, 0]} />
                    <meshStandardMaterial
                        color={markerColor}
                        emissive={beamColor}
                        emissiveIntensity={repoCityMode ? 0.32 : 2}
                        transparent
                        opacity={repoCityMode ? 0.82 : 0.9}
                        metalness={repoCityMode ? 0.28 : 0.8}
                        roughness={repoCityMode ? 0.74 : 0.1}
                    />
                </mesh>
                {/* Inner glow */}
                <pointLight color={beamColor} intensity={repoCityMode ? 0.9 : 3} distance={repoCityMode ? 5 : 10} />
            </group>

            {/* Vertical beam */}
            <mesh ref={beamRef} position={[0, 8, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 16, 8]} />
                <meshStandardMaterial
                    color={beamColor}
                    emissive={beamColor}
                    emissiveIntensity={repoCityMode ? 0.26 : 2}
                    transparent
                    opacity={repoCityMode ? 0.09 : 0.2}
                />
            </mesh>

            {/* Label */}
            <Html
                position={[0, 4.5, 0]}
                center
                distanceFactor={20}
                style={{
                    pointerEvents: 'none',
                    userSelect: 'none',
                }}
            >
                <div style={{
                    fontFamily: repoCityMode ? 'var(--font-display)' : "'Orbitron', sans-serif",
                    fontSize: repoCityMode ? '10px' : '11px',
                    color: repoCityMode ? '#eef4fb' : color,
                    textShadow: repoCityMode ? 'none' : `0 0 8px ${color}`,
                    textTransform: 'uppercase',
                    letterSpacing: repoCityMode ? '0.12em' : '2px',
                    whiteSpace: 'nowrap',
                    textAlign: 'center',
                    padding: repoCityMode ? '8px 10px' : '0',
                    borderRadius: repoCityMode ? '14px' : '0',
                    border: repoCityMode ? '1px solid rgba(214, 224, 255, 0.12)' : 'none',
                    background: repoCityMode ? 'rgba(7, 9, 18, 0.78)' : 'transparent',
                    boxShadow: repoCityMode ? '0 12px 26px rgba(0, 0, 0, 0.18)' : 'none',
                }}>
                    <div style={{ marginBottom: '2px' }}>{waypoint.label}</div>
                    <div style={{ fontSize: '9px', opacity: repoCityMode ? 0.78 : 0.7, color: repoCityMode ? 'rgba(214, 224, 255, 0.72)' : color }}>
                        {distanceText}
                    </div>
                </div>
            </Html>

            {/* Bright point light at ground level */}
            <pointLight
                color={beamColor}
                intensity={repoCityMode ? 0.7 : 2}
                distance={repoCityMode ? waypoint.radius * 1.8 : waypoint.radius * 3}
                position={[0, 1, 0]}
            />
        </group>
    );
}
