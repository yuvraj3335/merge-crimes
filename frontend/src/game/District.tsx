import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { District as DistrictType } from '../../../shared/types';

interface DistrictProps {
    district: DistrictType;
}

// Seeded random for deterministic building placement
function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

export function District({ district }: DistrictProps) {
    const groupRef = useRef<THREE.Group>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    const color = new THREE.Color(district.color);
    const emissive = new THREE.Color(district.emissive);

    // Generate deterministic building positions
    const buildings = useMemo(() => {
        const rand = seededRandom(district.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));
        const result: Array<{
            pos: [number, number, number];
            size: [number, number, number];
            color: string;
            emissiveIntensity: number;
        }> = [];

        const [cx, cz] = district.position;
        const [w, d] = district.size;
        const buildingCount = 12 + Math.floor(rand() * 8);

        for (let i = 0; i < buildingCount; i++) {
            const bw = 1.5 + rand() * 3;
            const bd = 1.5 + rand() * 3;
            const bh = 2 + rand() * 10;
            const bx = cx - w / 2 + 3 + rand() * (w - 6);
            const bz = cz - d / 2 + 3 + rand() * (d - 6);

            result.push({
                pos: [bx, bh / 2, bz],
                size: [bw, bh, bd],
                color: district.color,
                emissiveIntensity: 0.15 + rand() * 0.4,
            });
        }
        return result;
    }, [district]);

    // Animate district glow
    useFrame((state) => {
        if (glowRef.current) {
            const t = state.clock.elapsedTime;
            const mat = glowRef.current.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = 0.3 + Math.sin(t * 0.8 + district.heatLevel * 0.05) * 0.15;
        }
    });

    return (
        <group ref={groupRef}>
            {/* Ground plane */}
            <mesh
                ref={glowRef}
                position={[district.position[0], 0.02, district.position[1]]}
                rotation={[-Math.PI / 2, 0, 0]}
                receiveShadow
            >
                <planeGeometry args={[district.size[0], district.size[1]]} />
                <meshStandardMaterial
                    color={color.clone().multiplyScalar(0.15)}
                    emissive={emissive}
                    emissiveIntensity={0.3}
                    metalness={0.8}
                    roughness={0.3}
                />
            </mesh>

            {/* Border lines */}
            <lineSegments position={[district.position[0], 0.05, district.position[1]]}>
                <edgesGeometry args={[new THREE.PlaneGeometry(district.size[0], district.size[1])]} />
                <lineBasicMaterial color={district.color} transparent opacity={0.5} />
            </lineSegments>

            {/* Buildings */}
            {buildings.map((b, i) => (
                <mesh key={i} position={b.pos} castShadow receiveShadow>
                    <boxGeometry args={b.size} />
                    <meshStandardMaterial
                        color={new THREE.Color(b.color).multiplyScalar(0.2)}
                        emissive={emissive}
                        emissiveIntensity={b.emissiveIntensity}
                        metalness={0.9}
                        roughness={0.15}
                    />
                </mesh>
            ))}

            {/* Window accent lights on some buildings */}
            {buildings.slice(0, 6).map((b, i) => {
                const windowRows = Math.floor(b.size[1] / 1.5);
                return Array.from({ length: windowRows }, (_, row) => (
                    <mesh
                        key={`win-${i}-${row}`}
                        position={[
                            b.pos[0],
                            1 + row * 1.5,
                            b.pos[2] + b.size[2] / 2 + 0.01,
                        ]}
                    >
                        <planeGeometry args={[b.size[0] * 0.6, 0.3]} />
                        <meshStandardMaterial
                            color={district.color}
                            emissive={district.color}
                            emissiveIntensity={1.2}
                            transparent
                            opacity={0.7}
                        />
                    </mesh>
                ));
            })}

            {/* District label (floating text indicator via a glowing box) */}
            <mesh position={[district.position[0], 15, district.position[1]]}>
                <boxGeometry args={[8, 1.5, 0.1]} />
                <meshStandardMaterial
                    color={district.color}
                    emissive={district.color}
                    emissiveIntensity={2}
                    transparent
                    opacity={0.8}
                />
            </mesh>

            {/* District point light */}
            <pointLight
                color={district.color}
                intensity={5}
                distance={district.size[0] * 1.2}
                position={[district.position[0], 8, district.position[1]]}
            />
        </group>
    );
}
