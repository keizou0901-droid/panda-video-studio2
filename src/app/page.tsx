import fs from 'fs';
import path from 'path';
import {ManualCurrentVideoLoader} from './components/ManualCurrentVideoLoader';

type CurrentVideoSummary = {
  exists: boolean;
  loaded: boolean;
  filePath: string;
  error?: string;
  projectId?: string;
  sceneCount?: number;
  totalFrames?: number;
  fps?: number;
};

const currentVideoPath = path.join(
  process.cwd(),
  'local_project_data',
  'current_video_24fps.json',
);

const readCurrentVideoSummary = (): CurrentVideoSummary => {
  if (!fs.existsSync(currentVideoPath)) {
    return {
      exists: false,
      loaded: false,
      filePath: currentVideoPath,
    };
  }

  try {
    const raw = fs.readFileSync(currentVideoPath, 'utf8');
    const video = JSON.parse(raw) as {
      project_id?: string;
      meta?: {
        fps?: number;
        total_duration_frames?: number;
      };
      scenes?: Record<string, unknown>;
    };

    return {
      exists: true,
      loaded: true,
      filePath: currentVideoPath,
      projectId: video.project_id,
      sceneCount: Object.keys(video.scenes ?? {}).length,
      totalFrames: video.meta?.total_duration_frames,
      fps: video.meta?.fps,
    };
  } catch (error) {
    return {
      exists: true,
      loaded: false,
      filePath: currentVideoPath,
      error: error instanceof Error ? error.message : 'Unknown read error',
    };
  }
};

export const dynamic = 'force-dynamic';

export default function Home() {
  const summary = readCurrentVideoSummary();
  const renderCommand = 'npm.cmd run render:24fps:official';

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <header className="flex flex-col gap-3 border-b border-zinc-800 pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Rear Remotion Environment
          </p>
          <h1 className="text-4xl font-bold tracking-normal">
            Panda Video Studio
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-zinc-400">
            Reads the local official 24fps render props and shows the current
            render readiness summary.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatusTile
            label="JSON file"
            value={summary.exists ? 'Found' : 'Missing'}
            tone={summary.exists ? 'ok' : 'warn'}
          />
          <StatusTile
            label="Read status"
            value={summary.loaded ? 'Loaded' : 'Not loaded'}
            tone={summary.loaded ? 'ok' : 'warn'}
          />
          <StatusTile
            label="Scene count"
            value={formatValue(summary.sceneCount)}
          />
          <StatusTile label="FPS" value={formatValue(summary.fps)} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="text-lg font-semibold">current_video_24fps.json</h2>
            <dl className="mt-5 grid gap-4 text-sm">
              <InfoRow label="Path" value={summary.filePath} mono />
              <InfoRow
                label="Project ID"
                value={summary.projectId ?? 'Not available'}
              />
              <InfoRow
                label="Total frames"
                value={formatValue(summary.totalFrames)}
              />
              <InfoRow label="FPS" value={formatValue(summary.fps)} />
              <InfoRow
                label="Scene count"
                value={formatValue(summary.sceneCount)}
              />
              {summary.error ? (
                <InfoRow label="Read error" value={summary.error} />
              ) : null}
            </dl>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5">
            <h2 className="text-lg font-semibold">Render command</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Run this from the panda-video-studio2 directory after the front
              studio has prepared the render props.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-md border border-zinc-800 bg-black p-4 text-sm text-emerald-200">
              <code>{renderCommand}</code>
            </pre>
          </div>
        </section>

        <ManualCurrentVideoLoader />
      </div>
    </main>
  );
}

function StatusTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'ok' | 'warn';
}) {
  const valueClass =
    tone === 'ok'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-300'
        : 'text-zinc-100';

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </div>
      <div className={`mt-3 text-2xl font-semibold ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function InfoRow({
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
      <dd
        className={`break-words text-zinc-100 ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
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
