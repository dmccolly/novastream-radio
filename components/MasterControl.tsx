
import React, { useEffect, useRef } from 'react';

interface MasterControlProps {
  onAutoPilotToggle: (active: boolean) => void;
  isAutoPilot: boolean;
  onSystemTest: () => void;
  onInjectDemo: () => void;
  onProveIt: () => void;
  setLogEmitter: (fn: (msg: string) => void) => void;
}

const MasterControl: React.FC<MasterControlProps> = ({ 
  onAutoPilotToggle, 
  isAutoPilot, 
  onSystemTest,
  onProveIt,
  setLogEmitter
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLogEmitter((msg) => {
      if (!logContainerRef.current) return;
      
      const entry = document.createElement('div');
      entry.className = 'flex gap-2 border-l border-zinc-900 pl-2 py-0.5 group animate-in slide-in-from-left-2 duration-200';
      
      const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const colorClass = msg.includes('OK') || msg.includes('SUCCESS') ? 'text-emerald-500' : 
                         msg.includes('ERR') || msg.includes('!!') ? 'text-red-500' : 
                         msg.includes('>>') ? 'text-blue-500 font-black' : 'text-zinc-600';
      
      entry.innerHTML = `<span class="text-zinc-800 font-mono">[${time}]</span> <span class="${colorClass} uppercase font-bold break-all">${msg}</span>`;
      
      logContainerRef.current.prepend(entry);
      
      // Limit log entries to 50 for memory performance
      if (logContainerRef.current.children.length > 50) {
        logContainerRef.current.lastChild?.remove();
      }
    });
  }, [setLogEmitter]);

  return (
    <div className="bg-[#0a0a0c] p-8 rounded-[3rem] border border-zinc-900 shadow-2xl space-y-8 relative overflow-hidden h-fit">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isAutoPilot ? 'bg-blue-500 animate-pulse' : 'bg-zinc-800'}`} />
            <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600 italic">SYSTEM MASTER</h3>
        </div>
        <div className="px-2 py-0.5 rounded-sm border border-zinc-900">
            <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">SIGNAL_V24_SECURE</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-black rounded-2xl border border-zinc-900">
            <div className="text-[7px] font-black text-zinc-700 uppercase tracking-widest mb-4 italic">SIGNAL TOPOLOGY</div>
            <div className="flex items-center justify-between px-2">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${isAutoPilot ? 'border-blue-500 text-blue-500' : 'border-zinc-800 text-zinc-800'}`}>
                    <span className="text-[8px] font-black">VLT</span>
                </div>
                <div className={`h-px flex-1 mx-2 ${isAutoPilot ? 'bg-blue-500/30' : 'bg-zinc-800'}`} />
                <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${isAutoPilot ? 'border-blue-500 text-blue-500' : 'border-zinc-800 text-zinc-800'}`}>
                    <span className="text-[8px] font-black">DSP</span>
                </div>
                <div className={`h-px flex-1 mx-2 ${isAutoPilot ? 'bg-red-500/30' : 'bg-zinc-800'}`} />
                <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${isAutoPilot ? 'border-red-500 text-red-500' : 'border-zinc-800 text-zinc-800'}`}>
                    <span className="text-[8px] font-black">TX</span>
                </div>
            </div>
        </div>

        <button 
          onClick={onProveIt}
          className="w-full py-8 rounded-2xl bg-white text-black font-black text-[11px] uppercase tracking-[0.5em] shadow-2xl hover:bg-zinc-200 active:scale-95 transition-all"
        >
          ENGAGE SIGNAL
        </button>

        <div className="grid grid-cols-2 gap-3">
            <button 
                onClick={onSystemTest}
                className="py-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 font-black text-[8px] uppercase tracking-widest hover:text-white transition-all"
            >
                PROBE
            </button>
            <button 
                onClick={() => onAutoPilotToggle(!isAutoPilot)}
                className={`py-4 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all ${
                    isAutoPilot ? 'bg-blue-600 text-white border-blue-500 shadow-lg' : 'bg-zinc-900 border border-zinc-800 text-zinc-600'
                }`}
            >
                {isAutoPilot ? 'AUTOPILOT' : 'MANUAL'}
            </button>
        </div>
      </div>

      <div 
        ref={logContainerRef}
        className="bg-black/80 rounded-2xl p-4 h-64 border border-zinc-900 overflow-y-auto custom-scrollbar font-mono text-[8px] space-y-1 shadow-inner flex flex-col"
      >
        <div className="text-zinc-800 italic uppercase flex items-center justify-center h-full gap-2 opacity-50">
            <span>Awaiting Signal...</span>
        </div>
      </div>
    </div>
  );
};

export default MasterControl;
