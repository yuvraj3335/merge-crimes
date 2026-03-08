import { useGameStore } from '../store/gameStore';

export function MissionPanel() {
    const {
        showMissionPanel,
        setShowMissionPanel,
        missions,
        districts,
        currentDistrict,
        repoCityTransit,
        acceptMission,
        activeMission,
        phase,
        apiAvailable,
        writeSessionState,
        writeSessionMessage,
        repoCityMode,
    } = useGameStore();

    if (!showMissionPanel || phase === 'boss') return null;

    const writesBlocked = apiAvailable && (writeSessionState === 'checking' || writeSessionState === 'error');
    const scopedDistrict = repoCityMode && repoCityTransit
        ? districts.find((district) => district.id === repoCityTransit.districtId) ?? currentDistrict
        : currentDistrict;
    const repoCityScopeMode = repoCityMode && repoCityTransit
        ? 'transit'
        : scopedDistrict
            ? 'district'
            : 'city';

    // Repo-city transit previews the queued destination district before arrival.
    const availableMissions = missions.filter((m) => {
        if (m.status !== 'available') return false;
        if (scopedDistrict) return m.districtId === scopedDistrict.id;
        return true;
    });

    const scopeLabel = scopedDistrict ? scopedDistrict.name : 'Repo city';
    const summaryLabel = availableMissions.length === 0
        ? 'No routes ready'
        : availableMissions.length === 1
            ? '1 route ready'
            : `${availableMissions.length} routes ready`;

    return (
        <div className={`mission-panel ${repoCityMode ? 'repo-city' : ''}`} data-testid="mission-panel">
            <div className={`mission-panel-header ${repoCityMode ? 'repo-city' : ''}`}>
                <div className="mission-panel-heading">
                    {repoCityMode && (
                        <div className="mission-panel-kicker">
                            {repoCityScopeMode === 'transit'
                                ? 'Transit routes'
                                : scopedDistrict
                                    ? 'District routes'
                                    : 'City routes'}
                        </div>
                    )}
                    <div className="mission-panel-title">
                        {scopedDistrict ? `${scopedDistrict.name} Missions` : 'Available Missions'}
                    </div>
                    {repoCityMode && (
                        <div className="mission-panel-subtitle">
                            {repoCityScopeMode === 'transit'
                                ? `${scopeLabel} · queued destination · ${summaryLabel}`
                                : `${scopeLabel} · ${summaryLabel}`}
                        </div>
                    )}
                </div>
                <button
                    className={repoCityMode ? 'mission-panel-close' : 'hud-btn'}
                    onClick={() => setShowMissionPanel(false)}
                >
                    ✕
                </button>
            </div>

            {writesBlocked && (
                <div
                    className={`mission-sync-note ${repoCityMode ? 'repo-city' : ''} ${writeSessionState === 'error' ? 'error' : ''}`}
                    data-testid="mission-sync-note"
                >
                    {writeSessionState === 'checking'
                        ? 'Checking worker write access before protected missions can sync.'
                        : (writeSessionMessage ?? 'Worker write access is unavailable. Mission accepts are temporarily blocked.')}
                </div>
            )}

            {availableMissions.length === 0 && (
                <div className={`mission-panel-empty ${repoCityMode ? 'repo-city' : ''}`}>
                    {repoCityMode
                        ? repoCityScopeMode === 'transit'
                            ? 'No routes ready in the queued district.'
                            : 'No routes ready in this district.'
                        : 'No missions available in this area.'}
                    <br />{repoCityMode
                        ? repoCityScopeMode === 'transit'
                            ? 'Stay on course or select another district on the city surface.'
                            : 'Select another district on the city surface.'
                        : 'Explore other districts.'}
                </div>
            )}

            {availableMissions.map((mission) => (
                <div key={mission.id} className={`mission-card ${repoCityMode ? 'repo-city' : ''} ${mission.type === 'boss' ? 'boss' : ''}`}>
                    {repoCityMode && (
                        <div className="mission-card-topline">
                            <span className={`mission-card-type ${mission.type}`}>
                                {mission.type === 'boss' ? 'Boss route' : `${mission.type} route`}
                            </span>
                            <span className="mission-card-district">
                                {districts.find((district) => district.id === mission.districtId)?.name ?? mission.districtId}
                            </span>
                        </div>
                    )}
                    <div className="mission-card-title" style={{ color: mission.type === 'boss' ? 'var(--neon-magenta)' : 'var(--text-primary)' }}>
                        {mission.title}
                    </div>
                    <div className="mission-card-desc">{mission.description}</div>
                    <div className="mission-card-meta">
                        <span className="mission-difficulty">
                            {'★'.repeat(mission.difficulty)}{'☆'.repeat(5 - mission.difficulty)}
                        </span>
                        <span className="mission-reward">+{mission.reward}¢</span>
                        <span className="mission-time">{mission.timeLimit}s</span>
                    </div>
                    {!activeMission && (
                        <button
                            className={`mission-accept-btn ${repoCityMode ? 'repo-city' : ''}`}
                            data-testid={`accept-mission-${mission.id}`}
                            disabled={writesBlocked}
                            onClick={() => {
                                acceptMission(mission.id);
                            }}
                        >
                            {writesBlocked
                                ? (writeSessionState === 'checking' ? 'Checking Sync...' : 'Sync Unavailable')
                                : mission.type === 'boss' ? '⚔ Accept Boss Fight' : '► Accept Mission'}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
