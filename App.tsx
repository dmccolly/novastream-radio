
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import Sidebar from './components/Sidebar';
import ClockPanel from './components/ClockPanel';
import Visualizer from './components/Visualizer';
import LibraryView from './components/LibraryView';
import { EditProvider } from './contexts/EditContext';
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
  getFullConfig,
  initializeFromServer
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
          
          // Initialize from Dropbox first
          await initializeFromServer();
          
          const config = getFullConfig();
          let currentTracks = await getTracks();
          const hasCustomVault = config.clientId && config.clientId !== "80tozg97nbba9bs";
          if (currentTracks.length === 0 && !hasCustomVault) { 
              await injectDemoTracks(); 
              currentTracks = await getTracks(); 
          }
          setTracks(currentTracks);
          setIsInitializing(false);
          
          // Listen for token updates and reload tracks
          window.addEventListener('reload-tracks-from-dropbox', async () => {
            addLog('>> VAULT: RELOADING_FROM_DROPBOX...');
            await initializeFromServer();
            const reloadedTracks = await getTracks();
            setTracks(reloadedTracks);
            addLog(`>> VAULT: LOADED ${reloadedTracks.length} TRACKS`);
          });

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
    <EditProvider>
      <div className="flex h-screen bg-[#020203] text-zinc-100 overflow-hidden select-none antialiased font-sans">
      {/* Mobile menu button */}
      <button 
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-zinc-900 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition-colors"
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar - responsive */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-40
        transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 transition-transform duration-300
      `}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsMobileMenuOpen(false);
          }} 
          canInstall={!!deferredPrompt} 
          onInstall={handleInstall} 
        />
      </div>
      
      <main className="flex-1 overflow-hidden relative">
        <div className="overflow-y-auto custom-scrollbar p-4 sm:p-8 lg:p-12">
          <div className="max-w-7xl mx-auto space-y-6 sm:space-y-12 pb-24 pt-16 lg:pt-0">
            {activeTab === 'studio' && (
              <div className="flex flex-col lg:flex-row justify-between items-start gap-8">
                 <ClockPanel />
                 <div className="bg-[#0a0a0c] p-4 sm:p-6 px-6 sm:px-10 rounded-2xl sm:rounded-[2.5rem] border border-zinc-900 shadow-2xl flex flex-col items-center">
                      <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-2 italic">Signal Route</div>
                      <div className="text-xs font-black italic tracking-tighter text-blue-500 font-mono uppercase">DIRECT_MODE</div>
                 </div>
              </div>
            )}
            
            {activeTab === 'studio' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
                <div className="xl:col-span-2 space-y-12">
                  <div className="bg-[#0a0a0c] rounded-2xl sm:rounded-[4.5rem] p-6 sm:p-16 border-2 border-zinc-900 shadow-2xl relative overflow-hidden min-h-[300px] sm:min-h-[400px]">
                    {!isAutoPilot && !isReceiver && (
                        <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center gap-10">
                            <h2 className="text-2xl sm:text-4xl font-black italic uppercase tracking-tighter">Signal Standby</h2>
                            <button onClick={wakeAudioEngine} className="px-8 sm:px-20 py-4 sm:py-8 bg-blue-600 text-white rounded-xl sm:rounded-[2rem] font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] shadow-2xl hover:scale-105 transition-all text-xs">Engage Node</button>
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
                          <div className="flex flex-col items-center gap-6 sm:gap-16 relative z-10">
                            <div className="w-48 h-48 sm:w-80 sm:h-80 rounded-2xl sm:rounded-[4rem] overflow-hidden border-4 border-zinc-900 bg-zinc-950 shadow-2xl">
                               <img src={tracks[currentTrackIndex]?.coverUrl} className="w-full h-full object-cover opacity-60" alt="Cover" />
                            </div>
                            <div className="flex-1 w-full text-center">
                              <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black italic uppercase tracking-tighter text-white truncate max-w-full leading-tight">{tracks[currentTrackIndex]?.title}</h1>
                              <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] sm:tracking-[0.5em] text-xs italic mt-2 sm:mt-4">{tracks[currentTrackIndex]?.artist}</p>
                              <AtomicProgressBar audioRef={audioRef} />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full text-zinc-800 text-lg sm:text-2xl font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] italic">Vault Empty</div>
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
    </EditProvider>
  );
};

export default App;
