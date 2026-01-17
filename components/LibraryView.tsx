
import React, { useState, useMemo, useTransition } from 'react';
import { Track } from '../types';
import { Icons } from '../constants';
import { saveTracksBatch, updateTrack, exportVaultIndex } from '../services/stationService';
import { harvestDropbox } from '../services/dropboxService';

interface LibraryViewProps {
  tracks: Track[];
  onRefresh: () => Promise<void>;
}

const CATEGORY_MAP: Record<string, string> = {
  music: 'MUS',
  sweeper: 'SWP',
  jingle: 'JNG',
  promo: 'PRM',
  id: 'ID',
  commercial: 'COM'
};

const LibraryView: React.FC<LibraryViewProps> = ({ tracks, onRefresh }) => {
  const [isPending, startTransition] = useTransition();
  const [localSearch, setLocalSearch] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [cloudIndex, setCloudIndex] = useState<Track[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [syncComplete, setSyncComplete] = useState(false);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg].slice(-30));

  const triggerCloudHarvest = async () => {
    setIsHarvesting(true);
    setLogs([]);
    setSyncComplete(false);
    try {
        const results = await harvestDropbox(msg => addLog(msg));
        if (results && results.length > 0) {
            setCloudIndex(results);
            setSelectedIds(new Set(results.map(t => t.id)));
            setIsInspecting(true);
            addLog(">> VAULT: READY_TO_MOUNT");
        } else {
            addLog("!! VAULT: NO_DATA_RETURNED");
        }
    } catch (e: any) { 
        addLog(`!! CRITICAL: ${e.message}`); 
    } finally { 
        setIsHarvesting(false); 
    }
  };

  const handleApplySync = async () => {
    if (selectedIds.size === 0) return;
    setIsHarvesting(true);
    addLog(">> VAULT: WRITING_TO_PERSISTENCE...");
    try {
        const toAdd = cloudIndex.filter(t => selectedIds.has(t.id));
        await saveTracksBatch(toAdd);
        await onRefresh();
        setIsInspecting(false);
        setSyncComplete(true);
        addLog(">> VAULT: PERSISTENCE_LOCKED");
        setTimeout(() => setSyncComplete(false), 5000);
    } catch (e: any) {
        addLog(`!! VAULT_WRITE_ERR: ${e.message}`);
    } finally {
        setIsHarvesting(false);
    }
  };

  const filteredTracks = useMemo(() => {
    const term = localSearch.toLowerCase().trim();
    const baseList = isInspecting ? cloudIndex : tracks;
    if (!term) return baseList;
    return baseList.filter(t => t.title.toLowerCase().includes(term) || t.artist.toLowerCase().includes(term));
  }, [isInspecting, cloudIndex, tracks, localSearch]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTracks.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredTracks.map(t => t.id)));
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="relative flex flex-col h-full space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-4 bg-[#0d0d0f] p-3 rounded-2xl border border-zinc-900 shadow-xl">
        <div className="relative flex-1">
          <input 
              type="text" 
              placeholder="FILTER LOCAL VAULT..." 
              className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-6 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-600 transition-all" 
              value={localSearch} 
              onChange={(e) => startTransition(() => setLocalSearch(e.target.value))} 
          />
        </div>
        <div className="flex gap-2">
            <button onClick={() => exportVaultIndex()} className="px-6 py-3 bg-zinc-900 text-zinc-500 border border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">Export Index</button>
            <button 
                onClick={triggerCloudHarvest} 
                disabled={isHarvesting} 
                className={`px-6 py-3 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600/20 transition-all ${isHarvesting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isHarvesting ? 'PROBING...' : 'Scan Cloud'}
            </button>
            {isInspecting && (
                <button onClick={handleApplySync} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest animate-pulse">
                    MOUNT {selectedIds.size} ASSETS
                </button>
            )}
            {syncComplete && (
                <div className="px-6 py-3 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center">
                    VAULT PERSISTED
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 bg-[#050507] rounded-[2rem] border border-zinc-900 shadow-inner overflow-hidden flex min-h-[500px] relative">
        {isHarvesting && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-[60] flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
                <div className="w-12 h-12 border-2 border-t-blue-500 border-zinc-900 rounded-full animate-spin mb-6" />
                <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-2xl p-6 text-left font-mono text-[9px] space-y-1 overflow-y-auto max-h-64 shadow-2xl">
                    {logs.map((log, i) => (
                        <div key={i} className={`${log.startsWith('!!') ? 'text-red-500' : 'text-zinc-500'}`}>
                            {log}
                        </div>
                    ))}
                    {logs.length === 0 && <div className="text-zinc-800 animate-pulse">ESTABLISHING_LINK...</div>}
                </div>
            </div>
        )}

        <div className={`flex-1 overflow-y-auto custom-scrollbar ${editingTrack ? 'mr-96' : ''}`}>
            <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 bg-[#020203] z-20 border-b border-zinc-800">
                    <tr>
                        <th className="px-6 py-3 w-12 text-center"><input type="checkbox" onChange={toggleSelectAll} className="w-3 h-3 accent-blue-600" /></th>
                        <th className="px-6 py-3 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">ID / Title</th>
                        <th className="px-6 py-3 w-24 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">Source</th>
                        <th className="px-6 py-3 w-20 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">Type</th>
                        <th className="px-6 py-3 w-20 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600 text-right">Offset</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTracks.map((t) => (
                        <tr 
                            key={t.id} 
                            onClick={() => setEditingTrack(t)} 
                            className={`border-b border-zinc-900/50 hover:bg-blue-600/5 transition-colors cursor-pointer group ${editingTrack?.id === t.id ? 'bg-blue-600/10' : ''}`}
                        >
                            <td className="px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.has(t.id)} 
                                    onChange={() => toggleSelection(t.id)}
                                    className="w-3 h-3 accent-blue-600" 
                                />
                            </td>
                            <td className="px-6 py-3">
                                <span className="text-[10px] font-black uppercase text-zinc-300 block truncate group-hover:text-white">{t.title}</span>
                                <span className="text-[7px] font-bold text-zinc-600 uppercase tracking-widest italic truncate">{t.artist}</span>
                            </td>
                            <td className="px-6 py-3">
                                <span className={`text-[7px] font-black uppercase tracking-widest ${t.source === 'cloud' ? 'text-blue-500' : 'text-zinc-500'}`}>
                                    {t.source === 'cloud' ? '☁ CLOUD' : '📁 LOCAL'}
                                </span>
                            </td>
                            <td className="px-6 py-3">
                                <span className={`text-[7px] font-black px-2 py-0.5 rounded-sm uppercase border ${
                                    t.assetType === 'jingle' ? 'bg-purple-900/20 text-purple-400 border-purple-500/30' :
                                    t.assetType === 'sweeper' ? 'bg-orange-900/20 text-orange-400 border-orange-500/30' :
                                    t.assetType === 'id' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/30' :
                                    t.assetType === 'commercial' ? 'bg-red-900/20 text-red-400 border-red-500/30' :
                                    'bg-blue-900/20 text-blue-400 border-blue-500/30'
                                }`}>{CATEGORY_MAP[t.assetType] || 'MUS'}</span>
                            </td>
                            <td className="px-6 py-3 text-right"><span className="text-[9px] font-mono font-bold text-zinc-600 group-hover:text-blue-500 transition-colors">-{t.segueOffset?.toFixed(1) || '0.0'}s</span></td>
                        </tr>
                    ))}
                    {filteredTracks.length === 0 && (
                        <tr>
                            <td colSpan={5} className="p-20 text-center">
                                <div className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-800 italic">VAULT_EMPTY_OR_UNSCANNED</div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {editingTrack && (
            <div className="absolute top-0 right-0 w-96 h-full bg-[#0d0d0f] border-l border-zinc-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-black/40">
                    <h3 className="text-[9px] font-black uppercase tracking-[0.3em] italic text-blue-500">Asset Inspector</h3>
                    <button onClick={() => setEditingTrack(null)} className="p-2 hover:text-white transition-colors"><Icons.Maximize /></button>
                </div>
                <div className="flex-1 p-8 space-y-10 overflow-y-auto">
                    <div className="space-y-3">
                        <label className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.4em] block">Asset Title</label>
                        <input className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-[11px] font-black uppercase tracking-widest text-zinc-200 outline-none focus:border-blue-600" value={editingTrack.title} onChange={e => setEditingTrack({...editingTrack, title: e.target.value.toUpperCase()})} />
                    </div>
                    <div className="space-y-4">
                        <label className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.4em] block italic">Segue Trim Point</label>
                        <div className="h-48 bg-black rounded-2xl border border-zinc-800 p-6 flex items-center justify-center relative overflow-hidden">
                             <input type="range" min="0" max="30" step="0.1" className="w-full accent-blue-600 cursor-ns-resize rotate-[-90deg] h-2 bg-zinc-900 rounded-lg appearance-none" value={editingTrack.segueOffset} onChange={e => setEditingTrack({...editingTrack, segueOffset: parseFloat(e.target.value)})} />
                             <div className="absolute top-4 right-8 text-right">
                                <span className="text-[8px] font-black text-zinc-800 block uppercase">Fader Level</span>
                                <span className="text-4xl font-mono font-black text-blue-500">-{editingTrack.segueOffset.toFixed(1)}s</span>
                             </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.4em] block">Broadcast Class</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['music', 'jingle', 'promo', 'sweeper', 'id', 'commercial'].map(type => (
                                <button key={type} onClick={() => setEditingTrack({...editingTrack, assetType: type as any})} className={`py-3 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${editingTrack.assetType === type ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-black border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}>{CATEGORY_MAP[type] || type.toUpperCase()}</button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="p-6 bg-black/60 border-t border-zinc-800 backdrop-blur-md">
                    <button onClick={() => { updateTrack(editingTrack).then(() => { onRefresh(); setEditingTrack(null); }); }} className="w-full py-4 bg-white text-black rounded-xl font-black uppercase tracking-[0.4em] text-[9px] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">COMMIT CHANGES</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;
