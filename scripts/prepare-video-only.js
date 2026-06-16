const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

const FPS = 24;
const IMAGE_FRAMES = FPS * 3;
const PROJECT_ID = process.argv[2] || 'demo-project';
const DRIVE_ROOT = 'G:\\マイドライブ\\panda_trip_studio_data';
const WORKING_FOLDER = '②作成中';
const CHECKPOINT_FOLDER = '01_映像のみ';
const REAR_PROJECT_DIR = 'C:\\Users\\User\\panda\\panda-video-studio2';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const inputPlanPath = path.join(
  DRIVE_ROOT,
  PROJECT_ID,
  WORKING_FOLDER,
  'production-plan.yaml',
);
const outputDir = path.join(
  DRIVE_ROOT,
  PROJECT_ID,
  WORKING_FOLDER,
  CHECKPOINT_FOLDER,
);
const outputPlanPath = path.join(outputDir, 'production-plan.yaml');
const outputJsonPath = path.join(outputDir, 'current_video.json');
const outputCommandPath = path.join(outputDir, 'render-command.txt');

const normalizeSlash = (value) => value.replace(/\\/g, '/').replace(/^\/+/, '');

const unquote = (value) => {
  const trimmed = value.trim();
  if (trimmed === '[]') return [];
  if (trimmed === 'null') return null;
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseKeyValue = (text) => {
  const match = text.match(/^([^:]+):\s*(.*)$/);
  if (!match) return null;
  return {
    key: match[1].trim(),
    value: unquote(match[2] ?? ''),
  };
};

const parseProductionPlanYaml = (yamlText) => {
  const lines = yamlText.split(/\r?\n/);
  const project = {};
  const scenes = [];
  let inProject = false;
  let inScenes = false;
  let currentScene = null;
  let currentAsset = null;

  const pushAsset = () => {
    if (currentScene && currentAsset) {
      currentScene.selected_assets.push(currentAsset);
    }
    currentAsset = null;
  };

  const pushScene = () => {
    pushAsset();
    if (currentScene) {
      scenes.push(currentScene);
    }
    currentScene = null;
  };

  for (const line of lines) {
    if (/^project:\s*$/.test(line)) {
      pushScene();
      inProject = true;
      inScenes = false;
      continue;
    }

    if (/^scenes:\s*$/.test(line)) {
      inProject = false;
      inScenes = true;
      continue;
    }

    if (/^[^\s].+:\s*$/.test(line) && !/^scenes:\s*$/.test(line)) {
      if (inScenes) pushScene();
      inProject = false;
      inScenes = false;
    }

    if (inProject) {
      const match = line.match(/^  ([^:]+):\s*(.*)$/);
      if (match) {
        project[match[1].trim()] = unquote(match[2] ?? '');
      }
      continue;
    }

    if (!inScenes) continue;

    const sceneStart = line.match(/^  -\s+(.*)$/);
    if (sceneStart) {
      pushScene();
      currentScene = {selected_assets: []};
      const inline = parseKeyValue(sceneStart[1]);
      if (inline) currentScene[inline.key] = inline.value;
      continue;
    }

    if (!currentScene) continue;

    const assetStart = line.match(/^      -\s+(.*)$/);
    if (assetStart) {
      pushAsset();
      currentAsset = {};
      const inline = parseKeyValue(assetStart[1]);
      if (inline) currentAsset[inline.key] = inline.value;
      continue;
    }

    if (currentAsset) {
      const assetField = line.match(/^        ([^:]+):\s*(.*)$/);
      if (assetField) {
        currentAsset[assetField[1].trim()] = unquote(assetField[2] ?? '');
      }
      continue;
    }

    const sceneField = line.match(/^    ([^:]+):\s*(.*)$/);
    if (sceneField) {
      const key = sceneField[1].trim();
      const value = unquote(sceneField[2] ?? '');
      if (key === 'selected_assets') {
        currentScene.selected_assets = [];
      } else {
        currentScene[key] = value;
      }
    }
  }

  pushScene();
  return {project, scenes};
};

const findFfprobe = () => {
  const candidates = [
    path.join(
      REAR_PROJECT_DIR,
      'node_modules',
      '@remotion',
      'compositor-win32-x64-msvc',
      'ffprobe.exe',
    ),
  ];

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error('ffprobe.exe was not found in panda-video-studio2 node_modules.');
  }
  return found;
};

const toDriveRelativeAssetPath = (assetPath) => {
  const normalized = normalizeSlash(assetPath.trim());
  if (!normalized) return '';
  if (normalized === PROJECT_ID || normalized.startsWith(`${PROJECT_ID}/`)) {
    return normalized;
  }
  return `${PROJECT_ID}/${normalized}`;
};

const toAbsoluteAssetPath = (driveRelativePath) => {
  const normalized = normalizeSlash(driveRelativePath);
  const withoutProject =
    normalized === PROJECT_ID
      ? ''
      : normalized.startsWith(`${PROJECT_ID}/`)
        ? normalized.slice(PROJECT_ID.length + 1)
        : normalized;
  return path.join(DRIVE_ROOT, PROJECT_ID, ...withoutProject.split('/'));
};

const getExtension = (assetPath) => path.extname(assetPath).toLowerCase();

const getVideoDurationFrames = (ffprobePath, absolutePath) => {
  const stdout = execFileSync(
    ffprobePath,
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      absolutePath,
    ],
    {encoding: 'utf8'},
  );
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Could not read video duration: ${absolutePath}`);
  }
  return Math.max(1, Math.round(seconds * FPS));
};

const patternTypeFromScene = (scene, assetCount) => {
  if (scene.render_pattern === 'image_to_video') return '2';
  if (scene.render_pattern === 'video_to_video') return '3';
  if (scene.render_pattern === 'single_asset' || assetCount === 1) return '1';
  return '1';
};

const renderCommand = () =>
  [
    `cd ${REAR_PROJECT_DIR}`,
    'start "panda-video-assets" /D "C:\\Users\\User\\panda\\panda-video-studio2" npm.cmd run start -- -p 3002',
    'npm.cmd run render:checkpoint:video-only',
  ].join('\r\n');

const main = () => {
  if (!fs.existsSync(inputPlanPath)) {
    throw new Error(`production-plan.yaml was not found: ${inputPlanPath}`);
  }

  const yamlText = fs.readFileSync(inputPlanPath, 'utf8');
  const plan = parseProductionPlanYaml(yamlText);
  const ffprobePath = findFfprobe();
  const adoptedScenes = plan.scenes
    .filter((scene) => scene.status === 'adopted')
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  const scenes = {};
  const durationLogs = [];
  let startFrame = 0;

  for (const scene of adoptedScenes) {
    const visualAssets = (scene.selected_assets || [])
      .filter((asset) => asset.asset_type !== 'audio')
      .map((asset) => asset.asset_path || asset.asset_name || '')
      .filter(Boolean);

    if (visualAssets.length === 0) {
      console.warn(`skip ${scene.scene_id}: selected_assets is empty.`);
      continue;
    }

    const assets = visualAssets.map(toDriveRelativeAssetPath);
    const firstAsset = assets[0];
    const absoluteFirstAsset = toAbsoluteAssetPath(firstAsset);

    if (!fs.existsSync(absoluteFirstAsset)) {
      throw new Error(`asset file was not found: ${absoluteFirstAsset}`);
    }

    const firstExt = getExtension(firstAsset);
    const durationFrames = VIDEO_EXTENSIONS.has(firstExt)
      ? getVideoDurationFrames(ffprobePath, absoluteFirstAsset)
      : IMAGE_EXTENSIONS.has(firstExt)
        ? IMAGE_FRAMES
        : IMAGE_FRAMES;

    scenes[scene.scene_id] = {
      pattern_type: patternTypeFromScene(scene, assets.length),
      comment: '',
      start_frame: startFrame,
      duration_frames: durationFrames,
      assets,
      text_tracks: [],
    };

    durationLogs.push({
      scene_id: scene.scene_id,
      asset: firstAsset,
      duration_frames: durationFrames,
      duration_sec: Number((durationFrames / FPS).toFixed(3)),
    });

    startFrame += durationFrames;
  }

  if (startFrame <= 0) {
    throw new Error('No renderable adopted scenes were found.');
  }

  const currentVideo = {
    project_id: PROJECT_ID,
    meta: {
      global_title: plan.project.video_title || '',
      fps: FPS,
      total_duration_frames: startFrame,
      source: 'production-plan',
      generator: 'panda-video-studio2',
      output_mode: 'video_only',
      checkpoint_name: CHECKPOINT_FOLDER,
    },
    scenes,
  };

  fs.mkdirSync(outputDir, {recursive: true});
  fs.copyFileSync(inputPlanPath, outputPlanPath);
  fs.writeFileSync(outputJsonPath, JSON.stringify(currentVideo, null, 2), 'utf8');
  fs.writeFileSync(outputCommandPath, renderCommand(), 'utf8');

  console.log(`created: ${outputDir}`);
  console.log(`total_duration_frames: ${startFrame}`);
  console.log(`total_duration_sec: ${(startFrame / FPS).toFixed(3)}`);
  console.table(durationLogs);
};

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
