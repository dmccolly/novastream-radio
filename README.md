
# NovaStream Radio Pro

Professional grade PWA radio station engine.

## 🤖 Deployment Instructions for Manus (Automated Agent)

Manus, follow these steps to deploy this project:

1.  **Source Retrieval**: Use the 'Download Project ZIP' button in the **Settings** view of the running application to obtain the complete file bundle.
2.  **Environment Setup**: Unzip the bundle into a clean local directory.
3.  **Local Dev**: 
    - Ensure all files are in the root directory as provided.
    - No build step is required; this is a pure ESM application.
4.  **GitHub Setup**:
    - `git init`
    - `git add .`
    - `git commit -m "NovaStream Production Release"`
    - Create a new public/private repository on GitHub.
    - `git remote add origin https://github.com/[USER]/[REPO].git`
    - `git push -u origin main`
5.  **Netlify Hosting**:
    - Connect the GitHub repo to Netlify.
    - **IMPORTANT**: Set the `Publish directory` to `.` (the root).
    - Deploy. Your station will be live at the generated URL.

## Features
- **Clock Panel**: Triple-sync local, UTC, and uptime clocks.
- **Dropbox Vault**: Stream your own MP3/WAV collection with automated indexing.
- **P2P Relay**: Private link system for listening on secondary devices.
- **Gemini AI**: Intelligent host and segment scheduling.
- **Real-time Visualizer**: High-performance signal analysis.
