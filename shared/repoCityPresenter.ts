import type { GeneratedDistrict } from './repoModel';
import type { District } from './types';

export interface RepoCityTransitLike {
    districtId: string;
    targetPosition: readonly [number, number, number];
    pathPoints: ReadonlyArray<readonly [number, number, number]>;
    pathIndex: number;
    mode: 'direct' | 'roads';
}

export interface RepoCityPathPoint2D {
    x: number;
    y: number;
}

export interface ResolvedRepoCityDistricts {
    currentSurfaceDistrict: GeneratedDistrict | null;
    currentMissionDistrict: GeneratedDistrict | null;
    hoveredDistrict: GeneratedDistrict | null;
    transitGeneratedDistrict: GeneratedDistrict | null;
    transitGameplayDistrict: District | null;
    scopedGameplayDistrict: District | null;
    focusedDistrict: GeneratedDistrict | null;
    statusDistrict: GeneratedDistrict | null;
}

export interface TransitPresentation {
    destination: string;
    routeMode: 'direct' | 'roads';
    pathPoints: RepoCityPathPoint2D[];
    distance: number;
    distanceLabel: string;
    arrivalLabel: string;
}

export interface GuidancePresentation {
    pathPoints: RepoCityPathPoint2D[];
    color: string;
    label: string;
    distance: number;
    distanceLabel: string;
}

interface ResolveFocusedDistrictInput {
    generatedDistricts: ReadonlyArray<GeneratedDistrict>;
    gameplayDistricts?: ReadonlyArray<District>;
    currentDistrict?: District | null;
    missionDistrictId?: string | null;
    hoveredDistrictId?: string | null;
    transit?: RepoCityTransitLike | null;
}

interface DeriveTransitPresentationInput {
    playerPosition: readonly [number, number, number];
    currentDistrict?: District | null;
    transit?: RepoCityTransitLike | null;
    transitGeneratedDistrict?: GeneratedDistrict | null;
    transitGameplayDistrict?: District | null;
}

interface GuidanceWaypointLike {
    label: string;
    position: readonly [number, number, number];
}

interface DeriveGuidancePresentationInput {
    playerPosition: readonly [number, number, number];
    activeWaypoint?: GuidanceWaypointLike | null;
    canSelectDistricts: boolean;
    hoveredDistrict?: GeneratedDistrict | null;
    transitDistrict?: GeneratedDistrict | null;
    transitPresentation?: TransitPresentation | null;
}

function toPathPoint2D(point: readonly [number, number, number]): RepoCityPathPoint2D {
    return { x: point[0], y: point[2] };
}

function measure2DPathDistance(points: ReadonlyArray<RepoCityPathPoint2D>): number {
    if (points.length < 2) {
        return 0;
    }

    let total = 0;
    let previous = points[0];

    for (let index = 1; index < points.length; index += 1) {
        const point = points[index];
        total += Math.hypot(point.x - previous.x, point.y - previous.y);
        previous = point;
    }

    return total;
}

function getRemainingTransitPathPoints(transit: RepoCityTransitLike): RepoCityPathPoint2D[] {
    const remainingPath = transit.pathPoints
        .slice(transit.pathIndex)
        .map(toPathPoint2D);
    const targetPoint = toPathPoint2D(transit.targetPosition);
    const lastPoint = remainingPath[remainingPath.length - 1];

    if (!lastPoint || lastPoint.x !== targetPoint.x || lastPoint.y !== targetPoint.y) {
        remainingPath.push(targetPoint);
    }

    return remainingPath;
}

export function formatRepoCityDistance(distance: number): string {
    if (distance < 10) {
        return `${distance.toFixed(1)}m`;
    }

    return `${Math.round(distance)}m`;
}

export function resolveFocusedDistrict({
    generatedDistricts,
    gameplayDistricts = [],
    currentDistrict = null,
    missionDistrictId = null,
    hoveredDistrictId = null,
    transit = null,
}: ResolveFocusedDistrictInput): ResolvedRepoCityDistricts {
    const generatedDistrictById = new Map(
        generatedDistricts.map((district) => [district.id, district] as const),
    );
    const gameplayDistrictById = new Map(
        gameplayDistricts.map((district) => [district.id, district] as const),
    );
    const currentSurfaceDistrict = currentDistrict
        ? generatedDistrictById.get(currentDistrict.id) ?? null
        : null;
    const currentMissionDistrict = missionDistrictId
        ? generatedDistrictById.get(missionDistrictId) ?? null
        : null;
    const hoveredDistrict = hoveredDistrictId
        ? generatedDistrictById.get(hoveredDistrictId) ?? null
        : null;
    const transitGeneratedDistrict = transit
        ? generatedDistrictById.get(transit.districtId) ?? null
        : null;
    const transitGameplayDistrict = transit
        ? gameplayDistrictById.get(transit.districtId) ?? currentDistrict
        : null;

    return {
        currentSurfaceDistrict,
        currentMissionDistrict,
        hoveredDistrict,
        transitGeneratedDistrict,
        transitGameplayDistrict,
        scopedGameplayDistrict: transitGameplayDistrict ?? currentDistrict,
        focusedDistrict: transitGeneratedDistrict ?? hoveredDistrict ?? currentSurfaceDistrict ?? currentMissionDistrict,
        statusDistrict: transitGeneratedDistrict ?? currentSurfaceDistrict ?? null,
    };
}

export function deriveTransitPresentation({
    playerPosition,
    currentDistrict = null,
    transit = null,
    transitGeneratedDistrict = null,
    transitGameplayDistrict = null,
}: DeriveTransitPresentationInput): TransitPresentation | null {
    if (!transit) {
        return null;
    }

    const pathPoints = getRemainingTransitPathPoints(transit);
    const distance = measure2DPathDistance([
        toPathPoint2D(playerPosition),
        ...pathPoints,
    ]);

    return {
        destination: transitGameplayDistrict?.name ?? currentDistrict?.name ?? 'Selected district',
        routeMode: transit.mode,
        pathPoints,
        distance,
        distanceLabel: formatRepoCityDistance(distance),
        arrivalLabel: transitGeneratedDistrict
            ? `Approaching ${transitGeneratedDistrict.category} district`
            : 'Arrival will update district context',
    };
}

export function deriveGuidancePresentation({
    playerPosition,
    activeWaypoint = null,
    canSelectDistricts,
    hoveredDistrict = null,
    transitDistrict = null,
    transitPresentation = null,
}: DeriveGuidancePresentationInput): GuidancePresentation | null {
    if (activeWaypoint) {
        const pathPoints = [toPathPoint2D(activeWaypoint.position)];
        const distance = measure2DPathDistance([
            toPathPoint2D(playerPosition),
            ...pathPoints,
        ]);

        return {
            pathPoints,
            color: '#ffd95f',
            label: activeWaypoint.label,
            distance,
            distanceLabel: formatRepoCityDistance(distance),
        };
    }

    if (transitDistrict && transitPresentation) {
        return {
            pathPoints: transitPresentation.pathPoints,
            color: transitDistrict.emissive,
            label: transitDistrict.name,
            distance: transitPresentation.distance,
            distanceLabel: transitPresentation.distanceLabel,
        };
    }

    if (canSelectDistricts && hoveredDistrict) {
        const pathPoints = [{
            x: hoveredDistrict.position.x,
            y: hoveredDistrict.position.y,
        }];
        const distance = measure2DPathDistance([
            toPathPoint2D(playerPosition),
            ...pathPoints,
        ]);

        return {
            pathPoints,
            color: hoveredDistrict.emissive,
            label: hoveredDistrict.name,
            distance,
            distanceLabel: formatRepoCityDistance(distance),
        };
    }

    return null;
}
