import type {
  DependencyEdge,
  DependencyReason,
  GeneratedDistrict,
  GeneratedRoad,
  RepoArchetype,
  RepoModel,
} from './repoModel';
import { clamp, makeId } from './repoCityGeneratorUtils';

const ROAD_STYLE_BY_REASON: Record<DependencyReason, { color: string; emissive: string; baseWidth: number }> = {
  import: { color: '#0f172a', emissive: '#38bdf8', baseWidth: 2.6 },
  package_dependency: { color: '#111827', emissive: '#f59e0b', baseWidth: 3.2 },
  service_link: { color: '#1f2937', emissive: '#f97316', baseWidth: 3.8 },
  folder_reference: { color: '#0b1120', emissive: '#8b5cf6', baseWidth: 2.2 },
};

function projectRoadAnchor(
  district: GeneratedDistrict,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const outwardX = dx === 0 ? 1 : Math.sign(dx);
  const outwardY = dy === 0 ? 1 : Math.sign(dy);

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: Math.round((district.position.x + outwardX * (district.footprint.width / 2 + 2)) * 10) / 10,
      y: district.position.y,
    };
  }

  return {
    x: district.position.x,
    y: Math.round((district.position.y + outwardY * (district.footprint.height / 2 + 2)) * 10) / 10,
  };
}

function buildRoadPoints(
  fromDistrict: GeneratedDistrict,
  toDistrict: GeneratedDistrict,
): Array<{ x: number; y: number }> {
  const dx = toDistrict.position.x - fromDistrict.position.x;
  const dy = toDistrict.position.y - fromDistrict.position.y;
  const start = projectRoadAnchor(fromDistrict, dx, dy);
  const end = projectRoadAnchor(toDistrict, -dx, -dy);

  if (Math.abs(dx) < 10 || Math.abs(dy) < 10) {
    return [start, end];
  }

  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = Math.round(((start.x + end.x) / 2) * 10) / 10;
    return [
      start,
      { x: midX, y: start.y },
      { x: midX, y: end.y },
      end,
    ];
  }

  const midY = Math.round(((start.y + end.y) / 2) * 10) / 10;
  return [
    start,
    { x: start.x, y: midY },
    { x: end.x, y: midY },
    end,
  ];
}

function selectReadableEdges(
  archetype: RepoArchetype,
  repo: RepoModel,
  activeModuleIds: Set<string>,
): DependencyEdge[] {
  const outboundLimit = archetype === 'monorepo' ? 3 : 2;
  const groupedEdges = new Map<string, DependencyEdge[]>();

  repo.dependencyEdges.forEach((edge) => {
    if (
      edge.fromModuleId === edge.toModuleId
      || !activeModuleIds.has(edge.fromModuleId)
      || !activeModuleIds.has(edge.toModuleId)
    ) {
      return;
    }

    const current = groupedEdges.get(edge.fromModuleId) ?? [];
    current.push(edge);
    groupedEdges.set(edge.fromModuleId, current);
  });

  const dedupedEdges = new Map<string, DependencyEdge>();

  groupedEdges.forEach((edges) => {
    edges
      .sort((a, b) => b.weight - a.weight || a.toModuleId.localeCompare(b.toModuleId))
      .slice(0, outboundLimit)
      .filter((edge) => edge.weight >= 0.35)
      .forEach((edge) => {
        const pairKey = [edge.fromModuleId, edge.toModuleId].sort().join('::');
        const existing = dedupedEdges.get(pairKey);
        if (!existing || edge.weight > existing.weight) {
          dedupedEdges.set(pairKey, edge);
        }
      });
  });

  return [...dedupedEdges.values()].sort(
    (a, b) => b.weight - a.weight || a.fromModuleId.localeCompare(b.fromModuleId),
  );
}

export function generateRoads(
  repo: RepoModel,
  districts: GeneratedDistrict[],
  archetype: RepoArchetype,
): GeneratedRoad[] {
  if (districts.length < 2) {
    return [];
  }

  const districtByModuleId = new Map(districts.map((district) => [district.moduleId, district] as const));
  const activeModuleIds = new Set(districts.map((district) => district.moduleId));

  return selectReadableEdges(archetype, repo, activeModuleIds)
    .map((edge) => {
      const fromDistrict = districtByModuleId.get(edge.fromModuleId);
      const toDistrict = districtByModuleId.get(edge.toModuleId);

      if (!fromDistrict || !toDistrict) {
        return null;
      }

      const style = ROAD_STYLE_BY_REASON[edge.reason];

      return {
        id: makeId('road', repo.repoId, edge.fromModuleId, edge.toModuleId),
        fromDistrictId: fromDistrict.id,
        toDistrictId: toDistrict.id,
        reason: edge.reason,
        weight: edge.weight,
        width: Math.round(clamp(style.baseWidth + edge.weight * 2.4, 2.2, 6.4) * 10) / 10,
        color: style.color,
        emissive: style.emissive,
        points: buildRoadPoints(fromDistrict, toDistrict),
      };
    })
    .filter((road): road is GeneratedRoad => road !== null);
}
