/**
 * Scheduler Service - Modular Radio Automation Scheduling
 * 
 * Modules:
 * - Clock Management: Create/edit/delete clock templates
 * - Separation Rules: Artist/category/track separation logic
 * - Auto-Scheduler: Fill clocks with tracks based on rules
 * - Schedule Storage: IndexedDB persistence
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Clock, ClockElement, SeparationRule, ScheduleEntry, SchedulerConfig, Track } from '../types';

interface SchedulerDB extends DBSchema {
  clocks: {
    key: string;
    value: Clock;
  };
  separationRules: {
    key: string;
    value: SeparationRule;
  };
  scheduleEntries: {
    key: string;
    value: ScheduleEntry;
    indexes: { 'by-time': number };
  };
  config: {
    key: string;
    value: SchedulerConfig;
  };
}

let db: IDBPDatabase<SchedulerDB> | null = null;

async function getDB() {
  if (!db) {
    db = await openDB<SchedulerDB>('NovaStreamScheduler', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('clocks')) {
          db.createObjectStore('clocks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('separationRules')) {
          db.createObjectStore('separationRules', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('scheduleEntries')) {
          const store = db.createObjectStore('scheduleEntries', { keyPath: 'id' });
          store.createIndex('by-time', 'scheduledTime');
        }
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'id' });
        }
      },
    });
  }
  return db;
}

// ============================================================================
// MODULE: Clock Management
// ============================================================================

export async function saveClock(clock: Clock): Promise<void> {
  const database = await getDB();
  await database.put('clocks', clock);
}

export async function getClock(id: string): Promise<Clock | undefined> {
  const database = await getDB();
  return await database.get('clocks', id);
}

export async function getAllClocks(): Promise<Clock[]> {
  const database = await getDB();
  return await database.getAll('clocks');
}

export async function deleteClock(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('clocks', id);
}

export function createClock(name: string, description?: string): Clock {
  return {
    id: `clock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    elements: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function addElementToClock(clock: Clock, element: Omit<ClockElement, 'id'>): Clock {
  const newElement: ClockElement = {
    ...element,
    id: `elem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
  return {
    ...clock,
    elements: [...clock.elements, newElement].sort((a, b) => a.position - b.position),
    updatedAt: Date.now(),
  };
}

export function removeElementFromClock(clock: Clock, elementId: string): Clock {
  return {
    ...clock,
    elements: clock.elements.filter(e => e.id !== elementId),
    updatedAt: Date.now(),
  };
}

// ============================================================================
// MODULE: Separation Rules
// ============================================================================

export async function saveSeparationRule(rule: SeparationRule): Promise<void> {
  const database = await getDB();
  await database.put('separationRules', rule);
}

export async function getAllSeparationRules(): Promise<SeparationRule[]> {
  const database = await getDB();
  return await database.getAll('separationRules');
}

export async function deleteSeparationRule(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('separationRules', id);
}

export function createSeparationRule(
  name: string,
  type: 'artist' | 'category' | 'track',
  minMinutes: number
): SeparationRule {
  return {
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type,
    minMinutes,
    enabled: true,
  };
}

/**
 * Check if a track violates separation rules
 * @param track Track to check
 * @param recentEntries Recent schedule entries to check against
 * @param rules Active separation rules
 * @returns true if track passes all rules, false if it violates any
 */
export function checkSeparation(
  track: Track,
  recentEntries: ScheduleEntry[],
  rules: SeparationRule[],
  trackMap: Map<string, Track>
): boolean {
  const now = Date.now();
  
  for (const rule of rules) {
    if (!rule.enabled) continue;
    
    const minMs = rule.minMinutes * 60 * 1000;
    
    for (const entry of recentEntries) {
      const timeDiff = now - entry.scheduledTime;
      if (timeDiff > minMs) continue; // Outside separation window
      
      const entryTrack = trackMap.get(entry.trackId);
      if (!entryTrack) continue;
      
      // Check rule type
      if (rule.type === 'artist' && entryTrack.artist === track.artist) {
        return false; // Artist separation violated
      }
      
      if (rule.type === 'category' && entryTrack.assetType === track.assetType) {
        return false; // Category separation violated
      }
      
      if (rule.type === 'track' && entryTrack.id === track.id) {
        return false; // Track separation violated
      }
    }
  }
  
  return true;
}

// ============================================================================
// MODULE: Schedule Management
// ============================================================================

export async function saveScheduleEntry(entry: ScheduleEntry): Promise<void> {
  const database = await getDB();
  await database.put('scheduleEntries', entry);
}

export async function getScheduleEntries(startTime: number, endTime: number): Promise<ScheduleEntry[]> {
  const database = await getDB();
  const all = await database.getAll('scheduleEntries');
  return all.filter(e => e.scheduledTime >= startTime && e.scheduledTime <= endTime);
}

export async function clearSchedule(): Promise<void> {
  const database = await getDB();
  const all = await database.getAll('scheduleEntries');
  for (const entry of all) {
    await database.delete('scheduleEntries', entry.id);
  }
}

// ============================================================================
// MODULE: Auto-Scheduler
// ============================================================================

/**
 * Auto-fill a clock with tracks based on separation rules
 * @param clock Clock template to fill
 * @param startTime Starting timestamp for the hour
 * @param availableTracks Pool of tracks to choose from
 * @param rules Separation rules to enforce
 * @returns Array of schedule entries
 */
export async function autoFillClock(
  clock: Clock,
  startTime: number,
  availableTracks: Track[],
  rules: SeparationRule[]
): Promise<ScheduleEntry[]> {
  const entries: ScheduleEntry[] = [];
  const trackMap = new Map(availableTracks.map(t => [t.id, t]));
  
  // Get recent history for separation checking
  const recentEntries = await getScheduleEntries(startTime - (24 * 60 * 60 * 1000), startTime);
  
  for (const element of clock.elements) {
    const elementTime = startTime + (element.position * 60 * 1000);
    
    // Filter tracks by element type
    let candidates = availableTracks.filter(t => {
      if (element.type === 'music') return t.assetType === 'music';
      return t.assetType === element.type;
    });
    
    // Filter by category if specified
    if (element.category) {
      // For now, we'll skip category filtering since tracks don't have category field yet
      // This can be extended when track metadata includes rotation category
    }
    
    // Find first track that passes separation rules
    let selectedTrack: Track | null = null;
    for (const candidate of candidates) {
      if (checkSeparation(candidate, [...recentEntries, ...entries], rules, trackMap)) {
        selectedTrack = candidate;
        break;
      }
    }
    
    // If no track passes rules, pick randomly (fallback)
    if (!selectedTrack && candidates.length > 0) {
      selectedTrack = candidates[Math.floor(Math.random() * candidates.length)];
    }
    
    if (selectedTrack) {
      const entry: ScheduleEntry = {
        id: `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        trackId: selectedTrack.id,
        scheduledTime: elementTime,
        clockId: clock.id,
        elementId: element.id,
        played: false,
      };
      entries.push(entry);
    }
  }
  
  return entries;
}

/**
 * Generate schedule for a time range using a clock
 * @param clock Clock to use
 * @param startTime Start timestamp
 * @param hours Number of hours to schedule
 * @param tracks Available tracks
 * @param rules Separation rules
 */
export async function generateSchedule(
  clock: Clock,
  startTime: number,
  hours: number,
  tracks: Track[],
  rules: SeparationRule[]
): Promise<ScheduleEntry[]> {
  const allEntries: ScheduleEntry[] = [];
  
  for (let i = 0; i < hours; i++) {
    const hourStart = startTime + (i * 60 * 60 * 1000);
    const hourEntries = await autoFillClock(clock, hourStart, tracks, rules);
    allEntries.push(...hourEntries);
    
    // Save entries to database
    for (const entry of hourEntries) {
      await saveScheduleEntry(entry);
    }
  }
  
  return allEntries;
}

// ============================================================================
// MODULE: Configuration
// ============================================================================

export async function getSchedulerConfig(): Promise<SchedulerConfig> {
  const database = await getDB();
  const config = await database.get('config', 'main');
  if (!config) {
    const defaultConfig: SchedulerConfig = {
      separationRules: [],
      defaultClock: undefined,
    };
    await database.put('config', { ...defaultConfig, id: 'main' } as any);
    return defaultConfig;
  }
  return config;
}

export async function saveSchedulerConfig(config: SchedulerConfig): Promise<void> {
  const database = await getDB();
  await database.put('config', { ...config, id: 'main' } as any);
}

// ============================================================================
// MODULE: Default Data
// ============================================================================

export async function initializeDefaultData(): Promise<void> {
  const clocks = await getAllClocks();
  if (clocks.length === 0) {
    // Create a default clock
    const defaultClock = createClock('Default Hour', 'Standard hourly rotation');
    
    // Add typical elements
    let clock = addElementToClock(defaultClock, { type: 'music', position: 0 });
    clock = addElementToClock(clock, { type: 'music', position: 4 });
    clock = addElementToClock(clock, { type: 'sweeper', position: 8 });
    clock = addElementToClock(clock, { type: 'music', position: 9 });
    clock = addElementToClock(clock, { type: 'music', position: 13 });
    clock = addElementToClock(clock, { type: 'jingle', position: 17 });
    clock = addElementToClock(clock, { type: 'music', position: 18 });
    clock = addElementToClock(clock, { type: 'music', position: 22 });
    clock = addElementToClock(clock, { type: 'id', position: 26 });
    clock = addElementToClock(clock, { type: 'music', position: 27 });
    clock = addElementToClock(clock, { type: 'music', position: 31 });
    clock = addElementToClock(clock, { type: 'sweeper', position: 35 });
    clock = addElementToClock(clock, { type: 'music', position: 36 });
    clock = addElementToClock(clock, { type: 'music', position: 40 });
    clock = addElementToClock(clock, { type: 'jingle', position: 44 });
    clock = addElementToClock(clock, { type: 'music', position: 45 });
    clock = addElementToClock(clock, { type: 'music', position: 49 });
    clock = addElementToClock(clock, { type: 'id', position: 53 });
    clock = addElementToClock(clock, { type: 'music', position: 54 });
    
    await saveClock(clock);
  }
  
  const rules = await getAllSeparationRules();
  if (rules.length === 0) {
    // Create default separation rules
    await saveSeparationRule(createSeparationRule('Artist Separation', 'artist', 60));
    await saveSeparationRule(createSeparationRule('Track Separation', 'track', 180));
    await saveSeparationRule(createSeparationRule('Jingle Separation', 'category', 15));
  }
}
