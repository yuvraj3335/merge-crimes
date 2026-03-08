import type { GeneratedCity, GeneratedRoad } from '../../../shared/repoModel';
import { measure2DPathDistance } from '../utils/pathDistance';

const REPO_CITY_MAX_TRANSIT_HOPS = 3;
const REPO_CITY_MAX_ROUTE_DISTANCE_RATIO = 1.9;
const REPO_CITY_ROUTE_POINT_EPSILON = 0.75;

export type TransitPoint = [number, number, number];

interface TransitGraphEdge {
    roadId: string;
    toDistrictId: string;
    points: TransitPoint[];
    distance: number;
}

interface RoutedTransitPath {
    mode: 'direct' | 'roads';
    points: TransitPoint[];
    roadIds: string[];
}

function measureTransitDistance(a: TransitPoint, b: TransitPoint): number {
    return Math.hypot(b[0] - a[0], b[2] - a[2]);
}

function toPathPoint2D(point: TransitPoint) {
    return { x: point[0], y: point[2] };
}

function appendTransitPoint(points: TransitPoint[], point: TransitPoint) {
    const previous = points[points.length - 1];
    if (!previous || measureTransitDistance(previous, point) > REPO_CITY_ROUTE_POINT_EPSILON) {
        points.push(point);
    }
}

function roadToTransitPoints(road: GeneratedRoad, playerY: number, reverse = false): TransitPoint[] {
    const sourcePoints = reverse ? [...road.points].reverse() : road.points;
    return sourcePoints.map((point) => [point.x, playerY, point.y]);
}

function measureRoadDistance(points: TransitPoint[]): number {
    return measure2DPathDistance(points.map(toPathPoint2D));
}

export function buildRoadGuidedTransitPath(
    city: GeneratedCity | null,
    currentDistrictId: string | null,
    targetDistrictId: string,
    currentPosition: TransitPoint,
    targetPosition: TransitPoint,
): RoutedTransitPath {
    const directPath: RoutedTransitPath = {
        mode: 'direct',
        points: [targetPosition],
        roadIds: [],
    };

    if (!city || !currentDistrictId || currentDistrictId === targetDistrictId || city.roads.length === 0) {
        return directPath;
    }

    const districtById = new Map(city.districts.map((district) => [district.id, district] as const));
    if (!districtById.has(currentDistrictId) || !districtById.has(targetDistrictId)) {
        return directPath;
    }

    const adjacency = new Map<string, TransitGraphEdge[]>();
    const addEdge = (fromDistrictId: string, edge: TransitGraphEdge) => {
        const currentEdges = adjacency.get(fromDistrictId) ?? [];
        currentEdges.push(edge);
        adjacency.set(fromDistrictId, currentEdges);
    };

    city.roads.forEach((road) => {
        const forwardPoints = roadToTransitPoints(road, currentPosition[1]);
        const reversePoints = [...forwardPoints].reverse();

        addEdge(road.fromDistrictId, {
            roadId: road.id,
            toDistrictId: road.toDistrictId,
            points: forwardPoints,
            distance: measureRoadDistance(forwardPoints),
        });
        addEdge(road.toDistrictId, {
            roadId: road.id,
            toDistrictId: road.fromDistrictId,
            points: reversePoints,
            distance: measureRoadDistance(reversePoints),
        });
    });

    const queue: Array<{ districtId: string; distance: number; hops: number }> = [{
        districtId: currentDistrictId,
        distance: 0,
        hops: 0,
    }];
    const bestByDistrict = new Map<string, { distance: number; hops: number }>([
        [currentDistrictId, { distance: 0, hops: 0 }],
    ]);
    const previousByDistrict = new Map<string, { fromDistrictId: string; edge: TransitGraphEdge }>();

    while (queue.length > 0) {
        queue.sort((a, b) => a.distance - b.distance || a.hops - b.hops);
        const current = queue.shift();
        if (!current) {
            break;
        }

        if (current.districtId === targetDistrictId) {
            break;
        }

        const currentBest = bestByDistrict.get(current.districtId);
        if (currentBest && current.distance > currentBest.distance + 0.001) {
            continue;
        }

        (adjacency.get(current.districtId) ?? []).forEach((edge) => {
            const nextHops = current.hops + 1;
            if (nextHops > REPO_CITY_MAX_TRANSIT_HOPS) {
                return;
            }

            const nextDistance = current.distance + edge.distance;
            const existing = bestByDistrict.get(edge.toDistrictId);
            if (
                existing
                && (nextDistance > existing.distance + 0.001
                    || (Math.abs(nextDistance - existing.distance) <= 0.001 && nextHops >= existing.hops))
            ) {
                return;
            }

            bestByDistrict.set(edge.toDistrictId, { distance: nextDistance, hops: nextHops });
            previousByDistrict.set(edge.toDistrictId, { fromDistrictId: current.districtId, edge });
            queue.push({
                districtId: edge.toDistrictId,
                distance: nextDistance,
                hops: nextHops,
            });
        });
    }

    if (!previousByDistrict.has(targetDistrictId)) {
        return directPath;
    }

    const orderedEdges: TransitGraphEdge[] = [];
    let cursor = targetDistrictId;
    while (cursor !== currentDistrictId) {
        const previous = previousByDistrict.get(cursor);
        if (!previous) {
            return directPath;
        }

        orderedEdges.unshift(previous.edge);
        cursor = previous.fromDistrictId;
    }

    const routedPoints: TransitPoint[] = [];
    orderedEdges.forEach((edge) => {
        edge.points.forEach((point) => appendTransitPoint(routedPoints, point));
    });
    appendTransitPoint(routedPoints, targetPosition);

    const normalizedPoints = routedPoints.filter(
        (point) => measureTransitDistance(currentPosition, point) > REPO_CITY_ROUTE_POINT_EPSILON,
    );
    if (normalizedPoints.length === 0) {
        return directPath;
    }

    const directDistance = measureTransitDistance(currentPosition, targetPosition);
    const routedDistance = measure2DPathDistance([
        toPathPoint2D(currentPosition),
        ...normalizedPoints.map(toPathPoint2D),
    ]);
    if (
        directDistance <= REPO_CITY_ROUTE_POINT_EPSILON
        || routedDistance > directDistance * REPO_CITY_MAX_ROUTE_DISTANCE_RATIO
    ) {
        return directPath;
    }

    return {
        mode: 'roads',
        points: normalizedPoints,
        roadIds: [...new Set(orderedEdges.map((edge) => edge.roadId))],
    };
}
