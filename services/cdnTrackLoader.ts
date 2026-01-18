/**
 * CDN Track Loader - Load pre-scanned track index from CDN
 */

const TRACK_INDEX_URL = 'https://files.manuscdn.com/user_upload_by_module/session_file/310419663029859616/FNdXXAYHmRUoACHi.json';

export interface TrackIndex {
    version: number;
    generated: string;
    source: string;
    total_tracks: number;
    tracks: any[];
}

export const loadTracksFromCDN = async (): Promise<any[]> => {
    try {
        console.log('Loading tracks from CDN...');
        const response = await fetch(TRACK_INDEX_URL);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch track index: ${response.status}`);
        }
        
        const data: TrackIndex = await response.json();
        console.log(`Loaded ${data.total_tracks} tracks from CDN (generated: ${data.generated})`);
        
        return data.tracks || [];
    } catch (error) {
        console.error('Failed to load tracks from CDN:', error);
        return [];
    }
};
