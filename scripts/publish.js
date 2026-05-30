const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// 1. Next.js サーバー起動に関する警告表示
console.log('※アセット配信のため、別のターミナルで "npm run dev" が起動している必要があります。');

// 2. 設定ファイルの読み込み
const localDataDir = path.join(process.cwd(), 'local_project_data');
const currentVideoJsonPath = path.join(localDataDir, 'current_video.json');

if (!fs.existsSync(currentVideoJsonPath)) {
  console.error(`エラー: 設定ファイルが見つかりません: ${currentVideoJsonPath}`);
  console.error('先に素材のインポートと `current_video.json` の配置を行ってください。');
  process.exit(1);
}

let projectId = '';
try {
  const config = JSON.parse(fs.readFileSync(currentVideoJsonPath, 'utf8'));
  projectId = config.project_id || '';
} catch (e) {
  console.warn('警告: current_video.json の解析に失敗しました。デフォルトのプロジェクト名を使用します。');
}

if (!projectId) {
  const now = new Date();
  const dateStr = now.getFullYear() + 
    String(now.getMonth() + 1).padStart(2, '0') + 
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') + 
    String(now.getMinutes()).padStart(2, '0') + 
    String(now.getSeconds()).padStart(2, '0');
  projectId = `project_${dateStr}`;
}

console.log(`プロジェクトID: ${projectId}`);

// 3. Remotion レンダリングの実行
const outputFilename = 'output.mp4';
const outputPath = path.join(process.cwd(), outputFilename);

console.log('Remotionレンダリングを開始します...');
// レンダリングを実行。propsにcurrent_video.jsonを指定
const renderCmd = `npx remotion render src/remotion-entry.tsx Shorts "${outputPath}" --props="${currentVideoJsonPath}"`;
console.log(`実行コマンド: ${renderCmd}`);

try {
  execSync(renderCmd, { stdio: 'inherit' });
  console.log(`レンダリング完了: ${outputPath}`);
} catch (err) {
  console.error('エラー: レンダリング中にエラーが発生しました。', err);
  process.exit(1);
}

// 4. Gドライブの探索
console.log('Google ドライブ (panda_trip_studio_data) を探索しています...');
const drives = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
let gDrivePath = null;
for (const d of drives) {
  const pathsToTry = [
    path.join(`${d}:`, 'マイドライブ', 'panda_trip_studio_data'),
    path.join(`${d}:`, 'My Drive', 'panda_trip_studio_data'),
    path.join(`${d}:`, 'panda_trip_studio_data'),
  ];
  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      gDrivePath = p;
      break;
    }
  }
  if (gDrivePath) break;
}

if (!gDrivePath) {
  console.error('エラー: Google ドライブ内の panda_trip_studio_data フォルダが見つかりません。');
  console.error('Google ドライブがマウントされていること、または対象のフォルダが存在することを確認してください。');
  console.error('レンダリングされた動画はローカルに残っています:', outputPath);
  process.exit(1);
}

console.log(`Google ドライブのパスを検出しました: ${gDrivePath}`);

// 5. バックアップフォルダの作成
const hostname = os.hostname();
const backupParentDir = path.join(gDrivePath, `backup_${hostname}`);
const backupProjectDir = path.join(backupParentDir, projectId);

console.log(`バックアップ先フォルダを作成します: ${backupProjectDir}`);
if (!fs.existsSync(backupProjectDir)) {
  fs.mkdirSync(backupProjectDir, { recursive: true });
}

// 6. 成果物およびアセットの同期コピー
console.log('成果物 (動画) とアセット (local_project_data) を Google ドライブへコピーしています...');
try {
  // 動画のコピー
  const destVideoPath = path.join(backupProjectDir, outputFilename);
  fs.copyFileSync(outputPath, destVideoPath);
  console.log(`成果物動画をコピーしました: ${destVideoPath}`);

  // アセットフォルダのコピー
  const destAssetsDir = path.join(backupProjectDir, 'local_project_data');
  if (fs.cpSync) {
    fs.cpSync(localDataDir, destAssetsDir, { recursive: true });
  } else {
    // 古いNode.js用フォールバック
    const copyRecursiveSync = function(src, dest) {
      const exists = fs.existsSync(src);
      const stats = exists && fs.statSync(src);
      const isDirectory = exists && stats.isDirectory();
      if (isDirectory) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(function(childItemName) {
          copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
      } else {
        fs.copyFileSync(src, dest);
      }
    };
    copyRecursiveSync(localDataDir, destAssetsDir);
  }
  console.log(`アセットをコピーしました: ${destAssetsDir}`);

  console.log('コピー完了を確認しました。');
} catch (err) {
  console.error('エラー: Google ドライブへの同期コピー中にエラーが発生しました。', err);
  process.exit(1);
}

// 7. ローカルアセットの削除
console.log('ローカル一時アセット (local_project_data) を完全に消去します...');
try {
  if (fs.rmSync) {
    fs.rmSync(localDataDir, { recursive: true, force: true });
  } else {
    // 古いNode.js用フォールバック
    fs.rmdirSync(localDataDir, { recursive: true });
  }
  console.log('ローカルアセットを正常に消去しました。');
} catch (err) {
  console.error('警告: ローカルアセットの削除中にエラーが発生しました。', err);
}

console.log('パブリッシュ完了！すべての処理が正常に終了しました。');
