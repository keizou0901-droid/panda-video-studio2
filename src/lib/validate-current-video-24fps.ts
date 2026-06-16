export type PatternType24Fps = '1' | '2' | '3';

export type TextTrack24Fps = {
  id: string;
  text: string;
  start_frame?: number;
  animation?: string;
};

export type Scene24Fps = {
  pattern_type: PatternType24Fps;
  comment?: string;
  start_frame: number;
  duration_frames: number;
  assets: string[];
  text_tracks?: TextTrack24Fps[];
};

export type CurrentVideo24FpsProps = {
  project_id?: string;
  meta?: {
    global_title?: string;
    fps?: number;
    total_duration_frames?: number;
    source?: string;
    generator?: string;
  };
  scenes?: Record<string, Scene24Fps>;
};

const validPatternTypes = new Set(['1', '2', '3']);

const isFinitePositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isFiniteZeroOrPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

export const validateCurrentVideo24Fps = (
  props: CurrentVideo24FpsProps,
): CurrentVideo24FpsProps => {
  const errors: string[] = [];

  if (!props || typeof props !== 'object') {
    throw new Error('current_video_24fps props must be an object.');
  }

  if (props.meta?.fps !== 24) {
    errors.push('meta.fps must be 24.');
  }

  if (!isFinitePositiveNumber(props.meta?.total_duration_frames)) {
    errors.push('meta.total_duration_frames must be greater than 0.');
  }

  if (!props.scenes || Object.keys(props.scenes).length === 0) {
    errors.push('scenes must not be empty.');
  }

  Object.entries(props.scenes ?? {}).forEach(([sceneId, scene]) => {
    if (!validPatternTypes.has(scene.pattern_type)) {
      errors.push(`${sceneId}.pattern_type must be "1", "2", or "3".`);
    }

    if (!isFiniteZeroOrPositiveNumber(scene.start_frame)) {
      errors.push(`${sceneId}.start_frame must be 0 or greater.`);
    }

    if (!isFinitePositiveNumber(scene.duration_frames)) {
      errors.push(`${sceneId}.duration_frames must be greater than 0.`);
    }

    if (!Array.isArray(scene.assets) || scene.assets.length === 0) {
      errors.push(`${sceneId}.assets must not be empty.`);
    } else if (scene.assets.some((asset) => typeof asset !== 'string' || asset.trim() === '')) {
      errors.push(`${sceneId}.assets must contain non-empty strings.`);
    }

    if (scene.text_tracks && !Array.isArray(scene.text_tracks)) {
      errors.push(`${sceneId}.text_tracks must be an array.`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Invalid current_video_24fps.json: ${errors.join(' ')}`);
  }

  return props;
};
