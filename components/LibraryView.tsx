
import React, { useState, useMemo, useCallback, memo, useRef, useEffect } from 'react';
import { Track } from '../types';
import { Icons } from '../constants';
import { saveTracksBatch, updateTrack, exportVaultIndex, importVaultIndex, saveTracksBatchAndSync, updateTrackAndSync, initializeFromDropbox, triggerSync, syncNow } from '../services/stationService';
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

const ROW_HEIGHT = 60;

// Highly optimized track row with no unnecessary re-renders
const TrackRow = memo(({ 
  track, 
  isSelected, 
  isEditing, 
  onToggle, 
  onClick,
  style
}: { 
  track: Track; 
  isSelected: boolean; 
  isEditing: boolean; 
  onToggle: (id: string) => void; 
  onClick: (track: Track) => void;
  style: React.CSSProperties;
}) => (
  <div 
    style={style}
    onClick={() => onClick(track)} 
    className={`flex items-center border-b border-zinc-900/50 hover:bg-blue-600/5 transition-colors cursor-pointer group ${isEditing ? 'bg-blue-600/10' : ''}`}
  >
    <div className="px-6 w-12 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <input 
        type="checkbox" 
        checked={isSelected} 
        onChange={() => onToggle(track.id)}
        className="w-3 h-3 accent-blue-600" 
      />
    </div>
    <div className="flex-1 px-6 min-w-0">
      <div className="text-[10px] font-black uppercase text-zinc-300 truncate group-hover:text-white">{track.title}</div>
      <div className="text-[7px] font-bold text-zinc-600 uppercase tracking-widest italic truncate">{track.artist}</div>
    </div>
    <div className="px-6 w-24">
      <span className={`text-[7px] font-black uppercase tracking-widest ${track.source === 'cloud' ? 'text-blue-500' : 'text-zinc-500'}`}>
        {track.source === 'cloud' ? '☁️ CLOUD' : '📁 LOCAL'}
      </span>
    </div>
    <div className="px-6 w-20">
      <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">{CATEGORY_MAP[track.assetType] || 'UNK'}</span>
    </div>
    <div className="px-6 w-20 text-right">
      <span className="text-[7px] font-mono text-zinc-600">{track.segueOffset ? `${track.segueOffset > 0 ? '+' : ''}${track.segueOffset.toFixed(1)}s` : '-0.0s'}</span>
    </div>
  </div>
), (prevProps, nextProps) => {
  return prevProps.track.id === nextProps.track.id &&
         prevProps.isSelected === nextProps.isSelected &&
         prevProps.isEditing === nextProps.isEditing;
});

const LibraryView: React.FC<LibraryViewProps> = ({ tracks, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [cloudIndex, setCloudIndex] = useState<Track[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [syncComplete, setSyncComplete] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const addLog = useCallback((msg: string) => setLogs(prev => [...prev, msg].slice(-30)), []);

  // No debounce - instant search

  // Show warning if no tracks
  useEffect(() => {
    if (tracks.length === 0 && !isInspecting) {
      addLog("⚠️ NO TRACKS FOUND - Click 'Scan Cloud' to load your library");
    }
  }, [tracks.length, isInspecting]);

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
        await saveTracksBatchAndSync(toAdd);
        await onRefresh();
        setIsInspecting(false);
        setSyncComplete(true);
        setLastSyncTime(Date.now());
        addLog(">> VAULT: PERSISTENCE_LOCKED");
        addLog("✓ SYNCED TO DROPBOX");
        setTimeout(() => setSyncComplete(false), 5000);
    } catch (e: any) {
        addLog(`!! VAULT_WRITE_ERR: ${e.message}`);
    } finally {
        setIsHarvesting(false);
    }
  };

  const handleManualSync = async () => {
    if (tracks.length === 0) {
      alert("No tracks to sync. Please scan your library first.");
      return;
    }
    setIsSyncing(true);
    try {
      await syncNow();
      setLastSyncTime(Date.now());
      setSyncComplete(true);
      setTimeout(() => setSyncComplete(false), 3000);
    } catch (e: any) {
      alert(`Sync failed: ${e.message}`);
    } finally {
      setIsSyncing(false);
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
        addLog(">> SYNCING TO DROPBOX...");
        await syncNow();
        setLastSyncTime(Date.now());
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
    const term = searchQuery.toLowerCase().trim();
    const baseList = isInspecting ? cloudIndex : tracks;
    if (!term) return baseList;
    return baseList.filter(t => {
      const searchableText = [
        t.title,
        t.artist,
        t.album || '',
        t.assetType,
        t.source,
        t.id,
        CATEGORY_MAP[t.assetType] || ''
      ].join(' ').toLowerCase();
      return searchableText.includes(term);
    });
  }, [isInspecting, cloudIndex, tracks, searchQuery]);

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
      await updateTrackAndSync(editingTrack);
      await onRefresh();
      setEditingTrack(null);
      setLastSyncTime(Date.now());
    } catch (e: any) {
      alert(`Failed to update track: ${e.message}`);
    }
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate visible range
  const containerHeight = scrollContainerRef.current?.clientHeight || 600;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
  const endIndex = Math.min(filteredTracks.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + 5);
  const visibleTracks = filteredTracks.slice(startIndex, endIndex);
  const totalHeight = filteredTracks.length * ROW_HEIGHT;
  const offsetY = startIndex * ROW_HEIGHT;

  const formatSyncTime = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const ago = Math.floor((Date.now() - timestamp) / 1000);
    if (ago < 60) return `${ago}s ago`;
    if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
    return `${Math.floor(ago / 3600)}h ago`;
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Sync Status Banner */}
      {tracks.length === 0 ? (
        <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-red-400 text-2xl">⚠️</div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-red-400">NO TRACKS IN LIBRARY</div>
              <div className="text-[8px] text-red-500/70 mt-1">Your library is empty. Scan Dropbox or import a backup to restore your tracks.</div>
            </div>
          </div>
          <button onClick={triggerCloudHarvest} className="px-6 py-2 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500 transition-all">
            Scan Now
          </button>
        </div>
      ) : (
        <div className="bg-emerald-600/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-emerald-400 text-2xl">✓</div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">{tracks.length} TRACKS LOADED</div>
              <div className="text-[8px] text-emerald-500/70 mt-1">Last synced: {formatSyncTime(lastSyncTime)}</div>
            </div>
          </div>
          <button 
            onClick={handleManualSync} 
            disabled={isSyncing}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all disabled:opacity-50"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      <div className="flex justify-between items-center gap-6">
        <div className="flex-1">
          <input 
              type="text" 
              placeholder="FILTER LOCAL VAULT..." 
              className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-6 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-600 transition-all" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
          />
        </div>
        <div className="flex gap-2">
            <button onClick={handleImportJSON} disabled={isHarvesting} className="px-6 py-3 bg-zinc-900 text-zinc-500 border border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-widest hover:text-white transition-all disabled:opacity-50">Import Index</button>
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
                    ✓ SYNCED
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 bg-[#050507] rounded-[2rem] border border-zinc-900 shadow-inner overflow-hidden flex min-h-[500px] relative">
        {isHarvesting && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl z-[60] flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 border-2 border-t-blue-500 border-zinc-900 rounded-full animate-spin mb-6" />
                <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-2xl p-6 text-left font-mono text-[9px] space-y-1 overflow-y-auto max-h-64 shadow-2xl">
                    {logs.map((log, i) => (
                        <div key={i} className={`${log.startsWith('!!') ? 'text-red-500' : log.startsWith('✓') ? 'text-emerald-500' : 'text-zinc-500'}`}>
                            {log}
                        </div>
                    ))}
                    {logs.length === 0 && <div className="text-zinc-800 animate-pulse">ESTABLISHING_LINK...</div>}
                </div>
            </div>
        )}

        <div 
          ref={scrollContainerRef}
          className={`flex-1 overflow-y-auto overflow-x-hidden ${editingTrack ? 'mr-96' : ''}`}
          onScroll={handleScroll}
          style={{
            scrollBehavior: 'auto',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {/* Header */}
          <div className="sticky top-0 bg-[#020203] z-20 border-b border-zinc-800 flex items-center" style={{height: ROW_HEIGHT}}>
            <div className="px-6 w-12 flex items-center justify-center">
              <input type="checkbox" onChange={toggleSelectAll} checked={selectedIds.size === filteredTracks.length && filteredTracks.length > 0} className="w-3 h-3 accent-blue-600" />
            </div>
            <div className="flex-1 px-6 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">ID / Title</div>
            <div className="px-6 w-24 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">Source</div>
            <div className="px-6 w-20 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">Type</div>
            <div className="px-6 w-20 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600 text-right">Offset</div>
          </div>

          {/* Virtual scrolling container */}
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ transform: `translateY(${offsetY}px)` }}>
              {visibleTracks.map((track, idx) => (
                <TrackRow 
                  key={track.id}
                  track={track}
                  isSelected={selectedIds.has(track.id)}
                  isEditing={editingTrack?.id === track.id}
                  onToggle={toggleSelection}
                  onClick={setEditingTrack}
                  style={{ height: ROW_HEIGHT }}
                />
              ))}
            </div>
          </div>
        </div>

        {editingTrack && (
            <div className="w-96 bg-[#0a0a0c] border-l border-zinc-900 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">EDIT ASSET</h2>
                    <button onClick={() => setEditingTrack(null)} className="text-zinc-600 hover:text-white transition-colors">
                        <Icons.X />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
