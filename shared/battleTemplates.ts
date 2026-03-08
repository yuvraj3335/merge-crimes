import type { BotArchetype } from './repoModel';
import type { RepoSignalType } from './types';

const REPO_SIGNAL_TYPES: readonly RepoSignalType[] = [
  'failing_workflow',
  'open_issue',
  'open_pr',
  'merge_conflict',
  'security_alert',
  'issue_spike',
  'stale_pr',
  'flaky_tests',
  'dependency_drift',
  'latest_commit',
] as const;

const BOT_ARCHETYPES: readonly BotArchetype[] = [
  'hallucination',
  'merge',
  'regression',
  'dependency',
  'type',
  'refactor',
  'saboteur',
] as const;

const THREAT_TYPE_ALIASES: Readonly<Record<string, RepoSignalType>> = {
  ci_failure: 'failing_workflow',
  ci_failures: 'failing_workflow',
  failing_ci: 'failing_workflow',
  failing_pipeline: 'failing_workflow',
  vulnerable_dependency: 'security_alert',
};

export type BattleTemplateThreatType = RepoSignalType | 'unknown';
export type BattleTemplateBotArchetype = BotArchetype | 'unknown';
export type BattleTemplateTone = 'containment' | 'stabilization' | 'triage' | 'pressure';

export interface BattleTemplateMechanic {
  key: string;
  label: string;
  description: string;
}

export interface BattleTemplatePhase {
  key: string;
  label: string;
  objective: string;
  pressure: string;
}

export interface BattleTemplateCopy {
  intro: string;
  victory: string;
  failure: string;
}

export interface BattleTemplate {
  id: string;
  threatType: BattleTemplateThreatType;
  botArchetype: BattleTemplateBotArchetype;
  encounterName: string;
  enemyRole: string;
  summary: string;
  arenaTheme: string;
  objective: string;
  tone: BattleTemplateTone;
  mechanicHints: BattleTemplateMechanic[];
  phases: BattleTemplatePhase[];
  copy: BattleTemplateCopy;
  tags: string[];
}

interface BattleThreatTemplate {
  id: string;
  encounterName: string;
  summary: string;
  arenaTheme: string;
  objective: string;
  tone: BattleTemplateTone;
  mechanicHints: readonly BattleTemplateMechanic[];
  phases: readonly BattleTemplatePhase[];
  introScene: string;
  victoryState: string;
  failureState: string;
  tags: readonly string[];
}

interface BattleBotOverlay {
  enemyRole: string;
  pressureModifier: string;
  victoryAction: string;
  failureOutcome: string;
  tags: readonly string[];
}

const DEFAULT_THREAT_TEMPLATE: BattleThreatTemplate = {
  id: 'generic-threat-sweep',
  encounterName: 'Threat Sweep',
  summary: 'A hostile pressure signature has surfaced. Read the pattern and stabilize the district without treating the repo as literal code.',
  arenaTheme: 'An abstract maintenance corridor with shifting safe zones and relay anchors.',
  objective: 'Claim stable ground, identify the hostile pattern, and clear the pressure wave before it hardens.',
  tone: 'triage',
  mechanicHints: [
    {
      key: 'anchor-control',
      label: 'Anchor Control',
      description: 'Capture stable anchors to keep the encounter readable while the pressure pattern shifts around you.',
    },
  ],
  phases: [
    {
      key: 'sweep',
      label: 'Pattern Sweep',
      objective: 'Read the room and mark the safest route through the pressure field.',
      pressure: 'The hostile signal moves before it commits, forcing quick but readable choices.',
    },
  ],
  introScene: 'the district relay',
  victoryState: 'the district settles into a controllable rhythm',
  failureState: 'the pressure pattern takes over the playable space',
  tags: ['fallback', 'abstract'],
};

export const BATTLE_THREAT_TEMPLATES: Readonly<Partial<Record<RepoSignalType, BattleThreatTemplate>>> = {
  merge_conflict: {
    id: 'merge-conflict-branch-deadlock',
    encounterName: 'Branch Deadlock',
    summary: 'Two incompatible route states are colliding in the district. Untangle the overlap and restore one readable path without acting out a literal merge tool.',
    arenaTheme: 'A branch nexus of mirrored rails, crossing signal bridges, and lock gates that only open when one clean lane is stabilized.',
    objective: 'Separate the crossing routes, preserve the clean anchor points, and reopen one stable branch corridor.',
    tone: 'pressure',
    mechanicHints: [
      {
        key: 'lane-separation',
        label: 'Lane Separation',
        description: 'Keep competing routes apart until the stable branch is obvious enough to lock in.',
      },
      {
        key: 'anchor-lock',
        label: 'Anchor Lock',
        description: 'Claim steady anchors before the crossing waves overlap again and hide the safe line.',
      },
    ],
    phases: [
      {
        key: 'collision-read',
        label: 'Read the Collision',
        objective: 'Trace where the two route states cross before either branch hardens into a deadlock.',
        pressure: 'Crossing lanes pulse at different tempos and briefly erase the safe route.',
      },
      {
        key: 'lock-the-branch',
        label: 'Lock the Clean Branch',
        objective: 'Hold the stable path long enough for the conflicting lane to collapse out of the room.',
        pressure: 'Residual branch echoes keep trying to re-open the rejected route.',
      },
    ],
    introScene: 'the branch nexus',
    victoryState: 'one clean route stays open and the district can move again',
    failureState: 'the room freezes into a full branch deadlock',
    tags: ['merge', 'conflict', 'boss-template'],
  },
  security_alert: {
    id: 'security-alert-quarantine',
    encounterName: 'Quarantine Breach',
    summary: 'A corrupted supply route is leaking pressure through the district. The encounter stays metaphorical: contain the breach, do not simulate literal exploit details.',
    arenaTheme: 'A dependency vault threaded with scan gates, sealed relay doors, and short quarantine lanes.',
    objective: 'Contain the breach, route clean packets through the chamber, and lock the poisoned lane before it spreads.',
    tone: 'containment',
    mechanicHints: [
      {
        key: 'quarantine-window',
        label: 'Quarantine Window',
        description: 'Safe lanes open in short cycles. Move only when the scanner confirms a clean pass.',
      },
      {
        key: 'clean-route',
        label: 'Clean Route',
        description: 'Link trusted anchors together to weaken the breach without representing literal dependency code.',
      },
    ],
    phases: [
      {
        key: 'containment-sweep',
        label: 'Containment Sweep',
        objective: 'Tag unstable nodes before the breach reaches neighboring lanes.',
        pressure: 'Quarantine barriers pulse open and closed in short intervals.',
      },
      {
        key: 'seal-route',
        label: 'Seal the Supply Path',
        objective: 'Lock the poisoned route and reopen the clean lane.',
        pressure: 'Corrupted echoes try to reopen sealed paths once the room stabilizes.',
      },
    ],
    introScene: 'the dependency vault',
    victoryState: 'the quarantine grid becomes readable enough for traffic to flow again',
    failureState: 'the contaminated route spreads into adjacent lanes',
    tags: ['security', 'supply-chain', 'threat-template'],
  },
  failing_workflow: {
    id: 'workflow-pipeline-jam',
    encounterName: 'Pipeline Jam',
    summary: 'Automation has stalled in a noisy corridor. The battle is about restoring readable flow, not acting out literal CI internals.',
    arenaTheme: 'A workflow relay chamber with frozen conveyor rails, sync lights, and blinking checkpoint pylons.',
    objective: 'Re-sequence the relay pulses, clear false interrupts, and reopen the district route before the corridor locks down.',
    tone: 'stabilization',
    mechanicHints: [
      {
        key: 'sync-window',
        label: 'Sync Window',
        description: 'Progress only during stable pulse windows or the relay will kick back additional noise.',
      },
      {
        key: 'interrupt-clear',
        label: 'Interrupt Clear',
        description: 'Reset false interrupts at side pylons to keep the central route playable and legible.',
      },
    ],
    phases: [
      {
        key: 'bootstrap-relay',
        label: 'Bootstrap Relay',
        objective: 'Bring the stalled checkpoints back online in the right order.',
        pressure: 'Out-of-sequence pulses create moving dead zones across the arena.',
      },
      {
        key: 'release-pulse',
        label: 'Release Pulse',
        objective: 'Hold the stabilized channel long enough for the route to reopen.',
        pressure: 'Noise surges try to desync the corridor once the flow is nearly restored.',
      },
    ],
    introScene: 'the workflow relay',
    victoryState: 'signal flow steadies enough for the route to carry traffic again',
    failureState: 'the corridor collapses into a full stop',
    tags: ['workflow', 'tempo', 'threat-template'],
  },
} as const;

const BOT_ARCHETYPE_OVERLAYS: Readonly<Record<BotArchetype, BattleBotOverlay>> = {
  hallucination: {
    enemyRole: 'Hallucination Bot',
    pressureModifier: 'false certainty mirages and decoy routes',
    victoryAction: 'disprove the fake route and pin the real signal in place',
    failureOutcome: 'the arena fills with misleading paths that hide the clean line',
    tags: ['misdirection'],
  },
  merge: {
    enemyRole: 'Merge Bot',
    pressureModifier: 'colliding branch waves and lane overlaps',
    victoryAction: 'separate the crossing routes and re-open one clean channel',
    failureOutcome: 'the room locks into crossing hazards and route deadlocks',
    tags: ['collision'],
  },
  regression: {
    enemyRole: 'Regression Bot',
    pressureModifier: 'rollback shocks and repeating fault loops',
    victoryAction: 'break the rollback loop and re-claim forward momentum',
    failureOutcome: 'the district slides back into repeated instability',
    tags: ['rollback'],
  },
  dependency: {
    enemyRole: 'Dependency Bot',
    pressureModifier: 'poisoned supply pulses and contaminated relay bursts',
    victoryAction: 'purge the contaminated route and restore the trusted chain',
    failureOutcome: 'fresh lanes keep inheriting stale pressure from the breach',
    tags: ['supply-chain'],
  },
  type: {
    enemyRole: 'Type Bot',
    pressureModifier: 'schema locks and collapsing shape gates',
    victoryAction: 're-align the gates until the route becomes readable again',
    failureOutcome: 'the district hardens into incompatible locked paths',
    tags: ['schema'],
  },
  refactor: {
    enemyRole: 'Refactor Bot',
    pressureModifier: 'shape-shifting corridors and disappearing landmarks',
    victoryAction: 'pin down the stable structure before the room shifts again',
    failureOutcome: 'the player loses the readable route as the layout keeps changing',
    tags: ['reframe'],
  },
  saboteur: {
    enemyRole: 'Saboteur Bot',
    pressureModifier: 'timed disruption spikes and broken relay cues',
    victoryAction: 'break the sabotage loop and reclaim the signal anchors',
    failureOutcome: 'the room stays trapped in noisy interrupts',
    tags: ['disruption'],
  },
} as const;

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isRepoSignalType(value: string): value is RepoSignalType {
  return (REPO_SIGNAL_TYPES as readonly string[]).includes(value);
}

function isBotArchetype(value: string): value is BotArchetype {
  return (BOT_ARCHETYPES as readonly string[]).includes(value);
}

function normalizeThreatType(threatType: string): BattleTemplateThreatType {
  const normalized = normalizeToken(threatType);
  const aliased = THREAT_TYPE_ALIASES[normalized] ?? normalized;
  return isRepoSignalType(aliased) ? aliased : 'unknown';
}

function normalizeBotArchetype(botArchetype: string): BattleTemplateBotArchetype {
  const normalized = normalizeToken(botArchetype);
  return isBotArchetype(normalized) ? normalized : 'unknown';
}

function cloneMechanic(mechanic: BattleTemplateMechanic): BattleTemplateMechanic {
  return {
    key: mechanic.key,
    label: mechanic.label,
    description: mechanic.description,
  };
}

function clonePhase(phase: BattleTemplatePhase): BattleTemplatePhase {
  return {
    key: phase.key,
    label: phase.label,
    objective: phase.objective,
    pressure: phase.pressure,
  };
}

function buildCopy(threatTemplate: BattleThreatTemplate, botOverlay: BattleBotOverlay): BattleTemplateCopy {
  return {
    intro: `${botOverlay.enemyRole} is twisting ${threatTemplate.introScene} with ${botOverlay.pressureModifier}.`,
    victory: `The district settles once you ${botOverlay.victoryAction}, and ${threatTemplate.victoryState}.`,
    failure: `If ${botOverlay.enemyRole} keeps control, ${botOverlay.failureOutcome} and ${threatTemplate.failureState}.`,
  };
}

function dedupeTags(...groups: ReadonlyArray<readonly string[]>): string[] {
  return [...new Set(groups.flat())];
}

export function getBattleTemplate(threatType: string, botArchetype: string): BattleTemplate {
  const normalizedThreatType = normalizeThreatType(threatType);
  const normalizedBotArchetype = normalizeBotArchetype(botArchetype);
  const threatTemplate = normalizedThreatType === 'unknown'
    ? DEFAULT_THREAT_TEMPLATE
    : BATTLE_THREAT_TEMPLATES[normalizedThreatType] ?? DEFAULT_THREAT_TEMPLATE;
  const botOverlay = normalizedBotArchetype === 'unknown'
    ? BOT_ARCHETYPE_OVERLAYS.saboteur
    : BOT_ARCHETYPE_OVERLAYS[normalizedBotArchetype];

  return {
    id: `${threatTemplate.id}__${normalizedBotArchetype}`,
    threatType: normalizedThreatType,
    botArchetype: normalizedBotArchetype,
    encounterName: threatTemplate.encounterName,
    enemyRole: botOverlay.enemyRole,
    summary: `${threatTemplate.summary} Enemy pressure comes through ${botOverlay.pressureModifier}.`,
    arenaTheme: threatTemplate.arenaTheme,
    objective: threatTemplate.objective,
    tone: threatTemplate.tone,
    mechanicHints: [
      ...threatTemplate.mechanicHints.map(cloneMechanic),
      {
        key: 'enemy-pressure',
        label: 'Enemy Pressure',
        description: `Expect ${botOverlay.pressureModifier} while you work the room back into a readable state.`,
      },
    ],
    phases: threatTemplate.phases.map(clonePhase),
    copy: buildCopy(threatTemplate, botOverlay),
    tags: dedupeTags(
      normalizedThreatType === 'unknown' ? ['unknown-threat'] : [normalizedThreatType],
      normalizedBotArchetype === 'unknown' ? ['unknown-bot'] : [normalizedBotArchetype],
      threatTemplate.tags,
      botOverlay.tags,
    ),
  };
}
