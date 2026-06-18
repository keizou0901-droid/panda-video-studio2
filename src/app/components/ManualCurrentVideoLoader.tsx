'use client';

import {useEffect, useMemo, useState} from 'react';

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
};

type ProjectEntry = {
  id: string;
  name: string;
  jsonPath: string;
  size: number;
  updatedAt: string;
};

type CurrentVideoJson = {
  meta?: {
    fps?: number;
    total_duration_frames?: number;
  };
  scenes?: Record<
    string,
    {
      start_frame?: number;
      duration_frames?: number;
      assets?: unknown[];
    }
  >;
};

export function ManualCurrentVideoLoader() {
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loadedVideo, setLoadedVideo] = useState<LoadedVideo | null>(null);
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
        currentVideo?: CurrentVideoJson;
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
      });
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
