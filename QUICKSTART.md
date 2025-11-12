# 🚀 Quick Start Guide

## Installation & Setup (5 minutes)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Start the Backend Server
```bash
npm start
```

You should see:
```
✅ Server is running on http://localhost:3000
📡 API endpoints:
   - GET /video-info?videoId=VIDEO_ID
   - GET /download?videoId=VIDEO_ID
   - GET /search?query=SEARCH_QUERY
   - GET /health
```

### Step 3: Open the Website
- Open `index.html` in your browser
- Or use VS Code Live Server extension

## 🎯 Usage Examples

### 1️⃣ Download by URL
```
1. Copy a YouTube URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ
2. Paste in the top input field
3. Click "Add to Library"
4. Video appears in your library below
```

### 2️⃣ Search for Videos
```
1. Type keywords in search box (e.g., "music")
2. Click "Search"
3. Click download icon on search results
4. Videos added to library
```

### 3️⃣ Watch Videos
```
1. Click play button (▶) on any library video
2. Video opens in fullscreen player
3. Click minimize to watch in corner
4. Click X to close
```

### 4️⃣ Download to Device
```
1. Find video in your library
2. Click "Download" button
3. Video downloads as MP4 to your computer
4. Check your Downloads folder
```

## 🔍 Testing the Server

Test if server is running:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","message":"YouTube Downloader API is running"}
```

## ⚠️ Troubleshooting

### Server won't start
- Make sure Node.js is installed: `node --version`
- Delete `node_modules` and run `npm install` again
- Check if port 3000 is already in use

### Downloads not working
- Make sure server is running on http://localhost:3000
- Check browser console (F12) for errors
- Verify the video URL is valid

### Videos won't play
- Check your internet connection
- Try a different YouTube video
- Clear browser cache

## 📱 Mobile Testing

The site is responsive! Test on mobile by:
1. Find your computer's IP address
2. Start the server
3. Open `http://YOUR_IP:3000` on mobile browser

## 🎓 Advanced

### Change Server Port
Edit `server.js`:
```javascript
const PORT = 3000; // Change to your preferred port
```

Also update in `script.js`:
```javascript
const API_URL = 'http://localhost:3000'; // Match server port
```

### Deploy to Production
1. Use a hosting service (Heroku, Railway, etc.)
2. Update `API_URL` in script.js to your production URL
3. Add environment variables for sensitive data

---

**Happy downloading! 🎉**
