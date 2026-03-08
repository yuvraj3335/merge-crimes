import { useEffect, useState } from 'react';

export type SnapshotSource = 'github' | 'seeded';

interface SnapshotFreshnessCopy {
    badge: string;
    detail: string | null;
    primary: string;
    source: SnapshotSource;
    sourceLabel: string;
}

const SNAPSHOT_DETAIL_FORMATTER = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
});
const SNAPSHOT_RELATIVE_FORMATTER = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
});
const SNAPSHOT_FRESHNESS_TICK_MS = 30_000;

function getSnapshotSourceLabel(source: SnapshotSource): string {
    return source === 'github' ? 'GitHub snapshot' : 'Seeded fixture';
}

function getSnapshotReadyBadge(source: SnapshotSource): string {
    return source === 'github' ? 'GitHub snapshot ready' : 'Seeded fixture ready';
}

function formatSnapshotAge(timestampMs: number, nowMs: number): string {
    const diffMs = nowMs - timestampMs;
    const absoluteDiffMs = Math.abs(diffMs);
    const minuteMs = 60_000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;

    if (absoluteDiffMs < 45_000) {
        return 'just now';
    }

    if (diffMs < 0) {
        return absoluteDiffMs < 5 * minuteMs ? 'just now' : 'recently';
    }

    if (absoluteDiffMs < hourMs) {
        return SNAPSHOT_RELATIVE_FORMATTER.format(-Math.round(diffMs / minuteMs), 'minute');
    }

    if (absoluteDiffMs < dayMs) {
        return SNAPSHOT_RELATIVE_FORMATTER.format(-Math.round(diffMs / hourMs), 'hour');
    }

    return SNAPSHOT_RELATIVE_FORMATTER.format(-Math.round(diffMs / dayMs), 'day');
}

export function buildSnapshotFreshnessCopy(
    generatedAt: string | null | undefined,
    source: SnapshotSource,
    nowMs: number,
): SnapshotFreshnessCopy {
    const sourceLabel = getSnapshotSourceLabel(source);
    const fallbackPrimary = source === 'github'
        ? 'GitHub snapshot time unavailable'
        : 'Seeded fixture time unavailable';

    if (!generatedAt) {
        return {
            badge: getSnapshotReadyBadge(source),
            detail: null,
            primary: fallbackPrimary,
            source,
            sourceLabel,
        };
    }

    const timestamp = new Date(generatedAt);
    if (Number.isNaN(timestamp.getTime())) {
        return {
            badge: getSnapshotReadyBadge(source),
            detail: null,
            primary: fallbackPrimary,
            source,
            sourceLabel,
        };
    }

    const ageCopy = formatSnapshotAge(timestamp.getTime(), nowMs);

    return {
        badge: getSnapshotReadyBadge(source),
        detail: SNAPSHOT_DETAIL_FORMATTER.format(timestamp),
        primary: source === 'github'
            ? `GitHub data refreshed ${ageCopy}`
            : `Seeded fixture snapshot dated ${ageCopy}`,
        source,
        sourceLabel,
    };
}

export function getSnapshotFreshnessBadge(source: SnapshotSource): string {
    return getSnapshotReadyBadge(source);
}

export function useSnapshotFreshnessCopy(
    generatedAt: string | null | undefined,
    source: SnapshotSource,
): SnapshotFreshnessCopy {
    const [nowMs, setNowMs] = useState(() => Date.now());

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setNowMs(Date.now());
        }, SNAPSHOT_FRESHNESS_TICK_MS);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    return buildSnapshotFreshnessCopy(generatedAt, source, nowMs);
}
