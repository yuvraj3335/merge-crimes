-- Merge Crimes — D1 Schema
-- Migration 0002: Session-scoped mission ownership

CREATE TABLE IF NOT EXISTS mission_sessions (
    session_id TEXT NOT NULL,
    mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('active', 'completed')),
    accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (session_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_sessions_session_status
    ON mission_sessions(session_id, status);

CREATE INDEX IF NOT EXISTS idx_mission_sessions_updated_at
    ON mission_sessions(updated_at DESC);

-- Older builds stored mission status globally on the mission definition row.
-- Reset definitions so session-scoped state becomes the only mutable source.
UPDATE missions
SET status = 'available'
WHERE status <> 'available';
