-- Merge Crimes — D1 Schema (SQLite)
-- Migration 0001: Initial tables

-- ─── Districts ───
CREATE TABLE IF NOT EXISTS districts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    color TEXT NOT NULL,
    emissive TEXT NOT NULL,
    pos_x REAL NOT NULL,
    pos_z REAL NOT NULL,
    size_w REAL NOT NULL,
    size_d REAL NOT NULL,
    faction TEXT NOT NULL,
    heat_level INTEGER NOT NULL DEFAULT 0,
    repo_json TEXT,          -- JSON: RepoSource | null
    mission_ids_json TEXT NOT NULL DEFAULT '[]'  -- JSON: string[]
);

-- ─── Missions ───
CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('delivery','escape','recovery','defense','boss')),
    district_id TEXT NOT NULL REFERENCES districts(id),
    difficulty INTEGER NOT NULL CHECK(difficulty BETWEEN 1 AND 5),
    time_limit INTEGER NOT NULL,
    reward INTEGER NOT NULL,
    faction_reward INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','active','completed','failed')),
    objectives_json TEXT NOT NULL DEFAULT '[]',   -- JSON: string[]
    waypoints_json TEXT NOT NULL DEFAULT '[]'     -- JSON: MissionWaypoint[]
);

-- ─── Factions ───
CREATE TABLE IF NOT EXISTS factions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    motto TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    districts_controlled INTEGER NOT NULL DEFAULT 0
);

-- ─── Events ───
CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    headline TEXT NOT NULL,
    description TEXT NOT NULL,
    district_id TEXT NOT NULL REFERENCES districts(id),
    severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
    timestamp TEXT NOT NULL,
    effects_json TEXT NOT NULL DEFAULT '[]'  -- JSON: EventEffect[]
);

-- ─── Merge Conflicts ───
CREATE TABLE IF NOT EXISTS merge_conflicts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    difficulty INTEGER NOT NULL CHECK(difficulty BETWEEN 1 AND 5),
    time_limit INTEGER NOT NULL,
    district_id TEXT NOT NULL REFERENCES districts(id),
    reward INTEGER NOT NULL,
    hunks_json TEXT NOT NULL DEFAULT '[]',         -- JSON: ConflictHunk[]
    correct_order_json TEXT NOT NULL DEFAULT '[]'  -- JSON: number[]
);

-- ─── Players ───
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    faction TEXT NOT NULL DEFAULT 'unaligned',
    credits INTEGER NOT NULL DEFAULT 0,
    reputation INTEGER NOT NULL DEFAULT 0,
    missions_completed INTEGER NOT NULL DEFAULT 0,
    districts_visited_json TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
    github_username TEXT,
    home_district TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_missions_district ON missions(district_id);
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_events_district ON events(district_id);
CREATE INDEX IF NOT EXISTS idx_events_severity ON events(severity);
CREATE INDEX IF NOT EXISTS idx_factions_score ON factions(score DESC);
