
import React, { useState } from 'react';
import { Icons } from '../constants';
import { connectToNode } from '../services/stationService';

interface StreamerViewProps {
  isBroadcasting: boolean;
  setIsBroadcasting: (val: boolean) => void;
  isReceiver?: boolean;
  onReceiverToggle?: (val: boolean) => void;
  stationId?: string;
}

const StreamerView: React.FC<StreamerViewProps> = ({ 
  isBroadcasting, 
  setIsBroadcasting,
  isReceiver = false,
  onReceiverToggle,
  stationId
}) => {
  const [targetId, setTargetId] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleJoin = () => {
      if (!targetId.trim()) return;
      connectToNode(targetId.trim());
      if (onReceiverToggle) onReceiverToggle(true);
  };

  const copyRelayLink = () => {
      if (!stationId) return;
      const url = `${window.location.origin}${window.location.pathname}?relay=${stationId}`;
      navigator.clipboard.writeText(url);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-[#0a0a0c] p-12 rounded-[3.5rem] border border-zinc-900 shadow-2xl">
        <div>
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-blue-500">Node_Relay</h2>
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] mt-2 italic">Secure Private Link Infrastructure</p>
        </div>
        <div className="flex flex-wrap gap-4">
            <button 
              onClick={() => setIsBroadcasting(!isBroadcasting)}
              className={`px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                isBroadcasting 
                  ? 'bg-red-600 shadow-lg shadow-red-900/40' 
                  : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
              }`}
            >
              {isBroadcasting ? 'Broadcasting ON' : 'Start Transmitter'}
            </button>
            <button 
              onClick={() => { if (onReceiverToggle) onReceiverToggle(!isReceiver); }}
              className={`px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                isReceiver 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
              }`}
            >
              Receiver Mode
            </button>
            <button 
                onClick={copyRelayLink}
                disabled={!stationId}
                className={`px-10 py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border-2 ${copyFeedback ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-white text-black border-white'}`}
            >
                {copyFeedback ? 'LINK COPIED' : 'Copy Direct Link'}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        <div className="bg-[#0a0a0c] p-10 rounded-[3rem] border border-zinc-900 space-y-8 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><Icons.Activity /></div>
            <h3 className="text-xl font-black italic uppercase tracking-tighter">Connection Portal</h3>
          </div>
          
          <div className="space-y-6">
            <div className="bg-black p-8 rounded-[2rem] border border-zinc-900">
               <div className="text-[9px] font-black text-zinc-500 uppercase mb-4 tracking-widest">Your Station ID:</div>
               <div className="text-3xl font-mono font-black italic text-blue-500 tracking-tighter">
                  {stationId || "GENERATING..."}
               </div>
            </div>

            {isReceiver ? (
                <div className="flex gap-4">
                    <input 
                        type="text" 
                        placeholder="ENTER HOST_ID"
                        className="flex-1 bg-black border border-zinc-800 rounded-xl px-6 py-5 text-sm font-mono text-blue-500 outline-none"
                        value={targetId}
                        onChange={(e) => setTargetId(e.target.value)}
                    />
                    <button onClick={handleJoin} className="bg-blue-600 text-white px-10 py-5 rounded-xl text-[10px] font-black uppercase">Link</button>
                </div>
            ) : (
                <div className="p-10 bg-white rounded-[2rem] flex flex-col items-center justify-center gap-4 border-8 border-zinc-900 shadow-inner">
                    <div className="w-48 h-48 bg-zinc-100 flex items-center justify-center text-zinc-300 font-black text-center text-xs p-4">
                       [SCAN QR ON PRIVATE DEVICE TO TUNE IN]
                    </div>
                    <p className="text-[9px] font-black text-black uppercase tracking-widest mt-2">Mobile Direct Connect</p>
                </div>
            )}
          </div>
        </div>

        <div className="bg-[#0a0a0c] p-10 rounded-[3rem] border border-zinc-900 shadow-2xl flex flex-col justify-center">
            <div className="text-center space-y-8">
                <div className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.5em] italic">Network Health</div>
                <div className="text-8xl font-black italic tracking-tighter text-zinc-900 select-none">NODE</div>
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest leading-loose max-w-sm mx-auto">
                    Signal is end-to-end encrypted. Port 19302 (STUN) open for private peer-to-peer device linking.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StreamerView;
