-- Merge Crimes — D1 Schema
-- Migration 0003: Global mission faction-score cooldown claims

CREATE TABLE IF NOT EXISTS mission_reward_claims (
    mission_id TEXT PRIMARY KEY REFERENCES missions(id) ON DELETE CASCADE,
    last_rewarded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mission_reward_claims_last_rewarded_at
    ON mission_reward_claims(last_rewarded_at DESC);
