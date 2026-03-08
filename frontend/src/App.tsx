import { Canvas } from '@react-three/fiber';
import { Player } from './game/Player';
import { Camera } from './game/Camera';
import { District } from './game/District';
import { CityGround, CityLighting, CityProps } from './game/CityScene';
import { MissionTriggers } from './game/MissionTrigger';
import { Waypoint } from './game/Waypoint';
import { HUD } from './ui/HUD';
import { MissionPanel } from './ui/MissionPanel';
import { MergeConflictGame } from './ui/MergeConflictGame';
import { Leaderboard } from './ui/Leaderboard';
import { CityBulletin } from './ui/CityBulletin';
import { MainMenu } from './ui/MainMenu';
import { MissionObjectiveTracker } from './ui/MissionObjectiveTracker';
import { RewardToast } from './ui/RewardToast';
import { CaptureOverlay } from './ui/CaptureOverlay';
import { ConnectionStatusBanner } from './ui/ConnectionStatusBanner';
import { RepoCitySurface } from './ui/RepoCitySurface';
import { useAppShellEffects } from './hooks/useAppShellEffects';
import { useConnectedRepoRefreshPolling } from './hooks/useConnectedRepoRefreshPolling';
import { useDistrictRoomPolling } from './hooks/useDistrictRoomPolling';
import { useGitHubOAuthCallback } from './hooks/useGitHubOAuthCallback';
import { useMissionTimer } from './hooks/useMissionTimer';
import { useGameStore } from './store/gameStore';
import './index.css';

function App() {
  useAppShellEffects();
  useGitHubOAuthCallback();
  useMissionTimer();
  useDistrictRoomPolling();
  useConnectedRepoRefreshPolling();

  const districts = useGameStore((state) => state.districts);
  const repoCityMode = useGameStore((state) => state.repoCityMode);
  const canvasBackground = repoCityMode ? '#0a121d' : '#050510';
  const canvasCamera = repoCityMode
    ? { position: [0, 62, 14] as [number, number, number], fov: 42 }
    : { position: [0, 45, 35] as [number, number, number], fov: 50 };

  return (
    <div className="game-container" data-testid="phase-3-complete">
      {/* 3D Canvas */}
      <div className="canvas-wrapper">
        <Canvas
          shadows
          camera={canvasCamera}
          gl={{ antialias: true, alpha: false }}
          style={{ background: canvasBackground }}
        >
          <CityLighting />
          <CityGround />

          {/* Districts */}
          {!repoCityMode && districts.map((d) => (
            <District key={d.id} district={d} />
          ))}

          {!repoCityMode && <CityProps />}
          <MissionTriggers />
          <Waypoint />
          <Player />
          <Camera />
        </Canvas>
      </div>

      {/* UI Overlays */}
      <RepoCitySurface />
      <MainMenu />
      <ConnectionStatusBanner />
      <HUD />
      <MissionObjectiveTracker />
      <CaptureOverlay />
      <MissionPanel />
      <Leaderboard />
      <CityBulletin />
      <MergeConflictGame />
      <RewardToast />
    </div>
  );
}

export default App;
