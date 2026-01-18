
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

// Scheduler Types
export type ElementType = 'music' | 'jingle' | 'sweeper' | 'promo' | 'id' | 'commercial' | 'break';

export interface ClockElement {
  id: string;
  type: ElementType;
  position: number; // Minute position in hour (0-59)
  duration?: number; // Optional fixed duration in seconds
  category?: string; // For music: 'current', 'recurrent', 'gold'
}

export interface Clock {
  id: string;
  name: string;
  description?: string;
  elements: ClockElement[];
  createdAt: number;
  updatedAt: number;
}

export interface SeparationRule {
  id: string;
  name: string;
  type: 'artist' | 'category' | 'track';
  minMinutes: number; // Minimum minutes between plays
  enabled: boolean;
}

export interface ScheduleEntry {
  id: string;
  trackId: string;
  scheduledTime: number; // Unix timestamp
  clockId?: string;
  elementId?: string;
  played: boolean;
}

export interface SchedulerConfig {
  separationRules: SeparationRule[];
  defaultClock?: string; // Default clock ID
}
