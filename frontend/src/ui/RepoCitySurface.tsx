import { useMemo, useState } from 'react';
import { useGameStore } from '../store/gameStore';

interface SurfaceBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
}

function computeSurfaceBounds(city: NonNullable<ReturnType<typeof useGameStore.getState>['generatedCity']>): SurfaceBounds {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    city.districts.forEach((district) => {
        minX = Math.min(minX, district.position.x - district.footprint.width / 2);
        maxX = Math.max(maxX, district.position.x + district.footprint.width / 2);
        minY = Math.min(minY, district.position.y - district.footprint.height / 2);
        maxY = Math.max(maxY, district.position.y + district.footprint.height / 2);
    });

    city.roads.forEach((road) => {
        road.points.forEach((point) => {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        });
    });

    const padding = 18;

    return {
        minX: minX - padding,
        maxX: maxX + padding,
        minY: minY - padding,
        maxY: maxY + padding,
        width: Math.max(1, maxX - minX + padding * 2),
        height: Math.max(1, maxY - minY + padding * 2),
    };
}

function getHeatLabel(heatLevel: number): string {
    if (heatLevel >= 80) return 'critical';
    if (heatLevel >= 60) return 'elevated';
    if (heatLevel >= 35) return 'watch';
    return 'stable';
}

function getHeatClassName(heatLevel: number): string {
    if (heatLevel >= 80) return 'critical';
    if (heatLevel >= 60) return 'elevated';
    if (heatLevel >= 35) return 'watch';
    return 'stable';
}

function formatDistance(distance: number): string {
    if (distance < 10) return `${distance.toFixed(1)}m`;
    return `${Math.round(distance)}m`;
}

function measureSurfacePathDistance(
    startPoint: { x: number; y: number },
    pathPoints: Array<{ x: number; y: number }>,
): number {
    let total = 0;
    let previous = startPoint;

    pathPoints.forEach((point) => {
        total += Math.hypot(point.x - previous.x, point.y - previous.y);
        previous = point;
    });

    return total;
}

function getMissionCountLabel(count: number): string {
    if (count <= 0) return 'no missions ready';
    if (count === 1) return '1 mission ready';
    return `${count} missions ready`;
}

export function RepoCitySurface() {
    const phase = useGameStore((s) => s.phase);
    const repoCityMode = useGameStore((s) => s.repoCityMode);
    const generatedCity = useGameStore((s) => s.generatedCity);
    const currentDistrict = useGameStore((s) => s.currentDistrict);
    const missions = useGameStore((s) => s.missions);
    const activeMission = useGameStore((s) => s.activeMission);
    const currentWaypointIndex = useGameStore((s) => s.currentWaypointIndex);
    const playerPosition = useGameStore((s) => s.playerPosition);
    const repoCityTransit = useGameStore((s) => s.repoCityTransit);
    const movePlayerToDistrict = useGameStore((s) => s.movePlayerToDistrict);
    const setShowMissionPanel = useGameStore((s) => s.setShowMissionPanel);
    const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null);

    const activeWaypoint = activeMission?.waypoints[currentWaypointIndex] ?? null;

    const bounds = useMemo(() => (
        generatedCity ? computeSurfaceBounds(generatedCity) : null
    ), [generatedCity]);

    const availableMissionCounts = useMemo(() => {
        const counts = new Map<string, number>();
        missions.forEach((mission) => {
            if (mission.status !== 'available') {
                return;
            }

            counts.set(mission.districtId, (counts.get(mission.districtId) ?? 0) + 1);
        });
        return counts;
    }, [missions]);

    if (!repoCityMode || !generatedCity || !bounds || phase === 'menu' || phase === 'boss') {
        return null;
    }

    const mapX = (x: number) => x - bounds.minX;
    const mapY = (y: number) => bounds.maxY - y;
    const canSelectDistricts = phase === 'playing' && !activeMission;
    const currentSurfaceDistrict = currentDistrict
        ? generatedCity.districts.find((district) => district.id === currentDistrict.id) ?? null
        : null;
    const currentMissionDistrict = activeMission
        ? generatedCity.districts.find((district) => district.id === activeMission.districtId) ?? null
        : null;
    const transitDistrict = repoCityTransit
        ? generatedCity.districts.find((district) => district.id === repoCityTransit.districtId) ?? null
        : null;
    const hoveredDistrict = hoveredDistrictId
        ? generatedCity.districts.find((district) => district.id === hoveredDistrictId) ?? null
        : null;
    const focusedDistrict = transitDistrict ?? hoveredDistrict ?? currentSurfaceDistrict ?? currentMissionDistrict;
    const statusDistrict = transitDistrict ?? currentSurfaceDistrict ?? null;
    const focusedDistrictMissionCount = focusedDistrict
        ? availableMissionCounts.get(focusedDistrict.id) ?? 0
        : 0;
    const transitPathPoints = repoCityTransit
        ? repoCityTransit.pathPoints.slice(repoCityTransit.pathIndex).map((point) => ({ x: point[0], y: point[2] }))
        : [];
    const guidanceTarget = activeWaypoint
        ? {
            pathPoints: [{
                x: activeWaypoint.position[0],
                y: activeWaypoint.position[2],
            }],
            color: '#ffd95f',
            label: activeWaypoint.label,
            distance: measureSurfacePathDistance(
                { x: playerPosition[0], y: playerPosition[2] },
                [{
                    x: activeWaypoint.position[0],
                    y: activeWaypoint.position[2],
                }],
            ),
        }
        : transitDistrict
            ? {
                pathPoints: transitPathPoints.length > 0
                    ? transitPathPoints
                    : [{
                        x: transitDistrict.position.x,
                        y: transitDistrict.position.y,
                    }],
                color: transitDistrict.emissive,
                label: transitDistrict.name,
                distance: measureSurfacePathDistance(
                    { x: playerPosition[0], y: playerPosition[2] },
                    transitPathPoints.length > 0
                        ? transitPathPoints
                        : [{
                            x: transitDistrict.position.x,
                            y: transitDistrict.position.y,
                        }],
                ),
            }
            : canSelectDistricts && hoveredDistrict
            ? {
                pathPoints: [{
                    x: hoveredDistrict.position.x,
                    y: hoveredDistrict.position.y,
                }],
                color: hoveredDistrict.emissive,
                label: hoveredDistrict.name,
                distance: measureSurfacePathDistance(
                    { x: playerPosition[0], y: playerPosition[2] },
                    [{
                        x: hoveredDistrict.position.x,
                        y: hoveredDistrict.position.y,
                    }],
                ),
            }
            : null;
    const focusLabel = transitDistrict
        ? `${transitDistrict.name} · ${repoCityTransit?.mode === 'roads' ? 'road-guided transit' : 'transit queued'}`
        : focusedDistrict
            ? `${focusedDistrict.name} · ${focusedDistrictMissionCount > 0
            ? getMissionCountLabel(focusedDistrictMissionCount)
            : `${focusedDistrict.category} district`}`
            : canSelectDistricts
                ? 'Hover or click a district to enter'
                : 'Transit lanes';
    const guidanceLabel = guidanceTarget
        ? transitDistrict && !activeWaypoint
            ? `${repoCityTransit?.mode === 'roads' ? 'Road transit to' : 'Transit to'} ${guidanceTarget.label} · ${formatDistance(guidanceTarget.distance)}`
            : `${guidanceTarget.label} · ${formatDistance(guidanceTarget.distance)}`
        : activeMission
            ? currentMissionDistrict?.name ?? 'No active mission'
            : 'Hover or click a district to enter';
    const statusLabel = transitDistrict
        ? 'Queued district'
        : currentSurfaceDistrict
            ? 'Current district'
            : 'District status';
    const statusValue = statusDistrict?.name ?? 'No district selected';
    const heatStatusClassName = statusDistrict
        ? getHeatClassName(statusDistrict.heatLevel)
        : 'idle';
    const heatStatusLabel = statusDistrict
        ? getHeatLabel(statusDistrict.heatLevel)
        : 'idle';

    function handleDistrictSelect(districtId: string) {
        if (!canSelectDistricts) {
            return;
        }

        if (currentDistrict?.id === districtId) {
            if ((availableMissionCounts.get(districtId) ?? 0) > 0) {
                setShowMissionPanel(true);
            }
            return;
        }

        setShowMissionPanel(false);
        movePlayerToDistrict(districtId, { animated: true });
    }

    return (
        <div className="repo-city-surface">
            <div className="repo-city-surface-shell">
                <div className="repo-city-surface-header">
                    <div>
                        <div className="repo-city-surface-kicker">Repo city surface</div>
                        <div className="repo-city-surface-title">
                            {generatedCity.repoOwner}/{generatedCity.repoName}
                        </div>
                    </div>
                    <div className="repo-city-surface-meta">
                        <span>{generatedCity.archetype}</span>
                        <span>{generatedCity.districts.length} districts</span>
                        <span>{generatedCity.roads.length} routes</span>
                    </div>
                </div>

                <div className="repo-city-surface-map">
                    <svg
                        className="repo-city-surface-svg"
                        viewBox={`0 0 ${bounds.width} ${bounds.height}`}
                        role="presentation"
                    >
                        <defs>
                            <pattern
                                id="repo-city-grid"
                                width="12"
                                height="12"
                                patternUnits="userSpaceOnUse"
                            >
                                <path
                                    d="M 12 0 L 0 0 0 12"
                                    fill="none"
                                    stroke="rgba(214, 224, 255, 0.08)"
                                    strokeWidth="0.6"
                                />
                            </pattern>
                            <linearGradient id="repo-city-surface-fill" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                                <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
                            </linearGradient>
                        </defs>

                        <rect
                            x="0"
                            y="0"
                            width={bounds.width}
                            height={bounds.height}
                            fill="url(#repo-city-grid)"
                            opacity="0.8"
                        />

                        {generatedCity.roads.map((road) => (
                            <polyline
                                key={road.id}
                                className="repo-city-surface-road"
                                points={road.points.map((point) => `${mapX(point.x)},${mapY(point.y)}`).join(' ')}
                                style={{
                                    stroke: road.emissive,
                                    strokeWidth: Math.max(1.8, road.width * 0.55),
                                }}
                            />
                        ))}

                        {guidanceTarget && (
                            <polyline
                                points={[
                                    `${mapX(playerPosition[0])},${mapY(playerPosition[2])}`,
                                    ...guidanceTarget.pathPoints.map((point) => `${mapX(point.x)},${mapY(point.y)}`),
                                ].join(' ')}
                                className="repo-city-surface-guidance-line"
                                style={{ stroke: guidanceTarget.color }}
                            />
                        )}

                        {generatedCity.districts.map((district) => {
                            const isCurrent = currentDistrict?.id === district.id;
                            const isMissionTarget = currentMissionDistrict?.id === district.id;
                            const isHovered = hoveredDistrictId === district.id;
                            const isQueued = repoCityTransit?.districtId === district.id;
                            const missionCount = availableMissionCounts.get(district.id) ?? 0;
                            const x = mapX(district.position.x - district.footprint.width / 2);
                            const y = mapY(district.position.y + district.footprint.height / 2);

                            return (
                                <g key={district.id}>
                                    {missionCount > 0 && !activeMission && (
                                        <rect
                                            x={x - 1.5}
                                            y={y - 1.5}
                                            width={district.footprint.width + 3}
                                            height={district.footprint.height + 3}
                                            rx="6"
                                            className="repo-city-surface-district-signal"
                                        />
                                    )}

                                    {isMissionTarget && (
                                        <rect
                                            x={x - 2.5}
                                            y={y - 2.5}
                                            width={district.footprint.width + 5}
                                            height={district.footprint.height + 5}
                                            rx="6"
                                            className="repo-city-surface-district-halo"
                                            style={{ stroke: district.emissive }}
                                        />
                                    )}

                                    <rect
                                        x={x - 1}
                                        y={y - 1}
                                        width={district.footprint.width + 2}
                                        height={district.footprint.height + 2}
                                        rx="6"
                                        fill="transparent"
                                        className="repo-city-surface-hitbox"
                                        data-testid={`repo-city-district-${district.id}`}
                                        onMouseEnter={() => setHoveredDistrictId(district.id)}
                                        onMouseLeave={() => setHoveredDistrictId((current) => (
                                            current === district.id ? null : current
                                        ))}
                                        onClick={() => handleDistrictSelect(district.id)}
                                        style={{ cursor: canSelectDistricts ? 'pointer' : 'default' }}
                                    />

                                    <rect
                                        x={x}
                                        y={y}
                                        width={district.footprint.width}
                                        height={district.footprint.height}
                                        rx="5"
                                        className={[
                                            'repo-city-surface-district',
                                            isCurrent ? 'current' : '',
                                            isQueued ? 'queued' : '',
                                            isHovered ? 'hovered' : '',
                                            missionCount > 0 && !activeMission ? 'hot' : '',
                                            canSelectDistricts ? 'selectable' : '',
                                        ].filter(Boolean).join(' ')}
                                        style={{
                                            fill: district.color,
                                            stroke: district.emissive,
                                        }}
                                    />

                                    <text
                                        x={x + district.footprint.width / 2}
                                        y={y + district.footprint.height / 2 - 1}
                                        className="repo-city-surface-label"
                                    >
                                        {district.name}
                                    </text>

                                    <text
                                        x={x + district.footprint.width / 2}
                                        y={y + district.footprint.height / 2 + 6}
                                        className="repo-city-surface-subLabel"
                                    >
                                        {district.category} · heat {district.heatLevel}
                                    </text>

                                    {missionCount > 0 && !activeMission && (
                                        <>
                                            <circle
                                                cx={x + district.footprint.width - 4}
                                                cy={y + 4}
                                                r="2.6"
                                                className="repo-city-surface-mission-badge"
                                            />
                                            <text
                                                x={x + district.footprint.width - 4}
                                                y={y + 4}
                                                className="repo-city-surface-mission-count"
                                            >
                                                {missionCount}
                                            </text>
                                        </>
                                    )}
                                </g>
                            );
                        })}

                        <circle
                            cx={mapX(playerPosition[0])}
                            cy={mapY(playerPosition[2])}
                            r="2.4"
                            className="repo-city-surface-player-ring"
                        />
                        <circle
                            cx={mapX(playerPosition[0])}
                            cy={mapY(playerPosition[2])}
                            r="1.3"
                            className="repo-city-surface-player-dot"
                        />

                        {activeWaypoint && (
                            <>
                                <circle
                                    cx={mapX(activeWaypoint.position[0])}
                                    cy={mapY(activeWaypoint.position[2])}
                                    r="4.5"
                                    className="repo-city-surface-waypoint-ring"
                                />
                                <circle
                                    cx={mapX(activeWaypoint.position[0])}
                                    cy={mapY(activeWaypoint.position[2])}
                                    r="1.4"
                                    className="repo-city-surface-waypoint-dot"
                                />
                            </>
                        )}
                    </svg>

                    <div className="repo-city-surface-legend">
                        <div className="repo-city-surface-legend-row">
                            <span className="repo-city-surface-legend-label">{statusLabel}</span>
                            <span className="repo-city-surface-legend-value">
                                {statusValue}
                            </span>
                        </div>
                        <div className="repo-city-surface-legend-row">
                            <span className="repo-city-surface-legend-label">Surface focus</span>
                            <span className="repo-city-surface-legend-value">
                                {focusLabel}
                            </span>
                        </div>
                        <div className="repo-city-surface-legend-row">
                            <span className="repo-city-surface-legend-label">
                                {activeMission ? 'Approach cue' : 'Entry cue'}
                            </span>
                            <span className="repo-city-surface-legend-value">
                                {canSelectDistricts || activeMission ? guidanceLabel : 'Keep moving with WASD'}
                            </span>
                        </div>
                        <div className="repo-city-surface-legend-row">
                            <span className="repo-city-surface-legend-label">Heat status</span>
                            <span className={`repo-city-surface-legend-pill ${heatStatusClassName}`}>
                                {heatStatusLabel}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
