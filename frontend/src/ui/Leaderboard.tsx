import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';

export function Leaderboard() {
    const { showLeaderboard, setShowLeaderboard, leaderboard, factions, phase, activeMission, repoCityMode } = useGameStore(useShallow((state) => ({
        showLeaderboard: state.showLeaderboard,
        setShowLeaderboard: state.setShowLeaderboard,
        leaderboard: state.leaderboard,
        factions: state.factions,
        phase: state.phase,
        activeMission: state.activeMission,
        repoCityMode: state.repoCityMode,
    })));

    // Hide leaderboard during active missions: the objective tracker occupies the same
    // left-panel slot (left: hud-padding, top: 50%), so both showing simultaneously
    // causes a full visual overlap.
    if (!showLeaderboard || phase === 'boss' || (phase === 'mission' && !!activeMission)) return null;

    const getRankColor = (rank: number) => {
        if (rank === 1) return '#FFD700';
        if (rank === 2) return '#C0C0C0';
        if (rank === 3) return '#CD7F32';
        return 'var(--text-secondary)';
    };

    return (
        <div className={`leaderboard-panel ${repoCityMode ? 'repo-city' : ''}`}>
            <div className={`leaderboard-header ${repoCityMode ? 'repo-city' : ''}`}>
                <div className="leaderboard-heading">
                    {repoCityMode && (
                        <div className="leaderboard-kicker">District control</div>
                    )}
                    <div className="leaderboard-title">Faction Rankings</div>
                    {repoCityMode && (
                        <div className="leaderboard-subtitle">
                            Live territory pressure across {leaderboard.length} factions
                        </div>
                    )}
                </div>
                <button
                    className={repoCityMode ? 'overlay-close-btn' : 'hud-btn'}
                    onClick={() => setShowLeaderboard(false)}
                >
                    ✕
                </button>
            </div>

            {leaderboard.map((entry) => (
                <div key={entry.factionId} className={`leaderboard-entry ${repoCityMode ? 'repo-city' : ''}`}>
                    <div className="leaderboard-rank" style={{ color: getRankColor(entry.rank) }}>
                        #{entry.rank}
                    </div>
                    <div
                        className="leaderboard-faction-bar"
                        style={{ backgroundColor: factions.find((f) => f.id === entry.factionId)?.color || '#fff' }}
                    />
                    <div className="leaderboard-info">
                        <div className="leaderboard-faction-name">{entry.factionName}</div>
                        <div className="leaderboard-score">
                            {entry.score.toLocaleString()} pts · {entry.missionsCompleted} missions
                        </div>
                    </div>
                    {repoCityMode ? (
                        <div className="leaderboard-metrics">
                            <div className="leaderboard-districts" title="Districts controlled">
                                {entry.districtsControlled} districts
                            </div>
                            <div className="leaderboard-missions">
                                {entry.missionsCompleted} clears
                            </div>
                        </div>
                    ) : (
                        <div className="leaderboard-districts" title="Districts controlled">
                            🏴 {entry.districtsControlled}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
