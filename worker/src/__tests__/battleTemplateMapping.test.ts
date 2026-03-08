import { getBattleTemplate } from '../../../shared/battleTemplates';
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
    repoId: 'github:battle-template-test',
    owner: 'acme',
    name: 'guardian-grid',
    defaultBranch: 'main',
    visibility: 'private',
    archetype: 'backend',
    languages: [
      { name: 'TypeScript', bytes: 16_000, share: 1 },
    ],
    modules: [
      {
        id: 'mod-api',
        name: 'api',
        path: 'api/',
        kind: 'service',
        language: 'TypeScript',
        fileCount: 21,
        totalBytes: 8_400,
        importanceScore: 88,
        activityScore: 76,
        riskScore: 61,
      },
      {
        id: 'mod-ci',
        name: 'ci',
        path: '.github/workflows/',
        kind: 'infra',
        language: 'YAML',
        fileCount: 6,
        totalBytes: 900,
        importanceScore: 72,
        activityScore: 68,
        riskScore: 48,
      },
    ],
    dependencyEdges: [],
    signals,
    generatedAt: '2026-03-08T00:00:00.000Z',
  };
}

function testLiveSecurityAlertBotMapsToThreatTemplate(): void {
  const repo = applySignalHeatToRepoModel(buildRepo([
    {
      type: 'security_alert',
      target: 'mod-api',
      severity: 5,
      title: 'Critical dependency alert',
      detail: 'A vulnerable package has reached the API boundary.',
    },
  ]));

  const city = generateCityFromRepo(repo);
  const securityBot = city.bots.find((bot) => bot.sourceSignalType === 'security_alert');

  assert(securityBot, 'Expected a generated bot for the security alert.');

  const template = getBattleTemplate(securityBot.sourceSignalType, securityBot.archetype);
  assertEqual(template.threatType, 'security_alert', 'Security alerts should keep their canonical threat type.');
  assertEqual(template.botArchetype, 'dependency', 'Security alerts should retain the dependency archetype overlay.');
  assertEqual(template.encounterName, 'Quarantine Breach', 'Security alerts should select the quarantine battle template.');
  assertMatch(template.objective, /contain the breach/i, 'Security alert objective should stay containment-focused.');
  assert(template.tags.includes('security_alert'), 'The resolved template should keep the security threat tag.');
}

function testFailingCiAliasNormalizesToWorkflowTemplate(): void {
  const template = getBattleTemplate('failing_ci', 'saboteur');

  assertEqual(template.threatType, 'failing_workflow', 'The failing_ci alias should normalize to failing_workflow.');
  assertEqual(template.encounterName, 'Pipeline Jam', 'Workflow threats should use the pipeline battle template.');
  assertEqual(template.enemyRole, 'Saboteur Bot', 'The archetype overlay should remain attached after threat normalization.');
  assertMatch(template.copy.intro, /workflow relay/i, 'Workflow template copy should point at the relay chamber flavor.');
}

function testUnknownThreatFallsBackToAbstractArchetypeTemplate(): void {
  const template = getBattleTemplate('mystery_noise', 'hallucination');

  assertEqual(template.threatType, 'unknown', 'Unknown threat types should degrade to the generic template.');
  assertEqual(template.encounterName, 'Threat Sweep', 'Unknown threat types should use the abstract fallback encounter.');
  assertEqual(template.enemyRole, 'Hallucination Bot', 'Known bot archetypes should still flavor the fallback template.');
  assertMatch(template.summary, /false certainty mirages/i, 'Fallback summary should still inherit archetype pressure flavor.');
}

testLiveSecurityAlertBotMapsToThreatTemplate();
testFailingCiAliasNormalizesToWorkflowTemplate();
testUnknownThreatFallsBackToAbstractArchetypeTemplate();

console.log('battleTemplateMapping.test.ts: ok');
