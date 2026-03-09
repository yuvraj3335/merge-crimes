import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';

export function CaptureOverlay() {
    const { currentDistrict, captureProgress, phase, repoCityMode } = useGameStore(useShallow((state) => ({
        currentDistrict: state.currentDistrict,
        captureProgress: state.captureProgress,
        phase: state.phase,
        repoCityMode: state.repoCityMode,
    })));

    if (!currentDistrict || phase === 'menu' || phase === 'boss') return null;

    const capture = captureProgress[currentDistrict.id];
    if (!capture) return null;

    const isCaptured = capture.progress >= 100;
    const isCapturing = !isCaptured;
    const capturePercent = Math.round(capture.progress);

    if (repoCityMode) {
        return (
            <div className={`capture-overlay repo-city ${isCaptured ? 'captured' : ''} ${isCapturing ? 'capturing' : ''}`}>
                <div className="capture-header repo-city">
                    <div className="capture-heading">
                        <div className="capture-kicker">District stability</div>
                        <div className="capture-district repo-city" style={{ color: currentDistrict.color }}>
                            {currentDistrict.name}
                        </div>
                    </div>
                    <span className={`capture-state-pill ${isCaptured ? 'stable' : 'syncing'}`}>
                        {isCaptured ? 'stable' : 'syncing'}
                    </span>
                </div>

                <div className="capture-meta-row">
                    <span className="capture-meta-chip">{capturePercent}% stable</span>
                    <span className="capture-meta-chip">
                        {isCaptured ? 'Recovery complete' : 'Live sync in progress'}
                    </span>
                </div>

                <div className="capture-bar repo-city">
                    <div
                        className="capture-fill repo-city"
                        style={{
                            width: `${capture.progress}%`,
                            background: `linear-gradient(90deg, ${currentDistrict.color}88, ${currentDistrict.color})`,
                            boxShadow: `0 0 8px ${currentDistrict.color}`,
                        }}
                    />
                </div>

                <div className={`capture-status repo-city ${isCaptured ? 'captured' : ''}`.trim()}>
                    {isCapturing ? (
                        <>
                            <span className="capture-pulse">●</span>
                            Stability sweep active in the current district
                        </>
                    ) : (
                        'District stability restored'
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`capture-overlay ${isCaptured ? 'captured' : ''} ${isCapturing ? 'capturing' : ''}`}>
            <div className="capture-header">
                <span className="capture-label">
                    {isCaptured ? '★ Territory Captured' : 'Infiltrating Territory'}
                </span>
                <span className="capture-percent" style={{ color: currentDistrict.color }}>
                    {capturePercent}%
                </span>
            </div>
            <div className="capture-bar">
                <div
                    className="capture-fill"
                    style={{
                        width: `${capture.progress}%`,
                        background: `linear-gradient(90deg, ${currentDistrict.color}88, ${currentDistrict.color})`,
                        boxShadow: `0 0 8px ${currentDistrict.color}`,
                    }}
                />
            </div>
            {isCapturing && (
                <div className="capture-status">
                    <span className="capture-pulse">●</span> Capturing...
                </div>
            )}
        </div>
    );
}
