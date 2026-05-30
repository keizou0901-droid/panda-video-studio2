const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. 引数の確認
const targetRelativePath = process.argv[2];
if (!targetRelativePath) {
  console.error('エラー: インポート先のパスを指定してください。');
  console.error('例: npm run import -- 1_素材入れ/20260529_kirin/intro_1.mp4');
  process.exit(1);
}

// 2. ダウンロードフォルダの特定
const homedir = process.env.USERPROFILE || process.env.HOME;
if (!homedir) {
  console.error('エラー: ホームディレクトリを特定できませんでした。');
  process.exit(1);
}
const downloadsDir = path.join(homedir, 'Downloads');
if (!fs.existsSync(downloadsDir)) {
  console.error(`エラー: ダウンロードフォルダが見つかりません: ${downloadsDir}`);
  process.exit(1);
}

// 3. 最新のファイルを探す
const files = fs.readdirSync(downloadsDir)
  .map(file => {
    const filePath = path.join(downloadsDir, file);
    try {
      const stat = fs.statSync(filePath);
      return { name: file, path: filePath, mtime: stat.mtimeMs, isFile: stat.isFile() };
    } catch (e) {
      return null;
    }
  })
  .filter(file => file && file.isFile && !file.name.startsWith('.')); // 隠しファイル除外

if (files.length === 0) {
  console.error(`エラー: ダウンロードフォルダにファイルが見つかりません: ${downloadsDir}`);
  process.exit(1);
}

// 更新日時でソート (降順)
files.sort((a, b) => b.mtime - a.mtime);
const latestFile = files[0];
console.log(`最新のダウンロードファイルを検出しました: ${latestFile.name} (更新日時: ${new Date(latestFile.mtime).toLocaleString()})`);

// 4. 保存先パスの決定
const localDataDir = path.join(process.cwd(), 'local_project_data');
const destPath = path.join(localDataDir, targetRelativePath);
const destDir = path.dirname(destPath);

// フォルダの自動作成
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

const srcExt = path.extname(latestFile.name).toLowerCase();
const destExt = path.extname(targetRelativePath).toLowerCase();

// 5. インポート処理（動画かつmp4の場合は ffmpeg で GOP=1 最適化）
if (srcExt === '.mp4' && destExt === '.mp4') {
  console.log('MP4動画として検出しました。ffmpegを用いてRemotion向けにシーク最適化（GOP=1 / 全キーフレーム化）を行います...');
  
  // @ffmpeg-installer/ffmpegの存在確認とパス取得
  let ffmpegPath;
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    ffmpegPath = ffmpegInstaller.path;
    if (!fs.existsSync(ffmpegPath)) {
      throw new Error(`ffmpeg binary not found at ${ffmpegPath}`);
    }
  } catch (e) {
    console.error('エラー: @ffmpeg-installer/ffmpeg が見つからないか、バイナリが存在しません。');
    console.error('npm install が正しく実行されたか確認してください。', e);
    process.exit(1);
  }

  // ffmpegコマンドの実行
  // -y : 上書き許可
  // -i : 入力ファイル
  // -r 30 : 30fps固定
  // -g 1 -keyint_min 1 -sc_threshold 0 : 全フレームキーフレーム（GOP=1）
  // -c:v libx264 : H.264
  // -crf 18 : 高画質（ほぼロスレス）
  // -pix_fmt yuv420p : 互換性重視のピクセルフォーマット
  const cmd = `"${ffmpegPath}" -y -i "${latestFile.path}" -r 30 -g 1 -keyint_min 1 -sc_threshold 0 -c:v libx264 -crf 18 -pix_fmt yuv420p "${destPath}"`;
  
  console.log(`実行コマンド: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log(`インポート＆最適化に成功しました: ${destPath}`);
    
    // 元ファイルの削除
    fs.unlinkSync(latestFile.path);
    console.log(`元のダウンロードファイルを削除しました: ${latestFile.path}`);
  } catch (err) {
    console.error('エラー: ffmpegの実行中にエラーが発生しました。', err);
    process.exit(1);
  }
} else {
  // 動画ではない、またはmp4以外の場合は単にコピー
  console.log(`非MP4ファイルまたは異なる種類のインポートです。ファイルを単にコピーします...`);
  try {
    fs.copyFileSync(latestFile.path, destPath);
    console.log(`コピーに成功しました: ${destPath}`);
    
    // 元ファイルの削除
    fs.unlinkSync(latestFile.path);
    console.log(`元のダウンロードファイルを削除しました: ${latestFile.path}`);
  } catch (err) {
    console.error('エラー: ファイルのコピー中にエラーが発生しました。', err);
    process.exit(1);
  }
}
