import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GeneratedRoad } from '../../../shared/repoModel';
import { useGameStore } from '../store/gameStore';

function blendHex(source: string, target: string, amount: number) {
    return `#${new THREE.Color(source).lerp(new THREE.Color(target), amount).getHexString()}`;
}

export function CityGround() {
    const repoCityMode = useGameStore((s) => s.repoCityMode);
    const generatedCity = useGameStore((s) => s.generatedCity);
    const repoCityTransit = useGameStore((s) => s.repoCityTransit);
    const repoRoads = repoCityMode ? generatedCity?.roads ?? [] : [];
    const hasRepoRoads = repoRoads.length > 0;
    const activeTransitRoadIds = repoCityMode && repoCityTransit?.mode === 'roads'
        ? repoCityTransit.roadIds
        : [];

    return (
        <>
            {/* Main ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
                <planeGeometry args={[200, 200]} />
                <meshStandardMaterial
                    color={repoCityMode ? '#0e1520' : '#080810'}
                    emissive={repoCityMode ? '#0b131d' : '#080810'}
                    emissiveIntensity={repoCityMode ? 0.14 : 0}
                    metalness={repoCityMode ? 0.32 : 0.9}
                    roughness={repoCityMode ? 0.84 : 0.2}
                />
            </mesh>

            {repoCityMode && <RepoCityGroundBackdrop />}

            {/* Grid lines */}
            <gridHelper
                args={repoCityMode ? [200, 24, '#203247', '#121927'] : [200, 40, '#1a1a2e', '#0d0d1a']}
                position={[0, 0.01, 0]}
            />

            {repoCityMode ? (
                hasRepoRoads ? <RepoRoads roads={repoRoads} activeRoadIds={activeTransitRoadIds} /> : <RepoFallbackGuides />
            ) : (
                <FallbackRoads />
            )}
        </>
    );
}

function RepoCityGroundBackdrop() {
    return (
        <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
                <circleGeometry args={[74, 64]} />
                <meshStandardMaterial
                    color="#111a28"
                    emissive="#0e1622"
                    emissiveIntensity={0.08}
                    metalness={0.24}
                    roughness={0.9}
                    transparent
                    opacity={0.82}
                />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <ringGeometry args={[18, 52, 64]} />
                <meshStandardMaterial
                    color="#8aa9c6"
                    transparent
                    opacity={0.08}
                    side={THREE.DoubleSide}
                />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
                <ringGeometry args={[6, 14, 48]} />
                <meshStandardMaterial
                    color="#95eab4"
                    transparent
                    opacity={0.06}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </>
    );
}

function FallbackRoads() {
    const roads = useMemo(() => {
        const roadData: Array<{
            pos: [number, number, number];
            size: [number, number];
            rotation: number;
        }> = [
                // Horizontal roads
                { pos: [0, 0.03, -30], size: [200, 3], rotation: 0 },
                { pos: [0, 0.03, 30], size: [200, 3], rotation: 0 },
                { pos: [0, 0.03, 0], size: [200, 4], rotation: 0 },
                // Vertical roads
                { pos: [-30, 0.03, 0], size: [200, 3], rotation: Math.PI / 2 },
                { pos: [30, 0.03, 0], size: [200, 3], rotation: Math.PI / 2 },
                { pos: [0, 0.03, 0], size: [200, 4], rotation: Math.PI / 2 },
            ];
        return roadData;
    }, []);

    return (
        <>
            {roads.map((r, i) => (
                <mesh key={i} position={r.pos} rotation={[-Math.PI / 2, 0, r.rotation]} receiveShadow>
                    <planeGeometry args={r.size} />
                    <meshStandardMaterial
                        color="#0f0f1a"
                        emissive="#111133"
                        emissiveIntensity={0.2}
                        metalness={0.95}
                        roughness={0.1}
                    />
                </mesh>
            ))}

            {/* Road center line dashes */}
            <StaticRoadDashes />
        </>
    );
}

function RepoFallbackGuides() {
    const guides = useMemo(() => {
        return [
            { pos: [0, 0.03, 0] as [number, number, number], size: [176, 2.6] as [number, number], rotation: 0 },
            { pos: [0, 0.03, 0] as [number, number, number], size: [176, 2.6] as [number, number], rotation: Math.PI / 2 },
            { pos: [0, 0.03, -38] as [number, number, number], size: [128, 2.1] as [number, number], rotation: 0 },
            { pos: [0, 0.03, 38] as [number, number, number], size: [128, 2.1] as [number, number], rotation: 0 },
        ];
    }, []);

    return (
        <>
            {guides.map((guide, index) => (
                <mesh
                    key={index}
                    position={guide.pos}
                    rotation={[-Math.PI / 2, 0, guide.rotation]}
                    receiveShadow
                >
                    <planeGeometry args={guide.size} />
                    <meshStandardMaterial
                        color="#182436"
                        emissive="#12202f"
                        emissiveIntensity={0.12}
                        metalness={0.26}
                        roughness={0.82}
                        transparent
                        opacity={0.88}
                    />
                </mesh>
            ))}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
                <ringGeometry args={[10, 18, 48]} />
                <meshStandardMaterial
                    color="#9ab8d1"
                    transparent
                    opacity={0.14}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </>
    );
}

function StaticRoadDashes() {
    const dashRef = useRef<THREE.Group>(null);

    const dashes = useMemo(() => {
        const result: Array<{ pos: [number, number, number]; rot: number }> = [];
        // Horizontal center road
        for (let x = -95; x <= 95; x += 4) {
            result.push({ pos: [x, 0.04, 0], rot: 0 });
        }
        // Vertical center road
        for (let z = -95; z <= 95; z += 4) {
            result.push({ pos: [0, 0.04, z], rot: Math.PI / 2 });
        }
        return result;
    }, []);

    return (
        <group ref={dashRef}>
            {dashes.map((d, i) => (
                <mesh key={i} position={d.pos} rotation={[-Math.PI / 2, 0, d.rot]}>
                    <planeGeometry args={[1.5, 0.15]} />
                    <meshStandardMaterial
                        color="#ffff00"
                        emissive="#ffff00"
                        emissiveIntensity={0.5}
                        transparent
                        opacity={0.6}
                    />
                </mesh>
            ))}
        </group>
    );
}

interface RepoRoadSegment {
    id: string;
    roadId: string;
    position: [number, number, number];
    rotation: number;
    size: [number, number, number];
    dashPositions: Array<[number, number, number]>;
    dashSize: [number, number, number];
    color: string;
    emissive: string;
}

function buildRepoRoadSegments(roads: GeneratedRoad[]): RepoRoadSegment[] {
    return roads.flatMap((road) =>
        road.points.flatMap((point, index) => {
            if (index === 0) {
                return [];
            }

            const previous = road.points[index - 1];
            const dx = point.x - previous.x;
            const dz = point.y - previous.y;
            const length = Math.hypot(dx, dz);

            if (length < 2) {
                return [];
            }

            const centerX = (previous.x + point.x) / 2;
            const centerZ = (previous.y + point.y) / 2;
            const directionX = dx / length;
            const directionZ = dz / length;
            const dashCount = Math.max(1, Math.floor(length / 10));
            const dashSpacing = length / dashCount;
            const dashLength = Math.max(1.8, Math.min(3.6, dashSpacing * 0.45));

            return [{
                id: `${road.id}-${index}`,
                roadId: road.id,
                position: [centerX, 0.05, centerZ] as [number, number, number],
                rotation: Math.atan2(dz, dx),
                size: [length, 0.12, road.width] as [number, number, number],
                dashPositions: Array.from({ length: dashCount }, (_, dashIndex) => {
                    const offset = -length / 2 + dashSpacing * (dashIndex + 0.5);
                    return [
                        centerX + directionX * offset,
                        0.12,
                        centerZ + directionZ * offset,
                    ] as [number, number, number];
                }),
                dashSize: [
                    dashLength,
                    0.04,
                    Math.max(0.18, Math.min(0.36, road.width * 0.14)),
                ] as [number, number, number],
                color: blendHex(road.color, '#243549', 0.62),
                emissive: blendHex(road.emissive, '#88a7bf', 0.48),
            }];
        }),
    );
}

function RepoRoads({ roads, activeRoadIds }: { roads: GeneratedRoad[]; activeRoadIds: string[] }) {
    const segments = useMemo(() => buildRepoRoadSegments(roads), [roads]);
    const activeRoadIdSet = useMemo(() => new Set(activeRoadIds), [activeRoadIds]);

    return (
        <>
            {segments.map((segment) => {
                const isActive = activeRoadIdSet.has(segment.roadId);
                const roadColor = isActive ? blendHex(segment.color, '#dbeafe', 0.56) : segment.color;
                const roadEmissive = isActive ? blendHex(segment.emissive, '#fef3c7', 0.34) : segment.emissive;
                const dashColor = isActive ? blendHex(segment.emissive, '#fff6bf', 0.22) : segment.emissive;
                const roadHeight = isActive ? 0.16 : segment.size[1];
                const roadWidth = isActive ? segment.size[2] + 0.12 : segment.size[2];
                const dashHeight = isActive ? 0.06 : segment.dashSize[1];
                const dashWidth = isActive ? segment.dashSize[2] + 0.04 : segment.dashSize[2];

                return (
                    <group key={segment.id}>
                    <mesh
                        position={segment.position}
                        rotation={[0, segment.rotation, 0]}
                        receiveShadow
                    >
                        <boxGeometry args={[segment.size[0], roadHeight, roadWidth]} />
                        <meshStandardMaterial
                            color={roadColor}
                            emissive={roadEmissive}
                            emissiveIntensity={isActive ? 0.34 : 0.12}
                            metalness={isActive ? 0.26 : 0.32}
                            roughness={isActive ? 0.56 : 0.78}
                        />
                    </mesh>

                    {segment.dashPositions.map((dashPosition, dashIndex) => (
                        <mesh
                            key={`${segment.id}-dash-${dashIndex}`}
                            position={dashPosition}
                            rotation={[0, segment.rotation, 0]}
                        >
                            <boxGeometry args={[segment.dashSize[0], dashHeight, dashWidth]} />
                            <meshStandardMaterial
                                color={dashColor}
                                emissive={dashColor}
                                emissiveIntensity={isActive ? 0.62 : 0.24}
                                transparent
                                opacity={isActive ? 0.84 : 0.48}
                            />
                        </mesh>
                    ))}
                    </group>
                );
            })}
        </>
    );
}

export function CityLighting() {
    const repoCityMode = useGameStore((s) => s.repoCityMode);

    return (
        <>
            {/* Ambient base */}
            <ambientLight intensity={repoCityMode ? 0.28 : 0.15} color={repoCityMode ? '#95abc7' : '#1a1a3e'} />

            {repoCityMode && (
                <hemisphereLight
                    args={['#aec3dd', '#0b1018', 0.18]}
                />
            )}

            {/* Main directional (moonlight) */}
            <directionalLight
                intensity={repoCityMode ? 0.42 : 0.3}
                position={repoCityMode ? [36, 72, 24] : [50, 80, 30]}
                color={repoCityMode ? '#d5e4f7' : '#4444aa'}
                castShadow
                shadow-mapSize-width={2048}
                shadow-mapSize-height={2048}
                shadow-camera-far={200}
                shadow-camera-left={-100}
                shadow-camera-right={100}
                shadow-camera-top={100}
                shadow-camera-bottom={-100}
            />

            {/* Fog for depth */}
            <fog attach="fog" args={repoCityMode ? ['#0a121d', 42, 165] : ['#050510', 30, 150]} />

            {!repoCityMode && <StreetLights />}
        </>
    );
}

function StreetLights() {
    const lights = useMemo(() => {
        const result: Array<{ pos: [number, number, number]; color: string }> = [];
        const colors = ['#00f0ff', '#ff00ff', '#ffff00', '#00ff88', '#ff6b35'];
        let ci = 0;

        // Along main roads
        for (let x = -90; x <= 90; x += 20) {
            result.push({ pos: [x, 6, 2], color: colors[ci % colors.length] });
            result.push({ pos: [x, 6, -2], color: colors[(ci + 2) % colors.length] });
            ci++;
        }
        for (let z = -90; z <= 90; z += 20) {
            result.push({ pos: [2, 6, z], color: colors[ci % colors.length] });
            result.push({ pos: [-2, 6, z], color: colors[(ci + 1) % colors.length] });
            ci++;
        }
        return result;
    }, []);

    return (
        <>
            {lights.map((l, i) => (
                <group key={i}>
                    {/* Light pole */}
                    <mesh position={[l.pos[0], l.pos[1] / 2, l.pos[2]]}>
                        <cylinderGeometry args={[0.05, 0.05, l.pos[1], 6]} />
                        <meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} />
                    </mesh>
                    {/* Light fixture */}
                    <mesh position={l.pos}>
                        <sphereGeometry args={[0.2, 8, 8]} />
                        <meshStandardMaterial
                            color={l.color}
                            emissive={l.color}
                            emissiveIntensity={2}
                        />
                    </mesh>
                    <pointLight
                        color={l.color}
                        intensity={1.5}
                        distance={15}
                        position={l.pos}
                    />
                </group>
            ))}
        </>
    );
}

export function CityProps() {
    const propsRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!propsRef.current) return;
        // Subtle floating animation for hologram props
        propsRef.current.children.forEach((child, i) => {
            if (child.userData.hologram) {
                child.position.y = child.userData.baseY + Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.3;
            }
        });
    });

    const holograms = useMemo(() => {
        return [
            { pos: [0, 12, 0] as [number, number, number], color: '#00f0ff', text: 'MERGE CRIMES' },
            { pos: [-30, 14, -30] as [number, number, number], color: '#61DAFB', text: 'REACT' },
            { pos: [30, 14, -30] as [number, number, number], color: '#FF6B35', text: 'RUST' },
            { pos: [-30, 14, 30] as [number, number, number], color: '#FFD43B', text: 'PYTHON' },
            { pos: [30, 14, 30] as [number, number, number], color: '#00ADD8', text: 'GO' },
            { pos: [0, 14, -60] as [number, number, number], color: '#3178C6', text: 'TS' },
            { pos: [0, 14, 60] as [number, number, number], color: '#A855F7', text: 'LINUX' },
        ];
    }, []);

    return (
        <group ref={propsRef}>
            {holograms.map((h, i) => {
                const mesh = (
                    <group key={i} position={h.pos} userData={{ hologram: true, baseY: h.pos[1] }}>
                        {/* Holographic billboard */}
                        <mesh>
                            <boxGeometry args={[6, 2, 0.1]} />
                            <meshStandardMaterial
                                color={h.color}
                                emissive={h.color}
                                emissiveIntensity={1.5}
                                transparent
                                opacity={0.5}
                                side={THREE.DoubleSide}
                            />
                        </mesh>
                    </group>
                );
                return mesh;
            })}
        </group>
    );
}
