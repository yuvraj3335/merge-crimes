import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { REPO_FIXTURES } from '../../../shared/seed/repoFixtures';
import type { RepoModel } from '../../../shared/repoModel';

export function MainMenu() {
    const phase = useGameStore((s) => s.phase);
    const setPhase = useGameStore((s) => s.setPhase);
    const loadRepoCity = useGameStore((s) => s.loadRepoCity);
    const clearRepoCity = useGameStore((s) => s.clearRepoCity);
    const repoCityMode = useGameStore((s) => s.repoCityMode);
    const connectedRepo = useGameStore((s) => s.connectedRepo);
    const generatedCity = useGameStore((s) => s.generatedCity);

    const [showRepoSelector, setShowRepoSelector] = useState(false);

    if (phase !== 'menu') return null;

    function handleSelectRepo(repo: RepoModel) {
        loadRepoCity(repo);
        setShowRepoSelector(false);
    }

    function handleClassicMode() {
        if (repoCityMode) {
            clearRepoCity();
        }
        setPhase('playing');
    }

    const selectorHint = repoCityMode
        ? 'Choose a repo snapshot to translate into districts, routes, and threat signals.'
        : 'The repo inspires the city — districts, missions, and threats are generated from its structure.';
    const startMeta = generatedCity
        ? `${generatedCity.districts.length} districts · ${generatedCity.missions.length} routes ready`
        : 'Repo city translation ready';
    const footerNote = generatedCity
        ? `${generatedCity.repoName} snapshot · ${generatedCity.districts.length} districts ready`
        : 'Metadata-first seeded translation';
    const repoCitySummaryMetrics = generatedCity
        ? [
              { label: 'Districts', value: generatedCity.districts.length },
              { label: 'Roads', value: generatedCity.roads.length },
              { label: 'Missions', value: generatedCity.missions.length },
              { label: 'Threats', value: generatedCity.bots.length }
          ]
        : [];

    return (
        <div className={`main-menu ${repoCityMode ? 'repo-city' : ''}`.trim()}>
            {repoCityMode ? (
                <div className="repo-city-menu-hero">
                    <div className="repo-city-menu-kicker">Repo city translation</div>
                    <div className="repo-city-menu-header">
                        <div className="repo-city-menu-heading">
                            <div className="menu-title repo-city">MERGE CRIMES</div>
                            <div className="menu-subtitle repo-city">
                                Translate the connected repo into a readable city map, then clear routes and threat
                                pressure district by district.
                            </div>
                        </div>
                        {connectedRepo && (
                            <div className="repo-city-menu-repo">
                                <div className="repo-city-menu-repo-label">Connected repo</div>
                                <div className="repo-city-menu-repo-name">
                                    {connectedRepo.owner}/{connectedRepo.name}
                                </div>
                                <div className="repo-city-menu-repo-meta">
                                    {connectedRepo.defaultBranch} · {connectedRepo.visibility}
                                </div>
                            </div>
                        )}
                    </div>

                    {generatedCity && (
                        <div className="repo-city-summary repo-city">
                            <div className="repo-city-summary-header">
                                <div className="repo-city-summary-copy">
                                    <div className="repo-city-badge">City snapshot ready</div>
                                    <div className="repo-city-summary-title">
                                        {generatedCity.repoOwner}/{generatedCity.repoName}
                                    </div>
                                    <div className="repo-city-summary-description">
                                        {generatedCity.archetype} repo translated into districts, roads, mission routes,
                                        and bot pressure.
                                    </div>
                                </div>
                                <div className="repo-city-archetype">{generatedCity.archetype}</div>
                            </div>
                            <div className="repo-city-summary-grid">
                                {repoCitySummaryMetrics.map((metric) => (
                                    <div key={metric.label} className="repo-city-summary-metric">
                                        <span className="repo-city-summary-metric-label">{metric.label}</span>
                                        <span className="repo-city-summary-metric-value">{metric.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <>
                    <div className="menu-title">MERGE CRIMES</div>
                    <div className="menu-subtitle">Human vs AI — Defend Your Repo</div>
                </>
            )}

            <button
                type="button"
                className={`menu-start-btn ${repoCityMode ? 'repo-city' : ''}`.trim()}
                data-testid="enter-city"
                onClick={() => setPhase('playing')}
            >
                {repoCityMode ? (
                    <>
                        <span className="menu-start-kicker">Launch translation</span>
                        <span className="menu-start-title">Enter Repo City</span>
                        <span className="menu-start-meta">{startMeta}</span>
                    </>
                ) : (
                    'Enter the City'
                )}
            </button>

            <div className={`menu-secondary-actions ${repoCityMode ? 'repo-city' : ''}`.trim()}>
                <button
                    type="button"
                    className={`menu-repo-btn ${repoCityMode ? 'repo-city' : ''}`.trim()}
                    onClick={() => setShowRepoSelector(!showRepoSelector)}
                >
                    {repoCityMode ? (
                        <>
                            <span className="menu-action-label">Change Repo</span>
                            <span className="menu-action-meta">Swap the city source</span>
                        </>
                    ) : (
                        'Connect a Repo'
                    )}
                </button>
                {repoCityMode && (
                    <button
                        type="button"
                        className="menu-classic-btn repo-city"
                        onClick={handleClassicMode}
                    >
                        <span className="menu-action-label">Classic Mode</span>
                        <span className="menu-action-meta">Return to the legacy city</span>
                    </button>
                )}
            </div>

            {/* Repo Selector Panel */}
            {showRepoSelector && (
                <div className={`repo-selector-panel ${repoCityMode ? 'repo-city' : ''}`.trim()}>
                    <div className={`repo-selector-header ${repoCityMode ? 'repo-city' : ''}`.trim()}>
                        <div className="repo-selector-heading">
                            {repoCityMode && (
                                <div className="repo-selector-kicker">Repo city fixtures</div>
                            )}
                            <div className="repo-selector-title">Select a Repository</div>
                            <div className="repo-selector-hint">{selectorHint}</div>
                        </div>
                        {repoCityMode && (
                            <button
                                type="button"
                                className="repo-selector-close-icon"
                                aria-label="Close repository selector"
                                onClick={() => setShowRepoSelector(false)}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {repoCityMode && (
                        <div className="repo-selector-meta">
                            {REPO_FIXTURES.length} seeded repos ready for translation
                        </div>
                    )}
                    <div className="repo-selector-list">
                        {REPO_FIXTURES.map((repo) => (
                            <button
                                key={repo.repoId}
                                type="button"
                                className={`repo-selector-item ${connectedRepo?.repoId === repo.repoId ? 'selected' : ''} ${repoCityMode ? 'repo-city' : ''}`.trim()}
                                onClick={() => handleSelectRepo(repo)}
                            >
                                {repoCityMode ? (
                                    <>
                                        <div className="repo-item-topline">
                                            <div>
                                                <div className="repo-item-name">
                                                    {repo.owner}/{repo.name}
                                                </div>
                                                <div className="repo-item-branch">
                                                    {repo.defaultBranch} · {repo.visibility}
                                                </div>
                                            </div>
                                            <div className="repo-item-archetype">
                                                {repo.archetype}
                                            </div>
                                        </div>
                                        <div className="repo-item-langs">
                                            {repo.languages.slice(0, 3).map((language) => language.name).join(', ')}
                                        </div>
                                        <div className="repo-item-stats">
                                            <span className="repo-item-pill">{repo.modules.length} modules</span>
                                            <span className="repo-item-pill">{repo.signals.length} signals</span>
                                            <span className="repo-item-pill">{repo.dependencyEdges.length} links</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="repo-item-name">
                                            {repo.owner}/{repo.name}
                                        </div>
                                        <div className="repo-item-meta">
                                            {repo.archetype} · {repo.modules.length} modules · {repo.signals.length} signals
                                        </div>
                                        <div className="repo-item-langs">
                                            {repo.languages.slice(0, 3).map((language) => language.name).join(', ')}
                                        </div>
                                    </>
                                )}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className={`repo-selector-close ${repoCityMode ? 'repo-city' : ''}`.trim()}
                        onClick={() => setShowRepoSelector(false)}
                    >
                        {repoCityMode ? 'Close Selector' : 'Cancel'}
                    </button>
                </div>
            )}

            {repoCityMode ? (
                <div className="menu-version repo-city">
                    <span className="menu-version-pill">Repo City MVP</span>
                    <span className="menu-version-copy">{footerNote}</span>
                    <span className="menu-version-phase">Phase 3 shell</span>
                </div>
            ) : (
                <div className="menu-version">v0.2.0 — Repo City MVP — Phase 3</div>
            )}
        </div>
    );
}
