// Mobile-responsive updates for App.tsx
// Key changes:
// 1. Add mobile menu toggle state
// 2. Hide sidebar on mobile, show hamburger menu
// 3. Responsive padding and spacing
// 4. Touch-friendly button sizes
// 5. Responsive grid layouts

// Add to App component state:
const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

// Add hamburger button before main content:
<button 
  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
  className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-zinc-900 rounded-xl border border-zinc-800"
>
  <Icons.Menu />
</button>

// Update Sidebar wrapper:
<div className={`
  fixed lg:relative inset-y-0 left-0 z-40
  transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
  lg:translate-x-0 transition-transform duration-300
`}>
  <Sidebar 
    activeTab={activeTab} 
    setActiveTab={(tab) => {
      setActiveTab(tab);
      setIsMobileMenuOpen(false); // Close menu on mobile after selection
    }} 
    canInstall={!!deferredPrompt} 
    onInstall={handleInstall} 
  />
</div>

// Update main content padding for mobile:
<main className="flex-1 overflow-hidden relative">
  <div className="h-full overflow-y-auto custom-scrollbar p-4 sm:p-8 lg:p-12">
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-12 pb-24">
      {/* Content */}
    </div>
  </div>
</main>

// Update studio layout for mobile:
{activeTab === 'studio' && (
  <div className="flex flex-col gap-4 sm:gap-8">
    <ClockPanel />
    <div className="bg-[#0a0a0c] p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-zinc-900">
      <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-2">Signal Route</div>
      <div className="text-xs font-black text-blue-500">DIRECT_MODE</div>
    </div>
  </div>
)}

// Update player card for mobile:
<div className="bg-[#0a0a0c] rounded-2xl sm:rounded-[4.5rem] p-6 sm:p-16 border-2 border-zinc-900">
  <div className="flex flex-col items-center gap-6 sm:gap-16">
    <div className="w-48 h-48 sm:w-80 sm:h-80 rounded-2xl sm:rounded-[4rem] overflow-hidden border-4 border-zinc-900">
      <img src={tracks[currentTrackIndex]?.coverUrl} className="w-full h-full object-cover" alt="Cover" />
    </div>
    <div className="w-full text-center sm:text-left">
      <h1 className="text-2xl sm:text-6xl font-black uppercase truncate">{tracks[currentTrackIndex]?.title}</h1>
      <p className="text-zinc-500 text-xs sm:text-sm mt-2 sm:mt-4">{tracks[currentTrackIndex]?.artist}</p>
      <AtomicProgressBar audioRef={audioRef} />
    </div>
  </div>
</div>
