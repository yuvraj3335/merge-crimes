import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../store/gameStore';

export function MergeConflictGame() {
    const { phase, activeConflict, resolveBossFight, missionTimer, setMissionTimer, repoCityMode, districts } = useGameStore();
    if (phase !== 'boss' || !activeConflict) return null;

    return (
        <MergeConflictGameInner
            key={activeConflict.id}
            activeConflict={activeConflict}
            missionTimer={missionTimer}
            resolveBossFight={resolveBossFight}
            setMissionTimer={setMissionTimer}
            repoCityMode={repoCityMode}
            districtName={districts.find((district) => district.id === activeConflict.districtId)?.name ?? activeConflict.districtId}
        />
    );
}

interface MergeConflictGameInnerProps {
    activeConflict: NonNullable<ReturnType<typeof useGameStore.getState>['activeConflict']>;
    missionTimer: number;
    resolveBossFight: (success: boolean) => void;
    setMissionTimer: (t: number) => void;
    repoCityMode: boolean;
    districtName: string;
}

function MergeConflictGameInner({
    activeConflict,
    missionTimer,
    resolveBossFight,
    setMissionTimer,
    repoCityMode,
    districtName,
}: MergeConflictGameInnerProps) {
    const [selectedHunk, setSelectedHunk] = useState<number | null>(null);
    const [result, setResult] = useState<'success' | 'failure' | null>(null);
    const [showResult, setShowResult] = useState(false);

    // Timer countdown
    useEffect(() => {
        if (result) return;

        const interval = setInterval(() => {
            setMissionTimer(missionTimer - 1);
            if (missionTimer <= 1) {
                setResult('failure');
                setShowResult(true);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [missionTimer, result, setMissionTimer]);

    const handleHunkSelect = useCallback((hunkId: number) => {
        if (result || !activeConflict) return;
        setSelectedHunk(hunkId);

        // Check if correct
        const isCorrect = activeConflict.correctOrder.includes(hunkId);

        setTimeout(() => {
            if (isCorrect) {
                setResult('success');
            } else {
                setResult('failure');
            }
            setShowResult(true);
        }, 800);
    }, [result, activeConflict]);

    const handleContinue = useCallback(() => {
        resolveBossFight(result === 'success');
        setSelectedHunk(null);
        setResult(null);
        setShowResult(false);
    }, [result, resolveBossFight]);

    const getTimerColor = () => {
        if (missionTimer <= 5) return '#ff0044';
        if (missionTimer <= 10) return 'var(--neon-orange)';
        return 'var(--neon-cyan)';
    };

    const getTimerTone = () => {
        if (missionTimer <= 5) return 'critical';
        if (missionTimer <= 10) return 'warning';
        return 'stable';
    };

    const getHunkStateClassName = (hunkId: number) => {
        if (selectedHunk !== hunkId) {
            return '';
        }

        if (result === 'success') {
            return 'correct';
        }

        if (result === 'failure') {
            return 'wrong';
        }

        return 'selected';
    };

    if (repoCityMode) {
        return (
            <div className="boss-overlay repo-city">
                <div className="boss-shell">
                    <div className="boss-panel">
                        <div className="boss-header repo-city">
                            <div className="boss-heading">
                                <div className="boss-kicker">Conflict route</div>
                                <div className="boss-title repo-city">{activeConflict.title}</div>
                                <div className="boss-subtitle repo-city">{activeConflict.description}</div>
                            </div>
                            <div className={`boss-timer-block ${getTimerTone()}`}>
                                <div className="boss-timer repo-city">{missionTimer}s</div>
                                <div className="boss-timer-caption">resolve window</div>
                            </div>
                        </div>

                        <div className="boss-meta repo-city">
                            <span className="boss-pill">{districtName}</span>
                            <span className="boss-pill">+{activeConflict.reward}¢ reward</span>
                            <span className="boss-pill">{'★'.repeat(activeConflict.difficulty)} difficulty</span>
                        </div>

                        {!showResult ? (
                            <>
                                <div className="boss-instruction repo-city">
                                    Choose the safest merge plan from {activeConflict.hunks.length} candidate resolutions.
                                </div>

                                <div className="boss-hunks repo-city">
                                    {activeConflict.hunks.map((hunk) => (
                                        <button
                                            key={hunk.id}
                                            type="button"
                                            className={`hunk-card repo-city ${getHunkStateClassName(hunk.id)}`.trim()}
                                            onClick={() => handleHunkSelect(hunk.id)}
                                            aria-pressed={selectedHunk === hunk.id}
                                        >
                                            <div className="hunk-card-topline">
                                                <span className={`hunk-side ${hunk.side}`}>{hunk.side}</span>
                                                <span className="hunk-id">Option {hunk.id}</span>
                                            </div>
                                            <div className="hunk-label">{hunk.label}</div>
                                            <div className="hunk-code">{hunk.code}</div>
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className={`boss-result-panel repo-city ${result ?? ''}`.trim()}>
                                <div className="boss-result-kicker">
                                    {result === 'success' ? 'Conflict stabilized' : 'Conflict unresolved'}
                                </div>
                                <div className={`boss-result ${result} repo-city`}>
                                    {result === 'success' ? 'Merge restored' : 'Merge failed'}
                                </div>
                                <div className="boss-result-copy">
                                    {result === 'success'
                                        ? `Safe merge applied in ${districtName}.`
                                        : 'The conflict route collapsed before a safe merge could land.'}
                                </div>
                                {result === 'success' && (
                                    <div className="boss-reward-chip">+{activeConflict.reward}¢ secured</div>
                                )}
                                <button className="boss-continue-btn repo-city" type="button" onClick={handleContinue}>
                                    {result === 'success' ? 'Return to city' : 'Exit conflict'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="boss-overlay">
            <div className="boss-title">⚔ MERGE CONFLICT ⚔</div>
            <div className="boss-subtitle">{activeConflict.description}</div>

            {!showResult && (
                <>
                    <div className="boss-timer" style={{ color: getTimerColor(), textShadow: `0 0 20px ${getTimerColor()}` }}>
                        {missionTimer}s
                    </div>

                    <div className="boss-instruction">
                        Choose the correct resolution
                    </div>

                    <div className="boss-hunks">
                        {activeConflict.hunks.map((hunk) => (
                            <div
                                key={hunk.id}
                                className={`hunk-card ${getHunkStateClassName(hunk.id)}`.trim()}
                                onClick={() => handleHunkSelect(hunk.id)}
                            >
                                <span className={`hunk-side ${hunk.side}`}>{hunk.side}</span>
                                <div className="hunk-label">{hunk.label}</div>
                                <div className="hunk-code">{hunk.code}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {showResult && (
                <>
                    <div className={`boss-result ${result}`}>
                        {result === 'success' ? '✓ MERGED SUCCESSFULLY' : '✗ MERGE FAILED'}
                    </div>
                    {result === 'success' && (
                        <div style={{ color: 'var(--neon-green)', marginTop: 8, fontSize: '14px', fontFamily: 'var(--font-mono)' }}>
                            +{activeConflict.reward}¢ earned
                        </div>
                    )}
                    <button className="boss-continue-btn" onClick={handleContinue}>
                        Continue
                    </button>
                </>
            )}
        </div>
    );
}
