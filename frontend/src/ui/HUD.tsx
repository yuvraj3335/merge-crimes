import { memo, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import type { GameState } from '../store/gameStore';
import { SEED_FACTION_BY_ID } from '../../../shared/seed/factions';
import type { District } from '../../../shared/types';
import { buildSnapshotFreshnessCopy } from './snapshotFreshness';

const MISSION_TYPE_COLORS: Record<string, string> = {
    delivery: '#00ff88',
    escape: '#ff4444',
    recovery: '#4488ff',
    defense: '#ff8800',
    boss: '#ffdd00',
};

function getHeatColor(heat: number): string {
    if (heat < 30) return '#00ff88';
    if (heat < 60) return '#ffff00';
    if (heat < 80) return '#ff6b35';
    return '#ff0044';
}

function getHeatLabel(heat: number): string {
    if (heat < 30) return 'stable';
    if (heat < 60) return 'watch';
    if (heat < 80) return 'elevated';
    return 'critical';
}

function measureRouteDistance(start: [number, number, number], pathPoints: [number, number, number][]): number {
    let total = 0;
    let previous = start;

    pathPoints.forEach((point) => {
        total += Math.hypot(point[0] - previous[0], point[2] - previous[2]);
        previous = point;
    });

    return total;
}

function formatTransitDistance(distance: number): string {
    if (distance < 10) return `${distance.toFixed(1)}m`;
    return `${Math.round(distance)}m`;
}

const selectHudState = (state: GameState) => ({
    phase: state.phase,
    credits: state.credits,
    reputation: state.reputation,
    currentDistrict: state.currentDistrict,
    activeMission: state.activeMission,
    missionTimer: state.missionTimer,
    showMissionPanel: state.showMissionPanel,
    setShowMissionPanel: state.setShowMissionPanel,
    showLeaderboard: state.showLeaderboard,
    setShowLeaderboard: state.setShowLeaderboard,
    showBulletin: state.showBulletin,
    setShowBulletin: state.setShowBulletin,
    playerPosition: state.playerPosition,
    districts: state.districts,
    currentWaypointIndex: state.currentWaypointIndex,
    captureProgress: state.captureProgress,
    districtRooms: state.districtRooms,
    repoCityMode: state.repoCityMode,
    connectedRepo: state.connectedRepo,
    generatedCity: state.generatedCity,
    repoCityTransit: state.repoCityTransit,
});

type DirectionArrowProps = {
    playerPosition: [number, number, number];
    waypointPosition: [number, number, number];
    color: string;
};

type MinimapProps = {
    playerPosition: [number, number, number];
    districts: District[];
    waypointPosition: [number, number, number] | null;
    waypointColor: string;
};

// App subscribes broadly to the game store, so memoizing the HUD keeps unrelated parent updates
// from rebuilding the overlay while Zustand still pushes the HUD's own selected state changes through.
export const HUD = memo(function HUD() {
    const {
        phase,
        credits,
        reputation,
        currentDistrict,
        activeMission,
        missionTimer,
        showMissionPanel,
        setShowMissionPanel,
        showLeaderboard,
        setShowLeaderboard,
        showBulletin,
        setShowBulletin,
        playerPosition,
        districts,
        currentWaypointIndex,
        captureProgress,
        districtRooms,
        repoCityMode,
        connectedRepo,
        generatedCity,
        repoCityTransit,
    } = useGameStore(useShallow(selectHudState));
    const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
    const hideHud = phase === 'menu' || phase === 'boss';

    useEffect(() => {
        if (hideHud || !repoCityMode || !connectedRepo) {
            return;
        }

        const intervalId = window.setInterval(() => {
            setFreshnessNow(Date.now());
        }, 30_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [connectedRepo, hideHud, repoCityMode]);

    if (hideHud) return null;

    // Current waypoint info for the mission-active bar
    const currentWp = activeMission?.waypoints[currentWaypointIndex];
    const totalWaypoints = activeMission?.waypoints.length ?? 0;
    const missionColor = activeMission ? (MISSION_TYPE_COLORS[activeMission.type] || '#00ff88') : '#00ff88';
    const missionDistrictName = activeMission
        ? districts.find((district) => district.id === activeMission.districtId)?.name ?? activeMission.districtId
        : null;
    const missionRouteLabel = activeMission
        ? (activeMission.type === 'boss' ? 'Boss route' : `${activeMission.type} route`)
        : null;
    const missionStepLabel = activeMission
        ? `${currentWp ? currentWaypointIndex + 1 : totalWaypoints}/${totalWaypoints}`
        : null;
    const missionCueLabel = currentWp?.label ?? 'All route steps complete';
    const transitGeneratedDistrict = repoCityTransit && generatedCity
        ? generatedCity.districts.find((district) => district.id === repoCityTransit.districtId) ?? null
        : null;
    const transitDistrict = repoCityMode && repoCityTransit
        ? districts.find((district) => district.id === repoCityTransit.districtId) ?? currentDistrict
        : null;
    const scopedDistrict = repoCityMode
        ? transitDistrict ?? currentDistrict
        : currentDistrict;
    const currentRoom = scopedDistrict ? districtRooms[scopedDistrict.id] : undefined;
    const currentCapture = scopedDistrict ? captureProgress[scopedDistrict.id] : undefined;
    const districtStatusLabel = scopedDistrict
        ? getHeatLabel(scopedDistrict.heatLevel)
        : 'idle';
    const districtShellTitle = scopedDistrict?.name ?? 'No district selected';
    const districtShellSubtitle = repoCityTransit
        ? 'Queued destination status preview'
        : activeMission
            ? 'Mission routing active on the surface'
            : scopedDistrict
                ? 'Current district status'
                : 'Select a district on the map';
    const remainingTransitPath = repoCityTransit
        ? [
            ...repoCityTransit.pathPoints.slice(repoCityTransit.pathIndex),
            repoCityTransit.targetPosition,
        ]
        : [];
    const transitStatus = repoCityMode && repoCityTransit
        ? {
            destination: transitDistrict?.name ?? currentDistrict?.name ?? 'Selected district',
            routeLabel: repoCityTransit.mode === 'roads' ? 'Road-guided transit' : 'Direct transit',
            routeDetail: repoCityTransit.mode === 'roads'
                ? 'Following generated routes to the district edge'
                : 'Cross-city approach with a straight entry line',
            distanceLabel: formatTransitDistance(measureRouteDistance(playerPosition, remainingTransitPath)),
            arrivalLabel: transitGeneratedDistrict
                ? `Approaching ${transitGeneratedDistrict.category} district`
                : 'Arrival will update district context',
            routeClassName: repoCityTransit.mode === 'roads' ? 'roads' : 'direct',
        }
        : null;
    const repoCityStats = [
        {
            key: 'credits',
            label: 'Credits',
            value: credits.toLocaleString(),
            meta: 'Current city recovery budget',
        },
        {
            key: 'reputation',
            label: 'Reputation',
            value: reputation.toLocaleString(),
            meta: 'Current maintainer standing',
        },
    ] as const;
    const snapshotFreshness = repoCityMode && connectedRepo
        ? buildSnapshotFreshnessCopy(
            connectedRepo.generatedAt,
            connectedRepo.metadata?.provider === 'github' ? 'github' : 'seeded',
            freshnessNow,
        )
        : null;

    return (
        <div className={`hud-overlay ${repoCityMode ? 'repo-city-hud' : ''}`}>
            {/* Top Bar */}
            <div className={`hud-top-bar ${repoCityMode ? 'repo-city' : ''}`}>
                <div className={`hud-shell-stack ${repoCityMode ? 'repo-city' : ''}`}>
                    {repoCityMode ? (
                        <div className="hud-stats repo-city">
                            <div className="hud-stats-kicker">City resources</div>
                            <div className="hud-stats-grid">
                                {repoCityStats.map((stat) => (
                                    <div key={stat.key} className={`hud-stat-card ${stat.key}`}>
                                        <span className="hud-stat-card-label">{stat.label}</span>
                                        <span className="hud-stat-card-value">{stat.value}</span>
                                        <span className="hud-stat-card-meta">{stat.meta}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="hud-stats">
                            <div className="stat-item">
                                <span className="stat-label">Credits</span>
                                <span className="stat-value">{credits.toLocaleString()}</span>
                            </div>
                            <div className="stat-divider" />
                            <div className="stat-item">
                                <span className="stat-label">Rep</span>
                                <span className="stat-value">{reputation}</span>
                            </div>
                        </div>
                    )}

                    {repoCityMode && connectedRepo && (
                        <div className="repo-hud-badge repo-city">
                            <span className="repo-hud-icon">⬡</span>
                            <div className="repo-hud-copy">
                                <span className="repo-hud-name">{connectedRepo.owner}/{connectedRepo.name}</span>
                                {generatedCity && (
                                    <span className="repo-hud-count">
                                        {generatedCity.districts.length} districts · {generatedCity.bots.length} threats
                                    </span>
                                )}
                                {snapshotFreshness && (
                                    <div className="repo-hud-provenance">
                                        <span
                                            className={`repo-hud-provenance-pill ${snapshotFreshness.source}`.trim()}
                                        >
                                            {snapshotFreshness.sourceLabel}
                                        </span>
                                        <div className="repo-hud-provenance-copy">
                                            <span className="repo-hud-provenance-primary">
                                                {snapshotFreshness.primary}
                                            </span>
                                            {snapshotFreshness.detail && (
                                                <time
                                                    className="repo-hud-provenance-detail"
                                                    dateTime={connectedRepo.generatedAt}
                                                >
                                                    {snapshotFreshness.detail}
                                                </time>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {repoCityMode && transitStatus && (
                        <div className="repo-transit-card">
                            <div className="repo-transit-header">
                                <div>
                                    <div className="repo-transit-kicker">Transit active</div>
                                    <div className="repo-transit-title">{transitStatus.destination}</div>
                                </div>
                                <span className={`repo-transit-route ${transitStatus.routeClassName}`}>
                                    {transitStatus.routeLabel}
                                </span>
                            </div>
                            <div className="repo-transit-detail">{transitStatus.routeDetail}</div>
                            <div className="repo-transit-meta">
                                <span className="repo-transit-chip distance">
                                    {transitStatus.distanceLabel} remaining
                                </span>
                                <span className="repo-transit-chip">
                                    {transitStatus.arrivalLabel}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Repo City Badge */}
                {!repoCityMode && connectedRepo && (
                    <div className="repo-hud-badge">
                        <span className="repo-hud-icon">⬡</span>
                        <span className="repo-hud-name">{connectedRepo.owner}/{connectedRepo.name}</span>
                        {generatedCity && (
                            <span className="repo-hud-count">{generatedCity.bots.length} threats</span>
                        )}
                    </div>
                )}

                {/* District Info */}
                {repoCityMode ? (
                    <div
                        className={`district-info repo-city ${scopedDistrict ? '' : 'idle'}`.trim()}
                        style={scopedDistrict ? { borderColor: `${scopedDistrict.color}55` } : undefined}
                    >
                        <div className="district-info-header">
                            <div>
                                <div
                                    className="district-name"
                                    style={scopedDistrict ? { color: scopedDistrict.color } : undefined}
                                >
                                    {districtShellTitle}
                                </div>
                                <div className="district-faction">
                                    {districtShellSubtitle}
                                </div>
                            </div>
                            <span className={`district-status-pill ${districtStatusLabel}`}>
                                {districtStatusLabel}
                            </span>
                        </div>

                        <div className="district-meta-row">
                            {scopedDistrict ? (
                                <>
                                    {repoCityTransit && (
                                        <span className="district-meta-chip">Queued destination</span>
                                    )}
                                    <span className="district-meta-chip">Heat {scopedDistrict.heatLevel}</span>
                                    <span className="district-meta-chip">
                                        {currentRoom ? `${currentRoom.presenceCount} online` : 'No sync yet'}
                                    </span>
                                    <span className="district-meta-chip">
                                        {currentCapture ? `${Math.round(currentCapture.progress)}% stable` : '0% stable'}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span className="district-meta-chip">Select a district on the map</span>
                                    <span className="district-meta-chip">Missions stay in the side panel</span>
                                </>
                            )}
                        </div>
                    </div>
                ) : currentDistrict && (
                    <div className="district-info" style={{ borderColor: currentDistrict.color + '55' }}>
                        <div className="district-name" style={{ color: currentDistrict.color }}>
                            {currentDistrict.name}
                        </div>
                        <div className="district-faction">
                            Controlled by {SEED_FACTION_BY_ID[currentDistrict.faction].name}
                        </div>
                        {districtRooms[currentDistrict.id] !== undefined && (
                            <div className="district-presence">
                                {districtRooms[currentDistrict.id].presenceCount} online
                            </div>
                        )}
                        <div className="district-heat">
                            <span className="heat-label">Heat</span>
                            <div className="heat-bar">
                                <div
                                    className="heat-fill"
                                    style={{
                                        width: `${currentDistrict.heatLevel}%`,
                                        background: getHeatColor(currentDistrict.heatLevel),
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Active Mission Bar */}
            {activeMission && phase === 'mission' && (
                <>
                    {repoCityMode ? (
                        <div className="mission-active-bar repo-city" style={{ borderColor: `${missionColor}33` }}>
                            <div className="mission-active-content repo-city">
                                <div className="mission-active-header repo-city">
                                    <div className="mission-active-heading">
                                        <div className="mission-active-kicker">Active route</div>
                                        <div className="mission-active-title repo-city" style={{ color: missionColor }}>
                                            {activeMission.title}
                                        </div>
                                    </div>
                                    {missionTimer > 0 && (
                                        <div className={`mission-time-pill repo-city ${missionTimer <= 10 ? 'critical' : ''}`}>
                                            {missionTimer}s
                                        </div>
                                    )}
                                </div>

                                <div className="mission-active-meta repo-city">
                                    {missionRouteLabel && (
                                        <span className={`mission-active-chip route-type ${activeMission.type}`}>
                                            {missionRouteLabel}
                                        </span>
                                    )}
                                    {missionDistrictName && (
                                        <span className="mission-active-chip">
                                            {missionDistrictName}
                                        </span>
                                    )}
                                    {missionStepLabel && (
                                        <span className="mission-active-chip">
                                            {missionStepLabel}
                                        </span>
                                    )}
                                </div>

                                <div className="mission-active-obj repo-city">
                                    <span className="mission-active-obj-label">
                                        {currentWp ? 'Current cue' : 'Route status'}
                                    </span>
                                    <span className="mission-active-obj-value">
                                        {missionCueLabel}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mission-active-bar" style={{ borderColor: missionColor }}>
                            <div className="mission-active-copy">
                                <div className="mission-active-title" style={{ color: missionColor }}>
                                    {activeMission.title}
                                </div>
                                <div className="mission-active-obj">
                                    {currentWp
                                        ? `▸ ${currentWp.label}  (${currentWaypointIndex + 1}/${totalWaypoints})`
                                        : 'All objectives complete!'}
                                </div>
                            </div>
                        </div>
                    )}
                    {!repoCityMode && missionTimer > 0 && (
                        <div className="mission-timer">
                            <div className="timer-label">Time Remaining</div>
                            <div className={`timer-value ${missionTimer <= 10 ? 'critical' : ''}`}>
                                {missionTimer}s
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Direction Arrow */}
            {!repoCityMode && activeMission && phase === 'mission' && currentWp && (
                <DirectionArrow
                    playerPosition={playerPosition}
                    waypointPosition={currentWp.position}
                    color={missionColor}
                />
            )}

            {/* Bottom Bar */}
            <div className={`hud-bottom-bar ${repoCityMode ? 'repo-city' : ''}`}>
                {/* Controls */}
                <div className={`hud-controls ${repoCityMode ? 'repo-city' : ''}`}>
                    <button
                        className={`hud-btn ${showMissionPanel ? 'active' : ''}`}
                        data-testid="toggle-missions"
                        onClick={() => setShowMissionPanel(!showMissionPanel)}
                    >
                        {repoCityMode ? (
                            <>
                                <span className="hud-control-label">Routes</span>
                                <span className="hud-control-meta">
                                    {showMissionPanel ? 'Hide mission routes [M]' : 'Browse mission routes [M]'}
                                </span>
                            </>
                        ) : (
                            'Missions [M]'
                        )}
                    </button>
                    <button
                        className={`hud-btn ${showLeaderboard ? 'active' : ''}`}
                        onClick={() => setShowLeaderboard(!showLeaderboard)}
                    >
                        {repoCityMode ? (
                            <>
                                <span className="hud-control-label">Rankings</span>
                                <span className="hud-control-meta">
                                    {showLeaderboard ? 'Hide district standings [L]' : 'Open district standings [L]'}
                                </span>
                            </>
                        ) : (
                            'Rankings [L]'
                        )}
                    </button>
                    <button
                        className={`hud-btn ${showBulletin ? 'active' : ''}`}
                        onClick={() => setShowBulletin(!showBulletin)}
                    >
                        {repoCityMode ? (
                            <>
                                <span className="hud-control-label">Bulletin</span>
                                <span className="hud-control-meta">
                                    {showBulletin ? 'Hide repo alerts [B]' : 'Open repo alerts [B]'}
                                </span>
                            </>
                        ) : (
                            'Bulletin [B]'
                        )}
                    </button>
                </div>

                {/* Minimap */}
                {!repoCityMode && (
                    <Minimap
                        playerPosition={playerPosition}
                        districts={districts}
                        waypointPosition={activeMission && phase === 'mission' && currentWp ? currentWp.position : null}
                        waypointColor={missionColor}
                    />
                )}
            </div>
        </div>
    );
});

HUD.displayName = 'HUD';

const DirectionArrow = memo(function DirectionArrow({ playerPosition, waypointPosition, color }: DirectionArrowProps) {
    const dx = waypointPosition[0] - playerPosition[0];
    const dz = waypointPosition[2] - playerPosition[2];
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Angle from player to waypoint (in screen space: -Z is "up" on screen)
    // atan2 gives angle, we convert to CSS rotation (0 = up)
    const angle = Math.atan2(dx, -dz) * (180 / Math.PI);

    // Don't show if very close
    if (dist < 5) return null;

    const distText = dist < 10 ? `${dist.toFixed(1)}m` : `${Math.round(dist)}m`;

    return (
        <div className="direction-arrow" style={{ color }}>
            <div
                className="direction-arrow-icon"
                style={{ transform: `rotate(${angle}deg)` }}
            >
                ▲
            </div>
            <div className="direction-arrow-dist">{distText}</div>
        </div>
    );
});

DirectionArrow.displayName = 'DirectionArrow';

const Minimap = memo(function Minimap({ playerPosition, districts, waypointPosition, waypointColor }: MinimapProps) {
    const mapSize = 150;
    const worldSize = 200;
    const scale = mapSize / worldSize;
    const districtRects = useMemo(() => (
        districts.map((district) => ({
            id: district.id,
            style: {
                left: `${(district.position[0] + worldSize / 2 - district.size[0] / 2) * scale}px`,
                top: `${(district.position[1] + worldSize / 2 - district.size[1] / 2) * scale}px`,
                width: `${district.size[0] * scale}px`,
                height: `${district.size[1] * scale}px`,
                backgroundColor: district.color,
            },
        }))
    ), [districts, scale, worldSize]);

    return (
        <div className="minimap">
            {/* Districts */}
            {districtRects.map((district) => (
                <div
                    key={district.id}
                    className="minimap-district"
                    style={district.style}
                />
            ))}

            {/* Waypoint dot */}
            {waypointPosition && (
                <div
                    className="minimap-waypoint"
                    style={{
                        left: `${(waypointPosition[0] + worldSize / 2) * scale}px`,
                        top: `${(waypointPosition[2] + worldSize / 2) * scale}px`,
                        backgroundColor: waypointColor,
                        color: waypointColor,
                    }}
                />
            )}

            {/* Player dot */}
            <div
                className="minimap-player"
                style={{
                    left: `${(playerPosition[0] + worldSize / 2) * scale}px`,
                    top: `${(playerPosition[2] + worldSize / 2) * scale}px`,
                }}
            />
        </div>
    );
});

Minimap.displayName = 'Minimap';
