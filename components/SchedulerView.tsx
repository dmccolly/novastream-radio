import React, { useState, useEffect, useCallback } from 'react';
import { Clock, ClockElement, SeparationRule, ScheduleEntry, Track, ElementType } from '../types';
import { Icons } from '../constants';
import {
  getAllClocks,
  saveClock,
  deleteClock,
  createClock,
  addElementToClock,
  removeElementFromClock,
  getAllSeparationRules,
  saveSeparationRule,
  deleteSeparationRule,
  createSeparationRule,
  generateSchedule,
  getScheduleEntries,
  clearSchedule,
  initializeDefaultData,
} from '../services/schedulerService';
import { getTracks } from '../services/stationService';

const ELEMENT_COLORS: Record<ElementType, string> = {
  music: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
  jingle: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
  sweeper: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
  promo: 'bg-pink-600/20 text-pink-400 border-pink-500/30',
  id: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
  commercial: 'bg-red-600/20 text-red-400 border-red-500/30',
  break: 'bg-zinc-600/20 text-zinc-400 border-zinc-500/30',
};

const SchedulerView: React.FC = () => {
  const [clocks, setClocks] = useState<Clock[]>([]);
  const [rules, setRules] = useState<SeparationRule[]>([]);
  const [selectedClock, setSelectedClock] = useState<Clock | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTab, setActiveTab] = useState<'clocks' | 'rules' | 'schedule'>('clocks');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Clock editor state
  const [isEditingClock, setIsEditingClock] = useState(false);
  const [editClockName, setEditClockName] = useState('');
  const [editClockDesc, setEditClockDesc] = useState('');
  
  // Element editor state
  const [newElementType, setNewElementType] = useState<ElementType>('music');
  const [newElementPosition, setNewElementPosition] = useState(0);
  
  // Rule editor state
  const [isEditingRule, setIsEditingRule] = useState(false);
  const [editRuleName, setEditRuleName] = useState('');
  const [editRuleType, setEditRuleType] = useState<'artist' | 'category' | 'track'>('artist');
  const [editRuleMinutes, setEditRuleMinutes] = useState(60);

  const loadData = useCallback(async () => {
    const [clocksData, rulesData, tracksData] = await Promise.all([
      getAllClocks(),
      getAllSeparationRules(),
      getTracks(),
    ]);
    setClocks(clocksData);
    setRules(rulesData);
    setTracks(tracksData);
    
    if (clocksData.length > 0 && !selectedClock) {
      setSelectedClock(clocksData[0]);
    }
  }, [selectedClock]);

  useEffect(() => {
    initializeDefaultData().then(() => loadData());
  }, []);

  const handleCreateClock = async () => {
    if (!editClockName.trim()) return;
    const newClock = createClock(editClockName, editClockDesc);
    await saveClock(newClock);
    await loadData();
    setIsEditingClock(false);
    setEditClockName('');
    setEditClockDesc('');
    setSelectedClock(newClock);
  };

  const handleDeleteClock = async (id: string) => {
    if (!confirm('Delete this clock?')) return;
    await deleteClock(id);
    await loadData();
    if (selectedClock?.id === id) {
      setSelectedClock(null);
    }
  };

  const handleAddElement = async () => {
    if (!selectedClock) return;
    const updated = addElementToClock(selectedClock, {
      type: newElementType,
      position: newElementPosition,
    });
    await saveClock(updated);
    setSelectedClock(updated);
    await loadData();
  };

  const handleRemoveElement = async (elementId: string) => {
    if (!selectedClock) return;
    const updated = removeElementFromClock(selectedClock, elementId);
    await saveClock(updated);
    setSelectedClock(updated);
    await loadData();
  };

  const handleCreateRule = async () => {
    if (!editRuleName.trim()) return;
    const newRule = createSeparationRule(editRuleName, editRuleType, editRuleMinutes);
    await saveSeparationRule(newRule);
    await loadData();
    setIsEditingRule(false);
    setEditRuleName('');
    setEditRuleMinutes(60);
  };

  const handleToggleRule = async (rule: SeparationRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    await saveSeparationRule(updated);
    await loadData();
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this rule?')) return;
    await deleteSeparationRule(id);
    await loadData();
  };

  const handleGenerateSchedule = async () => {
    if (!selectedClock) {
      alert('Please select a clock first');
      return;
    }
    if (tracks.length === 0) {
      alert('No tracks available. Please scan your library first.');
      return;
    }
    
    setIsGenerating(true);
    try {
      const startTime = Date.now();
      const hours = 24; // Generate 24 hours
      await clearSchedule();
      await generateSchedule(selectedClock, startTime, hours, tracks, rules);
      
      // Load generated schedule
      const entries = await getScheduleEntries(startTime, startTime + (hours * 60 * 60 * 1000));
      setSchedule(entries);
      setActiveTab('schedule');
    } catch (e: any) {
      alert(`Failed to generate schedule: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const loadSchedule = async () => {
    const now = Date.now();
    const entries = await getScheduleEntries(now - (12 * 60 * 60 * 1000), now + (24 * 60 * 60 * 1000));
    setSchedule(entries);
  };

  useEffect(() => {
    if (activeTab === 'schedule') {
      loadSchedule();
    }
  }, [activeTab]);

  const trackMap = new Map(tracks.map(t => [t.id, t]));

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-zinc-100">Scheduler</h1>
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mt-1">Clock Templates & Automation Rules</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateSchedule}
            disabled={isGenerating || !selectedClock}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'GENERATING...' : 'Generate Schedule'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('clocks')}
          className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'clocks'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-900 text-zinc-500 hover:text-white'
          }`}
        >
          Clocks
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'rules'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-900 text-zinc-500 hover:text-white'
          }`}
        >
          Separation Rules
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'schedule'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-900 text-zinc-500 hover:text-white'
          }`}
        >
          Schedule
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 bg-[#050507] rounded-[2rem] border border-zinc-900 shadow-inner overflow-hidden p-8">
        {activeTab === 'clocks' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
            {/* Clock List */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Clock Templates</h2>
                <button
                  onClick={() => setIsEditingClock(true)}
                  className="text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Icons.Plus />
                </button>
              </div>

              {isEditingClock && (
                <div className="bg-[#0a0a0c] border border-zinc-800 rounded-xl p-4 space-y-3">
                  <input
                    type="text"
                    placeholder="Clock Name"
                    value={editClockName}
                    onChange={(e) => setEditClockName(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-bold uppercase text-zinc-300 outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={editClockDesc}
                    onChange={(e) => setEditClockDesc(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] text-zinc-300 outline-none focus:border-blue-600"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateClock}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setIsEditingClock(false)}
                      className="flex-1 bg-zinc-900 text-zinc-500 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2 overflow-y-auto max-h-[600px] custom-scrollbar">
                {clocks.map((clock) => (
                  <div
                    key={clock.id}
                    onClick={() => setSelectedClock(clock)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedClock?.id === clock.id
                        ? 'bg-blue-600/10 border-blue-500/30'
                        : 'bg-[#0a0a0c] border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-[10px] font-black uppercase text-zinc-300">{clock.name}</h3>
                        {clock.description && (
                          <p className="text-[8px] text-zinc-600 mt-1">{clock.description}</p>
                        )}
                        <p className="text-[7px] text-zinc-700 mt-2">{clock.elements.length} elements</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClock(clock.id);
                        }}
                        className="text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Clock Editor */}
            {selectedClock && (
              <div className="lg:col-span-2 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-[12px] font-black uppercase tracking-wider text-zinc-300">{selectedClock.name}</h2>
                    <p className="text-[8px] text-zinc-600 mt-1">{selectedClock.description}</p>
                  </div>
                </div>

                {/* Add Element */}
                <div className="bg-[#0a0a0c] border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-3">Add Element</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      value={newElementType}
                      onChange={(e) => setNewElementType(e.target.value as ElementType)}
                      className="bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-bold uppercase text-zinc-300 outline-none focus:border-blue-600"
                    >
                      <option value="music">Music</option>
                      <option value="jingle">Jingle</option>
                      <option value="sweeper">Sweeper</option>
                      <option value="promo">Promo</option>
                      <option value="id">Station ID</option>
                      <option value="commercial">Commercial</option>
                      <option value="break">Break</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={newElementPosition}
                      onChange={(e) => setNewElementPosition(parseInt(e.target.value) || 0)}
                      placeholder="Minute"
                      className="bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-mono text-zinc-300 outline-none focus:border-blue-600"
                    />
                    <button
                      onClick={handleAddElement}
                      className="bg-blue-600 text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-500"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Clock Timeline */}
                <div className="bg-[#0a0a0c] border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4">Hour Timeline</h3>
                  <div className="space-y-2">
                    {selectedClock.elements.map((element) => (
                      <div
                        key={element.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${ELEMENT_COLORS[element.type]}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-mono font-black">:{element.position.toString().padStart(2, '0')}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest">{element.type}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveElement(element.id)}
                          className="text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <Icons.X />
                        </button>
                      </div>
                    ))}
                    {selectedClock.elements.length === 0 && (
                      <p className="text-center text-zinc-700 text-[9px] py-8">No elements yet. Add some above.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Separation Rules</h2>
              <button
                onClick={() => setIsEditingRule(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-500"
              >
                Add Rule
              </button>
            </div>

            {isEditingRule && (
              <div className="bg-[#0a0a0c] border border-zinc-800 rounded-xl p-6 space-y-4">
                <input
                  type="text"
                  placeholder="Rule Name"
                  value={editRuleName}
                  onChange={(e) => setEditRuleName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-bold uppercase text-zinc-300 outline-none focus:border-blue-600"
                />
                <div className="grid grid-cols-2 gap-4">
                  <select
                    value={editRuleType}
                    onChange={(e) => setEditRuleType(e.target.value as any)}
                    className="bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-bold uppercase text-zinc-300 outline-none focus:border-blue-600"
                  >
                    <option value="artist">Artist</option>
                    <option value="category">Category</option>
                    <option value="track">Track</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={editRuleMinutes}
                    onChange={(e) => setEditRuleMinutes(parseInt(e.target.value) || 60)}
                    placeholder="Minutes"
                    className="bg-black border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-mono text-zinc-300 outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateRule}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-[9px] font-black uppercase tracking-widest"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setIsEditingRule(false)}
                    className="flex-1 bg-zinc-900 text-zinc-500 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-[#0a0a0c] border border-zinc-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-[10px] font-black uppercase text-zinc-300">{rule.name}</h3>
                      <p className="text-[8px] text-zinc-600 mt-1">
                        {rule.type} • {rule.minMinutes} min
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <Icons.Trash />
                    </button>
                  </div>
                  <button
                    onClick={() => handleToggleRule(rule)}
                    className={`w-full py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                      rule.enabled
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                    }`}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Generated Schedule</h2>
              <button
                onClick={loadSchedule}
                className="px-4 py-2 bg-zinc-900 text-zinc-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:text-white"
              >
                Refresh
              </button>
            </div>

            <div className="overflow-y-auto max-h-[700px] custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#020203] z-10 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-3 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">Time</th>
                    <th className="px-4 py-3 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">Track</th>
                    <th className="px-4 py-3 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">Artist</th>
                    <th className="px-4 py-3 text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((entry) => {
                    const track = trackMap.get(entry.trackId);
                    const time = new Date(entry.scheduledTime);
                    return (
                      <tr key={entry.id} className="border-b border-zinc-900/50 hover:bg-blue-600/5">
                        <td className="px-4 py-3 text-[9px] font-mono text-zinc-500">
                          {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 text-[10px] font-bold uppercase text-zinc-300">
                          {track?.title || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-[9px] text-zinc-600">
                          {track?.artist || 'Unknown'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                            track ? ELEMENT_COLORS[track.assetType] : 'bg-zinc-900 text-zinc-600'
                          }`}>
                            {track?.assetType || 'UNK'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {schedule.length === 0 && (
                <p className="text-center text-zinc-700 text-[9px] py-12">
                  No schedule generated yet. Click "Generate Schedule" above.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulerView;
