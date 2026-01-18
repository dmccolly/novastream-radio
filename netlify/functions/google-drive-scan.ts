import { Handler } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { google } from 'googleapis';

const FOLDER_ID = '1e5zYB0gtYJQt43BZS4cSZJ05E8fCuUiV';
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg', '.wma'];

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  assetType: 'MUSIC' | 'LINER' | 'COMMERCIAL' | 'SWEEPER';
  segueOffset?: number;
  source: 'GDRIVE';
  sourceUrl: string;
  fileId: string;
}

// Initialize Google Drive API with service account
async function getGoogleDriveClient(context: any) {
  // Load credentials from Netlify Blobs
  const store = getStore({
    name: 'novastream',
    siteID: context.site?.id || 'b624300c-f3f9-44f3-b737-bdfaa637cd4c',
    token: context.token,
  });
  const credentialsJson = await store.get('google-drive-credentials', { type: 'text' });
  
  if (!credentialsJson) {
    throw new Error('Google Drive credentials not found in Netlify Blobs');
  }
  
  const credentials = JSON.parse(credentialsJson);
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  return google.drive({ version: 'v3', auth });
}

// Recursively scan folder for audio files
async function scanFolder(drive: any, folderId: string, basePath: string = ''): Promise<Track[]> {
  const tracks: Track[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType, size)',
      pageSize: 1000,
      pageToken,
    });

    const files = response.data.files || [];

    for (const file of files) {
      const fullPath = basePath ? `${basePath}/${file.name}` : file.name;

      // If it's a folder, scan it recursively
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        const subTracks = await scanFolder(drive, file.id, fullPath);
        tracks.push(...subTracks);
      }
      // If it's an audio file, add it to the list
      else if (AUDIO_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))) {
        // Parse metadata from filename
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        const parts = fileName.split(' - ');
        
        const track: Track = {
          id: file.id,
          title: parts.length > 1 ? parts[1] : fileName,
          artist: parts.length > 1 ? parts[0] : 'Unknown Artist',
          assetType: 'MUSIC',
          source: 'GDRIVE',
          sourceUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
          fileId: file.id,
        };

        tracks.push(track);
      }
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  return tracks;
}

export const handler: Handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    console.log('Starting Google Drive scan...');
    const drive = await getGoogleDriveClient(context);
    const tracks = await scanFolder(drive, FOLDER_ID);
    
    console.log(`Found ${tracks.length} audio files`);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        tracks,
        count: tracks.length,
      }),
    };
  } catch (error: any) {
    console.error('Error scanning Google Drive:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message || 'Failed to scan Google Drive',
      }),
    };
  }
};
