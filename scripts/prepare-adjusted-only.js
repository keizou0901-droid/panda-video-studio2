const fs = require('fs');
const path = require('path');

const PROJECT_ID = process.argv[2] || 'demo-project';
const DRIVE_ROOT = 'G:\\マイドライブ\\panda_trip_studio_data';
const WORKING_FOLDER = '②作成中';
const CHECKPOINT_FOLDER = '04_尺調整版';
const REAR_PROJECT_DIR = 'C:\\Users\\User\\panda\\panda-video-studio2';

const driveWorkingDir = path.join(DRIVE_ROOT, PROJECT_ID, WORKING_FOLDER);
const driveCurrentVideoPath = path.join(driveWorkingDir, 'current_video_24fps.json');
const localCurrentVideoPath = path.join(
  REAR_PROJECT_DIR,
  'local_project_data',
  'current_video_24fps.json',
);
const inputCurrentVideoPath = fs.existsSync(driveCurrentVideoPath)
  ? driveCurrentVideoPath
  : localCurrentVideoPath;
const inputPlanPath = path.join(driveWorkingDir, 'production-plan.yaml');

const outputDir = path.join(driveWorkingDir, CHECKPOINT_FOLDER);
const outputPlanPath = path.join(outputDir, 'production-plan.yaml');
const outputJsonPath = path.join(outputDir, 'current_video.json');
const outputCommandPath = path.join(outputDir, 'render-command.txt');

const renderOutputPath =
  `G:/マイドライブ/panda_trip_studio_data/${PROJECT_ID}/②作成中/${CHECKPOINT_FOLDER}/${CHECKPOINT_FOLDER}.mp4`;
const renderPropsPath =
  `G:/マイドライブ/panda_trip_studio_data/${PROJECT_ID}/②作成中/${CHECKPOINT_FOLDER}/current_video.json`;

const renderCommand = () =>
  [
    `cd ${REAR_PROJECT_DIR}`,
    'start "panda-video-assets" /D "C:\\Users\\User\\panda\\panda-video-studio2" npm.cmd run start -- -p 3002',
    'set NEXT_PUBLIC_ASSET_ORIGIN=http://localhost:3002',
    `npx.cmd remotion render src/remotion-entry-24fps-official.tsx Shorts24FpsOfficial "${renderOutputPath}" --props="${renderPropsPath}" --concurrency=2`,
  ].join('\r\n');

const main = () => {
  if (!fs.existsSync(inputCurrentVideoPath)) {
    throw new Error(`current_video_24fps.json was not found: ${inputCurrentVideoPath}`);
  }

  if (!fs.existsSync(inputPlanPath)) {
    throw new Error(`production-plan.yaml was not found: ${inputPlanPath}`);
  }

  const currentVideo = JSON.parse(fs.readFileSync(inputCurrentVideoPath, 'utf8'));
  const scenes = currentVideo.scenes ?? {};
  const beforeTextTrackCounts = {};

  for (const [sceneId, scene] of Object.entries(scenes)) {
    beforeTextTrackCounts[sceneId] = Array.isArray(scene.text_tracks)
      ? scene.text_tracks.length
      : 0;
    scene.text_tracks = [];
  }

  currentVideo.meta = {
    ...(currentVideo.meta ?? {}),
    output_mode: 'adjusted',
    checkpoint_name: CHECKPOINT_FOLDER,
  };

  fs.mkdirSync(outputDir, {recursive: true});
  fs.copyFileSync(inputPlanPath, outputPlanPath);
  fs.writeFileSync(outputJsonPath, JSON.stringify(currentVideo, null, 2), 'utf8');
  fs.writeFileSync(outputCommandPath, renderCommand(), 'utf8');

  console.log(`input: ${inputCurrentVideoPath}`);
  console.log(`created: ${outputDir}`);
  console.log(`total_duration_frames: ${currentVideo.meta?.total_duration_frames}`);
  console.log('text_tracks before -> after');
  for (const [sceneId, count] of Object.entries(beforeTextTrackCounts)) {
    console.log(`${sceneId}: ${count} -> 0`);
  }
};

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
