
import React, { useEffect, useRef, memo, useState } from 'react';

interface VisualizerProps {
  analyser: AnalyserNode | null;
  mode?: 'bars' | 'wave';
}

const Visualizer: React.FC<VisualizerProps> = ({ analyser, mode = 'bars' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);
    const bars = 64;
    const barWidth = (canvas.width / bars);

    const render = () => {
      // Dynamic framerate: If window indicates low-cpu (typing), we throttle.
      const isLowCpu = document.documentElement.closest('.low-cpu-mode');
      
      if (!isVisible) {
          requestRef.current = requestAnimationFrame(render);
          return;
      }

      ctx.fillStyle = '#121214';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      if (analyser) {
        if (mode === 'bars') {
          analyser.getByteFrequencyData(dataArray);
          for (let i = 0; i < bars; i++) {
            const index = Math.floor((i / bars) * bufferLength);
            const value = dataArray[index];
            const height = (value / 255) * (canvas.height * 0.85);
            const x = i * barWidth;
            const y = canvas.height - height;
            
            ctx.fillStyle = height > canvas.height * 0.6 ? '#60a5fa' : '#3b82f6';
            ctx.beginPath();
            ctx.roundRect(x + 4, y, barWidth - 8, height, [4, 4, 0, 0]);
            ctx.fill();
          }
        } else {
          analyser.getByteTimeDomainData(dataArray);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#3b82f6';
          ctx.beginPath();
          
          const sliceWidth = canvas.width * 1.0 / bufferLength;
          let x = 0;

          for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }
          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.stroke();
        }
      } else {
        ctx.strokeStyle = '#27272a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
      
      if (isLowCpu) {
          setTimeout(() => {
              requestRef.current = requestAnimationFrame(render);
          }, 500); // 2 FPS during typing
      } else {
          requestRef.current = requestAnimationFrame(render);
      }
    };

    render();
    return () => {
        cancelAnimationFrame(requestRef.current);
    };
  }, [analyser, mode, isVisible]);

  return (
    <div className="bg-[#121214] rounded-[3.5rem] p-12 h-64 relative overflow-hidden border-2 border-zinc-900 shadow-2xl">
      <div className="absolute top-10 left-12 flex items-center gap-4 z-10">
         <div className={`w-2 h-2 rounded-full ${analyser ? 'bg-blue-600 animate-pulse' : 'bg-zinc-800'}`} />
         <span className="text-[11px] font-black uppercase tracking-[0.5em] text-zinc-700 italic">
            {isVisible ? (mode === 'bars' ? 'Signal Analysis' : 'Oscilloscope') : 'STANDBY'}
         </span>
      </div>
      <canvas ref={canvasRef} width={1600} height={300} className="w-full h-full opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#121214] via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

export default memo(Visualizer);
