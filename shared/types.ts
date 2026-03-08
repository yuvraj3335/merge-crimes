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
