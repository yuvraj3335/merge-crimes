import { getBattleTemplate } from './battleTemplates';
import type { GeneratedCity } from './repoModel';
import type { District, FactionId, MergeConflictEncounter, Mission } from './types';

const ARCHETYPE_FACTIONS: Record<string, FactionId> = {
  interface: 'chrome-syndicate',
  service: 'node-mafia',
  data: 'python-cartel',
  ops: 'go-yakuza',
  validation: 'rust-collective',
  archive: 'unaligned',
  shared: 'node-mafia',
  control: 'go-yakuza',
};

export function generatedCityToDistricts(city: GeneratedCity): District[] {
  return city.districts.map((district) => ({
    id: district.id,
    name: district.label,
    description: district.description,
    color: district.color,
    emissive: district.emissive,
    position: [district.position.x, district.position.y] as [number, number],
    size: [district.footprint.width, district.footprint.height] as [number, number],
    faction: ARCHETYPE_FACTIONS[district.category] ?? 'unaligned',
    heatLevel: district.heatLevel,
    repoSource: {
      owner: city.repoOwner,
      repo: city.repoName,
      language: district.category,
      stars: 0,
      openIssues: city.missions.filter((mission) => mission.districtId === district.id).length,
      lastActivity: city.generatedAt,
    },
    missionIds: city.missions
      .filter((mission) => mission.districtId === district.id)
      .map((mission) => mission.id),
  }));
}

export function generatedCityToMissions(city: GeneratedCity): Mission[] {
  return city.missions.map((mission) => {
    const district = city.districts.find((candidate) => candidate.id === mission.districtId);
    const pos = district?.position ?? { x: 0, y: 0 };

    return {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      type: mission.type,
      districtId: mission.districtId,
      difficulty: mission.difficulty,
      timeLimit: mission.type === 'boss' ? 60 : 45,
      reward: mission.difficulty * 100,
      factionReward: mission.difficulty * 8,
      status: 'available' as const,
      objectives: mission.objectives,
      waypoints: mission.objectives.map((objective, index) => ({
        id: `${mission.id}-wp-${index}`,
        label: objective,
        position: [
          pos.x + (index - 1) * 8,
          0.5,
          pos.y + (index - 1) * 5,
        ] as [number, number, number],
        radius: 4,
        order: index,
      })),
    };
  });
}

export function generatedCityToConflicts(city: GeneratedCity): MergeConflictEncounter[] {
  const bossMissions = city.missions.filter((mission) => mission.type === 'boss');

  return bossMissions.map((mission) => {
    const bot = city.bots.find((candidate) => (
      candidate.districtId === mission.districtId
      && candidate.sourceSignalType === mission.sourceSignalType
    )) ?? city.bots.find((candidate) => candidate.districtId === mission.districtId);
    const district = city.districts.find((candidate) => candidate.id === mission.districtId);
    const districtLabel = district?.label ?? district?.name ?? mission.districtId;
    const battleTemplate = getBattleTemplate(mission.sourceSignalType, bot?.archetype ?? 'saboteur');
    const primaryMechanic = battleTemplate.mechanicHints[0];
    const firstPhase = battleTemplate.phases[0];
    const finalPhase = battleTemplate.phases[battleTemplate.phases.length - 1];

    return {
      id: `conflict-${mission.id}`,
      title: `${battleTemplate.encounterName} at ${districtLabel}`,
      description: `${battleTemplate.summary} ${battleTemplate.copy.intro}`,
      difficulty: mission.difficulty,
      timeLimit: 30,
      districtId: mission.districtId,
      reward: mission.difficulty * 150,
      hunks: [
        {
          id: 1,
          label: `${bot?.name ?? battleTemplate.enemyRole}'s pressure plan`,
          code: `// ${battleTemplate.copy.intro}\nconst route = rushThrough("${districtLabel}");\n// ${primaryMechanic?.description ?? 'Noise hides the readable path.'}`,
          side: 'theirs' as const,
        },
        {
          id: 2,
          label: 'Containment pass',
          code: `// ${battleTemplate.objective}\nconst route = traceStableAnchors("${districtLabel}");\n// ${firstPhase?.objective ?? 'Read the room before you commit.'}`,
          side: 'ours' as const,
        },
        {
          id: 3,
          label: `${battleTemplate.encounterName} resolution`,
          code: `// ${battleTemplate.copy.victory}\nconst route = applyCuratedTemplate("${battleTemplate.id}");\nlockRoute(route);\n// ${finalPhase?.objective ?? 'Hold the clean route until the pressure collapses.'}`,
          side: 'resolved' as const,
        },
      ],
      correctOrder: [3],
    };
  });
}
