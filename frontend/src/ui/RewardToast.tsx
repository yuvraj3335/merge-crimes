import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';

export function RewardToast() {
    const { rewardToasts, repoCityMode } = useGameStore(useShallow((state) => ({
        rewardToasts: state.rewardToasts,
        repoCityMode: state.repoCityMode,
    })));

    if (rewardToasts.length === 0) return null;

    return (
        <div className={`reward-toast-container ${repoCityMode ? 'repo-city' : ''}`.trim()} aria-live="polite" aria-atomic="true">
            {rewardToasts.map((toast) => (
                <div key={toast.id} className={`reward-toast ${repoCityMode ? 'repo-city' : ''}`.trim()}>
                    {repoCityMode ? (
                        <>
                            <div className="reward-toast-header">
                                <div>
                                    <div className="reward-toast-kicker">Route clear</div>
                                    <div className="reward-toast-label">{toast.label}</div>
                                </div>
                                <div className="reward-toast-chip">Reward</div>
                            </div>
                            <div className="reward-toast-copy">District stability improved.</div>
                            <div className="reward-toast-values repo-city">
                                <div className="reward-toast-metric">
                                    <span className="reward-toast-metric-label">Credits</span>
                                    <span className="reward-credits">+{toast.credits}¢</span>
                                </div>
                                <div className="reward-toast-metric">
                                    <span className="reward-toast-metric-label">Reputation</span>
                                    <span className="reward-rep">+{toast.rep} Rep</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="reward-toast-label">{toast.label}</div>
                            <div className="reward-toast-values">
                                <span className="reward-credits">+{toast.credits}¢</span>
                                <span className="reward-rep">+{toast.rep} Rep</span>
                            </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}
