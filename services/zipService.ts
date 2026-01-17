
import JSZip from 'jszip';

const FILE_LIST = [
  'index.html',
  'index.tsx',
  'App.tsx',
  'types.ts',
  'constants.tsx',
  'manifest.json',
  'metadata.json',
  'package.json',
  'netlify.toml',
  'sw.js',
  'README.md',
  'services/stationService.ts',
  'services/dropboxService.ts',
  'services/githubService.ts',
  'services/geminiService.ts',
  'services/zipService.ts',
  'components/Sidebar.tsx',
  'components/ClockPanel.tsx',
  'components/Visualizer.tsx',
  'components/LibraryView.tsx',
  'components/SchedulerView.tsx',
  'components/StreamerView.tsx',
  'components/MasterControl.tsx',
  'components/SettingsView.tsx'
];

export const downloadProjectZip = async (onProgress: (msg: string) => void) => {
  const zip = new JSZip();
  onProgress(">> INITIALIZING_ZIP_BUNDLE...");

  for (const path of FILE_LIST) {
    try {
      onProgress(`>> PACKING: ${path}`);
      // Use a cache-busting timestamp to ensure we get the latest code
      const response = await fetch(`./${path}?t=${Date.now()}`);
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const content = await response.text();
      zip.file(path, content);
    } catch (e: any) {
      onProgress(`!! SKIP_FAILED: ${path} (${e.message})`);
      // Create a dummy file if fetch fails so the structure remains
      zip.file(path, `// Error loading ${path}: ${e.message}`);
    }
  }

  onProgress(">> COMPRESSING_FOR_MANUS...");
  const blob = await zip.generateAsync({ 
    type: 'blob',
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NovaStream_Radio_Full_Source.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  onProgress(">> ZIP_EXPORT_COMPLETE: GIVE THIS TO MANUS NOW");
};
