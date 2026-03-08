import { generateCityFromRepo, generatedCityToConflicts } from '../../../shared/repoCityGenerator';
import { applySignalHeatToRepoModel } from '../../../shared/repoSignalMapping';
import type { RepoModel } from '../../../shared/repoModel';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

function assertMatch(value: string, pattern: RegExp, message: string): void {
  if (!pattern.test(value)) {
    throw new Error(`${message} (value: ${value})`);
  }
}

function buildRepo(signals: RepoModel['signals']): RepoModel {
  return {
    repoId: 'github:mission-test',
    owner: 'acme',
    name: 'signal-ops',
    defaultBranch: 'main',
    visibility: 'private',
    archetype: 'backend',
    languages: [
      { name: 'TypeScript', bytes: 12_000, share: 1 },
    ],
    modules: [
      {
        id: 'mod-api',
        name: 'api',
        path: 'api/',
        kind: 'service',
        language: 'TypeScript',
        fileCount: 18,
        totalBytes: 7_200,
        importanceScore: 90,
        activityScore: 84,
        riskScore: 54,
      },
      {
        id: 'mod-ui',
        name: 'ui',
        path: 'frontend/ui/',
        kind: 'app',
        language: 'TypeScript',
        fileCount: 14,
        totalBytes: 3_800,
        importanceScore: 82,
        activityScore: 76,
        riskScore: 32,
      },
      {
        id: 'mod-tests',
        name: 'tests',
        path: 'tests/',
        kind: 'tests',
        language: 'TypeScript',
        fileCount: 11,
        totalBytes: 2_900,
        importanceScore: 64,
        activityScore: 52,
        riskScore: 22,
      },
      {
        id: 'mod-docs',
        name: 'docs',
        path: 'docs/',
        kind: 'docs',
        language: null,
        fileCount: 6,
        totalBytes: 1_400,
        importanceScore: 18,
        activityScore: 12,
        riskScore: 6,
      },
    ],
    dependencyEdges: [],
    signals,
    generatedAt: '2026-03-08T00:00:00.000Z',
  };
}

function testRepoLevelPrSignalsGenerateMappedReviewMission(): void {
  const repo = applySignalHeatToRepoModel(buildRepo([
    {
      type: 'open_pr',
      target: 'github:mission-test',
      severity: 3,
      title: '7 open pull requests',
      detail: 'Seven review items are waiting on the API boundary.',
      value: 7,
    },
  ]));

  const city = generateCityFromRepo(repo);
  const mission = city.missions.find((item) => item.sourceSignalType === 'open_pr');

  assert(mission, 'Expected an open PR mission to be generated.');
  assertEqual(mission.targetRef, 'mod-api', 'Repo-level PR signals should map to the API module.');

  const missionDistrict = city.districts.find((district) => district.id === mission.districtId);
  assert(missionDistrict, 'Expected the generated mission to point at a real district.');
  assertEqual(missionDistrict.moduleId, 'mod-api', 'Mission district should follow the mapped module target.');
  assertMatch(mission.title, /^Review 7 open pull requests at /i, 'Mission title should read like a review objective.');
  assertMatch(mission.description, /mapped open pull request signal/i, 'Mission description should call out the mapped signal source.');
  assertMatch(mission.objectives[0], /Inspect 7 open pull requests mapped to /i, 'First objective should reference the live PR signal.');
}

function testSameTypeSignalsRollUpIntoOneMission(): void {
  const city = generateCityFromRepo(buildRepo([
    {
      type: 'stale_pr',
      target: 'mod-ui',
      severity: 1,
      title: 'Stale settings cleanup',
      detail: 'This UI cleanup branch has been waiting for review for 21 days.',
    },
    {
      type: 'stale_pr',
      target: 'mod-ui',
      severity: 2,
      title: 'Stale dashboard refactor',
      detail: 'This dashboard refactor branch has been waiting for review for 18 days.',
    },
    {
      type: 'flaky_tests',
      target: 'mod-tests',
      severity: 2,
      title: 'Intermittent auth spec',
      detail: 'The login flow spec times out when the suite runs under CI load.',
    },
  ]));

  const staleMissions = city.missions.filter((mission) => mission.sourceSignalType === 'stale_pr');
  assertEqual(staleMissions.length, 1, 'Same-type signals sharing one target should roll up into a single mission.');

  const staleMission = staleMissions[0];
  assertMatch(staleMission.title, /^Recover 2 stale pull requests at /i, 'Rolled-up mission title should summarize the stale PR count.');
  assertMatch(staleMission.description, /condenses 2 mapped stale pull requests/i, 'Rolled-up mission description should explain the signal batch.');
  assertMatch(staleMission.objectives[0], /Locate 2 stale pull requests mapped to /i, 'Rolled-up mission objective should reference the summarized signal batch.');
  assert(city.missions.some((mission) => mission.sourceSignalType === 'flaky_tests'), 'Other signal types should still produce their own missions.');
}

function testBotsFollowMappedThreatGroupsInsteadOfRawSignals(): void {
  const repo = applySignalHeatToRepoModel(buildRepo([
    {
      type: 'open_pr',
      target: 'github:mission-test',
      severity: 3,
      title: '7 open pull requests',
      detail: 'Seven review items are waiting on the API boundary.',
      value: 7,
    },
    {
      type: 'open_pr',
      target: 'github:mission-test',
      severity: 2,
      title: '2 queued approvals',
      detail: 'Two more review items landed before the first batch cleared.',
      value: 2,
    },
    {
      type: 'dependency_drift',
      target: 'mod-ui',
      severity: 2,
      title: 'Outdated UI dependencies',
      detail: 'The UI bundle is pinned to stale package versions.',
    },
  ]));

  const city = generateCityFromRepo(repo);
  const reviewBots = city.bots.filter((bot) => bot.sourceSignalType === 'open_pr');

  assertEqual(reviewBots.length, 1, 'Same mapped PR threat group should produce one roster entry.');

  const reviewBot = reviewBots[0];
  assertEqual(reviewBot.archetype, 'hallucination', 'Open PR threats should map to the hallucination archetype.');
  assertEqual(reviewBot.name, 'Review Phantom', 'Open PR threats should use the review-themed bot copy.');
  assertEqual(reviewBot.targetRef, 'mod-api', 'Repo-level PR threats should inherit the mapped module target.');
  assertEqual(reviewBot.threatLevel, 4, 'Grouped PR threats should lift threat level above the raw max severity.');

  const reviewDistrict = city.districts.find((district) => district.id === reviewBot.districtId);
  assert(reviewDistrict, 'Expected the grouped PR bot to point at a real district.');
  assertEqual(reviewDistrict.moduleId, 'mod-api', 'Grouped PR bots should land in the mapped API district.');

  const dependencyBot = city.bots.find((bot) => bot.sourceSignalType === 'dependency_drift');
  assert(dependencyBot, 'Expected dependency drift to generate a roster entry.');
  assertEqual(dependencyBot.archetype, 'dependency', 'Dependency drift should map to the dependency archetype.');
  assertEqual(dependencyBot.name, 'Dependency Drifter', 'Dependency drift should use dependency-specific bot copy.');
  assertEqual(dependencyBot.targetRef, 'mod-ui', 'Explicit dependency targets should stay attached to their module.');
}

function testBossConflictUsesTheMergeThreatBotWhenDistrictHasMultipleThreats(): void {
  const city = generateCityFromRepo(buildRepo([
    {
      type: 'security_alert',
      target: 'mod-api',
      severity: 5,
      title: 'Critical package vulnerability',
      detail: 'A vulnerable transitive package has reached the API boundary.',
    },
    {
      type: 'merge_conflict',
      target: 'mod-api',
      severity: 4,
      title: 'API branch deadlock',
      detail: 'Two release branches disagree on the API contract.',
    },
  ]));

  const conflicts = generatedCityToConflicts(city);
  assertEqual(conflicts.length, 1, 'Expected a single merge-conflict boss encounter.');

  const [conflict] = conflicts;
  assertMatch(conflict.hunks[0].label, /^Conflict Core's patch$/i, 'Boss encounter copy should use the merge bot label.');
  assertMatch(conflict.hunks[0].code, /Conflict Core suggests:/i, 'Boss encounter copy should use the merge bot name, not another district threat.');
}

testRepoLevelPrSignalsGenerateMappedReviewMission();
testSameTypeSignalsRollUpIntoOneMission();
testBotsFollowMappedThreatGroupsInsteadOfRawSignals();
testBossConflictUsesTheMergeThreatBotWhenDistrictHasMultipleThreats();

console.log('repoCityMissionGeneration.test.ts: ok');
