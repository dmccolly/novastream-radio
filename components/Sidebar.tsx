
import React, { useEffect, useState, memo } from 'react';
import { Icons } from '../constants';
import { getFullConfig } from '../services/stationService';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  canInstall?: boolean;
  onInstall?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, canInstall, onInstall }) => {
  const [isSecure, setIsSecure] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);

  useEffect(() => {
    const config = getFullConfig();
    setIsSecure(!!config.token && !!config.clientId);
  }, []);

  const menuItems = [
    { id: 'studio', label: 'Studio Live', icon: Icons.Radio },
    { id: 'scheduler', label: 'Scheduler', icon: Icons.Calendar },
    { id: 'library', label: 'Track Library', icon: Icons.List },
    { id: 'analytics', label: 'Private Relay', icon: Icons.Activity },
    { id: 'settings', label: 'Settings', icon: Icons.Settings },
  ];

  return (
    <aside className="w-64 bg-[#0d0d0f] border-r border-zinc-800 flex flex-col h-screen shrink-0 relative z-50">
      <div className="p-8">
        <div className="flex items-center gap-3 text-blue-500 font-black text-xl tracking-tighter italic uppercase">
          <div className="p-2 bg-blue-600/10 rounded-xl shadow-lg border border-blue-500/20">
            <Icons.Radio />
          </div>
          NovaStream
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-inner' 
                  : 'text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800/20'
              }`}
            >
              <span className={`${isActive ? 'text-blue-400' : 'text-zinc-700 group-hover:text-zinc-400'}`}><Icon /></span>
              <span className="font-black text-[10px] uppercase tracking-widest">{item.label}</span>
            </button>
          );
        })}

        <div className="mt-8 pt-8 border-t border-zinc-900 px-2 space-y-3">
            {canInstall ? (
              <button
                onClick={onInstall}
                className="w-full py-5 rounded-xl bg-blue-600 text-white shadow-2xl hover:bg-blue-500 transition-all animate-bounce"
              >
                <span className="font-black text-[10px] uppercase tracking-widest italic">Install Station</span>
              </button>
            ) : (
                <button 
                  onClick={() => setShowManualGuide(!showManualGuide)}
                  className="w-full p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl flex flex-col items-center gap-1 hover:border-blue-500/50 transition-all"
                >
                    <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest text-center italic">Standalone Mode</span>
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest italic">Manual Setup</span>
                </button>
            )}
        </div>
      </nav>

      {showManualGuide && (
          <div className="absolute bottom-24 left-4 right-4 bg-zinc-900 border border-blue-500/40 p-6 rounded-2xl shadow-2xl z-50 animate-in slide-in-from-bottom-4">
              <h4 className="text-[10px] font-black uppercase text-blue-500 italic mb-2">Direct Mode Guide</h4>
              <p className="text-[8px] font-bold text-zinc-400 leading-relaxed mb-4">
                Standalone mode requires hosting (GitHub/Netlify). <br/><br/>
                Once hosted, in Chrome:<br/>
                1. Click (⋮) Menu <br/>
                2. "Save and Share" <br/>
                3. "Install App"
              </p>
              <button onClick={() => setShowManualGuide(false)} className="w-full py-2 bg-zinc-800 rounded-lg text-[9px] font-black uppercase text-zinc-300">Close</button>
          </div>
      )}

      <div className="p-4 m-4 bg-zinc-950 rounded-2xl border border-zinc-900 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${isSecure ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-blue-600 text-white animate-pulse'}`}>
            {isSecure ? '✓' : '!'}
          </div>
          <div>
            <div className="text-[9px] font-black text-zinc-300 uppercase tracking-tighter italic">Engine Node</div>
            <div className={`text-[7px] font-black uppercase tracking-[0.2em] ${isSecure ? 'text-emerald-500' : 'text-blue-500'}`}>
               {isSecure ? 'SYNCED' : 'UNCONFIGURED'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default memo(Sidebar);
