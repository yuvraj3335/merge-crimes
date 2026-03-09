import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';
import { getWaypointDistanceAndText } from '../game/waypointUtils';

export function MissionObjectiveTracker() {
    const {
        activeMission,
        currentWaypointIndex,
        completedWaypoints,
        phase,
        playerPosition,
        repoCityMode,
        districts,
    } = useGameStore(useShallow((state) => ({
        activeMission: state.activeMission,
        currentWaypointIndex: state.currentWaypointIndex,
        completedWaypoints: state.completedWaypoints,
        phase: state.phase,
        playerPosition: state.playerPosition,
        repoCityMode: state.repoCityMode,
        districts: state.districts,
    })));

    if (!activeMission || phase === 'boss' || phase === 'menu') return null;

    const waypoints = activeMission.waypoints;
    const currentWp = waypoints[currentWaypointIndex];
    const missionDistrictName = districts.find((district) => district.id === activeMission.districtId)?.name ?? activeMission.districtId;
    const routeTypeLabel = activeMission.type === 'boss' ? 'Boss route' : `${activeMission.type} route`;

    // Calculate distance to current waypoint
    let distanceText = '';
    if (currentWp) {
        distanceText = getWaypointDistanceAndText(playerPosition, currentWp.position).text;
    }

    if (repoCityMode) {
        const currentCueLabel = currentWp ? currentWp.label : 'All route steps complete';
        const currentCueDetail = currentWp
            ? (distanceText ? `${distanceText} remaining` : 'Stay on route')
            : 'All route steps cleared';
        const routeStep = currentWp
            ? Math.min(currentWaypointIndex + 1, waypoints.length)
            : waypoints.length;

        return (
            <div className="objective-tracker repo-city">
                <div className="objective-tracker-header repo-city">
                    <div className="objective-tracker-heading">
                        <div className="objective-tracker-kicker">Active route</div>
                        <div className="objective-tracker-title repo-city">{activeMission.title}</div>
                    </div>
                    <div className="objective-tracker-step">
                        {routeStep}/{waypoints.length}
                    </div>
                </div>

                <div className="objective-tracker-meta repo-city">
                    <span className={`objective-tracker-chip route-type ${activeMission.type}`}>
                        {routeTypeLabel}
                    </span>
                    <span className="objective-tracker-chip">{missionDistrictName}</span>
                </div>

                <div className={`objective-tracker-current repo-city ${currentWp ? '' : 'complete'}`.trim()}>
                    <div className="objective-tracker-current-label">
                        {currentWp ? 'Current cue' : 'Route status'}
                    </div>
                    <div className="objective-tracker-current-value">{currentCueLabel}</div>
                    <div className="objective-tracker-current-detail">{currentCueDetail}</div>
                </div>

                <div className="objective-list repo-city">
                    {waypoints.map((wp, i) => {
                        const isCompleted = completedWaypoints.includes(wp.id);
                        const isCurrent = i === currentWaypointIndex;
                        return (
                            <div
                                key={wp.id}
                                className={`objective-item repo-city ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`.trim()}
                            >
                                <span className={`objective-check repo-city ${isCompleted ? 'completed' : isCurrent ? 'current' : ''}`.trim()}>
                                    {isCompleted ? '✓' : i + 1}
                                </span>
                                <span className="objective-label">{wp.label}</span>
                                {isCurrent && distanceText && (
                                    <span className="objective-distance repo-city">{distanceText}</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="objective-tracker">
            <div className="objective-tracker-header">
                <div className="objective-tracker-title">Objectives</div>
            </div>
            <div className="objective-list">
                {waypoints.map((wp, i) => {
                    const isCompleted = completedWaypoints.includes(wp.id);
                    const isCurrent = i === currentWaypointIndex;
                    return (
                        <div
                            key={wp.id}
                            className={`objective-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                        >
                            <span className="objective-check">
                                {isCompleted ? '✓' : isCurrent ? '▸' : '○'}
                            </span>
                            <span className="objective-label">{wp.label}</span>
                            {isCurrent && distanceText && (
                                <span className="objective-distance">{distanceText}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
