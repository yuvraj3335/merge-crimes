// ─── Merge Crimes — Repo City Model Types ───
// Translation layer: GitHub repo metadata -> playable city

// ─── Repo Snapshot Types ───

export type RepoArchetype =
  | 'frontend'
  | 'backend'
  | 'library'
  | 'fullstack'
  | 'monorepo'
  | 'unknown';

export interface RepoLanguage {
  name: string;
  bytes: number;
  share: number; // 0–1
}

export type RepoModuleKind =
  | 'app'
  | 'package'
  | 'service'
  | 'folder'
  | 'infra'
  | 'tests'
  | 'docs'
  | 'control';

export interface RepoModule {
  id: string;
  name: string;
  path: string;
  kind: RepoModuleKind;
  language: string | null;
  fileCount: number;
  totalBytes: number;
  importanceScore: number; // 0–100
  activityScore: number;   // 0–100
  riskScore: number;       // 0–100
}

export type DependencyReason =
  | 'import'
  | 'package_dependency'
  | 'service_link'
  | 'folder_reference';

export interface DependencyEdge {
  fromModuleId: string;
  toModuleId: string;
  weight: number; // 0–1
  reason: DependencyReason;
}

export type RepoSignalType =
  | 'failing_workflow'
  | 'open_pr'
  | 'merge_conflict'
  | 'security_alert'
  | 'issue_spike'
  | 'stale_pr'
  | 'flaky_tests'
  | 'dependency_drift';

export interface RepoSignal {
  type: RepoSignalType;
  target: string; // module id or path
  severity: number; // 1–5
  title?: string;
  detail?: string;
}

export interface RepoMetadata {
  provider: 'github';
  providerRepoId: number;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepageUrl: string | null;
  topics: string[];
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  primaryLanguage: string | null;
  license: string | null;
  archived: boolean;
  fork: boolean;
  updatedAt: string;
  pushedAt: string | null;
}

export interface RepoModel {
  repoId: string;
  owner: string;
  name: string;
  defaultBranch: string;
  visibility: 'public' | 'private';
  archetype: RepoArchetype;
  languages: RepoLanguage[];
  modules: RepoModule[];
  dependencyEdges: DependencyEdge[];
  signals: RepoSignal[];
  generatedAt: string; // ISO date
  metadata?: RepoMetadata;
}

export interface GitHubRepoMetadataSnapshot extends RepoModel {
  metadata: RepoMetadata;
}

// ─── Generated City Types ───

export type DistrictCategory =
  | 'interface'
  | 'service'
  | 'data'
  | 'ops'
  | 'validation'
  | 'archive'
  | 'shared'
  | 'control';

export interface GeneratedBuilding {
  id: string;
  label: string;
  kind: 'cluster' | 'terminal' | 'gate' | 'shield' | 'infra';
  fileCount: number;
}

export interface GeneratedDistrict {
  id: string;
  moduleId: string;
  name: string;
  label: string;
  description: string;
  category: DistrictCategory;
  color: string;
  emissive: string;
  sizeScore: number;       // 0–100
  heatLevel: number;       // 0–100
  riskLevel: number;       // 0–100
  position: { x: number; y: number };
  footprint: { width: number; height: number };
  buildings: GeneratedBuilding[];
}

export interface GeneratedRoadPoint {
  x: number;
  y: number;
}

export interface GeneratedRoad {
  id: string;
  fromDistrictId: string;
  toDistrictId: string;
  reason: DependencyReason;
  weight: number;
  width: number;
  color: string;
  emissive: string;
  points: GeneratedRoadPoint[];
}

export type GeneratedMissionType = 'delivery' | 'recovery' | 'defense' | 'escape' | 'boss';

export interface GeneratedMission {
  id: string;
  districtId: string;
  title: string;
  type: GeneratedMissionType;
  difficulty: 1 | 2 | 3 | 4 | 5;
  sourceSignalType: RepoSignalType;
  targetRef: string;
  description: string;
  objectives: string[];
}

export type BotArchetype =
  | 'hallucination'
  | 'merge'
  | 'regression'
  | 'dependency'
  | 'type'
  | 'refactor'
  | 'saboteur';

export interface GeneratedBot {
  id: string;
  archetype: BotArchetype;
  name: string;
  districtId: string;
  threatLevel: number; // 1–5
}

export interface GeneratedCity {
  repoId: string;
  repoName: string;
  repoOwner: string;
  archetype: RepoArchetype;
  districts: GeneratedDistrict[];
  roads: GeneratedRoad[];
  missions: GeneratedMission[];
  bots: GeneratedBot[];
  generatedAt: string; // ISO date
}
