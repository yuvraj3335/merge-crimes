import { useState, useEffect, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';

type EncounterCopySource = {
    name?: string;
    summary?: string;
    title?: string;
    description?: string;
    resolutionText?: string;
    hunks?: Array<{
        label?: string;
        side?: string;
    }>;
};

function getEncounterCopy(encounter: EncounterCopySource) {
    const encounterTitle = [encounter.title, encounter.name]
        .map((value) => value?.trim())
        .find((value): value is string => Boolean(value))
        ?? 'Critical encounter';
    const encounterSummary = [encounter.summary, encounter.description]
        .map((value) => value?.trim())
        .find((value): value is string => Boolean(value))
        ?? 'A hostile route is destabilizing this district. Choose the safest response before the window closes.';
    const resolutionText = [
        encounter.resolutionText,
        encounter.hunks?.find((hunk) => hunk.side === 'resolved')?.label,
    ]
        .map((value) => value?.trim())
        .find((value): value is string => Boolean(value))
        ?? 'Lock the curated route before the district destabilizes.';

    return { encounterTitle, encounterSummary, resolutionText };
}

export function MergeConflictGame() {
    const { phase, activeConflict, resolveBossFight, missionTimer, setMissionTimer, repoCityMode, districts } = useGameStore(useShallow((state) => ({
        phase: state.phase,
        activeConflict: state.activeConflict,
        resolveBossFight: state.resolveBossFight,
        missionTimer: state.missionTimer,
        setMissionTimer: state.setMissionTimer,
        repoCityMode: state.repoCityMode,
        districts: state.districts,
    })));
    if (phase !== 'boss' || !activeConflict) return null;
    const encounterCopy = getEncounterCopy(activeConflict);

    return (
        <BossEncounterOverlay
            key={activeConflict.id}
            activeConflict={activeConflict}
            missionTimer={missionTimer}
            resolveBossFight={resolveBossFight}
            setMissionTimer={setMissionTimer}
            repoCityMode={repoCityMode}
            districtName={districts.find((district) => district.id === activeConflict.districtId)?.name ?? activeConflict.districtId}
            encounterTitle={encounterCopy.encounterTitle}
            encounterSummary={encounterCopy.encounterSummary}
            resolutionText={encounterCopy.resolutionText}
        />
    );
}

interface BossEncounterOverlayProps {
    activeConflict: NonNullable<ReturnType<typeof useGameStore.getState>['activeConflict']>;
    missionTimer: number;
    resolveBossFight: (success: boolean) => void;
    setMissionTimer: (t: number) => void;
    repoCityMode: boolean;
    districtName: string;
    encounterTitle: string;
    encounterSummary: string;
    resolutionText: string;
}

function BossEncounterOverlay({
    activeConflict,
    missionTimer,
    resolveBossFight,
    setMissionTimer,
    repoCityMode,
    districtName,
    encounterTitle,
    encounterSummary,
    resolutionText,
}: BossEncounterOverlayProps) {
    const [selectedHunkIds, setSelectedHunkIds] = useState<number[]>([]);
    const [result, setResult] = useState<'success' | 'failure' | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [isResolving, setIsResolving] = useState(false);

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
        if (result || isResolving || !activeConflict || selectedHunkIds.includes(hunkId)) return;

        const nextSelectedHunkIds = [...selectedHunkIds, hunkId];
        setSelectedHunkIds(nextSelectedHunkIds);

        const expectedPrefix = activeConflict.correctOrder.slice(0, nextSelectedHunkIds.length);
        const matchesExpectedOrder = expectedPrefix.every((expectedHunkId, index) => (
            expectedHunkId === nextSelectedHunkIds[index]
        ));

        if (!matchesExpectedOrder) {
            setIsResolving(true);
            setTimeout(() => {
                setResult('failure');
                setShowResult(true);
                setIsResolving(false);
            }, 800);
            return;
        }

        if (nextSelectedHunkIds.length < activeConflict.correctOrder.length) {
            return;
        }

        setIsResolving(true);
        setTimeout(() => {
            setResult('success');
            setShowResult(true);
            setIsResolving(false);
        }, 800);
    }, [activeConflict, isResolving, result, selectedHunkIds]);

    const handleContinue = useCallback(() => {
        resolveBossFight(result === 'success');
        setSelectedHunkIds([]);
        setResult(null);
        setShowResult(false);
        setIsResolving(false);
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
        if (!selectedHunkIds.includes(hunkId)) {
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
                                <div className="boss-kicker">Boss route</div>
                                <div className="boss-title repo-city">{encounterTitle}</div>
                                <div className="boss-subtitle repo-city">{encounterSummary}</div>
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
                                    Review {activeConflict.hunks.length} candidate responses and lock the cleanest route.
                                    {activeConflict.correctOrder.length > 1 && (
                                        <div className="boss-resolution-note repo-city">
                                            {`Lock responses in order (${selectedHunkIds.length}/${activeConflict.correctOrder.length}).`}
                                        </div>
                                    )}
                                    <div className="boss-resolution-note repo-city">{`Resolution route: ${resolutionText}`}</div>
                                </div>

                                <div className="boss-hunks repo-city">
                                    {activeConflict.hunks.map((hunk) => (
                                        <button
                                            key={hunk.id}
                                            type="button"
                                            className={`hunk-card repo-city ${getHunkStateClassName(hunk.id)}`.trim()}
                                            onClick={() => handleHunkSelect(hunk.id)}
                                            aria-pressed={selectedHunkIds.includes(hunk.id)}
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
                                    {result === 'success' ? 'Threat stabilized' : 'Threat unresolved'}
                                </div>
                                <div className={`boss-result ${result} repo-city`}>
                                    {result === 'success' ? 'Encounter cleared' : 'Encounter lost'}
                                </div>
                                <div className="boss-result-copy">
                                    {result === 'success'
                                        ? `Resolution locked: ${resolutionText}.`
                                        : `${encounterTitle} overran ${districtName} before the resolution route could lock.`}
                                </div>
                                {result === 'success' && (
                                    <div className="boss-reward-chip">+{activeConflict.reward}¢ secured</div>
                                )}
                                <button className="boss-continue-btn repo-city" type="button" onClick={handleContinue}>
                                    {result === 'success' ? 'Return to city' : 'Leave encounter'}
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
            <div className="boss-title">{`⚔ ${encounterTitle} ⚔`}</div>
            <div className="boss-subtitle">{encounterSummary}</div>
            <div className="boss-resolution-note">{`Resolution route: ${resolutionText}`}</div>

            {!showResult && (
                <>
                    <div className="boss-timer" style={{ color: getTimerColor(), textShadow: `0 0 20px ${getTimerColor()}` }}>
                        {missionTimer}s
                    </div>

                    <div className="boss-instruction">
                        Review the candidate responses and lock the cleanest route
                        {activeConflict.correctOrder.length > 1
                            ? ` (${selectedHunkIds.length}/${activeConflict.correctOrder.length} locked)`
                            : ''}
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
                        {result === 'success' ? '✓ ENCOUNTER CLEARED' : '✗ ENCOUNTER LOST'}
                    </div>
                    <div className="boss-result-copy">
                        {result === 'success'
                            ? `Resolution locked: ${resolutionText}.`
                            : `${encounterTitle} pushed past the safe route.`}
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
