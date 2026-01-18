
import React, { useEffect, useRef, memo } from 'react';

const ClockPanel: React.FC = () => {
  const localRef = useRef<HTMLDivElement>(null);
  const zuluRef = useRef<HTMLDivElement>(null);
  const upRef = useRef<HTMLDivElement>(null);
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    let frame: number;
    const update = () => {
      const now = new Date();
      if (localRef.current) {
        localRef.current.innerHTML = `${now.toLocaleTimeString('en-GB', { hour12: false })}<span class="text-xl opacity-30 ml-1 font-mono">${now.getMilliseconds().toString().padStart(3, '0')}</span>`;
      }
      if (zuluRef.current) {
        zuluRef.current.textContent = new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC'
        }).format(now);
      }
      if (upRef.current) {
        const d = Date.now() - sessionStart.current;
        const h = Math.floor(d / 3600000).toString().padStart(2, '0');
        const m = Math.floor((d % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((d % 60000) / 1000).toString().padStart(2, '0');
        const ms = Math.floor((d % 1000) / 10).toString().padStart(2, '0');
        upRef.current.textContent = `${h}:${m}:${s}:${ms}`;
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 w-full max-w-5xl">
      <div className="bg-[#0a0a0c] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zinc-900 shadow-2xl">
        <div className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-2 italic">Studio Master</div>
        <div ref={localRef} className="text-2xl sm:text-4xl font-mono text-blue-500 font-bold tracking-tighter text-glow-blue leading-none flex items-baseline">00:00:00</div>
      </div>
      <div className="bg-[#0a0a0c] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zinc-900 shadow-2xl">
        <div className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-2 italic">Zulu Time</div>
        <div ref={zuluRef} className="text-2xl sm:text-4xl font-mono text-zinc-500 font-bold tracking-tighter leading-none">00:00:00</div>
      </div>
      <div className="bg-[#0a0a0c] p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-red-900/30 shadow-2xl bg-gradient-to-br from-red-950/5 to-transparent">
        <div className="text-red-500 text-[8px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-2 italic">Signal Uptime</div>
        <div ref={upRef} className="text-2xl sm:text-4xl font-mono text-red-600 font-bold tracking-tighter text-glow-red leading-none">00:00:00:00</div>
      </div>
    </div>
  );
};

export default memo(ClockPanel);
