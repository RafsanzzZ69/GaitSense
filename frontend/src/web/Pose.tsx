import { useEffect, useRef, useState } from 'react';
import type { PoseFrame } from './client';

const edges = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[24,26],[26,28],[28,30],[30,32]];
export function Pose({ frames, ratio = 16 / 9, illustrative = false }: { frames: PoseFrame[]; ratio?: number; illustrative?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null), [index, setIndex] = useState(0), [playing, setPlaying] = useState(false);
  useEffect(() => { setIndex(0); setPlaying(false); }, [frames]);
  useEffect(() => {
    if (!playing || !frames.length) return;
    if (index >= frames.length - 1) { setPlaying(false); return; }
    const timer = setTimeout(() => setIndex(i => i + 1), Math.max(1, frames[index + 1].timestampMs - frames[index].timestampMs));
    return () => clearTimeout(timer);
  }, [index, playing, frames]);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d'), frame = frames[index];
    if (!ctx || !frame) return;
    ctx.clearRect(0, 0, 680, 400);
    ctx.strokeStyle = '#dce6df'; ctx.lineWidth = 1;
    for (let x = 0; x < 680; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 400); ctx.stroke(); }
    for (let y = 0; y < 400; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(680, y); ctx.stroke(); }
    const w = Math.min(680, 400 * ratio), h = w / ratio;
    const point = (i: number): [number, number] => [(680-w)/2 + frame.landmarks[i].x*w, (400-h)/2 + frame.landmarks[i].y*h];
    ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const [a,b] of edges) {
      if (frame.landmarks[a]?.visibility < .6 || frame.landmarks[b]?.visibility < .6) continue;
      ctx.strokeStyle = a % 2 ? '#1c8166' : '#7caaa0'; ctx.beginPath(); ctx.moveTo(...point(a)); ctx.lineTo(...point(b)); ctx.stroke();
    }
    for (let i=0;i<33;i++) {
      if (frame.landmarks[i]?.visibility < .6) continue;
      ctx.fillStyle = i >= 27 ? '#d7994e' : '#206b57'; ctx.beginPath(); ctx.arc(...point(i), i === 0 ? 7 : 4, 0, Math.PI*2); ctx.fill();
    }
  }, [frames, index, ratio]);
  if (!frames.length) return <div className="empty">No pose frames available for this recording.</div>;
  return <div className="pose-player"><div className="pose-label"><span className="status-dot" />{illustrative ? 'ILLUSTRATIVE SKELETON' : 'RECORDED POSE LANDMARKS'}<span>33 landmarks</span></div>
    <canvas ref={canvas} width="680" height="400" aria-label={illustrative ? 'Synthetic walking skeleton demonstration' : 'Walking pose reconstructed from your video'} />
    <div className="player-controls"><button className="button small" onClick={() => { if(index>=frames.length-1)setIndex(0);setPlaying(v=>!v); }} aria-label={playing?'Pause replay':'Play replay'}>{playing?'Pause':'Play replay'}</button><input aria-label="Replay position" type="range" min="0" max={frames.length-1} value={index} onChange={e=>{setPlaying(false);setIndex(+e.target.value);}}/><span>{((frames[index]?.timestampMs ?? 0)/1000).toFixed(2)} s</span></div>
  </div>;
}
