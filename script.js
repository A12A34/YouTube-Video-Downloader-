// Video Library Storage
class VideoLibrary {
    constructor() {
        this.storageKey = 'youtube_library';
        this.videos = this.loadFromStorage();
    }

    loadFromStorage() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : [];
    }

    saveToStorage() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.videos));
        updateLibraryCount();
    }

    add(video) {
        const exists = this.videos.some(v => v.id === video.id);
        if (!exists) {
            this.videos.unshift({
                ...video,
                savedAt: new Date().toISOString()
            });
            this.saveToStorage();
            return true;
        }
        return false;
    }

    remove(videoId) {
        this.videos = this.videos.filter(v => v.id !== videoId);
        this.saveToStorage();
    }

    clear() {
        this.videos = [];
        this.saveToStorage();
    }

    getAll() {
        return this.videos;
    }
}

const library = new VideoLibrary();
let currentVideo = null;

document.addEventListener('DOMContentLoaded', () => {
    displayLibrary();
    updateLibraryCount();

    // Event listeners for inputs
    const downloadInput = document.getElementById('downloadInput');
    const searchInput = document.getElementById('searchInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const searchBtn = document.getElementById('searchBtn');

    if (downloadInput) {
        downloadInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') getVideoInfo();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchVideos();
        });
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', getVideoInfo);
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', searchVideos);
    }

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(btn.dataset.tab);
        });
    });

    // Close modal on Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePlayer();
    });
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const tabEl = document.getElementById(tabName);
    if (tabEl) tabEl.classList.add('active');

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
}

function formatDuration(seconds) {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(count) {
    if (!count) return 'Unknown';
    if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
    if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
    return count.toString();
}

function showStatus(elementId, message, type = 'info') {
    const statusEl = document.getElementById(elementId);
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = `status-message show ${type}`;
    setTimeout(() => statusEl.classList.remove('show'), 5000);
}

async function getVideoInfo() {
    const input = document.getElementById('downloadInput').value.trim();

    if (!input) {
        showStatus('downloadStatus', 'Please enter a YouTube URL or video name', 'error');
        return;
    }

    const btn = document.getElementById('downloadBtn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    btn.disabled = true;
    if (btnText) btnText.textContent = 'Loading...';
    if (spinner) spinner.classList.remove('hidden');

    const previewEl = document.getElementById('videoPreview');
    if (previewEl) previewEl.classList.add('hidden');

    const videoId = extractVideoId(input);

    if (videoId) {
        await fetchVideoInfo(videoId);
    } else {
        await searchAndGetFirst(input);
    }

    btn.disabled = false;
    if (btnText) btnText.textContent = 'Get Video';
    if (spinner) spinner.classList.add('hidden');
}

async function fetchVideoInfo(videoId) {
    try {
        const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Video not found or unavailable');
        const data = await response.json();
        currentVideo = {
            id: videoId,
            title: data.title,
            uploader: data.author_name,
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            duration: 0,
            views: 0
        };
        displayVideoPreview(currentVideo);
        showStatus('downloadStatus', 'Video information loaded!', 'success');
    } catch (error) {
        showStatus('downloadStatus', `Error: ${error.message}`, 'error');
    }
}

async function searchAndGetFirst(query) {
    showStatus('downloadStatus', 'Please enter a valid YouTube URL instead. Search feature requires YouTube API key.', 'error');
}

function displayVideoPreview(video) {
    if (!video) return;

    const thumbnail = document.getElementById('previewThumbnail');
    const title = document.getElementById('previewTitle');
    const uploader = document.getElementById('previewUploader');
    const duration = document.getElementById('previewDuration');
    const views = document.getElementById('previewViews');
    const preview = document.getElementById('videoPreview');

    if (thumbnail) thumbnail.src = video.thumbnail;
    if (title) title.textContent = video.title;
    if (uploader) uploader.textContent = video.uploader || 'Unknown';
    if (duration) duration.textContent = video.duration ? formatDuration(video.duration) : 'Unknown';
    if (views) views.textContent = video.views ? formatViews(video.views) : 'Unknown';
    if (preview) preview.classList.remove('hidden');
}

function saveToLibrary() {
    if (!currentVideo) {
        showStatus('downloadStatus', 'No video selected', 'error');
        return;
    }

    const added = library.add(currentVideo);

    if (added) {
        showStatus('downloadStatus', `✓ "${currentVideo.title}" added to library!`, 'success');
        displayLibrary();
    } else {
        showStatus('downloadStatus', 'This video is already in your library', 'info');
    }
}

function downloadVideo() {
    if (!currentVideo) {
        showStatus('downloadStatus', 'No video selected', 'error');
        return;
    }

    showStatus('downloadStatus', 'Opening video URL (actual download requires backend server)...', 'info');
    window.open(currentVideo.url, '_blank');
}

function watchVideo() {
    if (!currentVideo) {
        showStatus('downloadStatus', 'No video selected', 'error');
        return;
    }

    playVideoInModal(currentVideo);
}

async function searchVideos() {
    const query = document.getElementById('searchInput').value.trim();

    if (!query) {
        showStatus('searchStatus', 'Please enter a search query', 'error');
        return;
    }

    const btn = document.getElementById('searchBtn');
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    btn.disabled = true;
    if (btnText) btnText.textContent = 'Searching...';
    if (spinner) spinner.classList.remove('hidden');

    setTimeout(() => {
        const mockResults = generateMockSearchResults(query);
        displaySearchResults(mockResults);

        btn.disabled = false;
        if (btnText) btnText.textContent = 'Search';
        if (spinner) spinner.classList.add('hidden');

        showStatus('searchStatus', `Found ${mockResults.length} results (Mock data - requires YouTube API for real search)`, 'info');
    }, 1000);
}

function generateMockSearchResults(query) {
    const mockVideoIds = [
        'dQw4w9WgXcQ',
        'jNQXAC9IVRw',
        'kJQP7kiw5Fk',
        '9bZkp7q19f0',
        'oHg5SJYRHA0',
        'L_jWHffIx5E'
    ];

    return mockVideoIds.map((id, index) => ({
        id: id,
        title: `${query} - Result ${index + 1}`,
        uploader: 'Sample Channel',
        thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${id}`,
        duration: Math.floor(Math.random() * 600),
        views: Math.floor(Math.random() * 10000000)
    }));
}

function displaySearchResults(results) {
    const container = document.getElementById('searchResults');
    if (!container) return;

    container.innerHTML = '';

    if (results.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No results found</p></div>';
        return;
    }

    results.forEach(video => {
        const card = createResultCard(video);
        container.appendChild(card);
    });
}

function createResultCard(video) {
    const card = document.createElement('div');
    card.className = 'result-card';

    card.innerHTML = `
        <img src="${video.thumbnail}" alt="${video.title}">
        <div class="result-card-body">
            <h4>${video.title}</h4>
            <p>${video.uploader} • ${formatDuration(video.duration)}</p>
            <div class="result-card-actions">
                <button onclick='addSearchResultToLibrary(${JSON.stringify(video).replace(/'/g, "&apos;")})' class="btn btn-success">💾</button>
                <button onclick='playSearchResult(${JSON.stringify(video).replace(/'/g, "&apos;")})' class="btn btn-primary">▶️</button>
            </div>
        </div>
    `;

    return card;
}

function addSearchResultToLibrary(video) {
    const added = library.add(video);

    if (added) {
        showStatus('searchStatus', `✓ "${video.title}" added to library!`, 'success');
        displayLibrary();
    } else {
        showStatus('searchStatus', 'This video is already in your library', 'info');
    }
}

function playSearchResult(video) {
    playVideoInModal(video);
}

function displayLibrary() {
    const container = document.getElementById('libraryContent');
    const emptyState = document.getElementById('emptyLibrary');
    const videos = library.getAll();

    if (!container || !emptyState) return;

    container.innerHTML = '';

    if (videos.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    videos.forEach(video => {
        const card = createLibraryCard(video);
        container.appendChild(card);
    });
}

function createLibraryCard(video) {
    const card = document.createElement('div');
    card.className = 'library-card';

    card.innerHTML = `
        <img src="${video.thumbnail}" alt="${video.title}" onclick='playLibraryVideo(${JSON.stringify(video).replace(/'/g, "&apos;")})'>
        <div class="library-card-body">
            <h4>${video.title}</h4>
            <p>${video.uploader || 'Unknown'} • Added ${new Date(video.savedAt).toLocaleDateString()}</p>
            <div class="library-card-actions">
                <button onclick='playLibraryVideo(${JSON.stringify(video).replace(/'/g, "&apos;")})' class="btn btn-primary">▶️ Watch</button>
                <button onclick='downloadLibraryVideo(${JSON.stringify(video).replace(/'/g, "&apos;")})' class="btn btn-secondary">⬇️</button>
                <button onclick='removeFromLibrary("${video.id}")' class="btn btn-danger">🗑️</button>
            </div>
        </div>
    `;

    return card;
}

function playLibraryVideo(video) {
    playVideoInModal(video);
}

function downloadLibraryVideo(video) {
    window.open(video.url, '_blank');
}

function removeFromLibrary(videoId) {
    if (confirm('Remove this video from library?')) {
        library.remove(videoId);
        displayLibrary();
        showStatus('downloadStatus', 'Video removed from library', 'success');
    }
}

function clearLibrary() {
    if (confirm('Are you sure you want to clear your entire library?')) {
        library.clear();
        displayLibrary();
        showStatus('downloadStatus', 'Library cleared', 'success');
    }
}

function updateLibraryCount() {
    const countEl = document.getElementById('libraryCount');
    if (countEl) {
        countEl.textContent = library.getAll().length;
    }
}

function playVideoInModal(video) {
    if (!video) return;

    const modal = document.getElementById('videoPlayerModal');
    const player = document.getElementById('videoPlayer');
    const title = document.getElementById('playerTitle');

    if (!modal || !player || !title) return;

    title.textContent = video.title;
    player.src = `https://www.youtube.com/embed/${video.id}?autoplay=1`;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePlayer() {
    const modal = document.getElementById('videoPlayerModal');
    const player = document.getElementById('videoPlayer');

    if (!modal || !player) return;

    player.src = '';
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}
