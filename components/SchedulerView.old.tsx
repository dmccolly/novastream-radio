
import React, { useState } from 'react';
import { Icons } from '../constants';

interface ScheduleEntry {
  id: string;
  time: string;
  title: string;
  host: string;
  type: 'live' | 'automated' | 'commercial';
}

const SchedulerView: React.FC = () => {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([
    { id: '1', time: '08:00', title: 'The Morning Brew', host: 'DJ Spark', type: 'live' },
    { id: '2', time: '10:00', title: 'Top 40 Countdown', host: 'AI Host Kore', type: 'automated' },
    { id: '3', time: '12:00', title: 'Midday Jazz', host: 'Sarah Jenkins', type: 'live' },
    { id: '4', time: '14:00', title: 'Tech Talk Weekly', host: 'Marc Digital', type: 'automated' },
    { id: '5', time: '16:00', title: 'Evening Rush', host: 'Alex Rivera', type: 'live' },
    { id: '6', time: '19:00', title: 'Deep Space Beats', host: 'Nebula', type: 'automated' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Program Schedule</h2>
          <p className="text-sm text-zinc-500">Plan your station broadcasts</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-bold border border-zinc-700 transition-all">
            Export XML
          </button>
          <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2">
            <Icons.Calendar />
            Generate Week
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {schedule.map((entry) => (
          <div key={entry.id} className="group relative flex items-center gap-6 p-6 bg-[#18181b] border border-zinc-800 rounded-3xl hover:border-blue-500/30 transition-all cursor-pointer shadow-lg overflow-hidden">
            {entry.type === 'live' && (
              <div className="absolute top-0 right-0 p-4">
                <span className="text-[10px] font-bold uppercase tracking-tighter bg-red-600 text-white px-2 py-0.5 rounded shadow-[0_0_10px_rgba(220,38,38,0.5)]">Studio Live</span>
              </div>
            )}
            {entry.type === 'automated' && (
              <div className="absolute top-0 right-0 p-4">
                <span className="text-[10px] font-bold uppercase tracking-tighter bg-blue-600 text-white px-2 py-0.5 rounded shadow-[0_0_10px_rgba(37,99,235,0.5)]">AI Automated</span>
              </div>
            )}
            
            <div className="text-3xl font-mono font-bold text-zinc-800 group-hover:text-blue-500 transition-colors w-24">
              {entry.time}
            </div>

            <div className="flex-1">
              <h4 className="text-lg font-bold text-zinc-100 mb-1 group-hover:translate-x-1 transition-transform">{entry.title}</h4>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Icons.Mic />
                {entry.host}
              </div>
            </div>

            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </button>
              <button className="p-2.5 bg-zinc-800 hover:bg-red-900/30 rounded-xl border border-zinc-700 text-zinc-400 hover:text-red-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="bg-zinc-900/30 border border-zinc-800 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center gap-4 text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/20 transition-all cursor-pointer">
        <div className="p-4 bg-zinc-800 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
        <span className="font-bold text-sm tracking-widest uppercase">Add New Program Segment</span>
      </div>
    </div>
  );
};

export default SchedulerView;
