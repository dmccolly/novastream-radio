
import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../constants';
import { validateToken, normalizePath } from '../services/dropboxService';
import { saveFullConfig, getFullConfig, clearConfig, exportVaultIndex } from '../services/stationService';
import { pushToGitHub, GitHubFile } from '../services/githubService';
import { downloadProjectZip } from '../services/zipService';

interface SettingsViewProps {
    onRefresh: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onRefresh }) => {
  const [config, setConfig] = useState(getFullConfig());
  const [token, setToken] = useState(config.token || "");
  const [root, setRoot] = useState(config.root || "/");
  const [clientId, setClientId] = useState(config.clientId || "");
  const [clientSecret, setClientSecret] = useState(config.clientSecret || "");
  
  const [ghToken, setGhToken] = useState("");
  const [ghUser, setGhUser] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);

  const [status, setStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');

  useEffect(() => {
    const current = getFullConfig();
    setToken(current.token);
    setClientId(current.clientId);
    setClientSecret(current.clientSecret);
    setRoot(current.root);
    setConfig(current);
  }, []);

  const addDeployLog = (msg: string) => setDeployLogs(prev => [...prev, msg].slice(-25));

  const handleDownloadZip = async () => {
    setIsDeploying(true);
    setDeployLogs([]);
    try {
        await downloadProjectZip(addDeployLog);
    } catch (e: any) {
        addDeployLog(`!! ZIP_ERROR: ${e.message}`);
    } finally {
        setIsDeploying(false);
    }
  };

  const handleGitHubPush = async () => {
    if (!ghToken || !ghUser || !ghRepo) {
      alert("GitHub credentials required.");
      return;
    }
    setIsDeploying(true);
    setDeployLogs([]);
    try {
      addDeployLog(">> DEPLOY: GATHERING_SOURCE_FOR_GITHUB...");
      
      const filePaths = [
        'index.html', 'index.tsx', 'App.tsx', 'types.ts', 'constants.tsx', 'manifest.json', 'metadata.json', 'sw.js', 'README.md', 'package.json', 'netlify.toml',
        'services/stationService.ts', 'services/dropboxService.ts', 'services/githubService.ts', 'services/geminiService.ts', 'services/zipService.ts',
        'components/Sidebar.tsx', 'components/ClockPanel.tsx', 'components/Visualizer.tsx', 'components/LibraryView.tsx', 'components/SchedulerView.tsx', 'components/StreamerView.tsx', 'components/MasterControl.tsx', 'components/SettingsView.tsx'
      ];

      const files: GitHubFile[] = [];
      for (const path of filePaths) {
        try {
          const res = await fetch(`./${path}`);
          if (res.ok) {
            const content = await res.text();
            files.push({ path, content });
          }
        } catch (e) {
          console.warn(`Could not include ${path}`);
        }
      }

      await pushToGitHub(ghToken.trim(), ghUser.trim(), ghRepo.trim(), files, addDeployLog);
      addDeployLog(">> SUCCESS: GITHUB_PUSH_COMPLETE");
    } catch (e: any) {
      addDeployLog(`!! DEPLOY_FAILED: ${e.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleSave = async () => {
    const cleanToken = token.trim();
    const cleanId = clientId.trim();
    const cleanSecret = clientSecret.trim();
    
    if (!cleanToken || !cleanId || !cleanSecret) {
        setStatus('error');
        return;
    }

    setStatus('validating');
    const nextConfig = { token: cleanToken, root: normalizePath(root), clientId: cleanId, clientSecret: cleanSecret };
    saveFullConfig(nextConfig);
    setConfig(nextConfig);

    const result = await validateToken(cleanToken);
    if (result.success) {
        setStatus('success');
        onRefresh();
        setTimeout(() => setStatus('idle'), 3000);
    } else {
        setStatus('error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-24">
      {/* HEADER SECTION */}
      <div className="bg-[#0a0a0c] p-12 rounded-[3.5rem] border border-zinc-900 shadow-2xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-5xl font-black italic uppercase tracking-tighter text-blue-500">Node_Control</h2>
          <p className="text-zinc-600 font-bold uppercase tracking-[0.5em] text-[9px] italic">Deployment & Source Management</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
            <button 
                onClick={handleDownloadZip}
                disabled={isDeploying}
                className="px-10 py-6 bg-blue-600 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] animate-pulse"
            >
                DOWNLOAD PROJECT ZIP (FOR MANUS)
            </button>
            <button onClick={() => { if(confirm("Clear all data?")) clearConfig(); }} className="px-8 py-5 bg-red-950/20 border border-red-900/40 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-600 hover:text-white transition-all">Factory Reset</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* DEPLOYMENT GATEWAY */}
        <div className="bg-black/50 p-12 rounded-[4rem] border-2 border-dashed border-blue-900/40 space-y-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8">
                <div className="px-3 py-1 bg-blue-950 border border-blue-900 rounded-md text-[8px] font-black uppercase tracking-widest text-blue-400 italic">Protocol v2.4.1</div>
            </div>
            
            <div className="space-y-4">
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-blue-500">GitHub Auto-Sync</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase italic">Push source directly to your repository</p>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.4em] block mb-4">Username</label>
                        <input className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-5 font-mono text-[12px] text-zinc-300 outline-none focus:border-blue-600" placeholder="github_user" value={ghUser} onChange={e => setGhUser(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.4em] block mb-4">Repo Name</label>
                        <input className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-5 font-mono text-[12px] text-zinc-300 outline-none focus:border-blue-600" placeholder="novastream-radio" value={ghRepo} onChange={e => setGhRepo(e.target.value)} />
                    </div>
                </div>
                <div>
                    <label className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.4em] block mb-4">GitHub Personal Access Token</label>
                    <input type="password" className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-2xl p-5 font-mono text-[12px] text-blue-500 outline-none focus:border-blue-600" placeholder="ghp_..." value={ghToken} onChange={e => setGhToken(e.target.value)} />
                </div>
                <button onClick={handleGitHubPush} disabled={isDeploying} className={`w-full py-6 rounded-2xl font-black uppercase text-[10px] tracking-widest italic transition-all ${isDeploying ? 'bg-zinc-800 animate-pulse' : 'bg-white text-black hover:scale-[1.02] shadow-2xl'}`}>
                    {isDeploying ? 'EXECUTING_SYNC...' : 'Push to GitHub Repository'}
                </button>
            </div>
            
            <div className="bg-black rounded-3xl p-8 border border-zinc-900 flex flex-col min-h-[250px] shadow-inner">
                <div className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.4em] mb-4 text-center">Deployment Terminal</div>
                <div className="flex-1 font-mono text-[10px] space-y-1 overflow-y-auto custom-scrollbar">
                    {deployLogs.map((log, i) => (
                        <div key={i} className={log.startsWith('!!') ? 'text-red-500' : log.startsWith('>> SUCCESS') ? 'text-emerald-500 font-black' : 'text-blue-500'}>{log}</div>
                    ))}
                    {deployLogs.length === 0 && <div className="text-zinc-800 italic uppercase">System ready. Waiting for instruction...</div>}
                </div>
            </div>
        </div>

        {/* INFRASTRUCTURE CONFIG */}
        <div className="space-y-8">
            <div className="bg-[#0a0a0c] p-10 rounded-[3.5rem] border border-zinc-900 space-y-8 shadow-2xl">
                <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-400 italic">Cloud Signal Node</h3>
                <div className="space-y-6">
                    <div>
                        <label className="text-[9px] font-black text-zinc-700 uppercase tracking-[0.4em] block mb-3">Dropbox Refresh Token</label>
                        <input className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-mono text-[11px] text-blue-500 outline-none focus:border-blue-600" value={token} onChange={(e) => setToken(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <input className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-mono text-[11px] text-zinc-400 outline-none focus:border-blue-600" placeholder="Dropbox App Key" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                        <input type="password" className="w-full bg-black border border-zinc-800 rounded-xl p-4 font-mono text-[11px] text-zinc-400 outline-none focus:border-blue-600" placeholder="Secret Key" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
                    </div>
                    <button onClick={handleSave} className="w-full py-5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg">Update Infrastructure</button>
                </div>
            </div>
            
            <div className="bg-blue-600 p-10 rounded-[3.5rem] shadow-2xl flex flex-col justify-between h-64 border-4 border-blue-400">
                <div>
                  <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-white italic mb-4">Netlify Quick-Start</h3>
                  <p className="text-[10px] font-bold text-white/90 leading-relaxed mb-6">
                    Manus Instructions: Once the GitHub repo is ready, connect it to Netlify. <br/><br/>
                    Build Command: <span className="font-mono bg-blue-700 px-1">None</span><br/>
                    Publish Directory: <span className="font-mono bg-blue-700 px-1">.</span> (The Root)
                  </p>
                </div>
                <a href="https://app.netlify.com/start" target="_blank" className="text-center py-4 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl">Connect to Netlify</a>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
