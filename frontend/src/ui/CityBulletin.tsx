import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '../store/gameStore';

export function CityBulletin() {
    const { showBulletin, setShowBulletin, events, districts, phase, repoCityMode } = useGameStore(useShallow((state) => ({
        showBulletin: state.showBulletin,
        setShowBulletin: state.setShowBulletin,
        events: state.events,
        districts: state.districts,
        phase: state.phase,
        repoCityMode: state.repoCityMode,
    })));

    if (!showBulletin || phase === 'boss') return null;

    return (
        <div className={`bulletin-panel ${repoCityMode ? 'repo-city' : ''}`}>
            <div className={`bulletin-header ${repoCityMode ? 'repo-city' : ''}`}>
                <div className="bulletin-heading">
                    {repoCityMode && (
                        <div className="bulletin-kicker">Signal feed</div>
                    )}
                    <div className="bulletin-title">{repoCityMode ? 'Repo Bulletin' : '📡 City Bulletin'}</div>
                    {repoCityMode && (
                        <div className="bulletin-subtitle">
                            {events.length === 1 ? '1 live event' : `${events.length} live events`}
                        </div>
                    )}
                </div>
                <button
                    className={repoCityMode ? 'overlay-close-btn' : 'hud-btn'}
                    onClick={() => setShowBulletin(false)}
                >
                    ✕
                </button>
            </div>

            {events.map((event) => (
                <div key={event.id} className={`bulletin-event ${repoCityMode ? 'repo-city' : ''}`}>
                    {repoCityMode && (
                        <div className="bulletin-event-topline">
                            <span className="bulletin-district-chip">
                                {districts.find((district) => district.id === event.districtId)?.name ?? event.districtId}
                            </span>
                            <span className={`bulletin-severity severity-${event.severity}`}>
                                {event.severity}
                            </span>
                        </div>
                    )}
                    <div className="bulletin-headline">{event.headline}</div>
                    <div className="bulletin-desc">{event.description}</div>
                    {!repoCityMode && (
                        <span className={`bulletin-severity severity-${event.severity}`}>
                            {event.severity}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}
