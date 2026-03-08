import type { GeneratedCity, RepoModel } from './repoModel';
import { classifyRepoArchetype, computeConnectivityScores, planDistrictLayout } from './archetypeClassification';
import { buildGeneratedDistricts } from './districtLabeling';
import { generateRoads } from './roadGeneration';
import { generateSignalDrivenBots, generateSignalDrivenMissions, isActionableSignal } from './signalMissionGeneration';

export { generatedCityToConflicts, generatedCityToDistricts, generatedCityToMissions } from './gameplayBridge';

export function generateCityFromRepo(repo: RepoModel): GeneratedCity {
  const archetype = classifyRepoArchetype(repo);
  const connectivityScores = computeConnectivityScores(repo);
  const { activeModules, positions } = planDistrictLayout(repo.modules, archetype, connectivityScores);
  const districts = buildGeneratedDistricts(repo, activeModules, archetype, positions, connectivityScores);
  const roads = generateRoads(repo, districts, archetype);
  const actionableSignals = repo.signals.filter(isActionableSignal);
  const missions = generateSignalDrivenMissions(repo, districts, actionableSignals);
  const bots = generateSignalDrivenBots(repo, districts, actionableSignals);

  return {
    repoId: repo.repoId,
    repoName: repo.name,
    repoOwner: repo.owner,
    archetype,
    districts,
    roads,
    missions,
    bots,
    generatedAt: repo.generatedAt,
  };
}
