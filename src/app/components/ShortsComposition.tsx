'use client';

import React from 'react';
import { AbsoluteFill, Video, Img, Sequence, useCurrentFrame, interpolate, Audio } from 'remotion';

const resolveAsset = (assetPath: string) => {
  if (!assetPath) return '';
  if (assetPath.startsWith('http')) return assetPath;
  
  const nextjsOrigin = 'http://localhost:3000';
  return `${nextjsOrigin}/api/assets?path=${encodeURIComponent(assetPath)}`;
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

interface TextTrack {
  id: string;
  text: string;
  start_frame?: number;
}

interface SceneProps {
  pattern_type: '1' | '2' | '3';
  assets: string[];
  text_tracks: TextTrack[];
}

interface ShortsCompositionProps {
  scenes?: { [key: string]: any };
}

export const ShortsComposition: React.FC<ShortsCompositionProps> = ({ scenes = {} }) => {
  if (!scenes || Object.keys(scenes).length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: '24px' }}>
        No script data found.
      </AbsoluteFill>
    );
  }

  const firstSceneKey = Object.keys(scenes)[0];
  const firstAsset = scenes[firstSceneKey]?.assets?.[0] || '';
  const folderPath = firstAsset ? firstAsset.substring(0, firstAsset.lastIndexOf('/')) : '';
  const bgmSrc = folderPath ? resolveAsset(`${folderPath}/bgm.mp3`) : '';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {bgmSrc && <Audio src={bgmSrc} volume={0.25} loop />}
      
      {Object.keys(scenes).map((key) => {
        const scene = scenes[key];
        const file1Src = scene.assets?.[0] ? resolveAsset(scene.assets[0]) : '';
        const file2Src = scene.assets?.[1] ? resolveAsset(scene.assets[1]) : '';

        const overlapFrames = 10;

        return (
          <Sequence
            key={key}
            from={scene.start_frame}
            durationInFrames={scene.duration_frames + overlapFrames}
          >
            <SceneRender
              pattern_type={scene.pattern_type}
              assets={[file1Src, file2Src]}
              text_tracks={scene.text_tracks || []}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const VideoRenderWithFadeIn: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ opacity }}>
      <Video src={src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </AbsoluteFill>
  );
};

const SceneRender: React.FC<SceneProps> = ({
  pattern_type,
  assets,
  text_tracks,
}) => {
  const frame = useCurrentFrame();
  const pandaQuote = text_tracks.find((t) => t.id === 'panda_quote');
  const sceneTitle = text_tracks.find((t) => t.id === 'scene_title');
  const trivia = text_tracks.find((t) => t.id === 'trivia');

  const transitionFrames = 8;
  const opacity = interpolate(
    frame,
    [0, transitionFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const triviaLines = trivia?.text
    ? trivia.text
        .split('。')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => s + '。')
    : [];

  return (
    <AbsoluteFill className="video-container" style={{ opacity }}>
      <style dangerouslySetInnerHTML={{ __html: textStyles }} />

      <AbsoluteFill>
        {pattern_type === '1' && assets[0] && (
          <Video src={assets[0]} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        
        {pattern_type === '2' && (
          <>
            <Sequence from={0} durationInFrames={125}>
              {assets[0] && <Img src={assets[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </Sequence>
            <Sequence from={120} durationInFrames={133}>
              {assets[1] && <VideoRenderWithFadeIn src={assets[1]} />}
            </Sequence>
          </>
        )}

        {pattern_type === '3' && (
          <>
            <Sequence from={0} durationInFrames={132}>
              {assets[0] && <Video src={assets[0]} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </Sequence>
            <Sequence from={126} durationInFrames={127}>
              {assets[1] && <VideoRenderWithFadeIn src={assets[1]} />}
            </Sequence>
          </>
        )}
      </AbsoluteFill>

      {sceneTitle?.text && (
        <div className="scene-title">
          {sceneTitle.text}
        </div>
      )}

      {triviaLines.length > 0 && (
        <div className="trivia-container">
          {triviaLines.map((line, index) => {
            const startFrame = 30 + index * 36;
            if (frame < startFrame) return null;
            return (
              <div key={index} className="trivia-line">
                {line}
              </div>
            );
          })}
        </div>
      )}

      {pandaQuote?.text && frame >= 162 && (
        <div className="panda-quote-container">
          <div className="panda-quote">
            {pandaQuote.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};