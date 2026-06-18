import {NextRequest, NextResponse} from 'next/server';
import fs from 'fs';
import path from 'path';

type ProjectEntry = {
  id: string;
  name: string;
  jsonPath: string;
  size: number;
  updatedAt: string;
};

const myDriveFolderName = String.fromCharCode(
  0x30de,
  0x30a4,
  0x30c9,
  0x30e9,
  0x30a4,
  0x30d6,
);

const driveRootCandidates = [
  path.join('G:', myDriveFolderName, 'panda_trip_studio_data'),
  path.join('G:', 'My Drive', 'panda_trip_studio_data'),
  path.join('G:', 'panda_trip_studio_data'),
];

const findDriveRoot = () =>
  driveRootCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;

const getCurrentVideoPath = (projectDir: string) =>
  path.join(projectDir, '02_working', 'current_video_24fps.json');

const listProjects = (driveRoot: string): ProjectEntry[] =>
  fs
    .readdirSync(driveRoot, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const projectDir = path.join(driveRoot, entry.name);
      const jsonPath = getCurrentVideoPath(projectDir);

      if (!fs.existsSync(jsonPath)) {
        return null;
      }

      const stat = fs.statSync(jsonPath);

      return {
        id: entry.name,
        name: entry.name,
        jsonPath,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      };
    })
    .filter((entry): entry is ProjectEntry => entry !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

const resolveProjectJsonPath = (driveRoot: string, projectId: string) => {
  if (!projectId || projectId.includes('/') || projectId.includes('\\')) {
    return null;
  }

  const projectDir = path.resolve(driveRoot, projectId);
  const root = path.resolve(driveRoot);

  if (projectDir !== root && !projectDir.startsWith(`${root}${path.sep}`)) {
    return null;
  }

  return getCurrentVideoPath(projectDir);
};

export async function GET(request: NextRequest) {
  const driveRoot = findDriveRoot();

  if (!driveRoot) {
    return NextResponse.json(
      {
        driveRoot: null,
        projects: [],
        error: 'panda_trip_studio_data was not found on G drive.',
      },
      {status: 404},
    );
  }

  const projectId = request.nextUrl.searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({
      driveRoot,
      projects: listProjects(driveRoot),
    });
  }

  const jsonPath = resolveProjectJsonPath(driveRoot, projectId);

  if (!jsonPath || !fs.existsSync(jsonPath)) {
    return NextResponse.json(
      {error: 'current_video_24fps.json was not found for the selected project.'},
      {status: 404},
    );
  }

  try {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    return NextResponse.json({
      projectId,
      jsonPath,
      currentVideo: JSON.parse(raw),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to read current_video_24fps.json.',
      },
      {status: 500},
    );
  }
}
