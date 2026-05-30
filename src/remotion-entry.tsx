import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { ShortsComposition } from './app/components/ShortsComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Shorts"
        component={ShortsComposition}
        durationInFrames={1771} // 253フレーム × 7シーン ＝ 約59秒
        fps={30}
        width={540}
        height={960}
        defaultProps={{
          scenes: {}
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
