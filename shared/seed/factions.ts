import type { Faction, FactionId, LeaderboardEntry } from '../types';
import { SEED_DISTRICTS } from './districts';

export const SEED_FACTIONS: Faction[] = [
    { id: 'chrome-syndicate', name: 'Chrome Syndicate', color: '#61DAFB', motto: 'We render the future.', score: 2400, districtsControlled: 1 },
    { id: 'rust-collective', name: 'Rust Collective', color: '#FF6B35', motto: 'Zero-cost. Zero mercy.', score: 3100, districtsControlled: 1 },
    { id: 'python-cartel', name: 'Python Cartel', color: '#FFD43B', motto: 'Import power.', score: 1800, districtsControlled: 1 },
    { id: 'node-mafia', name: 'Node Mafia', color: '#3178C6', motto: 'Async or die.', score: 2750, districtsControlled: 1 },
    { id: 'go-yakuza', name: 'Go Yakuza', color: '#00ADD8', motto: 'Keep it simple. Keep it fast.', score: 2100, districtsControlled: 1 },
    { id: 'unaligned', name: 'Unaligned', color: '#A855F7', motto: 'No masters, no forks.', score: 900, districtsControlled: 1 },
];

export const SEED_FACTION_BY_ID: Record<FactionId, Faction> = SEED_FACTIONS.reduce((factionsById, faction) => {
    factionsById[faction.id] = faction;
    return factionsById;
}, {} as Record<FactionId, Faction>);

export function buildSeedLeaderboard(factions: readonly Faction[] = SEED_FACTIONS): LeaderboardEntry[] {
    return [...factions]
        .sort((a, b) => b.score - a.score)
        .map((faction, index) => ({
            rank: index + 1,
            factionId: faction.id,
            factionName: faction.name,
            score: faction.score,
            districtsControlled: SEED_DISTRICTS.filter((district) => district.faction === faction.id).length,
            missionsCompleted: 0,
        }));
}
