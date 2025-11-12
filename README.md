# YouTube Video Downloader

A full-featured YouTube video downloader with library management, search functionality, and embedded playback.

## ✨ Features

- 📥 **Download Videos** - Download YouTube videos to your device
- 📚 **Video Library** - Save videos to your personal library (stored in browser)
- 🔍 **YouTube Search** - Search for videos by name
- ▶️ **Embedded Player** - Watch videos directly in the browser
- 💾 **Persistent Storage** - Library persists using localStorage
- 📱 **Responsive Design** - Works on desktop and mobile devices
- ⬇️ **Real Downloads** - Download videos from your library to your computer

## 🚀 Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Setup Instructions

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the backend server**
   ```bash
   npm start
   ```
   
   The server will run on `http://localhost:3000`

4. **Open the website**
   - Open `index.html` in your browser, or
   - Use a local server like Live Server (VS Code extension)

## 📖 How to Use

### Adding Videos by URL
1. Paste a YouTube URL in the input field
2. Click "Add to Library"
3. Video will be saved to your library

### Searching for Videos
1. Enter keywords in the search box
2. Click "Search"
3. Browse results and click the download icon to add to library

### Playing Videos
1. Click the play button on any video in your library
2. Video opens in fullscreen player
3. Use minimize button to watch in corner while browsing
4. Click X to close player

### Downloading Videos
1. Click the "Download" button on any video in your library
2. Video will download to your device as MP4
3. Progress shown in status messages

## 🛠️ Technical Details

### Frontend
- Pure HTML, CSS, JavaScript
- LocalStorage for persistent library
- Responsive design with CSS Grid
- SVG icons

### Backend (Node.js + Express)
- `ytdl-core` for YouTube video downloading
- CORS enabled for frontend communication
- REST API endpoints

### API Endpoints

- `GET /video-info?videoId=VIDEO_ID` - Get video metadata
- `GET /download?videoId=VIDEO_ID` - Download video file
- `GET /search?query=SEARCH_QUERY` - Search YouTube (mock)
- `GET /health` - Server health check

## ⚠️ Important Notes

### Legal Disclaimer
- Respect YouTube's Terms of Service
- Only download videos you have permission to download
- This tool is for educational purposes
- Consider copyright laws in your jurisdiction

### Technical Limitations
- Downloads require the backend server running
- Search uses mock data (can integrate YouTube Data API v3)
- Download speed depends on video quality and internet connection

## 🔧 Configuration

Edit `script.js` to change the API URL:
```javascript
const API_URL = 'http://localhost:3000';
```

## 📦 Dependencies

- **express** - Web server framework
- **cors** - Enable CORS
- **ytdl-core** - YouTube video downloader
- **nodemon** - Development auto-restart (optional)

## 🤝 Contributing

Feel free to fork this project and submit pull requests for improvements!

## 📄 License

MIT License - feel free to use for personal or educational purposes.

---

**Note**: Make sure the backend server is running before using download features. The website will work for playback and library management even without the server, but downloads require the backend.
