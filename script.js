// YouTube Video Downloader Script with Library & Search

// Configuration
const API_URL = 'http://localhost:3000'; // Backend server URL

// Video Library Management
class VideoLibrary {
    constructor() {
        this.videos = this.loadVideos();
    }

    loadVideos() {
        const stored = localStorage.getItem('videoLibrary');
        return stored ? JSON.parse(stored) : [];
    }

    saveVideos() {
        localStorage.setItem('videoLibrary', JSON.stringify(this.videos));
    }

    addVideo(videoData) {
        // Check if video already exists
        const exists = this.videos.find(v => v.id === videoData.id);
        if (!exists) {
            this.videos.unshift(videoData);
            this.saveVideos();
            return true;
        }
        return false;
    }

    removeVideo(videoId) {
        this.videos = this.videos.filter(v => v.id !== videoId);
        this.saveVideos();
    }

    getVideos() {
        return this.videos;
    }
}

const library = new VideoLibrary();

document.addEventListener('DOMContentLoaded', function () {
    const downloadBtn = document.getElementById('downloadBtn');
    const videoURL = document.getElementById('videoURL');
    const message = document.getElementById('message');
    const searchBtn = document.getElementById('searchBtn');
    const searchQuery = document.getElementById('searchQuery');
    const searchResults = document.getElementById('searchResults');
    const libraryGrid = document.getElementById('libraryGrid');
    const videoPlayer = document.getElementById('videoPlayer');
    const playerContainer = document.getElementById('playerContainer');
    const closePlayer = document.getElementById('closePlayer');
    const minimizePlayer = document.getElementById('minimizePlayer');

    // Initialize library display
    displayLibrary();

    // Add enter key support
    videoURL.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleDownload();
        }
    });

    searchQuery.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });

    downloadBtn.addEventListener('click', handleDownload);
    searchBtn.addEventListener('click', handleSearch);
    closePlayer.addEventListener('click', closeVideoPlayer);
    minimizePlayer.addEventListener('click', function () {
        playerContainer.classList.toggle('minimized');
    });



    function handleDownload() {
        const url = videoURL.value.trim();

        // Clear previous messages
        message.textContent = '';
        message.className = '';

        // Validate URL
        if (!url) {
            showMessage('Please enter a YouTube URL', 'error');
            return;
        }

        if (!isValidYouTubeURL(url)) {
            showMessage('Please enter a valid YouTube URL', 'error');
            return;
        }

        // Show loading state
        downloadBtn.disabled = true;
        const originalText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '<svg class="btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg><span>Processing...</span>';

        // Extract video ID
        const videoId = extractVideoID(url);
        if (videoId) {
            // Fetch video info from backend
            fetch(`${API_URL}/video-info?videoId=${videoId}`)
                .then(response => response.json())
                .then(data => {
                    const videoData = {
                        id: videoId,
                        title: data.title || `YouTube Video - ${videoId}`,
                        thumbnail: data.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                        url: url,
                        addedDate: new Date().toISOString(),
                        duration: data.duration || 'Unknown'
                    };

                    const added = library.addVideo(videoData);
                    if (added) {
                        showMessage(`✅ "${videoData.title}" added to library!`, 'success');
                        displayLibrary();
                    } else {
                        showMessage('ℹ️ This video is already in your library.', 'info');
                    }

                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = originalText;
                    videoURL.value = '';
                })
                .catch(error => {
                    console.error('Error fetching video info:', error);
                    // Fallback: add with basic info
                    const videoData = {
                        id: videoId,
                        title: `YouTube Video - ${videoId}`,
                        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                        url: url,
                        addedDate: new Date().toISOString()
                    };

                    const added = library.addVideo(videoData);
                    if (added) {
                        showMessage(`✅ Video added to library! (Server offline - using default info)`, 'warning');
                        displayLibrary();
                    } else {
                        showMessage('ℹ️ This video is already in your library.', 'info');
                    }

                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = originalText;
                    videoURL.value = '';
                });
        }
    }

    async function downloadVideo(videoId, title) {
        try {
            showMessage('🔄 Starting download...', 'info');

            const response = await fetch(`${API_URL}/download?videoId=${videoId}`);

            if (!response.ok) {
                throw new Error('Download failed');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.mp4`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showMessage(`✅ "${title}" downloaded successfully!`, 'success');
        } catch (error) {
            console.error('Download error:', error);
            showMessage(`❌ Download failed. Make sure the backend server is running at ${API_URL}`, 'error');
        }
    } function handleSearch() {
        const query = searchQuery.value.trim();

        if (!query) {
            showMessage('Please enter a search query', 'error');
            return;
        }

        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';

        // Simulate YouTube search (in production, use YouTube Data API)
        setTimeout(() => {
            const mockResults = generateMockSearchResults(query);
            displaySearchResults(mockResults);
            searchBtn.disabled = false;
            searchBtn.textContent = 'Search';
        }, 800);
    }

    function generateMockSearchResults(query) {
        // Generate mock video IDs for demonstration
        const mockVideoIds = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', 'kJQP7kiw5Fk', '9bZkp7q19f0', 'oHg5SJYRHA0'];

        return mockVideoIds.slice(0, 3).map((id, index) => ({
            id: id,
            title: `${query} - Result ${index + 1}`,
            thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${id}`,
            views: `${Math.floor(Math.random() * 10000000).toLocaleString()} views`
        }));
    }

    function displaySearchResults(results) {
        searchResults.innerHTML = '';

        if (results.length === 0) {
            searchResults.innerHTML = '<p class="no-results">No results found</p>';
            return;
        }

        results.forEach(video => {
            const videoCard = createSearchResultCard(video);
            searchResults.appendChild(videoCard);
        });
    }

    function createSearchResultCard(video) {
        const card = document.createElement('div');
        card.className = 'search-result-card';
        card.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}" class="result-thumbnail">
            <div class="result-info">
                <h3 class="result-title">${video.title}</h3>
                <p class="result-meta">${video.views}</p>
            </div>
            <button class="add-to-library-btn" data-video='${JSON.stringify(video)}'>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
            </button>
        `;

        const addBtn = card.querySelector('.add-to-library-btn');
        // Ensure button behaves like a button for accessibility
        addBtn.type = 'button';
        addBtn.addEventListener('click', function () {
            const videoData = JSON.parse(this.dataset.video);
            videoData.addedDate = new Date().toISOString();
            const added = library.addVideo(videoData);

            if (added) {
                showMessage(`✅ "${videoData.title}" added to library!`, 'success');
                displayLibrary();
                this.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
                this.disabled = true;
            } else {
                showMessage('ℹ️ This video is already in your library.', 'info');
            }
        });

        return card;
    }

    function displayLibrary() {
        const videos = library.getVideos();
        libraryGrid.innerHTML = '';

        if (videos.length === 0) {
            libraryGrid.innerHTML = '<p class="no-videos">No videos in library yet. Add some videos to get started!</p>';
            return;
        }

        videos.forEach(video => {
            const card = createLibraryCard(video);
            libraryGrid.appendChild(card);
        });
    }

    function createLibraryCard(video) {
        const card = document.createElement('div');
        card.className = 'library-card';
        card.innerHTML = `
            <div class="card-thumbnail" style="background-image: url('${video.thumbnail}')">
                <button class="play-btn" data-video-id="${video.id}">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                </button>
            </div>
            <div class="card-content">
                <h3 class="card-title">${video.title}</h3>
                <p class="card-date">Added: ${new Date(video.addedDate).toLocaleDateString()}</p>
                <div class="card-actions">
                    <button class="download-video-btn" data-video-id="${video.id}" data-title="${video.title}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </button>
                    <button class="remove-btn" data-video-id="${video.id}">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        Remove
                    </button>
                </div>
            </div>
        `;

        const playBtn = card.querySelector('.play-btn');
        // accessibility: explicit button role
        playBtn.type = 'button';
        playBtn.addEventListener('click', function () {
            playVideo(this.dataset.videoId);
        });

        const downloadVideoBtn = card.querySelector('.download-video-btn');
        downloadVideoBtn.type = 'button';
        downloadVideoBtn.addEventListener('click', function () {
            downloadVideo(this.dataset.videoId, this.dataset.title);
        });

        const removeBtn = card.querySelector('.remove-btn');
        removeBtn.type = 'button';
        removeBtn.addEventListener('click', function () {
            if (confirm('Remove this video from library?')) {
                library.removeVideo(this.dataset.videoId);
                displayLibrary();
                showMessage('Video removed from library', 'info');
            }
        });

        return card;
    }

    function playVideo(videoId) {
        videoPlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        playerContainer.classList.add('active');
        playerContainer.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function minimizePlayer() {
        playerContainer.classList.toggle('minimized');
    }

    function closeVideoPlayer() {
        videoPlayer.src = '';
        playerContainer.classList.remove('active');
        playerContainer.classList.remove('minimized');
        playerContainer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }

    function isValidYouTubeURL(url) {
        // YouTube URL patterns
        const patterns = [
            /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
            /^(https?:\/\/)?(www\.)?youtu\.be\/[\w-]+/,
            /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
            /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/
        ];

        return patterns.some(pattern => pattern.test(url));
    }

    function extractVideoID(url) {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/
        ];

        for (let pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                return match[1];
            }
        }
        return null;
    }

    function showMessage(text, type) {
        message.textContent = text;
        message.className = `message ${type}`;
    }
});
