import * as api from '../api';
import { useGameStore } from '../store/gameStore';

export function ConnectionStatusBanner() {
    const {
        phase,
        apiAvailable,
        apiConnectionState,
        apiStatusMessage,
        writeSessionState,
        writeSessionMessage,
        loadFromApi,
        repoCityMode,
    } = useGameStore();

    if (phase === 'menu') {
        return null;
    }

    const renderBanner = ({
        tone,
        testId,
        status,
        label,
        kicker,
        title,
        message,
        pill,
        actionLabel,
        onAction,
    }: {
        tone: 'warning' | 'info' | 'error';
        testId: string;
        status: string;
        label: string;
        kicker: string;
        title: string;
        message: string;
        pill: string;
        actionLabel?: string;
        onAction?: () => void;
    }) => (
        <div
            className={`connection-status connection-status-${tone} ${repoCityMode ? 'repo-city' : ''}`.trim()}
            data-testid={testId}
            data-status={status}
            aria-live={tone === 'error' ? 'assertive' : 'polite'}
            role={tone === 'error' ? 'alert' : 'status'}
        >
            {repoCityMode ? (
                <>
                    <div className="connection-status-header">
                        <div className="connection-status-heading">
                            <div className="connection-status-kicker">{kicker}</div>
                            <div className="connection-status-title">{title}</div>
                        </div>
                        <div className="connection-status-pill">{pill}</div>
                    </div>
                    <div className="connection-status-copy">{message}</div>
                    {actionLabel && onAction && (
                        <button className="connection-status-btn repo-city" type="button" onClick={onAction}>
                            {actionLabel}
                        </button>
                    )}
                </>
            ) : (
                <>
                    <div className="connection-status-label">{label}</div>
                    <div className="connection-status-text">{message}</div>
                    {actionLabel && onAction && (
                        <button className="connection-status-btn" type="button" onClick={onAction}>
                            {actionLabel}
                        </button>
                    )}
                </>
            )}
        </div>
    );

    if (!apiAvailable && apiConnectionState === 'offline') {
        return renderBanner({
            tone: 'warning',
            testId: 'connection-status-offline',
            status: 'offline',
            label: 'Seed Mode',
            kicker: 'Worker link',
            title: 'Seed mode active',
            message: apiStatusMessage ?? 'Worker API unavailable. Running local seed mode.',
            pill: 'Fallback',
            actionLabel: 'Retry Worker Sync',
            onAction: () => {
                void loadFromApi();
            },
        });
    }

    if (writeSessionState === 'checking') {
        return renderBanner({
            tone: 'info',
            testId: 'connection-status-checking',
            status: 'checking',
            label: 'Checking Writes',
            kicker: 'Write session',
            title: 'Checking sync access',
            message: 'Verifying worker write access for this browser session.',
            pill: 'Pending',
        });
    }

    if (writeSessionState === 'error') {
        return renderBanner({
            tone: 'error',
            testId: 'connection-status-write-error',
            status: 'write-error',
            label: 'Read-Only Warning',
            kicker: 'Write protection',
            title: 'Read-only mode',
            message: writeSessionMessage ?? 'Worker write access is unavailable right now.',
            pill: 'Blocked',
            actionLabel: 'Retry Write Access',
            onAction: () => {
                void api.primePublicWriteSession().catch(() => {
                    // Runtime status is already updated inside the API client.
                });
            },
        });
    }

    return null;
}
