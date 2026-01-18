import React, { memo } from 'react';
import { Track } from '../types';
import { Icons } from '../constants';

interface EditPanelProps {
  track: Track;
  onSave: (track: Track) => void;
  onClose: () => void;
  onChange: (track: Track) => void;
}

const EditPanel = memo(({ track, onSave, onClose, onChange }: EditPanelProps) => {
  return (
    <div className="w-96 bg-[#0a0a0c] border-l border-zinc-900 flex flex-col overflow-hidden">
      <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">EDIT ASSET</h2>
        <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors">
          <Icons.X />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div>
          <label className="text-[7px] font-black uppercase tracking-[0.3em] text-zinc-600 block mb-2">Title</label>
          <input 
            type="text" 
            value={track.title} 
            onChange={(e) => onChange({...track, title: e.target.value})}
            className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-bold uppercase text-zinc-300 outline-none focus:border-blue-600 transition-all"
          />
        </div>
        <div>
          <label className="text-[7px] font-black uppercase tracking-[0.3em] text-zinc-600 block mb-2">Artist</label>
          <input 
            type="text" 
            value={track.artist} 
            onChange={(e) => onChange({...track, artist: e.target.value})}
            className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-bold uppercase text-zinc-300 outline-none focus:border-blue-600 transition-all"
          />
        </div>
        <div>
          <label className="text-[7px] font-black uppercase tracking-[0.3em] text-zinc-600 block mb-2">Type</label>
          <select 
            value={track.assetType} 
            onChange={(e) => onChange({...track, assetType: e.target.value as any})}
            className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-bold uppercase text-zinc-300 outline-none focus:border-blue-600 transition-all"
          >
            <option value="music">Music</option>
            <option value="sweeper">Sweeper</option>
            <option value="jingle">Jingle</option>
            <option value="promo">Promo</option>
            <option value="id">Station ID</option>
            <option value="commercial">Commercial</option>
          </select>
        </div>
        <div>
          <label className="text-[7px] font-black uppercase tracking-[0.3em] text-zinc-600 block mb-2">Segue Offset (s)</label>
          <input 
            type="number" 
            step="0.1"
            value={track.segueOffset || 0} 
            onChange={(e) => onChange({...track, segueOffset: parseFloat(e.target.value) || 0})}
            className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-mono text-zinc-300 outline-none focus:border-blue-600 transition-all"
          />
        </div>
      </div>
      <div className="p-6 border-t border-zinc-900 flex gap-3">
        <button onClick={() => onSave(track)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all">
          SAVE
        </button>
        <button onClick={onClose} className="flex-1 bg-zinc-900 text-zinc-500 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">
          CANCEL
        </button>
      </div>
    </div>
  );
});

EditPanel.displayName = 'EditPanel';

export default EditPanel;
