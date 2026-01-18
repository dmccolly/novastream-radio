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
  const [isLoading, setIsLoading] = useState(false);
  
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
  const [editRuleCategory, setEditRuleCategory] = useState('');
  const [editRuleMinutes, setEditRuleMinutes] = useState(60);
  const [editRuleEnabled, setEditRuleEnabled] = useState(true);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Initialize default data on mount
  useEffect(() => {
    initializeDefaultData();
  }, []);

  // Lazy load data based on active tab
  const loadClocks = useCallback(async () => {
    const allClocks = await getAllClocks();
    setClocks(allClocks);
    if (allClocks.length > 0 && !selectedClock) {
      setSelectedClock(allClocks[0]);
    }
  }, [selectedClock]);

  const loadRules = useCallback(async () => {
    const allRules = await getAllSeparationRules();
    setRules(allRules);
  }, []);

  const loadSchedule = useCallback(async () => {
    const entries = await getScheduleEntries();
    setSchedule(entries);
  }, []);

  const loadTracks = useCallback(async () => {
    if (tracks.length === 0) {
      const allTracks = await getTracks();
      setTracks(allTracks);
    }
  }, [tracks.length]);

  // Load data when tab changes
  useEffect(() => {
    setIsLoading(true);
    if (activeTab === 'clocks') {
      loadClocks().finally(() => setIsLoading(false));
    } else if (activeTab === 'rules') {
      loadRules().finally(() => setIsLoading(false));
    } else if (activeTab === 'schedule') {
      loadSchedule().finally(() => setIsLoading(false));
    }
  }, [activeTab, loadClocks, loadRules, loadSchedule]);

  const handleCreateClock = async () => {
    const newClock = await createClock('New Clock', 'Description');
    await loadClocks();
    setSelectedClock(newClock);
  };

  const handleSaveClock = async () => {
    if (!selectedClock) return;
    const updated = { ...selectedClock, name: editClockName, description: editClockDesc };
    await saveClock(updated);
    await loadClocks();
    setSelectedClock(updated);
    setIsEditingClock(false);
  };

  const handleDeleteClock = async (clockId: string) => {
    await deleteClock(clockId);
    await loadClocks();
    if (selectedClock?.id === clockId) {
      setSelectedClock(clocks[0] || null);
    }
  };

  const handleAddElement = async () => {
    if (!selectedClock) return;
    await addElementToClock(selectedClock.id, newElementType, newElementPosition);
    await loadClocks();
    const updated = clocks.find(c => c.id === selectedClock.id);
    if (updated) setSelectedClock(updated);
  };

  const handleRemoveElement = async (elementId: string) => {
    if (!selectedClock) return;
    await removeElementFromClock(selectedClock.id, elementId);
    await loadClocks();
    const updated = clocks.find(c => c.id === selectedClock.id);
    if (updated) setSelectedClock(updated);
  };

  const handleCreateRule = async () => {
    await createSeparationRule('New Rule', 'artist', 60, true);
    await loadRules();
  };

  const handleEditRule = (rule: SeparationRule) => {
    setEditingRuleId(rule.id);
    setEditRuleName(rule.name);
    setEditRuleCategory(rule.category);
    setEditRuleMinutes(rule.separationMinutes);
    setEditRuleEnabled(rule.enabled);
    setIsEditingRule(true);
  };

  const handleSaveRule = async () => {
    if (!editingRuleId) return;
    const updated: SeparationRule = {
      id: editingRuleId,
      name: editRuleName,
      category: editRuleCategory,
      separationMinutes: editRuleMinutes,
      enabled: editRuleEnabled,
    };
    await saveSeparationRule(updated);
    await loadRules();
    setIsEditingRule(false);
    setEditingRuleId(null);
  };

  const handleDeleteRule = async (ruleId: string) => {
    await deleteSeparationRule(ruleId);
    await loadRules();
  };

  const handleGenerateSchedule = async () => {
    setIsGenerating(true);
    await loadTracks();
    await loadClocks();
    await loadRules();
    
    if (clocks.length === 0) {
      alert('No clocks available. Create a clock first.');
      setIsGenerating(false);
      return;
    }
    
    await clearSchedule();
    await generateSchedule(clocks[0].id, tracks, rules);
    await loadSchedule();
    setIsGenerating(false);
    setActiveTab('schedule');
  };

  const startEditClock = () => {
    if (!selectedClock) return;
    setEditClockName(selectedClock.name);
    setEditClockDesc(selectedClock.description);
    setIsEditingClock(true);
  };

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{Icons.scheduler}</span>
          <h2 className="text-xl font-semibold text-white">Scheduler</h2>
        </div>
        <button
          onClick={handleGenerateSchedule}
          disabled={isGenerating}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded-lg transition-colors"
        >
          {isGenerating ? 'Generating...' : 'Generate 24hr Schedule'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 border-b border-zinc-800">
        {(['clocks', 'rules', 'schedule'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg transition-colors capitalize ${
              activeTab === tab
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-zinc-400">Loading...</div>
          </div>
        ) : activeTab === 'clocks' ? (
          <div className="grid grid-cols-12 gap-6">
            {/* Clock List */}
            <div className="col-span-4 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Clocks</h3>
                <button
                  onClick={handleCreateClock}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
                >
                  + New
                </button>
              </div>
              {clocks.map((clock) => (
                <div
                  key={clock.id}
                  onClick={() => setSelectedClock(clock)}
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    selectedClock?.id === clock.id
                      ? 'bg-zinc-800 border-blue-500'
                      : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-semibold text-white">{clock.name}</div>
                  <div className="text-sm text-zinc-400">{clock.description}</div>
                  <div className="text-xs text-zinc-500 mt-1">{clock.elements.length} elements</div>
                </div>
              ))}
            </div>

            {/* Clock Editor */}
            <div className="col-span-8">
              {selectedClock ? (
                <div className="space-y-6">
                  {/* Clock Info */}
                  <div className="bg-zinc-800 rounded-lg p-6">
                    {isEditingClock ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          value={editClockName}
                          onChange={(e) => setEditClockName(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
                          placeholder="Clock Name"
                        />
                        <input
                          type="text"
                          value={editClockDesc}
                          onChange={(e) => setEditClockDesc(e.target.value)}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
                          placeholder="Description"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveClock}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setIsEditingClock(false)}
                            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xl font-bold text-white">{selectedClock.name}</h3>
                          <div className="flex gap-2">
                            <button
                              onClick={startEditClock}
                              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteClock(selectedClock.id)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <p className="text-zinc-400">{selectedClock.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Add Element */}
                  <div className="bg-zinc-800 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Add Element</h4>
                    <div className="flex gap-4">
                      <select
                        value={newElementType}
                        onChange={(e) => setNewElementType(e.target.value as ElementType)}
                        className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
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
                        value={newElementPosition}
                        onChange={(e) => setNewElementPosition(parseInt(e.target.value))}
                        className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
                        placeholder="Min"
                      />
                      <button
                        onClick={handleAddElement}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Elements Timeline */}
                  <div className="bg-zinc-800 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-white mb-4">Clock Elements</h4>
                    <div className="space-y-2">
                      {selectedClock.elements
                        .sort((a, b) => a.position - b.position)
                        .map((element) => (
                          <div
                            key={element.id}
                            className={`flex items-center justify-between p-3 rounded border ${ELEMENT_COLORS[element.type]}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono">{element.position}:00</span>
                              <span className="font-semibold capitalize">{element.type}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveElement(element.id)}
                              className="px-2 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-zinc-400">
                  Select a clock to edit
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'rules' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Separation Rules</h3>
              <button
                onClick={handleCreateRule}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded transition-colors"
              >
                + New Rule
              </button>
            </div>

            {isEditingRule && (
              <div className="bg-zinc-800 rounded-lg p-6 space-y-4">
                <h4 className="text-lg font-semibold text-white">Edit Rule</h4>
                <input
                  type="text"
                  value={editRuleName}
                  onChange={(e) => setEditRuleName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
                  placeholder="Rule Name"
                />
                <input
                  type="text"
                  value={editRuleCategory}
                  onChange={(e) => setEditRuleCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
                  placeholder="Category (artist, track, jingle, etc.)"
                />
                <input
                  type="number"
                  value={editRuleMinutes}
                  onChange={(e) => setEditRuleMinutes(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-white"
                  placeholder="Separation (minutes)"
                />
                <label className="flex items-center gap-2 text-white">
                  <input
                    type="checkbox"
                    checked={editRuleEnabled}
                    onChange={(e) => setEditRuleEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Enabled
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveRule}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingRule(false);
                      setEditingRuleId(null);
                    }}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-4 rounded-lg border ${
                    rule.enabled ? 'bg-zinc-800 border-zinc-700' : 'bg-zinc-800/50 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold text-white">{rule.name}</h4>
                        {!rule.enabled && (
                          <span className="text-xs px-2 py-1 bg-zinc-700 text-zinc-400 rounded">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">
                        Category: <span className="text-white">{rule.category}</span> • Separation:{' '}
                        <span className="text-white">{rule.separationMinutes} minutes</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditRule(rule)}
                        className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Generated Schedule</h3>
              <button
                onClick={() => clearSchedule().then(loadSchedule)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                Clear Schedule
              </button>
            </div>

            {schedule.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                No schedule generated. Click "Generate 24hr Schedule" to create one.
              </div>
            ) : (
              <div className="bg-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-zinc-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-white">Time</th>
                      <th className="px-4 py-3 text-left text-white">Type</th>
                      <th className="px-4 py-3 text-left text-white">Content</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((entry, idx) => (
                      <tr key={idx} className="border-t border-zinc-700">
                        <td className="px-4 py-3 text-white font-mono">
                          {new Date(entry.scheduledTime).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-sm capitalize ${
                              ELEMENT_COLORS[entry.type as ElementType]
                            }`}
                          >
                            {entry.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {entry.trackId ? `Track: ${entry.trackId.slice(0, 8)}...` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulerView;
