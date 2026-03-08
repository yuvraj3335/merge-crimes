export type WaypointPosition = [number, number, number];

export function getWaypointDistanceAndText(
    player: WaypointPosition,
    waypoint: WaypointPosition,
): { distance: number; text: string } {
    const distance = Math.hypot(player[0] - waypoint[0], player[2] - waypoint[2]);

    return {
        distance,
        text: distance < 10 ? `${distance.toFixed(1)}m` : `${Math.round(distance)}m`,
    };
}
