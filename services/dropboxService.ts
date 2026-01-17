
import { getFullConfig } from './stationService';
import { Track } from '../types';

let sessionAccessToken: string | null = null;
let sessionExpiryTime: number = 0;

export interface DiagnosticStep {
    name: string;
    status: 'running' | 'ok' | 'fail';
    message: string;
    raw?: any;
}

export const normalizePath = (path: string): string => {
    if (!path || path === '/' || path.trim() === '') return '';
    let p = path.trim();
    if (!p.startsWith('/')) p = '/' + p;
    if (p.endsWith('/')) p = p.slice(0, -1);
    return p;
};

async function refreshSession(config: any): Promise<string> {
    if (!config.token || !config.clientId || !config.clientSecret) {
        throw new Error("CREDENTIALS_MISSING");
    }

    const url = 'https://api.dropboxapi.com/oauth2/token';
    const params = new URLSearchParams();
    params.set('grant_type', 'refresh_token');
    params.set('refresh_token', config.token);
    params.set('client_id', config.clientId);
    params.set('client_secret', config.clientSecret);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        const data = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            console.error("Dropbox OAuth Error:", data);
            throw new Error(data.error_description || data.error || `HTTP_${response.status}`);
        }

        sessionAccessToken = data.access_token;
        sessionExpiryTime = Date.now() + (data.expires_in * 1000) - 60000;
        return data.access_token;
    } catch (e: any) {
        throw new Error(`AUTH_FAILURE: ${e.message}`);
    }
}

async function getValidSessionToken(): Promise<string> {
    const config = getFullConfig();
    // If we have a valid session token, use it.
    if (sessionAccessToken && Date.now() < sessionExpiryTime) return sessionAccessToken;
    
    try {
        return await refreshSession(config);
    } catch (e: any) {
        // Fallback: If refresh fails, try using the provided token directly (it might be a long-lived access token)
        console.warn("Refresh failed, attempting direct token access fallback...");
        return config.token;
    }
}

async function apiCall(endpoint: string, body: any = null, isContent: boolean = false) {
    const token = await getValidSessionToken();
    const baseUrl = isContent ? 'https://content.dropboxapi.com/2/' : 'https://api.dropboxapi.com/2/';
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
    };

    if (!isContent && body) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : null
    });

    if (response.status === 401) {
        sessionAccessToken = null;
        throw new Error("SESSION_REJECTED");
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        console.error(`Dropbox API Error [${endpoint}]:`, err);
        throw new Error(err.error_summary || `ERR_${response.status}`);
    }

    return await response.json();
}

export const harvestDropbox = async (onLog: (msg: string) => void): Promise<Track[]> => {
    const config = getFullConfig();
    const path = normalizePath(config.root);
    onLog(">> VAULT: INITIATING_PROTOCOL...");
    
    try {
        onLog(">> VAULT: LISTING_FOLDER_ENTRIES...");
        let data = await apiCall('files/list_folder', { path, recursive: true });
        let tracks: Track[] = [];
        
        const processEntries = (ents: any[]) => {
            ents.forEach((e: any) => {
                if (e[".tag"] === "file" && e.name.match(/\.(mp3|wav|m4a|flac)$/i)) {
                    tracks.push({
                        id: e.id,
                        title: e.name.replace(/\.[^/.]+$/, "").toUpperCase(),
                        file_path: e.path_lower,
                        artist: "Vault Cloud Asset",
                        source: 'cloud',
                        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&h=400&auto=format&fit=crop',
                        segueOffset: 0,
                        assetType: 'music'
                    });
                }
            });
        };

        processEntries(data.entries);
        while (data.has_more) {
            onLog(`>> VAULT: SYNCING... (${tracks.length} ASSETS)`);
            data = await apiCall('files/list_folder/continue', { cursor: data.cursor });
            processEntries(data.entries);
        }
        
        onLog(`>> VAULT: MOUNT_SUCCESS [${tracks.length} ASSETS]`);
        return tracks;
    } catch (e: any) {
        onLog(`!! VAULT_ERR: ${e.message}`);
        console.error("Harvest Failed:", e);
        return [];
    }
};

export const getStreamUrl = async (path: string): Promise<string> => {
    try {
        const data = await apiCall('files/get_temporary_link', { path });
        return data?.link || "";
    } catch (e: any) {
        console.error("Link Retrieval Failed:", e);
        return "";
    }
};

export const validateToken = async (token: string): Promise<{success: boolean, message: string}> => {
    try {
        const config = getFullConfig();
        await refreshSession({ ...config, token });
        const res = await apiCall('users/get_current_account');
        return { success: true, message: `ACCESS_GRANTED: ${res.email}` };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

export const runVaultDiagnostics = async (onStep: (step: DiagnosticStep) => void) => {
    const config = getFullConfig();
    
    const report = (name: string, status: 'running' | 'ok' | 'fail', message: string) => {
        onStep({ name, status, message });
    };

    report('CREDENTIALS', 'running', 'Verifying Key Set...');
    if (!config.clientId || !config.clientSecret || !config.token) {
        report('CREDENTIALS', 'fail', 'KEYS_MISSING');
        return;
    }
    report('CREDENTIALS', 'ok', 'KEYS_FOUND');

    report('HANDSHAKE', 'running', 'Attempting OAuth Refresh...');
    try {
        await refreshSession(config);
        report('HANDSHAKE', 'ok', 'TOKEN_REFRESHED');
    } catch (e: any) {
        report('HANDSHAKE', 'fail', `REFRESH_FAILED: ${e.message}`);
        return;
    }

    report('PROBE', 'running', 'Querying Storage Metadata...');
    try {
        const path = normalizePath(config.root);
        const res = await apiCall('files/list_folder', { path, limit: 1 });
        report('PROBE', 'ok', `METADATA_LOCKED (${res.entries.length} items)`);
    } catch (e: any) {
        report('PROBE', 'fail', `PROBE_FAILED: ${e.message}`);
    }
};
