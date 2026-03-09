// ─── Merge Crimes — DB Seed Script ───
// Populates D1 tables from shared seed data

import { SEED_DISTRICTS } from '../../shared/seed/districts.ts';
import { SEED_FACTIONS } from '../../shared/seed/factions.ts';
import { SEED_MISSIONS } from '../../shared/seed/missions.ts';
import { SEED_EVENTS } from '../../shared/seed/events.ts';
import { SEED_CONFLICTS } from '../../shared/seed/conflicts.ts';

export async function seedDatabase(db: D1Database): Promise<{ inserted: Record<string, number> }> {
    const counts: Record<string, number> = {};

    // Clear existing data (reverse order for FK safety)
    await db.batch([
        db.prepare('DELETE FROM mission_sessions'),
        db.prepare('DELETE FROM mission_reward_claims'),
        db.prepare('DELETE FROM merge_conflicts'),
        db.prepare('DELETE FROM events'),
        db.prepare('DELETE FROM missions'),
        db.prepare('DELETE FROM factions'),
        db.prepare('DELETE FROM districts'),
    ]);

    // ─── Seed Districts ───
    const districtStmts = SEED_DISTRICTS.map((d) =>
        db.prepare(
            `INSERT INTO districts (id, name, description, color, emissive, pos_x, pos_z, size_w, size_d, faction, heat_level, repo_json, mission_ids_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            d.id, d.name, d.description, d.color, d.emissive,
            d.position[0], d.position[1],
            d.size[0], d.size[1],
            d.faction, d.heatLevel,
            d.repoSource ? JSON.stringify(d.repoSource) : null,
            JSON.stringify(d.missionIds)
        )
    );
    await db.batch(districtStmts);
    counts.districts = SEED_DISTRICTS.length;

    // ─── Seed Factions ───
    const factionStmts = SEED_FACTIONS.map((f) =>
        db.prepare(
            `INSERT INTO factions (id, name, color, motto, score, districts_controlled)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(f.id, f.name, f.color, f.motto, f.score, f.districtsControlled)
    );
    await db.batch(factionStmts);
    counts.factions = SEED_FACTIONS.length;

    // ─── Seed Missions ───
    const missionStmts = SEED_MISSIONS.map((m) =>
        db.prepare(
            `INSERT INTO missions (id, title, description, type, district_id, difficulty, time_limit, reward, faction_reward, status, objectives_json, waypoints_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            m.id, m.title, m.description, m.type, m.districtId,
            m.difficulty, m.timeLimit, m.reward, m.factionReward, m.status,
            JSON.stringify(m.objectives),
            JSON.stringify(m.waypoints)
        )
    );
    await db.batch(missionStmts);
    counts.missions = SEED_MISSIONS.length;

    // ─── Seed Events ───
    const eventStmts = SEED_EVENTS.map((e) =>
        db.prepare(
            `INSERT INTO events (id, headline, description, district_id, severity, timestamp, effects_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(e.id, e.headline, e.description, e.districtId, e.severity, e.timestamp, JSON.stringify(e.effects))
    );
    await db.batch(eventStmts);
    counts.events = SEED_EVENTS.length;

    // ─── Seed Merge Conflicts ───
    const conflictStmts = SEED_CONFLICTS.map((c) =>
        db.prepare(
            `INSERT INTO merge_conflicts (id, title, description, difficulty, time_limit, district_id, reward, hunks_json, correct_order_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            c.id, c.title, c.description, c.difficulty, c.timeLimit,
            c.districtId, c.reward,
            JSON.stringify(c.hunks),
            JSON.stringify(c.correctOrder)
        )
    );
    await db.batch(conflictStmts);
    counts.merge_conflicts = SEED_CONFLICTS.length;

    return { inserted: counts };
}
