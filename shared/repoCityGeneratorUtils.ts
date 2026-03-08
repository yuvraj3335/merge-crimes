const MODULE_NAME_ALIASES: Record<string, string> = {
  src: 'Source',
  ui: 'UI',
  'ui-kit': 'UI Kit',
  api: 'API',
  db: 'Data',
  ci: 'CI',
  docs: 'Docs',
  e2e: 'E2E',
  infra: 'Infra',
  frontend: 'Frontend',
  worker: 'Worker',
  shared: 'Shared',
  tests: 'Tests',
  examples: 'Examples',
  migrations: 'Migrations',
  web: 'Web',
  auth: 'Auth',
  admin: 'Admin',
  workspace: 'Workspace',
};

export function humanizeModuleName(name: string): string {
  const key = name.toLowerCase();
  const alias = MODULE_NAME_ALIASES[key];
  if (alias) {
    return alias;
  }

  return key
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .map((part) => (part.length <= 2
      ? part.toUpperCase()
      : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(' ');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function makeId(prefix: string, ...parts: string[]): string {
  const slug = parts.map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, '-')).join('-');
  return `${prefix}-${slug}`;
}
