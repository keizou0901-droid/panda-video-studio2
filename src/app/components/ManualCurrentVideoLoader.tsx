'use client';

import {Player, PlayerRef} from '@remotion/player';
import {useEffect, useMemo, useRef, useState} from 'react';
import {ShortsComposition24FpsOfficial} from './ShortsComposition24FpsOfficial';
import {CurrentVideo24FpsProps} from '../../lib/validate-current-video-24fps';

type SceneSummary = {
  id: string;
  startFrame?: number;
  durationFrames?: number;
  assetCount: number;
};

type LoadedVideo = {
  projectId: string;
  jsonPath: string;
  fps?: number;
  totalFrames?: number;
  scenes: SceneSummary[];
  currentVideo: CurrentVideo24FpsProps;
};

type ProjectEntry = {
  id: string;
  name: string;
  jsonPath: string;
  size: number;
  updatedAt: string;
};

export function ManualCurrentVideoLoader() {
  const playerRef = useRef<PlayerRef>(null);
  const lastObservedFrameRef = useRef(0);
  const playbackStartTimeRef = useRef<number | null>(null);
  const playbackStartFrameRef = useRef(0);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loadedVideo, setLoadedVideo] = useState<LoadedVideo | null>(null);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isListing, setIsListing] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [driveRoot, setDriveRoot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      try {
        const response = await fetch('/api/current-video-projects', {
          cache: 'no-store',
        });
        const payload = (await response.json()) as {
          driveRoot?: string | null;
          projects?: ProjectEntry[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? 'Failed to list projects.');
        }

        if (isMounted) {
          setDriveRoot(payload.driveRoot ?? null);
          setProjects(payload.projects ?? []);
          setError(null);
        }
      } catch (listError) {
        if (isMounted) {
          setError(
            listError instanceof Error
              ? listError.message
              : 'Failed to list projects.',
          );
        }
      } finally {
        if (isMounted) {
          setIsListing(false);
        }
      }
    };

    loadProjects();

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const previewFps = loadedVideo?.fps ?? 24;
  const previewDurationFrames = loadedVideo?.totalFrames ?? 1;

  useEffect(() => {
    const player = playerRef.current;

    if (!player || !loadedVideo) {
      return;
    }

    const updateFrame = ({detail}: {detail: {frame: number}}) => {
      lastObservedFrameRef.current = detail.frame;
      setPreviewFrame(detail.frame);
    };
    player.addEventListener('frameupdate', updateFrame);
    player.addEventListener('seeked', updateFrame);

    return () => {
      player.removeEventListener('frameupdate', updateFrame);
      player.removeEventListener('seeked', updateFrame);
    };
  }, [loadedVideo]);

  useEffect(() => {
    if (!loadedVideo) {
      return;
    }

    const interval = window.setInterval(() => {
      const player = playerRef.current;

      if (!player || !isPreviewPlaying) {
        return;
      }

      const now = performance.now();
      const playbackStartTime = playbackStartTimeRef.current ?? now;
      const elapsedMs = now - playbackStartTime;
      const elapsedFrames = Math.floor((elapsedMs / 1000) * previewFps);
      const currentFrame = player.getCurrentFrame();
      const targetFrame = playbackStartFrameRef.current + elapsedFrames;
      const nextFrame = Math.min(
        Math.max(currentFrame, lastObservedFrameRef.current, targetFrame),
        previewDurationFrames - 1,
      );

      player.seekTo(nextFrame);
      lastObservedFrameRef.current = nextFrame;
      setPreviewFrame(nextFrame);
    }, Math.max(16, Math.round(1000 / previewFps)));

    return () => {
      window.clearInterval(interval);
    };
  }, [isPreviewPlaying, loadedVideo, previewDurationFrames, previewFps]);

  const handleLoad = async () => {
    if (!selectedProjectId) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/current-video-projects?projectId=${encodeURIComponent(
          selectedProjectId,
        )}`,
        {cache: 'no-store'},
      );
      const payload = (await response.json()) as {
        projectId?: string;
        jsonPath?: string;
        currentVideo?: CurrentVideo24FpsProps;
        error?: string;
      };

      if (!response.ok || !payload.currentVideo || !payload.projectId || !payload.jsonPath) {
        throw new Error(payload.error ?? 'Failed to load current_video_24fps.json.');
      }

      const parsed = payload.currentVideo;
      const scenes = Object.entries(parsed.scenes ?? {})
        .map(([id, scene]) => ({
          id,
          startFrame: scene.start_frame,
          durationFrames: scene.duration_frames,
          assetCount: Array.isArray(scene.assets) ? scene.assets.length : 0,
        }))
        .sort((a, b) => {
          if (typeof a.startFrame === 'number' && typeof b.startFrame === 'number') {
            return a.startFrame - b.startFrame;
          }

          return a.id.localeCompare(b.id);
        });

      setLoadedVideo({
        projectId: payload.projectId,
        jsonPath: payload.jsonPath,
        fps: parsed.meta?.fps,
        totalFrames: parsed.meta?.total_duration_frames,
        scenes,
        currentVideo: parsed,
      });
      setPreviewFrame(0);
      setIsPreviewPlaying(false);
      lastObservedFrameRef.current = 0;
      playbackStartTimeRef.current = null;
      playbackStartFrameRef.current = 0;
      setError(null);
    } catch (loadError) {
      setLoadedVideo(null);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load JSON');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Project JSON Load</h2>
        <p className="text-sm leading-6 text-zinc-400">
          Select a project from Google Drive and load its
          02_working/current_video_24fps.json for inspection.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            Project
          </span>
          <select
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-500"
            disabled={isListing || projects.length === 0}
            value={selectedProjectId}
            onChange={(event) => {
              setSelectedProjectId(event.target.value);
              setError(null);
            }}
          >
            <option value="">
              {isListing ? 'Loading projects...' : 'Select project'}
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <span className="truncate font-mono text-xs text-zinc-500">
            {selectedProject?.jsonPath ??
              driveRoot ??
              'G:\\My Drive\\panda_trip_studio_data'}
          </span>
        </label>
        <button
          className="rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          disabled={!selectedProjectId || isLoading}
          type="button"
          onClick={handleLoad}
        >
          {isLoading ? 'Loading...' : 'Load'}
        </button>
      </div>

      {!isListing && projects.length === 0 && !error ? (
        <div className="mt-5 rounded-md border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-100">
          No projects with 02_working/current_video_24fps.json were found.
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-md border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loadedVideo ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="text-sm font-semibold">Loaded summary</h3>
            <dl className="mt-4 grid gap-3 text-sm">
              <SummaryRow label="Project" value={loadedVideo.projectId} mono />
              <SummaryRow label="JSON path" value={loadedVideo.jsonPath} mono />
              <SummaryRow label="FPS" value={formatValue(loadedVideo.fps)} />
              <SummaryRow
                label="Total frames"
                value={formatValue(loadedVideo.totalFrames)}
              />
              <SummaryRow
                label="Scene count"
                value={formatValue(loadedVideo.scenes.length)}
              />
            </dl>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="text-sm font-semibold">Scenes</h3>
            {loadedVideo.scenes.length > 0 ? (
              <ol className="mt-4 grid max-h-96 gap-2 overflow-auto pr-1 text-sm">
                {loadedVideo.scenes.map((scene) => (
                  <li
                    className="grid gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-3 sm:grid-cols-[1fr_auto]"
                    key={scene.id}
                  >
                    <span className="font-mono text-zinc-100">{scene.id}</span>
                    <span className="text-zinc-400">
                      start {formatValue(scene.startFrame)} / duration{' '}
                      {formatValue(scene.durationFrames)} / assets {scene.assetCount}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">No scenes found.</p>
            )}
          </div>
        </div>
      ) : null}

      {loadedVideo ? (
        <div className="mt-6 rounded-md border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Preview</h3>
            <p className="text-sm leading-6 text-zinc-400">
              Browser preview using the loaded current_video_24fps.json. The
              JSON is not edited or saved.
            </p>
          </div>
          <div className="mt-4 flex justify-center">
            <div className="w-full max-w-[360px] overflow-hidden rounded-md border border-zinc-800 bg-black">
              <Player
                ref={playerRef}
                component={ShortsComposition24FpsOfficial}
                compositionHeight={960}
                compositionWidth={540}
                controls
                durationInFrames={previewDurationFrames}
                fps={previewFps}
                initiallyMuted
                inputProps={loadedVideo.currentVideo}
                style={{
                  aspectRatio: '540 / 960',
                  width: '100%',
                }}
              />
            </div>
          </div>
          <div className="mt-3 text-center font-mono text-xs text-zinc-500">
            frame {previewFrame.toLocaleString('en-US')} /{' '}
            {previewDurationFrames.toLocaleString('en-US')} @ {previewFps}fps
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 hover:border-zinc-500"
              type="button"
              onClick={() => {
                playbackStartTimeRef.current = performance.now();
                playbackStartFrameRef.current =
                  playerRef.current?.getCurrentFrame() ?? previewFrame;
                setIsPreviewPlaying(true);
              }}
            >
              Play preview
            </button>
            <button
              className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 hover:border-zinc-500"
              type="button"
              onClick={() => {
                playbackStartTimeRef.current = null;
                setIsPreviewPlaying(false);
              }}
            >
              Pause preview
            </button>
            {loadedVideo.scenes.slice(0, 3).map((scene) => (
              <button
                className="rounded-md border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 hover:border-zinc-500"
                key={scene.id}
                type="button"
                onClick={() => {
                  const frame = scene.startFrame ?? 0;
                  playerRef.current?.seekTo(frame);
                  lastObservedFrameRef.current = frame;
                  playbackStartTimeRef.current = isPreviewPlaying
                    ? performance.now()
                    : null;
                  playbackStartFrameRef.current = frame;
                  setPreviewFrame(frame);
                }}
              >
                {scene.id}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SummaryRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-zinc-800 pb-3 last:border-b-0 last:pb-0">
      <dt className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </dt>
      <dd className={`break-words text-zinc-100 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

function formatValue(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value.toLocaleString('en-US')
    : 'Not available';
}
