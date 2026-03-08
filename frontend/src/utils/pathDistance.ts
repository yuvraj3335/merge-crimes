export interface PathPoint2D {
    x: number;
    y: number;
}

export function measure2DPathDistance(points: ReadonlyArray<PathPoint2D>): number {
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
