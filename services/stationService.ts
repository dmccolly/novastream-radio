
/**
 * NOVASTREAM RADIO - MASTER VAULT PROTOCOL (STABILITY V24.0)
 */
const MASTER_VAULT = {
    token: "FvoDf8gNLXEAAAAAAAAAAWckjix-aCqhC8ZYFKX-3DHjD24FMx4vzpcSdK7NIbIL",
    clientId: "80tozg97nbba9bs",
    clientSecret: "plx6g6leszcphkg",
    root: "/"
};

const DB_NAME = 'NOVA_STATION_INDEX_FINAL'; 
const LIBRARY_STORE = 'station_library';
const DB_VERSION = 1;
const CONFIG_KEY = 'STATION_CONFIG_FINAL';

let dbPromise: Promise<IDBDatabase> | null = null;

export interface VaultConfig {
    token: string;
    root: string;
    clientId: string;
    clientSecret: string;
    lastVerified?: number;
}

export const getFullConfig = (): VaultConfig => {
    try {
        const localRaw = localStorage.getItem(CONFIG_KEY);
        if (localRaw) return JSON.parse(localRaw);
    } catch (e) {}
    return MASTER_VAULT;
};

export const saveFullConfig = (config: Partial<VaultConfig>) => {
    const current = getFullConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('vault-config-updated'));
};

export const openDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
                db.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return dbPromise;
};

export const exportVaultIndex = async () => {
    const tracks = await getTracks();
    const blob = new Blob([JSON.stringify(tracks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nova_station_backup.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const importVaultIndex = async (file: File) => {
    return new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const tracks = JSON.parse(e.target?.result as string);
                if (Array.isArray(tracks)) {
                    await saveTracksBatch(tracks);
                    resolve();
                } else {
                    reject(new Error("INVALID_JSON"));
                }
            } catch (err) { reject(err); }
        };
        reader.readAsText(file);
    });
};

export const clearConfig = () => {
    localStorage.clear();
    indexedDB.deleteDatabase(DB_NAME);
    window.location.reload();
};

export const injectDemoTracks = async () => {
    const demoTracks = [
        { id: 'demo-1', title: 'QUEEN - BOHEMIAN RHAPSODY', artist: 'LEGACY MASTERING', source: 'local', assetType: 'music', coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&h=400&auto=format&fit=crop', file_path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', segueOffset: 0 },
        { id: 'demo-2', title: 'SYNTHETIC HORIZON', artist: 'NOVACORE DIGITAL', source: 'local', assetType: 'music', coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&h=400&auto=format&fit=crop', file_path: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', segueOffset: 0 }
    ];
    await saveTracksBatch(demoTracks);
};

export const saveTracksBatch = async (tracks: any[]) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(LIBRARY_STORE, 'readwrite');
        const store = tx.objectStore(LIBRARY_STORE);
        tracks.forEach(t => {
            store.put({ 
                ...t, 
                assetType: t.assetType || 'music',
                source: t.source || 'cloud',
                segueOffset: t.segueOffset ?? 0
            });
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const updateTrack = async (track: any) => {
    const db = await openDB();
    const tx = db.transaction(LIBRARY_STORE, 'readwrite');
    tx.objectStore(LIBRARY_STORE).put(track);
    return new Promise(resolve => tx.oncomplete = resolve);
};

export const getTracks = async (): Promise<any[]> => {
    try {
        const db = await openDB();
        const tx = db.transaction(LIBRARY_STORE, 'readonly');
        return new Promise(resolve => {
            const req = tx.objectStore(LIBRARY_STORE).getAll();
            req.onsuccess = () => resolve(req.result || []);
        });
    } catch { return []; }
};

export const getAudioUrl = async (id: string): Promise<{url: string, source: 'local' | 'cloud'}> => {
    const db = await openDB();
    const tx = db.transaction(LIBRARY_STORE, 'readonly');
    return new Promise(resolve => {
        const req = tx.objectStore(LIBRARY_STORE).get(id);
        req.onsuccess = () => {
            const d = req.result;
            if (d?.file_path) resolve({ url: d.file_path, source: d.source || 'local' });
            else resolve({ url: "", source: 'local' });
        };
        req.onerror = () => resolve({ url: "", source: 'local' });
    });
};

let peer: any = null;
let activeConnections: any[] = [];
let masterStream: MediaStream | null = null;

export const initP2P = (onId: (id: string) => void, onError: (err: string) => void, onData: (data: any) => void, onStream?: (stream: MediaStream) => void) => {
    if (peer) return;
    const PeerClass = (window as any).Peer;
    if (!PeerClass) return onError("PEERJS_NOT_FOUND");

    try {
        peer = new PeerClass({
            config: {
                'iceServers': [
                    { 'urls': 'stun:stun.l.google.com:19302' },
                    { 'urls': 'stun:stun1.l.google.com:19302' },
                    { 'urls': 'stun:stun2.l.google.com:19302' },
                    { 'urls': 'stun:stun3.l.google.com:19302' },
                    { 'urls': 'stun:stun4.l.google.com:19302' }
                ]
            }
        });
        
        peer.on('open', onId);
        peer.on('error', (e: any) => onError(`SIGNAL_ERR: ${e.type}`));
        
        peer.on('connection', (conn: any) => {
            activeConnections.push(conn);
            conn.on('data', onData);
            if (masterStream) {
                setTimeout(() => peer.call(conn.peer, masterStream), 500);
            }
        });

        peer.on('call', (call: any) => {
            call.answer(); 
            call.on('stream', (s: MediaStream) => { if (onStream) onStream(s); });
        });

    } catch (e: any) { onError(e.message); }
};

export const setMasterStream = (stream: MediaStream) => {
    masterStream = stream;
    if (!peer) return;
    activeConnections.forEach(c => {
        if (c.open) peer.call(c.peer, masterStream);
    });
};

export const connectToNode = (id: string) => {
    if (!peer || !id) return;
    const conn = peer.connect(id);
    conn.on('open', () => activeConnections.push(conn));
};

export const requestPersistence = async () => {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
};
