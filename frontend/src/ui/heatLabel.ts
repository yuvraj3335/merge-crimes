export function getHeatLabel(heatLevel: number): string {
    if (heatLevel >= 80) return 'critical';
    if (heatLevel >= 60) return 'elevated';
    if (heatLevel >= 35) return 'watch';
    return 'stable';
}
