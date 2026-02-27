## YouTube Downloader & Library

This project lets you search, preview, download, and save YouTube videos to a simple library.

There are two ways to run it:

### 1. Local mode (recommended)

Local mode uses the bundled Flask backend and `yt-dlp` for reliable downloads and format selection.

1. Install Python 3 and `ffmpeg` (for best quality and audio+video merging).
2. Install Python dependencies:

```bash
pip install flask yt-dlp requests
```

3. Start the backend from the project folder:

```bash
python server.py
```

4. Open your browser at:

- `http://127.0.0.1:8000` or
- `http://localhost:8000`

In local mode:

- `config.js` has `CONFIG.mode = 'local'`.
- The frontend talks to Flask endpoints such as `/api/info`, `/api/download-start`, `/api/download-progress/<job_id>`, and `/api/download-file/<job_id>`.
- You can optionally place a `cookies.txt` file in the project folder (or upload it via the UI) to enable age‑restricted or authenticated downloads.

### 2. Piped (static) mode

Piped mode is intended for static hosting (for example GitHub Pages) where you **do not** run the Flask backend. Downloads and metadata come from public Piped API instances.

To enable Piped mode:

1. Edit `config.js` and set:

```js
mode: 'piped',
```

2. Serve the static files (`index.html`, `script.js`, `config.js`, `styles.css`) from any static host.

In Piped mode:

- The frontend calls the Piped API instances defined in `CONFIG.pipedInstances`.
- The cookie banner is hidden, because no local `cookies.txt` is needed.

### Switching modes

- **Local development / personal use** → keep `CONFIG.mode = 'local'` and run `python server.py`.
- **Static hosting without a backend** → set `CONFIG.mode = 'piped'` and deploy the static files.

You only need to change the `mode` value in `config.js` when switching between these two setups.

# YouTube Downloader & Library

A modern, fully-featured YouTube video downloader and library manager built with pure HTML, CSS, and JavaScript.

## ✨ Features

### 1. 📥 Download Videos
- Enter YouTube URL or video ID
- View video preview with thumbnail, title, uploader
- Save to library, download, or watch instantly

### 2. 🔍 Search Videos
- Search YouTube videos by name/keywords
- Browse search results with thumbnails
- Add any video to your library
- Play videos directly from search results

### 3. 📚 Video Library
- Save videos to your personal library
- Stored locally in browser (localStorage)
- Watch videos anytime with embedded player
- Download videos from library
- Remove individual videos or clear entire library

### 4. ▶️ Watch Videos
- Embedded YouTube player
- Full-screen support
- Autoplay option
- Clean, modal-based viewing experience

## 🚀 How to Use

### Method 1: Open Directly
Simply open `index.html` in your web browser.

### Method 2: Use a Local Server
```bash
# Using Python 3
python3 -m http.server 8000

# Using PHP
php -S localhost:8000

# Using Node.js (http-server)
npx http-server
```

Then visit: `http://localhost:8000`

## 📖 Usage Guide

### Download by URL:
1. Go to the **Download** tab
2. Paste a YouTube URL (e.g., `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
3. Click "Get Video"
4. Choose to Save, Download, or Watch

### Search Videos:
1. Go to the **Search** tab
2. Enter keywords
3. Click "Search"
4. Browse results and add to library or watch

### Manage Library:
1. Go to the **Library** tab
2. View all your saved videos
3. Watch videos with embedded player
4. Download or remove videos
5. Clear entire library if needed

## 🎨 Features Breakdown

### Video Information Display
- Thumbnail preview
- Video title
- Uploader name
- Duration
- View count

### Library Features
- Persistent storage (localStorage)
- Save unlimited videos
- Quick access to all saved content
- One-click watch and download
- Easy removal

### User Interface
- Modern, gradient design
- Responsive layout (mobile-friendly)
- Tab-based navigation
- Smooth animations
- Status messages for user feedback

## ⚙️ Technical Details

### Built With
- **HTML5** - Structure
- **CSS3** - Styling with gradients, animations, flexbox, grid
- **Vanilla JavaScript** - All functionality, no frameworks

### Data Storage
- Uses browser's `localStorage` for library
- No backend required for library features
- Videos persist across sessions

### Video Integration
- YouTube oEmbed API for video info
- YouTube iframe player for playback
- Direct YouTube links for downloading

## 🔧 Supported URL Formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- Direct video ID: `VIDEO_ID`

## 📱 Browser Compatibility

Works on all modern browsers:
- ✅ Chrome
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Opera

## ⚠️ Important Notes

### About Downloads:
- Direct video file download requires a backend server
- Current version opens videos in new tab for download
- To enable actual MP4 downloads, you need:
  - Python backend with yt-dlp
  - Or browser extension
  - Or third-party API

### About Search:
- Search currently shows mock results for demonstration
- For real YouTube search, you need:
  - YouTube Data API v3 key
  - Backend server to proxy API requests

### Privacy:
- All library data stored locally in your browser
- No data sent to external servers
- Clear browser data to remove library

## 🚀 Enhancement Options

To enable full functionality, you can add:

1. **Python Backend** (yt-dlp):
   - Real video downloads
   - Actual search functionality
   - Video format selection

2. **YouTube Data API**:
   - Real-time search
   - Accurate video metadata
   - Trending videos

3. **Database**:
   - Sync library across devices
   - User accounts
   - Shared playlists

## 📄 Files

- `index.html` - Main HTML structure
- `styles.css` - All styling
- `script.js` - Complete functionality
- `README.md` - This file

## 🎯 Quick Start

1. Download all files to a folder
2. Open `index.html` in your browser
3. Try these examples:
   - Paste: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - Search: "music video"
   - Save videos to library
   - Watch videos in the player

## 💡 Tips

- Use the **Library** to organize your favorite videos
- **Watch** videos without leaving the page
- **Search** for multiple videos and add them all
- Library persists even after closing the browser

---

**Made with ❤️ using HTML, CSS, and JavaScript**

Enjoy your YouTube video library! 🎬
