import { DEFAULT_BOSS_MISSION_APPROACH_TEMPLATE, buildBossMissionRouteCopy } from './battleTemplates';
import type {
  BotArchetype,
  GeneratedBot,
  GeneratedDistrict,
  GeneratedMission,
  GeneratedMissionType,
  RepoModel,
  RepoSignal,
  RepoSignalType,
} from './repoModel';
import { humanizeModuleName, makeId } from './repoCityGeneratorUtils';

interface MissionTemplate {
  titlePrefix: string;
  type: GeneratedMissionType;
  descriptionTemplate: string;
  objectiveTemplates: string[];
  baseDifficulty: 1 | 2 | 3 | 4 | 5;
}

interface SignalBotProfile {
  archetype: BotArchetype;
  names: readonly string[];
}

const SIGNAL_MISSION_TEMPLATES: Partial<Record<RepoSignalType, MissionTemplate>> = {
  failing_workflow: {
    titlePrefix: 'Defend',
    type: 'defense',
    descriptionTemplate: 'The deployment pipeline is under attack. Hold the control terminal until the workflow stabilizes.',
    objectiveTemplates: ['Reach the control terminal', 'Defend the pipeline', 'Restore workflow stability'],
    baseDifficulty: 3,
  },
  open_issue: {
    titlePrefix: 'Stabilize',
    type: 'recovery',
    descriptionTemplate: 'Open issues are piling up in the district. Recover clean artifacts before the queue overruns the maintainers.',
    objectiveTemplates: ['Assess incoming issue reports', 'Recover clean artifacts', 'Restore district stability'],
    baseDifficulty: 2,
  },
  merge_conflict: {
    titlePrefix: 'BOSS: Stabilize',
    type: 'boss',
    descriptionTemplate: DEFAULT_BOSS_MISSION_APPROACH_TEMPLATE.descriptionTemplate,
    objectiveTemplates: [...DEFAULT_BOSS_MISSION_APPROACH_TEMPLATE.objectiveTemplates],
    baseDifficulty: 4,
  },
  open_pr: {
    titlePrefix: 'Deliver',
    type: 'delivery',
    descriptionTemplate: 'Multiple pull requests need triage. Carry verified patches to the review terminal before the queue overflows.',
    objectiveTemplates: ['Collect pending patches', 'Navigate to the review terminal', 'Deliver before timeout'],
    baseDifficulty: 2,
  },
  security_alert: {
    titlePrefix: 'Purge',
    type: 'defense',
    descriptionTemplate: 'A security vulnerability has been detected. Purge the compromised dependency before it spreads.',
    objectiveTemplates: ['Locate the vulnerability', 'Isolate the affected module', 'Apply the security patch'],
    baseDifficulty: 4,
  },
  issue_spike: {
    titlePrefix: 'Stabilize',
    type: 'recovery',
    descriptionTemplate: 'A spike in reported issues is destabilizing the district. Recover clean artifacts before corruption spreads.',
    objectiveTemplates: ['Assess the damage', 'Recover clean artifacts', 'Restore district stability'],
    baseDifficulty: 3,
  },
  stale_pr: {
    titlePrefix: 'Recover',
    type: 'recovery',
    descriptionTemplate: 'A stale pull request has been abandoned in the district. Retrieve the useful changes before they rot.',
    objectiveTemplates: ['Locate the stale PR', 'Salvage useful changes', 'Clean up the branch'],
    baseDifficulty: 1,
  },
  flaky_tests: {
    titlePrefix: 'Sabotage Hunt',
    type: 'escape',
    descriptionTemplate: 'Flaky tests are masking real failures. Track down the saboteur bot before the test suite becomes meaningless.',
    objectiveTemplates: ['Identify flaky tests', 'Track the saboteur', 'Escape before the suite locks down'],
    baseDifficulty: 3,
  },
  dependency_drift: {
    titlePrefix: 'Supply Run',
    type: 'delivery',
    descriptionTemplate: 'Dependencies have drifted out of date. Deliver fresh packages to the module before incompatibilities cascade.',
    objectiveTemplates: ['Collect updated packages', 'Navigate dependency graph', 'Apply updates safely'],
    baseDifficulty: 2,
  },
};

const DEFAULT_BOT_PROFILE: SignalBotProfile = {
  archetype: 'saboteur',
  names: ['Repo Saboteur', 'Threat Proxy', 'Intrusion Wraith'],
};

const SIGNAL_TO_BOT_PROFILE: Partial<Record<RepoSignalType, SignalBotProfile>> = {
  failing_workflow: {
    archetype: 'saboteur',
    names: ['Pipeline Wrecker', 'Deploy Jammer', 'CI Gremlin'],
  },
  open_issue: {
    archetype: 'regression',
    names: ['Bug Swarm', 'Rollback Runner', 'Backlog Shade'],
  },
  merge_conflict: {
    archetype: 'merge',
    names: ['Conflict Core', 'Branch Breaker', 'Rebase Raider'],
  },
  open_pr: {
    archetype: 'hallucination',
    names: ['Review Phantom', 'Patch Spammer', 'Approval Mirage'],
  },
  security_alert: {
    archetype: 'dependency',
    names: ['Package Poisoner', 'Vulnerability Leech', 'Supply Chain Ghost'],
  },
  issue_spike: {
    archetype: 'regression',
    names: ['Escalation Hydra', 'Regression Agent', 'Bug Surge'],
  },
  stale_pr: {
    archetype: 'refactor',
    names: ['Branch Hoarder', 'Review Fossil', 'Cleanup Mirage'],
  },
  flaky_tests: {
    archetype: 'saboteur',
    names: ['Test Saboteur', 'Spec Scrambler', 'Assertion Ghost'],
  },
  dependency_drift: {
    archetype: 'dependency',
    names: ['Dependency Drifter', 'Version Leech', 'Outdated Package Phantom'],
  },
};

interface ActionableSignalGroup {
  type: RepoSignalType;
  target: string;
  signals: RepoSignal[];
  maxSeverity: RepoSignal['severity'];
}

const HIGH_SEVERITY_BOSS_THRESHOLD: RepoSignal['severity'] = 4;

const SIGNAL_MISSION_COPY: Record<RepoSignalType, {
  singular: string;
  plural: string;
  missionVerb: string;
  objectiveVerb: string;
}> = {
  failing_workflow: {
    singular: 'failing workflow',
    plural: 'failing workflows',
    missionVerb: 'Stabilize',
    objectiveVerb: 'Audit',
  },
  open_issue: {
    singular: 'open issue',
    plural: 'open issues',
    missionVerb: 'Clear',
    objectiveVerb: 'Audit',
  },
  open_pr: {
    singular: 'open pull request',
    plural: 'open pull requests',
    missionVerb: 'Review',
    objectiveVerb: 'Inspect',
  },
  merge_conflict: {
    singular: 'route deadlock alert',
    plural: 'route deadlock alerts',
    missionVerb: 'Stabilize',
    objectiveVerb: 'Approach',
  },
  security_alert: {
    singular: 'security alert',
    plural: 'security alerts',
    missionVerb: 'Purge',
    objectiveVerb: 'Trace',
  },
  issue_spike: {
    singular: 'issue spike',
    plural: 'issue spikes',
    missionVerb: 'Contain',
    objectiveVerb: 'Audit',
  },
  stale_pr: {
    singular: 'stale pull request',
    plural: 'stale pull requests',
    missionVerb: 'Recover',
    objectiveVerb: 'Locate',
  },
  flaky_tests: {
    singular: 'flaky test alert',
    plural: 'flaky test alerts',
    missionVerb: 'Trace',
    objectiveVerb: 'Track',
  },
  dependency_drift: {
    singular: 'dependency drift alert',
    plural: 'dependency drift alerts',
    missionVerb: 'Refresh',
    objectiveVerb: 'Inventory',
  },
  latest_commit: {
    singular: 'latest commit',
    plural: 'latest commits',
    missionVerb: 'Inspect',
    objectiveVerb: 'Trace',
  },
};

function getMissionTemplate(signalType: RepoSignalType): MissionTemplate | null {
  return SIGNAL_MISSION_TEMPLATES[signalType] ?? null;
}

function getBotProfile(signalType: RepoSignalType): SignalBotProfile {
  return SIGNAL_TO_BOT_PROFILE[signalType] ?? DEFAULT_BOT_PROFILE;
}

export function isActionableSignal(signal: RepoSignal): boolean {
  return signal.severity > 0
    && getMissionTemplate(signal.type) !== null;
}

function pluralizeLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function summarizeSignalGroup(group: ActionableSignalGroup): string {
  const copy = SIGNAL_MISSION_COPY[group.type];

  if (group.signals.length === 1) {
    const [signal] = group.signals;
    const title = signal.title?.trim();
    if (title) {
      return title;
    }

    if (typeof signal.value === 'number' && Number.isFinite(signal.value) && signal.value > 0) {
      return `${signal.value} ${pluralizeLabel(signal.value, copy.singular, copy.plural)}`;
    }

    return `1 ${copy.singular}`;
  }

  const aggregateValue = group.signals.reduce((sum, signal) => (
    typeof signal.value === 'number' && Number.isFinite(signal.value) && signal.value > 0
      ? sum + signal.value
      : sum
  ), 0);

  if (aggregateValue > 0) {
    return `${aggregateValue} ${pluralizeLabel(aggregateValue, copy.singular, copy.plural)}`;
  }

  return `${group.signals.length} ${pluralizeLabel(group.signals.length, copy.singular, copy.plural)}`;
}

function getGroupedSignalThreatLevel(group: ActionableSignalGroup): 1 | 2 | 3 | 4 | 5 {
  return Math.min(
    5,
    group.maxSeverity + Math.min(1, Math.max(0, group.signals.length - 1)),
  ) as 1 | 2 | 3 | 4 | 5;
}

function buildSignalHighlights(group: ActionableSignalGroup): string | null {
  const titles = [...new Set(
    group.signals
      .map((signal) => signal.title?.trim())
      .filter((title): title is string => Boolean(title)),
  )];

  if (titles.length <= 1) {
    return null;
  }

  if (titles.length === 2) {
    return `Priority reports: ${titles[0]} and ${titles[1]}.`;
  }

  return `Priority reports: ${titles[0]}, ${titles[1]}, and ${titles.length - 2} more.`;
}

function groupActionableSignals(signals: RepoSignal[]): ActionableSignalGroup[] {
  const groups = new Map<string, ActionableSignalGroup>();

  signals
    .filter(isActionableSignal)
    .forEach((signal) => {
      const key = `${signal.type}::${signal.target}`;
      const existing = groups.get(key);

      if (existing) {
        existing.signals.push(signal);
        existing.maxSeverity = Math.max(existing.maxSeverity, signal.severity) as RepoSignal['severity'];
        return;
      }

      groups.set(key, {
        type: signal.type,
        target: signal.target,
        signals: [signal],
        maxSeverity: signal.severity,
      });
    });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      signals: [...group.signals].sort(
        (left, right) => right.severity - left.severity || (left.title ?? '').localeCompare(right.title ?? ''),
      ),
    }))
    .sort(
      (left, right) => right.maxSeverity - left.maxSeverity
        || right.signals.length - left.signals.length
        || left.type.localeCompare(right.type)
        || left.target.localeCompare(right.target),
    );
}

function getActionableSignalGroupKey(group: ActionableSignalGroup): string {
  return `${group.type}::${group.target}`;
}

function isBossEscalationSignalGroup(group: ActionableSignalGroup): boolean {
  return group.type === 'merge_conflict'
    || group.maxSeverity >= HIGH_SEVERITY_BOSS_THRESHOLD;
}

function shouldPreferBossEscalationGroup(
  candidate: ActionableSignalGroup,
  current: ActionableSignalGroup,
): boolean {
  const candidateIsMergeConflict = candidate.type === 'merge_conflict';
  const currentIsMergeConflict = current.type === 'merge_conflict';

  if (candidateIsMergeConflict !== currentIsMergeConflict) {
    return candidateIsMergeConflict;
  }

  return candidate.maxSeverity > current.maxSeverity
    || (
      candidate.maxSeverity === current.maxSeverity
      && (
        candidate.signals.length > current.signals.length
        || (
          candidate.signals.length === current.signals.length
          && candidate.type.localeCompare(current.type) < 0
        )
      )
    );
}

function selectBossEscalationGroupKeys(groups: ActionableSignalGroup[]): Set<string> {
  const selectedGroupsByTarget = new Map<string, ActionableSignalGroup>();

  groups.forEach((group) => {
    if (!isBossEscalationSignalGroup(group)) {
      return;
    }

    const current = selectedGroupsByTarget.get(group.target);
    if (!current || shouldPreferBossEscalationGroup(group, current)) {
      selectedGroupsByTarget.set(group.target, group);
    }
  });

  return new Set(
    [...selectedGroupsByTarget.values()].map((group) => getActionableSignalGroupKey(group)),
  );
}

function buildSignalDrivenMissionTitle(
  group: ActionableSignalGroup,
  districtLabel: string,
  isBossEncounter: boolean,
): string {
  if (isBossEncounter) {
    const botProfile = getBotProfile(group.type);
    return buildBossMissionRouteCopy(districtLabel, group.type, botProfile.archetype, group.signals.length).title;
  }

  const copy = SIGNAL_MISSION_COPY[group.type];
  return `${copy.missionVerb} ${summarizeSignalGroup(group)} at ${districtLabel}`;
}

function buildSignalDrivenMissionDescription(
  group: ActionableSignalGroup,
  districtLabel: string,
  template: MissionTemplate,
): string {
  const copy = SIGNAL_MISSION_COPY[group.type];
  const [primarySignal] = group.signals;
  const detail = primarySignal.detail?.trim();
  const highlights = buildSignalHighlights(group);
  const summary = summarizeSignalGroup(group);
  const mappedSignalLine = group.signals.length > 1
    ? `This mission condenses ${group.signals.length} mapped ${copy.plural} into one readable batch.`
    : `This mission is rooted in one mapped ${copy.singular} signal.`;

  const descriptionParts = [
    `${districtLabel} is reacting to ${summary}.`,
    template.descriptionTemplate,
  ];

  if (detail && detail !== template.descriptionTemplate) {
    descriptionParts.push(`Signal report: ${detail}`);
  }

  if (highlights) {
    descriptionParts.push(highlights);
  }

  descriptionParts.push(mappedSignalLine);

  return descriptionParts.join(' ');
}

function buildSignalDrivenMissionObjectives(
  group: ActionableSignalGroup,
  districtLabel: string,
  template: MissionTemplate,
): string[] {
  const copy = SIGNAL_MISSION_COPY[group.type];
  const objectives = [...template.objectiveTemplates];

  objectives[0] = `${copy.objectiveVerb} ${summarizeSignalGroup(group)} mapped to ${districtLabel}`;

  return objectives;
}

function buildBossSignalDrivenMissionDescription(
  group: ActionableSignalGroup,
  districtLabel: string,
  botArchetype: BotArchetype,
): string {
  return buildBossMissionRouteCopy(districtLabel, group.type, botArchetype, group.signals.length).description;
}

function buildBossSignalDrivenMissionObjectives(
  group: ActionableSignalGroup,
  districtLabel: string,
  botArchetype: BotArchetype,
): string[] {
  return buildBossMissionRouteCopy(districtLabel, group.type, botArchetype, group.signals.length).objectives;
}

export function generateSignalDrivenMissions(
  repo: RepoModel,
  districts: GeneratedDistrict[],
  signals: RepoSignal[],
): GeneratedMission[] {
  const groupedSignals = groupActionableSignals(signals);
  const bossEscalationGroupKeys = selectBossEscalationGroupKeys(groupedSignals);

  return groupedSignals.flatMap((group) => {
    const template = getMissionTemplate(group.type);
    if (!template) {
      return [];
    }

    const targetDistrict = districts.find((district) => district.moduleId === group.target);
    const districtId = targetDistrict?.id ?? districts[0]?.id ?? 'unknown';
    const districtLabel = targetDistrict?.label ?? targetDistrict?.name ?? humanizeModuleName(group.target);
    const botProfile = getBotProfile(group.type);
    const isBossEncounter = bossEscalationGroupKeys.has(getActionableSignalGroupKey(group));
    const effectiveSeverity = getGroupedSignalThreatLevel(group);
    const baseDifficulty = Math.min(5, Math.max(1, Math.round(
      (template.baseDifficulty + effectiveSeverity) / 2,
    ))) as 1 | 2 | 3 | 4 | 5;
    const difficulty = (isBossEncounter
      ? Math.max(4, baseDifficulty)
      : baseDifficulty) as 1 | 2 | 3 | 4 | 5;

    return [{
      id: makeId('mission', repo.repoId, group.type, group.target),
      districtId,
      title: buildSignalDrivenMissionTitle(group, districtLabel, isBossEncounter),
      type: isBossEncounter ? 'boss' : template.type,
      difficulty,
      sourceSignalType: group.type,
      targetRef: group.target,
      description: isBossEncounter
        ? buildBossSignalDrivenMissionDescription(group, districtLabel, botProfile.archetype)
        : buildSignalDrivenMissionDescription(group, districtLabel, template),
      objectives: isBossEncounter
        ? buildBossSignalDrivenMissionObjectives(group, districtLabel, botProfile.archetype)
        : buildSignalDrivenMissionObjectives(group, districtLabel, template),
    }];
  });
}

export function generateSignalDrivenBots(
  repo: RepoModel,
  districts: GeneratedDistrict[],
  signals: RepoSignal[],
): GeneratedBot[] {
  const profileUsageBySignalType = new Map<RepoSignalType, number>();

  return groupActionableSignals(signals).map((group) => {
    const profile = getBotProfile(group.type);
    const targetDistrict = districts.find((district) => district.moduleId === group.target);
    const districtId = targetDistrict?.id ?? districts[0]?.id ?? 'unknown';
    const profileUsage = profileUsageBySignalType.get(group.type) ?? 0;
    const names = profile.names.length > 0 ? profile.names : DEFAULT_BOT_PROFILE.names;
    const name = names[profileUsage % names.length];

    profileUsageBySignalType.set(group.type, profileUsage + 1);

    return {
      id: makeId('bot', repo.repoId, group.type, group.target),
      archetype: profile.archetype,
      name,
      districtId,
      sourceSignalType: group.type,
      targetRef: group.target,
      threatLevel: getGroupedSignalThreatLevel(group),
    };
  });
}
