'use client';

import React from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
} from 'remotion';
import {
  CurrentVideo24FpsProps,
  Scene24Fps,
  SceneTransition24Fps,
  TextTrack24Fps,
  validateCurrentVideo24Fps,
} from '../../lib/validate-current-video-24fps';

const getAssetOrigin = () => {
  if (process.env.NEXT_PUBLIC_ASSET_ORIGIN) {
    return process.env.NEXT_PUBLIC_ASSET_ORIGIN;
  }

  return 'http://localhost:3002';
};

const resolveAsset = (assetPath: string) => {
  if (!assetPath) return '';
  if (assetPath.startsWith('http')) return assetPath;

  const assetOrigin = getAssetOrigin();
  return `${assetOrigin}/api/assets?path=${encodeURIComponent(assetPath)}`;
};

const textStyles = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@800;900&display=swap');

.video-container {
  font-family: 'Noto Sans JP', sans-serif;
  overflow: hidden;
}

.scene-title {
  position: absolute;
  top: 8%;
  left: 5%;
  width: 90%;
  text-align: center;
  background: transparent;
  color: #ffff00;
  font-size: 38px;
  font-weight: 900;
  z-index: 20;
  text-shadow:
    -4px -4px 0 #000,
     4px -4px 0 #000,
    -4px  4px 0 #000,
     4px  4px 0 #000,
    -4px  0px 0 #000,
     4px  0px 0 #000,
     0px -4px 0 #000,
     0px  4px 0 #000,
     0px  0px 10px rgba(0,0,0,0.9);
}

.panda-quote-container {
  position: absolute;
  bottom: 20%;
  right: 5%;
  width: 90%;
  display: flex;
  justify-content: flex-end;
  z-index: 20;
}

.panda-quote {
  background: transparent;
  color: #ff3366;
  font-size: 30px;
  font-weight: 900;
  max-width: 85%;
  text-shadow:
    -3px -3px 0 #fff,
     3px -3px 0 #fff,
    -3px  3px 0 #fff,
     3px  3px 0 #fff,
    -3px  0px 0 #fff,
     3px  0px 0 #fff,
     0px -3px 0 #fff,
     0px  3px 0 #fff,
     0px  0px 8px rgba(0,0,0,0.8);
  animation: slideFromLeft 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.trivia-container {
  position: absolute;
  top: 23%;
  left: 5%;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 15;
}

.trivia-line {
  align-self: flex-start;
  background: transparent;
  color: #ffffff;
  font-size: 26px;
  font-weight: 900;
  max-width: 95%;
  word-break: break-all;
  text-shadow:
    -3px -3px 0 #000,
     3px -3px 0 #000,
    -3px  3px 0 #000,
     3px  3px 0 #000,
    -3px  0px 0 #000,
     3px  0px 0 #000,
     0px -3px 0 #000,
     0px  3px 0 #000,
     0px  0px 8px rgba(0,0,0,0.8);
  animation: slideFromRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideFromLeft {
  0% { transform: translateX(-120vw); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}

@keyframes slideFromRight {
  0% { transform: translateX(120vw); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
`;

type SceneRenderProps = {
  scene: Scene24Fps;
  assets: string[];
  transition?: SceneTransition24Fps;
};

const trackStartFrame = (track: TextTrack24Fps | undefined, fallback: number) =>
  track?.start_frame ?? fallback;

const getAssetExtension = (src: string) => {
  let assetSrc = src;

  try {
    const assetUrl = new URL(src);
    assetSrc = assetUrl.searchParams.get('path') ?? assetUrl.pathname;
  } catch {
    assetSrc = src;
  }

  const cleanSrc = assetSrc.split('?')[0].split('#')[0].toLowerCase();
  const dotIndex = cleanSrc.lastIndexOf('.');
  return dotIndex >= 0 ? cleanSrc.slice(dotIndex) : '';
};

const isImageAsset = (src: string) =>
  ['.png', '.jpg', '.jpeg', '.webp'].includes(getAssetExtension(src));

const shouldFadeSceneTransition = (transition: SceneTransition24Fps | undefined) =>
  transition?.effect === 'fade' && (transition.duration_frames ?? 0) > 0;

const splitTriviaLines = (text: string) =>
  text
    .split(/\r?\n|。/)
    .map((line) => line.trim())
    .filter(Boolean);

const VideoRenderWithFadeIn: React.FC<{src: string}> = ({src}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{opacity}}>
      <OffthreadVideo
        src={src}
        muted
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
    </AbsoluteFill>
  );
};

const SceneMedia: React.FC<{scene: Scene24Fps; assets: string[]}> = ({
  scene,
  assets,
}) => {
  const fadeFrames = 6;
  const switchFrame = Math.max(1, Math.round(scene.duration_frames / 2));
  const secondFrom = Math.max(0, switchFrame - fadeFrames);
  const firstDuration = Math.min(scene.duration_frames, switchFrame + fadeFrames);
  const secondDuration = Math.max(1, scene.duration_frames - secondFrom);

  if (scene.pattern_type === '1') {
    if (!assets[0]) return null;

    return isImageAsset(assets[0]) ? (
      <Img
        src={assets[0]}
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
    ) : (
      <OffthreadVideo
        src={assets[0]}
        muted
        style={{width: '100%', height: '100%', objectFit: 'cover'}}
      />
    );
  }

  if (scene.pattern_type === '2') {
    return (
      <>
        <Sequence from={0} durationInFrames={firstDuration}>
          {assets[0] && (
            <Img
              src={assets[0]}
              style={{width: '100%', height: '100%', objectFit: 'cover'}}
            />
          )}
        </Sequence>
        <Sequence from={secondFrom} durationInFrames={secondDuration}>
          {assets[1] && <VideoRenderWithFadeIn src={assets[1]} />}
        </Sequence>
      </>
    );
  }

  return (
    <>
      <Sequence from={0} durationInFrames={firstDuration}>
        {assets[0] && (
          <OffthreadVideo
            src={assets[0]}
            muted
            style={{width: '100%', height: '100%', objectFit: 'cover'}}
          />
        )}
      </Sequence>
      <Sequence from={secondFrom} durationInFrames={secondDuration}>
        {assets[1] && <VideoRenderWithFadeIn src={assets[1]} />}
      </Sequence>
    </>
  );
};

const SceneRender: React.FC<SceneRenderProps> = ({scene, assets, transition}) => {
  const frame = useCurrentFrame();
  const pandaQuote = scene.text_tracks?.find((track) => track.id === 'panda_quote');
  const sceneTitle = scene.text_tracks?.find((track) => track.id === 'scene_title');
  const trivia = scene.text_tracks?.find((track) => track.id === 'trivia');
  const triviaLines = trivia?.text ? splitTriviaLines(trivia.text) : [];

  const opacity = shouldFadeSceneTransition(transition)
    ? interpolate(frame, [0, transition?.duration_frames ?? 6], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  return (
    <AbsoluteFill className="video-container" style={{opacity}}>
      <style dangerouslySetInnerHTML={{__html: textStyles}} />

      <AbsoluteFill>
        <SceneMedia scene={scene} assets={assets} />
      </AbsoluteFill>

      {sceneTitle?.text && frame >= trackStartFrame(sceneTitle, 36) && (
        <div className="scene-title">{sceneTitle.text}</div>
      )}

      {triviaLines.length > 0 && (
        <div className="trivia-container">
          {triviaLines.map((line, index) => {
            const startFrame = trackStartFrame(trivia, 68) + index * 29;
            if (frame < startFrame) return null;
            return (
              <div key={index} className="trivia-line">
                {line}
              </div>
            );
          })}
        </div>
      )}

      {pandaQuote?.text && frame >= trackStartFrame(pandaQuote, 0) && (
        <div className="panda-quote-container">
          <div className="panda-quote">{pandaQuote.text}</div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export const ShortsComposition24FpsOfficial: React.FC<CurrentVideo24FpsProps> = (
  props,
) => {
  const video = validateCurrentVideo24Fps(props);
  const orderedScenes = Object.entries(video.scenes ?? {}).sort(
    ([, a], [, b]) => a.start_frame - b.start_frame,
  );
  const transitionsByToScene = new Map(
    (video.scene_transitions ?? []).map((transition) => [
      transition.to_scene_id,
      transition,
    ]),
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {orderedScenes.map(([key, scene]) => {
        const assets = scene.assets.map(resolveAsset);

        return (
          <Sequence
            key={key}
            from={scene.start_frame}
            durationInFrames={scene.duration_frames}
          >
            <SceneRender
              scene={scene}
              assets={assets}
              transition={transitionsByToScene.get(key)}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
