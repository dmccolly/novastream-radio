
/**
 * NOVASTREAM RADIO - MASTER VAULT PROTOCOL (STABILITY V24.0)
 */
const MASTER_VAULT = {
    token: "sl.u.AGPPdWoFVni0BvbBLoWv6f_wqjRJaff0WRlenEiKob_KsTJB0x954J4U3X4nbf5JOuPpYiw8UQxV6VTiygy5Py2kl6qrYCjiaMZ_N2nGMBV0dOIyvTgBcSbjwjI18T_VxumgAap7wJp2efAosM4Ni8r7kpFeaNfuZDRdkV-9RX_uzx6oqvVHmBWpSURzi5Jsf37-ZNKED325sntKKSh5e__nkdrS61J58veI97sMAlWYkYa_pUILu3U4W6zCiwUrVl7H_cgBir4Y-45mHjJ8JUNDMEisYRW-ISbfL3OcBb52id9niYDk_rJs-BXVLVidiVBTIwZwb9TIUvhgQQjCyxetV1Io2JjfVvj3FiX3aicZ09nkUxdUgqA0KAIHug5m3ZWZUnylu7PdRrimJBXZzcoSjdAJuuH7HMTjNmZi-XO30YZfiYRScTH5Ew5Ij0gpgccUdERNINxC13jFE2bdy6R7hGXqx4sCmcvVMDb9RfIgiMFp5war1jRO9gm2a0QIrqGm7ekkUpnxtAkP_-1qEYWcZFTWEIRvZ8N0voOXu-qfBcHelpyfhTSjD1K9sR_jNAKLYfvOa-oGdiIjxukaMGV6ZSFGYxL2BC-q1rRtTCb6wuO_Du_XmFPWzg-sOnD9CeXKb-tEfor0AbpCiiJtRJPWbcqNF1q1xOpk8MACmc7Oa5mrWlqVJFXPzQvs51bWkz_WT9YZx0RaPV1_IKa8OhgFTE8eysthYHqXNW6c5kuFOrbUaZQYetAVoukJIFUY2g2YqniSswXVta_F6m0X8J4_-XBxrIkJwdZ392WU5-TtDIfTwhlVfZ4mD83LHudgG7mZNXX7gsaLQ6xqupqyf5rP1R_Trqg1TY8F2-sIxF5tUETk0qlBHAfVW-eUyHcg3JInfwyJufO69dG7RyqPq445ojDmuC84EVEvCJk6lecr8n0bA2135BUY_elzdlS-7QlG6olEAiNr2Fl17RQJt27Prz-734LLsO3uIhXAGlaEe19_jzSlfZ-C8V6gNIfKca1p64MYgcKh62IF46FsVsW49B2HQj2dOpactO6Slys-5bCcwnw1NfNvwNgVEGTuXRA2Q-k-T8vJk_P9t75iX8DWgDStBSBxg-LJfpX1U1_jrhIQnL1VqR51Iu3SvdscZw2O78a4ud0heA2mHvcUaZDrjRmeucSXiV5xS9mU76lJRlsYCpV5fZNWkE4PMNuKAY2A4tmG-ePUqvzKNVxhpIyLEAQaubj3fMQca1QJuJnqsbVQCVdGJqeZwcN4ckuPaMk",
    clientId: "80tozg97nbba9bs",
    clientSecret: "plx6g6leszcphkg",
    root: "/"
};

const DB_NAME = 'NOVA_STATION_INDEX_FINAL'; 
const LIBRARY_STORE = 'station_library';
const DB_VERSION = 1;
const CONFIG_KEY = 'STATION_CONFIG_FINAL';
const DROPBOX_INDEX_PATH = '/novastream_track_index.json';
const SYNC_DEBOUNCE_MS = 2000; // Wait 2s after last change before syncing

let syncTimeout: number | null = null;

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
                    await saveTracksBatchWithSync(tracks);
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

// ============================================================================
// DROPBOX SYNC MODULE
// ============================================================================

/**
 * Upload track index directly to Dropbox
 */
async function uploadIndexToServer(tracks: any[]): Promise<void> {
    try {
        const config = getFullConfig();
        if (!config.token) {
            console.warn('No Dropbox token configured, skipping sync');
            return;
        }

        // Upload directly to Dropbox
        const indexData = JSON.stringify(tracks, null, 2);
        const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Dropbox-API-Arg': JSON.stringify({
                    path: DROPBOX_INDEX_PATH,
                    mode: 'overwrite',
                    autorename: false,
                    mute: false
                }),
                'Content-Type': 'application/octet-stream'
            },
            body: indexData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Dropbox upload failed: ${response.status} - ${errorText}`);
        }

        console.log('✓ Track index synced to Dropbox:', tracks.length, 'tracks');
    } catch (error: any) {
        console.error('Failed to sync to server:', error.message);
    }
}

/**
 * Download track index directly from Dropbox
 */
async function downloadIndexFromServer(): Promise<any[] | null> {
    try {
        const config = getFullConfig();
        if (!config.token) {
            console.warn('No Dropbox token configured, skipping download');
            return null;
        }

        // Download from Dropbox
        const response = await fetch('https://content.dropboxapi.com/2/files/download', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Dropbox-API-Arg': JSON.stringify({
                    path: DROPBOX_INDEX_PATH
                })
            }
        });

        if (!response.ok) {
            if (response.status === 409) {
                // File doesn't exist yet, that's okay
                console.log('No track index found in Dropbox (first time setup)');
                return null;
            }
            const errorText = await response.text();
            throw new Error(`Dropbox download failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            console.log('✓ Track index loaded from Dropbox:', data.length, 'tracks');
            return data;
        }
        return null;
    } catch (error: any) {
        console.error('Failed to load from Dropbox:', error.message);
        return null;
    }
}

/**
 * Debounced sync to Dropbox
 * Waits for changes to settle before uploading
 */
async function debouncedSyncToDropbox(): Promise<void> {
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }

    syncTimeout = window.setTimeout(async () => {
        const tracks = await getTracks();
        await uploadIndexToServer(tracks);
    }, SYNC_DEBOUNCE_MS);
}

/**
 * Initialize: Load from CDN first, then IndexedDB
 * Call this when the app starts
 */
export async function initializeFromServer(): Promise<void> {
    // Check IndexedDB first
    const localTracks = await getTracks();
    console.log('Loaded', localTracks.length, 'tracks from IndexedDB');
    
    // If we have fewer than 1000 tracks (demo tracks only), load from CDN
    if (localTracks.length < 1000) {
        try {
            console.log('Loading tracks from CDN...');
            const response = await fetch('/tracks.json');
            if (response.ok) {
                const data = await response.json();
                if (data.tracks && data.tracks.length > 0) {
                    console.log('Loaded', data.tracks.length, 'tracks from CDN');
                    await saveTracksBatch(data.tracks);
                    return;
                }
            }
        } catch (error: any) {
            console.error('Failed to load from CDN:', error.message);
        }
    }
    
    // Fallback: Try Dropbox sync (legacy)
    try {
        const dropboxTracks = await downloadIndexFromServer();
        
        if (dropboxTracks && dropboxTracks.length > 0) {
            if (dropboxTracks.length > localTracks.length) {
                console.log('Restoring', dropboxTracks.length, 'tracks from Dropbox');
                await saveTracksBatch(dropboxTracks);
            } else if (localTracks.length > dropboxTracks.length) {
                console.log('Uploading', localTracks.length, 'local tracks to Dropbox');
                await uploadIndexToServer(localTracks);
            }
        }
    } catch (error: any) {
        console.log('Dropbox sync skipped:', error.message);
    }
}

/**
 * Enhanced saveTracksBatch with auto-sync
 */
export const saveTracksBatchAndSync = async (tracks: any[]) => {
    await saveTracksBatch(tracks);
    await debouncedSyncToDropbox();
};

/**
 * Enhanced updateTrack with auto-sync
 */
export const updateTrackAndSync = async (track: any) => {
    await updateTrack(track);
    await debouncedSyncToDropbox();
};

/**
 * Trigger sync (for use after operations)
 */
export async function triggerSync(): Promise<void> {
    await debouncedSyncToDropbox();
}

/**
 * Manual sync trigger
 */
export async function syncNow(): Promise<void> {
    const tracks = await getTracks();
    await uploadIndexToServer(tracks);
}

/**
 * Get sync status
 */
export function getSyncStatus(): { enabled: boolean; lastSync?: number } {
    const config = getFullConfig();
    return {
        enabled: !!config.token,
        lastSync: undefined, // Could store this in localStorage if needed
    };
}
