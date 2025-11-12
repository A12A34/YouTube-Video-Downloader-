const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const path = require('path');
const app = express();
const PORT = 3000;

// Enable CORS for frontend requests
app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// Get video information
app.get('/video-info', async (req, res) => {
    try {
        const { videoId } = req.query;

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;

        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get video info
        const info = await ytdl.getInfo(url);

        res.json({
            title: info.videoDetails.title,
            thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
            duration: info.videoDetails.lengthSeconds,
            author: info.videoDetails.author.name,
            viewCount: info.videoDetails.viewCount
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video information' });
    }
});

// Download video
app.get('/download', async (req, res) => {
    try {
        const { videoId } = req.query;

        if (!videoId) {
            return res.status(400).json({ error: 'Video ID is required' });
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;

        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get video info for filename
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');

        // Stream the video
        ytdl(url, {
            quality: 'highest',
            filter: 'audioandvideo'
        }).pipe(res);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download video' });
    }
});

// Search YouTube videos (using mock data for now - you can integrate YouTube Data API)
app.get('/search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Mock search results
        // In production, integrate YouTube Data API v3
        const mockResults = [
            { id: 'dQw4w9WgXcQ', title: `${query} - Result 1`, views: '1.2B views' },
            { id: 'jNQXAC9IVRw', title: `${query} - Result 2`, views: '500M views' },
            { id: 'kJQP7kiw5Fk', title: `${query} - Result 3`, views: '200M views' }
        ];

        res.json(mockResults);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'YouTube Downloader API is running' });
});

app.listen(PORT, () => {
    console.log(`✅ Server is running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints:`);
    console.log(`   - GET /video-info?videoId=VIDEO_ID`);
    console.log(`   - GET /download?videoId=VIDEO_ID`);
    console.log(`   - GET /search?query=SEARCH_QUERY`);
    console.log(`   - GET /health`);
});
