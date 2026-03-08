import type { RepoLanguage, RepoModel, RepoModule, RepoModuleKind, RepoModuleType } from './repoModel';

export interface RepoTopLevelTreeEntry {
  name: string;
  path: string;
  type: RepoModuleType;
  size: number;
}

interface RepoModuleDerivationContext {
  languages: readonly RepoLanguage[];
  primaryLanguage?: string | null;
}

const MAX_TOP_LEVEL_MODULES = 8;
const APP_HINTS = ['app', 'apps', 'client', 'clients', 'frontend', 'ui', 'web', 'www', 'site'];
const PACKAGE_HINTS = ['package', 'packages', 'pkg', 'pkgs', 'lib', 'libs'];
const SERVICE_HINTS = ['service', 'services', 'api', 'server', 'backend', 'worker', 'workers'];
const TEST_HINTS = ['test', 'tests', 'spec', 'specs', 'e2e', 'qa', '__tests__'];
const DOCS_HINTS = ['doc', 'docs', 'readme', 'changelog', 'guide', 'guides'];
const INFRA_HINTS = ['infra', 'ops', 'deploy', 'deployment', 'terraform', 'helm', 'k8s', 'docker'];
const CONTROL_HINTS = [
  '.github',
  '.changeset',
  '.circleci',
  '.husky',
  '.vscode',
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  'nx.json',
  'lerna.json',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
];

const FILE_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  cjs: 'JavaScript',
  cpp: 'C++',
  css: 'CSS',
  go: 'Go',
  java: 'Java',
  js: 'JavaScript',
  jsx: 'JavaScript',
  kt: 'Kotlin',
  md: 'Markdown',
  mdx: 'Markdown',
  php: 'PHP',
  py: 'Python',
  rb: 'Ruby',
  rs: 'Rust',
  sh: 'Shell',
  sql: 'SQL',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  yml: 'YAML',
  yaml: 'YAML',
};

const PRIORITY_BY_NAME: Record<string, number> = {
  api: 14,
  app: 16,
  apps: 18,
  package: 12,
  packages: 18,
  package_json: 14,
  src: 20,
  services: 18,
  tests: 8,
  docs: 8,
  readme_md: 10,
  cargo_toml: 14,
  dockerfile: 12,
  go_mod: 14,
  pyproject_toml: 14,
  pnpm_workspace_yaml: 16,
  requirements_txt: 10,
  turbo_json: 16,
};

const PENALTY_BY_NAME: Record<string, number> = {
  editorconfig: 8,
  gitignore: 8,
  license: 6,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function toScoreKey(value: string): string {
  return normalizeName(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function matchesAnyHint(value: string, hints: readonly string[]): boolean {
  return hints.some((hint) => value === hint || value.includes(hint));
}

function inferModuleKind(entry: RepoTopLevelTreeEntry): RepoModuleKind {
  const normalizedName = normalizeName(entry.name);
  const normalizedPath = normalizeName(entry.path);

  if (matchesAnyHint(normalizedName, TEST_HINTS) || matchesAnyHint(normalizedPath, TEST_HINTS)) {
    return 'tests';
  }

  if (matchesAnyHint(normalizedName, DOCS_HINTS) || matchesAnyHint(normalizedPath, DOCS_HINTS)) {
    return 'docs';
  }

  if (matchesAnyHint(normalizedName, INFRA_HINTS) || matchesAnyHint(normalizedPath, INFRA_HINTS)) {
    return 'infra';
  }

  if (matchesAnyHint(normalizedName, CONTROL_HINTS) || matchesAnyHint(normalizedPath, CONTROL_HINTS)) {
    return 'control';
  }

  if (matchesAnyHint(normalizedName, SERVICE_HINTS) || matchesAnyHint(normalizedPath, SERVICE_HINTS)) {
    return 'service';
  }

  if (matchesAnyHint(normalizedName, APP_HINTS) || matchesAnyHint(normalizedPath, APP_HINTS)) {
    return 'app';
  }

  if (matchesAnyHint(normalizedName, PACKAGE_HINTS) || matchesAnyHint(normalizedPath, PACKAGE_HINTS)) {
    return 'package';
  }

  return 'folder';
}

function scoreTopLevelEntry(entry: RepoTopLevelTreeEntry): number {
  const normalizedName = normalizeName(entry.name);
  const scoreKey = toScoreKey(normalizedName);
  const kind = inferModuleKind(entry);

  let score = entry.type === 'directory' ? 62 : 34;
  score += PRIORITY_BY_NAME[scoreKey] ?? 0;
  score -= PENALTY_BY_NAME[scoreKey] ?? 0;

  if (kind === 'app' || kind === 'service' || kind === 'package') {
    score += 12;
  } else if (kind === 'infra' || kind === 'control') {
    score += 6;
  } else if (kind === 'tests' || kind === 'docs') {
    score += 2;
  }

  if (normalizedName.startsWith('.')) {
    score -= 6;
  }

  return clamp(score, 12, 100);
}

function compareTopLevelEntries(left: RepoTopLevelTreeEntry, right: RepoTopLevelTreeEntry): number {
  const scoreDifference = scoreTopLevelEntry(right) - scoreTopLevelEntry(left);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  if (left.type !== right.type) {
    return left.type === 'directory' ? -1 : 1;
  }

  return left.path.localeCompare(right.path);
}

function estimateModuleFileCount(kind: RepoModuleKind, type: RepoModuleType): number {
  if (type === 'file') {
    return 1;
  }

  switch (kind) {
    case 'app':
      return 18;
    case 'package':
      return 14;
    case 'service':
      return 16;
    case 'infra':
      return 6;
    case 'tests':
      return 8;
    case 'docs':
      return 5;
    case 'control':
      return 4;
    case 'folder':
    default:
      return 10;
  }
}

function inferModuleLanguage(
  entry: RepoTopLevelTreeEntry,
  context: RepoModuleDerivationContext,
  kind: RepoModuleKind,
): string | null {
  if (kind === 'docs' || kind === 'control' || kind === 'infra') {
    return null;
  }

  if (entry.type === 'directory') {
    return context.primaryLanguage ?? context.languages[0]?.name ?? null;
  }

  const extension = entry.name.split('.').pop()?.toLowerCase();
  if (extension && FILE_LANGUAGE_BY_EXTENSION[extension]) {
    return FILE_LANGUAGE_BY_EXTENSION[extension];
  }

  return context.primaryLanguage ?? context.languages[0]?.name ?? null;
}

function makeModuleId(path: string): string {
  const normalized = path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `top-level:${normalized || 'root-item'}`;
}

function buildTopLevelRepoModule(
  entry: RepoTopLevelTreeEntry,
  context: RepoModuleDerivationContext,
): RepoModule {
  const kind = inferModuleKind(entry);
  const importanceScore = scoreTopLevelEntry(entry);

  return {
    id: makeModuleId(entry.path),
    name: entry.name,
    path: entry.path,
    type: entry.type,
    kind,
    language: inferModuleLanguage(entry, context, kind),
    fileCount: estimateModuleFileCount(kind, entry.type),
    totalBytes: entry.type === 'file' ? entry.size : 0,
    importanceScore,
    activityScore: 0,
    riskScore: kind === 'infra' ? 20 : kind === 'service' ? 12 : kind === 'control' ? 8 : 0,
  };
}

export function deriveTopLevelRepoModules(
  context: RepoModuleDerivationContext,
  entries: readonly [],
): [];
export function deriveTopLevelRepoModules(
  context: RepoModuleDerivationContext,
  entries: readonly [RepoTopLevelTreeEntry, ...RepoTopLevelTreeEntry[]],
): [RepoModule, ...RepoModule[]];
export function deriveTopLevelRepoModules(
  context: RepoModuleDerivationContext,
  entries: readonly RepoTopLevelTreeEntry[],
): RepoModule[];
export function deriveTopLevelRepoModules(
  context: RepoModuleDerivationContext,
  entries: readonly RepoTopLevelTreeEntry[],
): RepoModule[] {
  return [...entries]
    .sort(compareTopLevelEntries)
    .slice(0, MAX_TOP_LEVEL_MODULES)
    .map((entry) => buildTopLevelRepoModule(entry, context));
}

export function attachTopLevelRepoModules<T extends RepoModel>(
  snapshot: T,
  entries: readonly [],
): T;
export function attachTopLevelRepoModules<T extends RepoModel>(
  snapshot: T,
  entries: readonly [RepoTopLevelTreeEntry, ...RepoTopLevelTreeEntry[]],
): Omit<T, 'modules'> & { modules: [RepoModule, ...RepoModule[]] };
export function attachTopLevelRepoModules<T extends RepoModel>(
  snapshot: T,
  entries: readonly RepoTopLevelTreeEntry[],
): T;
export function attachTopLevelRepoModules<T extends RepoModel>(
  snapshot: T,
  entries: readonly RepoTopLevelTreeEntry[],
): T {
  return {
    ...snapshot,
    modules: deriveTopLevelRepoModules(
      {
        languages: snapshot.languages,
        primaryLanguage: snapshot.metadata?.primaryLanguage,
      },
      entries,
    ),
  } as T;
}

const _typicalRepoModulesContract = attachTopLevelRepoModules(
  {
    repoId: 'github:contract-example',
    owner: 'octocat',
    name: 'hello-world',
    defaultBranch: 'main',
    visibility: 'public',
    archetype: 'unknown',
    languages: [{ name: 'TypeScript', bytes: 1200, share: 1 }],
    modules: [],
    dependencyEdges: [],
    signals: [],
    generatedAt: '2026-03-08T00:00:00.000Z',
  },
  [
    { name: 'src', path: 'src', type: 'directory', size: 0 },
    { name: 'package.json', path: 'package.json', type: 'file', size: 512 },
  ] as const,
).modules;

const _nonEmptyTopLevelModulesContract: [RepoModule, ...RepoModule[]] = _typicalRepoModulesContract;

void _nonEmptyTopLevelModulesContract;
