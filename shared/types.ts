// ─── Merge Crimes — Shared Types ───

export type FactionId = 'chrome-syndicate' | 'rust-collective' | 'python-cartel' | 'node-mafia' | 'go-yakuza' | 'unaligned';

export interface District {
  id: string;
  name: string;
  description: string;
  color: string;        // hex color for district theme
  emissive: string;     // hex emissive glow color
  position: [number, number]; // x, z center on map
  size: [number, number];     // width, depth
  faction: FactionId;
  heatLevel: number;    // 0-100
  repoSource?: RepoSource;
  missionIds: string[];
}

export interface RepoSource {
  owner: string;
  repo: string;
  language: string;
  stars: number;
  openIssues: number;
  lastActivity: string; // ISO date
}

// Live signal types — produced by real GitHub API calls in fetchRepoSignals.ts.
// All other types below are currently fixture-only (seed/demo data); they are
// present so the game engine can consume them when present but are never emitted
// for real repos until the corresponding GitHub API fetches are implemented.
export type RepoSignalType =
  | 'open_issue'         // live: GitHub search API
  | 'open_pr'            // live: GitHub search API
  | 'latest_commit'      // live: GitHub commits API
  | 'failing_workflow'   // fixture-only: requires Checks / Actions API
  | 'merge_conflict'     // fixture-only: requires comparing branch refs
  | 'security_alert'     // fixture-only: requires Dependabot alerts API
  | 'issue_spike'        // fixture-only: derived metric
  | 'stale_pr'           // fixture-only: derived metric
  | 'flaky_tests'        // fixture-only: requires CI run history
  | 'dependency_drift';  // fixture-only: requires dependency graph API

export interface RepoSignal {
  type: RepoSignalType;
  target: string; // module id or repo-level path
  severity: 0 | 1 | 2 | 3 | 4 | 5;
  title?: string;
  detail?: string;
  value?: number | string;
}

export type MissionType = 'delivery' | 'escape' | 'recovery' | 'defense' | 'boss';

export type MissionStatus = 'available' | 'active' | 'completed' | 'failed';

export interface MissionWaypoint {
  id: string;
  label: string;
  position: [number, number, number]; // world x, y, z
  radius: number;      // proximity trigger radius
  order: number;       // sequence order (0-based)
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  districtId: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  timeLimit: number;     // seconds
  reward: number;        // credits
  factionReward: number; // faction influence points
  status: MissionStatus;
  objectives: string[];
  waypoints: MissionWaypoint[];
}

export interface Faction {
  id: FactionId;
  name: string;
  color: string;
  motto: string;
  score: number;
  districtsControlled: number;
}

export interface CaptureState {
  districtId: string;
  controllingFaction: FactionId;
  captureProgress: number; // 0-100
  contestedBy?: FactionId;
  lastUpdated: string;
}

export interface LeaderboardEntry {
  rank: number;
  factionId: FactionId;
  factionName: string;
  score: number;
  districtsControlled: number;
  missionsCompleted: number;
}

export interface CityEvent {
  id: string;
  headline: string;
  description: string;
  districtId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  effects: EventEffect[];
}

export interface EventEffect {
  type: 'heat_change' | 'mission_bonus' | 'faction_shift' | 'district_lockdown';
  value: number;
  target?: string;
}

export interface PlayerProfile {
  id: string;
  name: string;
  faction: FactionId;
  credits: number;
  reputation: number;
  missionsCompleted: number;
  districtsVisited: string[];
  githubUsername?: string;
  homeDistrict?: string;
}

export interface MergeConflictEncounter {
  id: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  timeLimit: number;     // seconds
  hunks: ConflictHunk[];
  correctOrder: number[];
  reward: number;
  districtId: string;
}

export interface ConflictHunk {
  id: number;
  label: string;
  code: string;
  side: 'ours' | 'theirs' | 'resolved';
}

export interface RuntimePresenceEvent {
  type: 'join' | 'leave' | 'move' | 'capture_start' | 'capture_complete';
  playerId: string;
  districtId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}
