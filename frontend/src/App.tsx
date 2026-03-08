import { useEffect, useRef } from 'react';
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
import { installLocalSmokeBridge } from './localSmokeBridge';
import { useGameStore } from './store/gameStore';
import * as api from './api';
import './index.css';

// Polls the DistrictRoom DO every 10s while player is in a district.
// Updates districtRooms in gameStore (presence count + merged capture progress).
// Also ticks local capture progress at 0.2/s for a smooth bar between heartbeats.
function DistrictRoomPoller() {
    const { apiAvailable, currentDistrict, setDistrictRoom, phase } = useGameStore();
    const addCaptureProgress = useGameStore((s) => s.addCaptureProgress);

    // Local capture tick: advances client-side progress smoothly while in a district.
    // Rate: 0.2/s = 2/10s, matching the DO heartbeat increment so they stay aligned.
    useEffect(() => {
        if (!currentDistrict || phase === 'menu' || phase === 'boss') return;
        const districtId = currentDistrict.id;
        const tick = setInterval(() => {
            addCaptureProgress(districtId, 0.2);
        }, 1000);
        return () => clearInterval(tick);
    }, [currentDistrict, phase, addCaptureProgress]);

    // Heartbeat: syncs presence + authoritative DO capture every 10s.
    useEffect(() => {
        if (!apiAvailable || !currentDistrict) return;

        const districtId = currentDistrict.id;

        // Heartbeat immediately on district enter
        api.districtHeartbeat(districtId).then((data) => {
            if (data) setDistrictRoom(districtId, data);
        }).catch(() => { /* non-fatal */ });

        // Poll every 10s (heartbeat refreshes presence window + adds walk-up capture in DO)
        const interval = setInterval(() => {
            api.districtHeartbeat(districtId).then((data) => {
                if (data) setDistrictRoom(districtId, data);
            }).catch(() => { /* non-fatal */ });
        }, 10_000);

        return () => clearInterval(interval);
    }, [apiAvailable, currentDistrict, setDistrictRoom]);

    return null;
}

function App() {
  const {
    phase,
    districts,
    setShowMissionPanel,
    showMissionPanel,
    setShowLeaderboard,
    showLeaderboard,
    setShowBulletin,
    showBulletin,
    activeMission,
    missionTimer,
    setMissionTimer,
    failMission,
    loadFromApi,
    apiAvailable,
    setApiRuntimeStatus,
    repoCityMode,
  } = useGameStore();

  // Hydrate from the Worker once on mount so the same tab can restore active missions after reload.
  const apiLoadedRef = useRef(false);
  useEffect(() => {
    if (!apiLoadedRef.current) {
      apiLoadedRef.current = true;
      void loadFromApi();
    }
  }, [loadFromApi]);

  useEffect(() => {
    return api.subscribeApiRuntimeStatus((status) => {
      setApiRuntimeStatus(status);
    });
  }, [setApiRuntimeStatus]);

  useEffect(() => installLocalSmokeBridge(), []);

  useEffect(() => {
    if (phase !== 'menu' && apiAvailable) {
      void api.primePublicWriteSession();
    }
  }, [phase, apiAvailable]);

  const canvasBackground = repoCityMode ? '#0a121d' : '#050510';
  const canvasCamera = repoCityMode
    ? { position: [0, 62, 14] as [number, number, number], fov: 42 }
    : { position: [0, 45, 35] as [number, number, number], fov: 50 };

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase === 'menu' || phase === 'boss') return;

      switch (e.key.toLowerCase()) {
        case 'm':
          setShowMissionPanel(!showMissionPanel);
          break;
        case 'l':
          setShowLeaderboard(!showLeaderboard);
          break;
        case 'b':
          setShowBulletin(!showBulletin);
          break;
        case 'escape':
          setShowMissionPanel(false);
          setShowLeaderboard(false);
          setShowBulletin(false);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, showMissionPanel, showLeaderboard, showBulletin, setShowMissionPanel, setShowLeaderboard, setShowBulletin]);

  // Mission timer countdown (for non-boss missions)
  useEffect(() => {
    if (phase !== 'mission' || !activeMission || missionTimer <= 0) return;

    const interval = setInterval(() => {
      const newTimer = missionTimer - 1;
      setMissionTimer(newTimer);
      if (newTimer <= 0 && activeMission) {
        failMission(activeMission.id);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, activeMission, missionTimer, setMissionTimer, failMission]);

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

      {/* District Room Poller (DO presence + capture) */}
      <DistrictRoomPoller />

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
