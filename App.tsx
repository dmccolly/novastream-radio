
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Sidebar from './components/Sidebar';
import ClockPanel from './components/ClockPanel';
import Visualizer from './components/Visualizer';
import LibraryView from './components/LibraryView';
import SchedulerView from './components/SchedulerView';
import SettingsView from './components/SettingsView';
import StreamerView from './components/StreamerView';
import MasterControl from './components/MasterControl';
import { Icons } from './constants';
import { 
  getTracks, 
  getAudioUrl, 
  initP2P, 
  requestPersistence,
  injectDemoTracks,
  setMasterStream,
  connectToNode,
  getFullConfig
} from './services/stationService';
import { getStreamUrl } from './services/dropboxService';
import { Track } from './types';

// Atomic Progress Component - zero re-renders
const AtomicProgressBar = memo(({ audioRef }: { audioRef: React.RefObject<HTMLAudioElement | null> }) => {
    const barRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let frame: number;
        const update = () => {
            const el = audioRef.current;
            if (el && barRef.current && el.duration) {
                const p = (el.currentTime / el.duration) * 100;
                barRef.current.style.width = `${p}%`;
            }
            frame = requestAnimationFrame(update);
        };
        frame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(frame);
    }, [audioRef]);

    return (
        <div className="h-4 w-full bg-zinc-950 rounded-full border-2 border-zinc-900 overflow-hidden p-1 shadow-inner mt-6">
            <div ref={barRef} className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: '0%' }} />
        </div>
    );
});

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('studio');
  const [stationId, setStationId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  const [isReceiver, setIsReceiver] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const remoteStreamRef = useRef<HTMLAudioElement | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const lastSegueFired = useRef<string | null>(null);
  const logEmitter = useRef<((msg: string) => void) | null>(null);

  const addLog = useCallback((msg: string) => {
    if (logEmitter.current) logEmitter.current(msg);
  }, []);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      addLog(">> SYSTEM: STANDALONE_READY");
    });
  }, [addLog]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const refreshLibrary = useCallback(async () => {
    const results = await getTracks();
    setTracks(results);
    addLog(`>> VAULT: INDEX_SYNC [${results.length} NODES]`);
  }, [addLog]);

  const playTrack = useCallback(async (index: number) => {
    if (tracks.length === 0 || !audioRef.current || isReceiver) return;
    const safeIndex = index % tracks.length;
    const track = tracks[safeIndex];
    if (!track) return;

    addLog(`>> ON-AIR: "${track.title}"`);
    setCurrentTrackIndex(safeIndex);
    lastSegueFired.current = null;
    
    const {url, source} = await getAudioUrl(track.id);
    let finalUrl = url;
    
    if (source === 'cloud') {
        try { 
            finalUrl = await getStreamUrl(url); 
        } catch (e) { 
            addLog("!! LINK_ERR: RETRYING...");
            setTimeout(() => playTrack(index), 3000);
            return; 
        }
    }
    
    if (finalUrl && audioRef.current) {
      audioRef.current.src = finalUrl;
      audioRef.current.load();
      try { await audioRef.current.play(); } catch (e) { 
          addLog("!! ENGINE: USER_ACTION_REQD");
          setIsAutoPilot(false); 
      }
    }
  }, [tracks, addLog, isReceiver]);

  const wakeAudioEngine = async () => {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
        const gain = audioContextRef.current.createGain();
        if (audioRef.current) {
            const src = audioContextRef.current.createMediaElementSource(audioRef.current);
            analyserRef.current = audioContextRef.current.createAnalyser();
            const dest = audioContextRef.current.createMediaStreamDestination();
            src.connect(gain);
            gain.connect(analyserRef.current);
            gain.connect(dest);
            analyserRef.current.connect(audioContextRef.current.destination);
            setMasterStream(dest.stream);
            addLog(">> ENGINE: SIGNAL_LOCKED");
        }
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
    
    if (isReceiver) {
        if (remoteStreamRef.current) remoteStreamRef.current.play().catch(() => {});
    } else {
        setIsAutoPilot(true);
        playTrack(currentTrackIndex);
    }
  };

  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const checkSegue = () => {
      if (!audio.duration || !isAutoPilot || isReceiver) return;
      const currentTrack = tracks[currentTrackIndex];
      const seguePoint = currentTrack?.segueOffset || 0;
      const timeRemaining = audio.duration - audio.currentTime;

      if (timeRemaining <= seguePoint && lastSegueFired.current !== currentTrack?.id) {
        lastSegueFired.current = currentTrack?.id || 'id';
        setCurrentTrackIndex(p => (p + 1) % (tracks.length || 1));
      }
    };

    audio.addEventListener('timeupdate', checkSegue);
    audio.onended = () => {
      if (isAutoPilot && !isReceiver && lastSegueFired.current === null) {
          setCurrentTrackIndex(p => (p + 1) % (tracks.length || 1));
      }
    };
    return () => {
        audio.removeEventListener('timeupdate', checkSegue);
        audio.pause();
    };
  }, [tracks, isAutoPilot, isReceiver, currentTrackIndex]);

  useEffect(() => {
    if (isAutoPilot && !isReceiver) playTrack(currentTrackIndex);
  }, [currentTrackIndex]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
          }
          requestPersistence();
          const config = getFullConfig();
          let currentTracks = await getTracks();
          const hasCustomVault = config.clientId && config.clientId !== "80tozg97nbba9bs";
          if (currentTracks.length === 0 && !hasCustomVault) { 
              await injectDemoTracks(); 
              currentTracks = await getTracks(); 
          }
          setTracks(currentTracks);
          setIsInitializing(false);

          initP2P(
            (id) => { setStationId(id); addLog(`>> P2P: NODE_${id}`); }, 
            (err) => { addLog(`!! P2P: ${err}`); },
            () => {}, 
            (stream) => {
              if (remoteStreamRef.current) {
                  remoteStreamRef.current.srcObject = stream;
                  if (audioContextRef.current) {
                      const rSrc = audioContextRef.current.createMediaStreamSource(stream);
                      remoteAnalyserRef.current = audioContextRef.current.createAnalyser();
                      rSrc.connect(remoteAnalyserRef.current);
                  }
              }
          });
      } catch (err) { setIsInitializing(false); }
    };
    bootstrap();
  }, []);

  if (isInitializing) {
    return (
      <div className="h-screen w-screen bg-[#020203] flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-4 border-t-blue-500 border-zinc-900 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020203] text-zinc-100 overflow-hidden select-none antialiased font-sans">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        canInstall={!!deferredPrompt} 
        onInstall={handleInstall} 
      />
      <main className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-y-auto custom-scrollbar p-12">
          <div className="max-w-7xl mx-auto space-y-12 pb-24">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
               <ClockPanel />
               <div className="bg-[#0a0a0c] p-6 px-10 rounded-[2.5rem] border border-zinc-900 shadow-2xl flex flex-col items-center">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-2 italic">Signal Route</div>
                    <div className="text-xs font-black italic tracking-tighter text-blue-500 font-mono uppercase">DIRECT_MODE</div>
               </div>
            </div>
            
            {activeTab === 'studio' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
                <div className="xl:col-span-2 space-y-12">
                  <div className="bg-[#0a0a0c] rounded-[4.5rem] p-16 border-2 border-zinc-900 shadow-2xl relative overflow-hidden min-h-[400px]">
                    {!isAutoPilot && !isReceiver && (
                        <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center gap-10">
                            <h2 className="text-4xl font-black italic uppercase tracking-tighter">Signal Standby</h2>
                            <button onClick={wakeAudioEngine} className="px-20 py-8 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-[0.5em] shadow-2xl hover:scale-105 transition-all text-xs">Engage Node</button>
                        </div>
                    )}
                    
                    {isReceiver ? (
                        <div className="flex flex-col items-center justify-center h-full gap-8">
                             <div className="w-64 h-64 rounded-full border-8 border-zinc-950 bg-black flex flex-col items-center justify-center shadow-2xl">
                                 <div className="text-blue-500 animate-pulse scale-150 mb-6"><Icons.Activity /></div>
                                 <div className="text-[12px] font-black uppercase tracking-widest text-zinc-500 italic">Receiving...</div>
                             </div>
                        </div>
                    ) : (
                        tracks.length > 0 ? (
                          <div className="flex flex-col md:flex-row items-center gap-16 relative z-10">
                            <div className="w-80 h-80 rounded-[4rem] overflow-hidden border-4 border-zinc-900 bg-zinc-950 shadow-2xl">
                               <img src={tracks[currentTrackIndex]?.coverUrl} className="w-full h-full object-cover opacity-60" alt="Cover" />
                            </div>
                            <div className="flex-1 w-full">
                              <h1 className="text-6xl font-black italic uppercase tracking-tighter text-white truncate max-w-lg leading-tight">{tracks[currentTrackIndex]?.title}</h1>
                              <p className="text-zinc-500 font-bold uppercase tracking-[0.5em] text-xs italic mt-4">{tracks[currentTrackIndex]?.artist}</p>
                              <AtomicProgressBar audioRef={audioRef} />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-800 text-2xl font-black uppercase tracking-[0.5em] italic">Vault Empty</div>
                        )
                    )}
                  </div>
                  <Visualizer analyser={isReceiver ? remoteAnalyserRef.current : analyserRef.current} mode="bars" />
                </div>
                <MasterControl 
                    isAutoPilot={isAutoPilot} 
                    onAutoPilotToggle={setIsAutoPilot} 
                    onSystemTest={() => addLog("🔍 DIAG: SIGNAL_OK")}
                    onInjectDemo={() => {}} 
                    onProveIt={wakeAudioEngine}
                    setLogEmitter={(fn) => { logEmitter.current = fn; }}
                />
              </div>
            )}
            
            {activeTab === 'library' && <LibraryView tracks={tracks} onRefresh={refreshLibrary} />}
            {activeTab === 'settings' && <SettingsView onRefresh={refreshLibrary} />}
            {activeTab === 'scheduler' && <SchedulerView />}
            {activeTab === 'analytics' && <StreamerView isBroadcasting={isAutoPilot} setIsBroadcasting={setIsAutoPilot} isReceiver={isReceiver} onReceiverToggle={setIsReceiver} stationId={stationId} />}
          </div>
        </div>
      </main>
      <audio ref={remoteStreamRef} style={{ display: 'none' }} crossOrigin="anonymous" playsInline />
    </div>
  );
};

export default App;
