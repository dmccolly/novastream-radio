
export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  file_path?: string;
  coverUrl: string;
  audioUrl?: string;
  segueOffset: number; // Seconds from end to trigger next track
  assetType: 'music' | 'jingle' | 'promo' | 'sweeper' | 'id' | 'commercial';
  source: 'local' | 'cloud';
}

export enum RadioState {
  OFFLINE = 'OFFLINE',
  LIVE = 'LIVE',
  AUTO = 'AUTO',
  EMERGENCY = 'EMERGENCY'
}
