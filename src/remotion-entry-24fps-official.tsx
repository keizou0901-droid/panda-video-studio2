import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {ShortsComposition24FpsOfficial} from './app/components/ShortsComposition24FpsOfficial';
import {
  CurrentVideo24FpsProps,
  validateCurrentVideo24Fps,
} from './lib/validate-current-video-24fps';

export const RemotionRoot24FpsOfficial: React.FC = () => {
  return (
    <Composition
      id="Shorts24FpsOfficial"
      component={ShortsComposition24FpsOfficial}
      durationInFrames={1}
      fps={24}
      width={540}
      height={960}
      defaultProps={{
        scenes: {},
      }}
      calculateMetadata={({props}) => {
        const video = validateCurrentVideo24Fps(props as CurrentVideo24FpsProps);
        return {
          durationInFrames: video.meta?.total_duration_frames ?? 1,
          fps: 24,
        };
      }}
    />
  );
};

registerRoot(RemotionRoot24FpsOfficial);
