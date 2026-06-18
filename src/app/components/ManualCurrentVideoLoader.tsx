'use client';

import {ChangeEvent, useMemo, useState} from 'react';

type SceneSummary = {
  id: string;
  startFrame?: number;
  durationFrames?: number;
  assetCount: number;
};

type LoadedVideo = {
  fileName: string;
  fps?: number;
  totalFrames?: number;
  scenes: SceneSummary[];
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loadedVideo, setLoadedVideo] = useState<LoadedVideo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedFileName = useMemo(
    () => selectedFile?.name ?? 'No file selected',
    [selectedFile],
  );

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
    setError(null);
  };

  const handleLoad = async () => {
    if (!selectedFile) {
      return;
    }

    try {
      const raw = await selectedFile.text();
      const parsed = JSON.parse(raw) as CurrentVideoJson;
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
        fileName: selectedFile.name,
        fps: parsed.meta?.fps,
        totalFrames: parsed.meta?.total_duration_frames,
        scenes,
      });
      setError(null);
    } catch (loadError) {
      setLoadedVideo(null);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load JSON');
    }
  };

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Manual JSON Load</h2>
        <p className="text-sm leading-6 text-zinc-400">
          Load a current_video_24fps.json file in the browser for inspection.
          This does not save anything to local_project_data.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2 rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm hover:border-zinc-500">
          <span className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
            JSON file
          </span>
          <input
            accept=".json"
            className="text-sm text-zinc-300 file:mr-4 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-zinc-100 hover:file:bg-zinc-700"
            type="file"
            onChange={handleFileChange}
          />
          <span className="truncate font-mono text-xs text-zinc-500">
            {selectedFileName}
          </span>
        </label>
        <button
          className="rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          disabled={!selectedFile}
          type="button"
          onClick={handleLoad}
        >
          Load
        </button>
      </div>

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
              <SummaryRow label="File" value={loadedVideo.fileName} mono />
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
