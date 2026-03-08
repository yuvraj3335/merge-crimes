import type { CityEvent } from '../types';

export const SEED_EVENTS: CityEvent[] = [
    {
        id: 'evt-rust-patch-wave',
        headline: 'RUST DOCKS RIOT: Major Patch Wave Hits',
        description: 'Cargo ships overloaded with crate updates. The Docks are in chaos. Extra rewards for mission runners brave enough to enter.',
        districtId: 'rust-docks',
        severity: 'high',
        timestamp: '2026-03-07T08:00:00Z',
        effects: [
            { type: 'heat_change', value: 20, target: 'rust-docks' },
            { type: 'mission_bonus', value: 50, target: 'rust-docks' },
        ],
    },
    {
        id: 'evt-react-hotfix-flood',
        headline: 'REACT DISTRICT FLOODED: Hotfix Couriers Everywhere',
        description: 'A breaking change in the core hook system has spawned waves of hotfix deliveries. Streets are packed with runners.',
        districtId: 'react-district',
        severity: 'medium',
        timestamp: '2026-03-07T10:00:00Z',
        effects: [
            { type: 'heat_change', value: 15, target: 'react-district' },
            { type: 'mission_bonus', value: 30, target: 'react-district' },
        ],
    },
    {
        id: 'evt-python-quarantine',
        headline: 'PYTHON HEIGHTS QUARANTINE: Dependency Chain Alert',
        description: 'A transitive dependency vulnerability has triggered a full quarantine. All packages entering Heights are being scanned.',
        districtId: 'python-heights',
        severity: 'critical',
        timestamp: '2026-03-07T06:00:00Z',
        effects: [
            { type: 'district_lockdown', value: 1, target: 'python-heights' },
            { type: 'heat_change', value: 30, target: 'python-heights' },
        ],
    },
    {
        id: 'evt-fork-clash',
        headline: 'FORK WARS: Downtown Clash After Issue Spike',
        description: 'Two major forks of the same framework are fighting for control of TypeScript Terminal. Choose your side.',
        districtId: 'typescript-terminal',
        severity: 'high',
        timestamp: '2026-03-07T12:00:00Z',
        effects: [
            { type: 'faction_shift', value: -10, target: 'typescript-terminal' },
            { type: 'heat_change', value: 25, target: 'typescript-terminal' },
        ],
    },
    {
        id: 'evt-go-speed-boost',
        headline: 'GO FREEWAY: Compilation Speed Record',
        description: 'The Go compiler just broke its own speed record. The Freeway is running hot. Bonus speed for all runners.',
        districtId: 'go-freeway',
        severity: 'low',
        timestamp: '2026-03-07T14:00:00Z',
        effects: [
            { type: 'mission_bonus', value: 25, target: 'go-freeway' },
        ],
    },
    {
        id: 'evt-linux-kernel-merge',
        headline: 'LINUX UNDERGROUND: Massive Kernel Merge Window Opens',
        description: 'Torvalds opened the merge window. The Underground is swarming with contributors and merge conflict bosses.',
        districtId: 'linux-underground',
        severity: 'critical',
        timestamp: '2026-03-07T04:00:00Z',
        effects: [
            { type: 'heat_change', value: 35, target: 'linux-underground' },
            { type: 'mission_bonus', value: 75, target: 'linux-underground' },
        ],
    },
    {
        id: 'evt-npm-outage',
        headline: 'CITY-WIDE: NPM Registry Outage',
        description: 'The central package registry is down. Supply lines are disrupted across all districts. Smugglers are making a fortune.',
        districtId: 'typescript-terminal',
        severity: 'critical',
        timestamp: '2026-03-07T16:00:00Z',
        effects: [
            { type: 'heat_change', value: 10 },
            { type: 'mission_bonus', value: 40 },
        ],
    },
];
