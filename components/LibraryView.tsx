
import React, { useState, useMemo, useTransition, useCallback, memo } from 'react';
import { Track } from '../types';
import { Icons } from '../constants';
import { saveTracksBatch, updateTrack, exportVaultIndex, importVaultIndex } from '../services/stationService';
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

// Memoized track row component to prevent unnecessary re-renders
const TrackRow = memo(({ 
  track, 
  isSelected, 
  isEditing, 
  onToggle, 
  onClick 
}: { 
  track: Track; 
  isSelected: boolean; 
  isEditing: boolean; 
  onToggle: (id: string) => void; 
  onClick: (track: Track) => void;
}) => (
  <tr 
    onClick={() => onClick(track)} 
    className={`border-b border-zinc-900/50 hover:bg-blue-600/5 transition-colors cursor-pointer group ${isEditing ? 'bg-blue-600/10' : ''}`}
  >
    <td className="px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
      <input 
        type="checkbox" 
        checked={isSelected} 
        onChange={() => onToggle(track.id)}
        className="w-3 h-3 accent-blue-600" 
      />
    </td>
    <td className="px-6 py-3">
      <span className="text-[10px] font-black uppercase text-zinc-300 block truncate group-hover:text-white">{track.title}</span>
      <span className="text-[7px] font-bold text-zinc-600 uppercase tracking-widest italic truncate">{track.artist}</span>
    </td>
    <td className="px-6 py-3">
      <span className={`text-[7px] font-black uppercase tracking-widest ${track.source === 'cloud' ? 'text-blue-500' : 'text-zinc-500'}`}>
        {track.source === 'cloud' ? '☁️ CLOUD' : '📁 LOCAL'}
      </span>
    </td>
    <td className="px-6 py-3">
      <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">{CATEGORY_MAP[track.assetType] || 'UNK'}</span>
    </td>
    <td className="px-6 py-3 text-right">
      <span className="text-[7px] font-mono text-zinc-600">{track.segueOffset ? `${track.segueOffset > 0 ? '+' : ''}${track.segueOffset.toFixed(1)}s` : '-0.0s'}</span>
    </td>
  </tr>
));

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

  const addLog = useCallback((msg: string) => setLogs(prev => [...prev, msg].slice(-30)), []);

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

  const handleImportJSON = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsHarvesting(true);
      setLogs([]);
      addLog(">> IMPORT: READING_JSON...");
      try {
        await importVaultIndex(file);
        await onRefresh();
        addLog(">> IMPORT: SUCCESS");
        setSyncComplete(true);
        setTimeout(() => setSyncComplete(false), 3000);
      } catch (e: any) {
        addLog(`!! IMPORT_ERROR: ${e.message}`);
      } finally {
        setIsHarvesting(false);
      }
    };
    input.click();
  };

  const filteredTracks = useMemo(() => {
    const term = localSearch.toLowerCase().trim();
    const baseList = isInspecting ? cloudIndex : tracks;
    if (!term) return baseList;
    return baseList.filter(t => t.title.toLowerCase().includes(term) || t.artist.toLowerCase().includes(term));
  }, [isInspecting, cloudIndex, tracks, localSearch]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredTracks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTracks.map(t => t.id)));
    }
  }, [selectedIds.size, filteredTracks]);

  const handleSaveEdit = async () => {
    if (!editingTrack) return;
    try {
      await updateTrack(editingTrack);
      await onRefresh();
      setEditingTrack(null);
    } catch (e: any) {
      alert(`Failed to update track: ${e.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center gap-6">
        <div className="flex-1">
          <input 
              type="text" 
              placeholder="FILTER LOCAL VAULT..." 
              className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-6 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-600 transition-all" 
              value={localSearch} 
              onChange={(e) => startTransition(() => setLocalSearch(e.target.value))} 
          />
        </div>
        <div className="flex gap-2">
            <button onClick={handleImportJSON} className="px-6 py-3 bg-zinc-900 text-zinc-500 border border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">Import Index</button>
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

        <div className={`flex-1 overflow-y-auto custom-scrollbar ${editingTrack ? 'mr-96' : ''}`} style={{willChange: 'scroll-position'}}>
            <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 bg-[#020203] z-20 border-b border-zinc-800">
                    <tr>
                        <th className="px-6 py-3 w-12 text-center"><input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === filteredTracks.length && filteredTracks.length > 0} className="w-3 h-3 accent-blue-600" /></th>
                        <th className="px-6 py-3 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">ID / Title</th>
                        <th className="px-6 py-3 w-24 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">Source</th>
                        <th className="px-6 py-3 w-20 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">Type</th>
                        <th className="px-6 py-3 w-20 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600 text-right">Offset</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredTracks.map((t) => (
                        <TrackRow 
                          key={t.id}
                          track={t}
                          isSelected={selectedIds.has(t.id)}
                          isEditing={editingTrack?.id === t.id}
                          onToggle={toggleSelection}
                          onClick={setEditingTrack}
                        />
                    ))}
                </tbody>
            </table>
        </div>

        {editingTrack && (
            <div className="w-96 bg-[#0a0a0c] border-l border-zinc-900 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">EDIT ASSET</h2>
                    <button onClick={() => setEditingTrack(null)} className="text-zinc-600 hover:text-white transition-colors">
                        <Icons.X />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    <div>
                        <label className="text-[7px] font-black uppercase tracking-[0.3em] text-zinc-600 block mb-2">Title</label>
                        <input 
                            type="text" 
                            value={editingTrack.title} 
                            onChange={(e) => setEditingTrack({...editingTrack, title: e.target.value})}
                            className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-bold uppercase text-zinc-300 outline-none focus:border-blue-600 transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-[7px] font-black uppercase tracking-[0.3em] text-zinc-600 block mb-2">Artist</label>
                        <input 
                            type="text" 
                            value={editingTrack.artist} 
                            onChange={(e) => setEditingTrack({...editingTrack, artist: e.target.value})}
                            className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-bold uppercase text-zinc-300 outline-none focus:border-blue-600 transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-[7px] font-black uppercase tracking-[0.3em] text-zinc-600 block mb-2">Type</label>
                        <select 
                            value={editingTrack.assetType} 
                            onChange={(e) => setEditingTrack({...editingTrack, assetType: e.target.value as any})}
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
                            value={editingTrack.segueOffset || 0} 
                            onChange={(e) => setEditingTrack({...editingTrack, segueOffset: parseFloat(e.target.value) || 0})}
                            className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-mono text-zinc-300 outline-none focus:border-blue-600 transition-all"
                        />
                    </div>
                </div>
                <div className="p-6 border-t border-zinc-900 flex gap-3">
                    <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all">
                        SAVE
                    </button>
                    <button onClick={() => setEditingTrack(null)} className="flex-1 bg-zinc-900 text-zinc-500 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all">
                        CANCEL
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default LibraryView;
