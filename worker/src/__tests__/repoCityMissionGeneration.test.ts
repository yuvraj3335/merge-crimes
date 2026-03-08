import { generateCityFromRepo } from '../../../shared/repoCityGenerator';
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

testRepoLevelPrSignalsGenerateMappedReviewMission();
testSameTypeSignalsRollUpIntoOneMission();

console.log('repoCityMissionGeneration.test.ts: ok');
