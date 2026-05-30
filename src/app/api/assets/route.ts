import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// CORSヘッダーを設定する共通関数
function corsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Range');
  response.headers.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length');
  return response;
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return corsHeaders(response);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const assetPath = searchParams.get('path');

  if (!assetPath) {
    const response = new NextResponse('Missing path parameter', { status: 400 });
    return corsHeaders(response);
  }

  // 1. まずローカルの local_project_data を探索
  const localBaseDir = path.join(process.cwd(), 'local_project_data');
  let absolutePath = path.join(localBaseDir, assetPath);

  console.log(`[API Assets] Request path: ${assetPath} -> Absolute path (LOCAL): ${absolutePath}`);

  if (!fs.existsSync(absolutePath)) {
    console.error(`[API Assets] File not found (LOCAL): ${absolutePath}, falling back to G Drive...`);
    
    // 2. ローカルに無い場合はGドライブ（マウントされたGoogle Drive）を自動探索してフォールバック
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

    if (gDrivePath) {
      absolutePath = path.join(gDrivePath, assetPath);
      console.log(`[API Assets] Fallback to G Drive -> Absolute path (G-DRIVE): ${absolutePath}`);
    }

    if (!fs.existsSync(absolutePath)) {
      console.error(`[API Assets] File not found in both LOCAL and G-DRIVE: ${assetPath}`);
      const response = new NextResponse('File not found', { status: 404 });
      return corsHeaders(response);
    }
  }

  const stat = fs.statSync(absolutePath);
  const fileSize = stat.size;
  const range = request.headers.get('range');

  let contentType = 'application/octet-stream';
  if (absolutePath.endsWith('.mp4')) {
    contentType = 'video/mp4';
  } else if (absolutePath.endsWith('.mp3')) {
    contentType = 'audio/mpeg';
  } else if (absolutePath.endsWith('.png')) {
    contentType = 'image/png';
  } else if (absolutePath.endsWith('.jpg') || absolutePath.endsWith('.jpeg')) {
    contentType = 'image/jpeg';
  }

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      const response = new NextResponse('Requested range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${fileSize}` }
      });
      return corsHeaders(response);
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(absolutePath, { start, end });
    
    // @ts-ignore
    const response = new NextResponse(file, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': contentType,
      }
    });
    return corsHeaders(response);
  } else {
    const file = fs.createReadStream(absolutePath);
    // @ts-ignore
    const response = new NextResponse(file, {
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
      }
    });
    return corsHeaders(response);
  }
}
