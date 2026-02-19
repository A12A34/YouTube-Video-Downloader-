// ─── Invidious API Configuration ────────────────────────────────────────────
const INVIDIOUS_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://inv.tux.pizza',
];
let currentInstanceIndex = 0;

function getInvidiousBase() {
    return INVIDIOUS_INSTANCES[currentInstanceIndex];
}

function rotateInstance() {
    currentInstanceIndex = (currentInstanceIndex + 1) % INVIDIOUS_INSTANCES.length;
}

async function invidiousFetch(path, retries = INVIDIOUS_INSTANCES.length) {
    // Try local proxy first (avoids CORS issues)
    const proxyMap = {
        '/api/v1/popular': '/api/popular',
        '/api/v1/trending': '/api/trending',
    };
    const proxyPath = Object.entries(proxyMap).find(([prefix]) => path === prefix || path.startsWith(prefix + '?'));
    if (proxyPath) {
        try {
            const localPath = path.replace(proxyPath[0], proxyPath[1]);
            const response = await fetch(localPath);
            if (response.ok) return await response.json();
        } catch { /* fall through to direct */ }
    }
    if (path.startsWith('/api/v1/search')) {
        try {
            const localPath = path.replace('/api/v1/search', '/api/invidious-search');
            const response = await fetch(localPath);
            if (response.ok) return await response.json();
        } catch { /* fall through to direct */ }
    }

    // Direct Invidious API calls as fallback
    for (let i = 0; i < retries; i++) {
        try {
            const url = `${getInvidiousBase()}${path}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            rotateInstance();
            if (i === retries - 1) throw err;
        }
    }
}

function mapInvidiousVideo(entry) {
    const thumb = entry.videoThumbnails
        ? (entry.videoThumbnails.find(t => t.quality === 'medium') || entry.videoThumbnails[0])
        : null;
    return {
        id: entry.videoId,
        title: entry.title || 'Unknown',
        uploader: entry.author || 'Unknown',
        duration: entry.lengthSeconds || 0,
        view_count: entry.viewCount || 0,
        thumbnail: thumb ? thumb.url : `https://img.youtube.com/vi/${entry.videoId}/mqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${entry.videoId}`,
        publishedText: entry.publishedText || '',
    };
}

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

// ─── Mode Helpers ──────────────────────────────────────────────────────────

function isPipedMode() {
    return typeof CONFIG !== 'undefined' && CONFIG.mode === 'piped';
}

function getPipedUrl() {
    return (typeof CONFIG !== 'undefined' && CONFIG.pipedApiUrl) || 'https://pipedapi.kavin.rocks';
}

// ─── Initialization ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    displayLibrary();
    updateLibraryCount();
    checkCookieStatus();

    const downloadInput = document.getElementById('downloadInput');
    const searchInput = document.getElementById('searchInput');
    const downloadBtn = document.getElementById('downloadBtn');
    const searchBtn = document.getElementById('searchBtn');
    const cookieFileInput = document.getElementById('cookieFileInput');

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

    if (cookieFileInput) {
        cookieFileInput.addEventListener('change', uploadCookies);
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePlayer();
    });
});

// ─── Utilities ────────────────────────────────────────────────────────────

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const tabEl = document.getElementById(tabName);
    if (tabEl) tabEl.classList.add('active');

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Load popular videos when search tab is opened for the first time
    if (tabName === 'search' && !popularLoaded) {
        loadPopularVideos();
        loadTrendingVideos('default');
    }
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
    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${minutes}:${secs.toString().padStart(2, '0')}`;
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

function showDownloadProgress(visible) {
    const el = document.getElementById('downloadProgress');
    if (!el) return;
    if (visible) {
        el.classList.remove('hidden');
    } else {
        el.classList.add('hidden');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── Piped API Helpers ────────────────────────────────────────────────────

async function pipedGetVideoInfo(videoId) {
    const response = await fetch(`${getPipedUrl()}/streams/${videoId}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return {
        id: videoId,
        title: data.title || 'Unknown',
        uploader: data.uploader || 'Unknown',
        thumbnail: data.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        duration: data.duration || 0,
        views: data.views || 0,
    };
}

async function pipedSearch(query, max) {
    const response = await fetch(`${getPipedUrl()}/search?q=${encodeURIComponent(query)}&filter=videos`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return (data.items || []).slice(0, max).map(item => {
        const id = item.url ? item.url.split('v=').pop().split('&')[0] : '';
        return {
            id: id,
            title: item.title || 'Unknown',
            uploader: item.uploaderName || 'Unknown',
            thumbnail: item.thumbnail || `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${id}`,
            duration: item.duration || 0,
            view_count: item.views || 0,
        };
    });
}

async function pipedDownload(videoUrl, quality) {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) throw new Error('Invalid video URL');

    const response = await fetch(`${getPipedUrl()}/streams/${videoId}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error);

    let streamUrl;
    const title = data.title || 'video';

    if (quality === 'audio') {
        const streams = (data.audioStreams || [])
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
        if (streams.length === 0) throw new Error('No audio stream available');
        streamUrl = streams[0].url;
    } else {
        const maxHeight = { 'best': 9999, '720': 720, '480': 480, '360': 360 }[quality] || 9999;

        // Prefer muxed streams (has both video and audio)
        const muxed = (data.videoStreams || [])
            .filter(s => !s.videoOnly)
            .filter(s => (s.height || 0) <= maxHeight)
            .sort((a, b) => (b.height || 0) - (a.height || 0));

        if (muxed.length > 0) {
            streamUrl = muxed[0].url;
        } else {
            // Fall back to video-only stream
            const videos = (data.videoStreams || [])
                .filter(s => (s.height || 0) <= maxHeight)
                .sort((a, b) => (b.height || 0) - (a.height || 0));
            if (videos.length > 0) {
                streamUrl = videos[0].url;
            } else {
                throw new Error('No suitable stream found for this quality');
            }
        }
    }

    // Open stream URL for download
    const a = document.createElement('a');
    a.href = streamUrl;
    a.download = `${title}.${quality === 'audio' ? 'm4a' : 'mp4'}`;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ─── Get Video Info ────────────────────────────────────────────────────────

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
        if (isPipedMode()) {
            currentVideo = await pipedGetVideoInfo(videoId);
        } else {
            const response = await fetch(`/api/info?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + videoId)}`);
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            currentVideo = {
                id: data.id,
                title: data.title,
                uploader: data.uploader,
                thumbnail: data.thumbnail || `https://img.youtube.com/vi/${data.id}/maxresdefault.jpg`,
                url: data.url || `https://www.youtube.com/watch?v=${data.id}`,
                duration: data.duration,
                views: data.view_count,
            };
        }
        displayVideoPreview(currentVideo);
        showStatus('downloadStatus', 'Video information loaded!', 'success');
    } catch (error) {
        showStatus('downloadStatus', `Error: ${error.message}`, 'error');
    }
}

async function searchAndGetFirst(query) {
    try {
        let results;
        if (isPipedMode()) {
            results = await pipedSearch(query, 1);
        } else {
            const data = await invidiousFetch(`/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
            const videos = data.filter(e => e.type === 'video');
            results = videos.map(mapInvidiousVideo);
        }

        if (results.length === 0) {
            showStatus('downloadStatus', 'No videos found for that query', 'error');
            return;
        }

        const first = results[0];
        currentVideo = {
            id: first.id,
            title: first.title,
            uploader: first.uploader,
            thumbnail: first.thumbnail,
            url: first.url,
            duration: first.duration,
            views: first.view_count || first.views,
        };

        displayVideoPreview(currentVideo);
        showStatus('downloadStatus', 'Video information loaded!', 'success');
    } catch (error) {
        showStatus('downloadStatus', `Error: ${error.message}`, 'error');
    }
}

// ─── Display Video Preview ─────────────────────────────────────────────────

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

// ─── Actions ───────────────────────────────────────────────────────────────

function saveToLibrary() {
    if (!currentVideo) {
        showStatus('downloadStatus', 'No video selected', 'error');
        return;
    }

    const added = library.add(currentVideo);

    if (added) {
        showStatus('downloadStatus', `"${currentVideo.title}" added to library!`, 'success');
        displayLibrary();
    } else {
        showStatus('downloadStatus', 'This video is already in your library', 'info');
    }
}

async function downloadVideo() {
    if (!currentVideo) {
        showStatus('downloadStatus', 'No video selected', 'error');
        return;
    }

    const quality = document.getElementById('qualitySelect').value;

    showDownloadProgress(true);
    showStatus('downloadStatus', 'Download started! This may take a moment...', 'info');

    try {
        if (isPipedMode()) {
            await pipedDownload(currentVideo.url, quality);
            showStatus('downloadStatus', 'Download started!', 'success');
        } else {
            const downloadUrl = `/api/download?url=${encodeURIComponent(currentVideo.url)}&quality=${quality}`;
            const response = await fetch(downloadUrl);

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Download failed');
            }

            const blob = await response.blob();
            const disposition = response.headers.get('Content-Disposition') || '';
            const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
            const filename = filenameMatch ? filenameMatch[1] : `${currentVideo.title}.mp4`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showStatus('downloadStatus', 'Download complete!', 'success');
        }
    } catch (error) {
        showStatus('downloadStatus', error.message, 'error');
    } finally {
        showDownloadProgress(false);
    }
}

function watchVideo() {
    if (!currentVideo) {
        showStatus('downloadStatus', 'No video selected', 'error');
        return;
    }

    playVideoInModal(currentVideo);
}

// ─── Search ────────────────────────────────────────────────────────────────

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

    try {
        let results;
        if (isPipedMode()) {
            results = await pipedSearch(query, 8);
        } else {
            const sortParam = document.getElementById('searchSort')?.value || 'relevance';
            const dateParam = document.getElementById('searchDate')?.value || '';
            let apiPath = `/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=${sortParam}`;
            if (dateParam) apiPath += `&date=${dateParam}`;

            const data = await invidiousFetch(apiPath);
            results = data
                .filter(e => e.type === 'video')
                .map(mapInvidiousVideo);
        }


        displaySearchResults(results);
        showStatus('searchStatus', `Found ${results.length} results`, 'success');
    } catch (error) {
        showStatus('searchStatus', `Search failed: ${error.message}`, 'error');
    } finally {
        btn.disabled = false;
        if (btnText) btnText.textContent = 'Search';
        if (spinner) spinner.classList.add('hidden');
    }
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

    const videoData = encodeURIComponent(JSON.stringify(video));
    const meta = [escapeHtml(video.uploader || 'Unknown')];
    if (video.duration) meta.push(formatDuration(video.duration));
    if (video.view_count) meta.push(formatViews(video.view_count) + ' views');
    if (video.publishedText) meta.push(escapeHtml(video.publishedText));

    card.innerHTML = `
        <img src="${escapeHtml(video.thumbnail)}" alt="${escapeHtml(video.title)}" loading="lazy">
        <div class="result-card-body">
            <h4>${escapeHtml(video.title)}</h4>
            <p>${meta.join(' · ')}</p>
            <div class="result-card-actions">
                <button data-video="${videoData}" onclick="addSearchResultFromBtn(this)" class="btn btn-success">💾</button>
                <button data-video="${videoData}" onclick="playSearchResultFromBtn(this)" class="btn btn-primary">▶️</button>
                <button data-video="${videoData}" onclick="downloadSearchResultFromBtn(this)" class="btn btn-secondary">⬇️</button>
            </div>
        </div>
    `;

    return card;
}

function getVideoFromBtn(btn) {
    return JSON.parse(decodeURIComponent(btn.getAttribute('data-video')));
}

function addSearchResultFromBtn(btn) {
    const video = getVideoFromBtn(btn);
    addSearchResultToLibrary(video);
}

function playSearchResultFromBtn(btn) {
    const video = getVideoFromBtn(btn);
    playVideoInModal(video);
}

async function downloadSearchResultFromBtn(btn) {
    const video = getVideoFromBtn(btn);
    const videoUrl = video.url || `https://www.youtube.com/watch?v=${video.id}`;

    showStatus('searchStatus', `Downloading "${video.title}"...`, 'info');

    try {
        if (isPipedMode()) {
            await pipedDownload(videoUrl, 'best');
            showStatus('searchStatus', 'Download started!', 'success');
        } else {
            const downloadUrl = `/api/download?url=${encodeURIComponent(videoUrl)}&quality=best`;
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Download failed');
            }
            const blob = await response.blob();
            const disposition = response.headers.get('Content-Disposition') || '';
            const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
            const filename = filenameMatch ? filenameMatch[1] : `${video.title}.mp4`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showStatus('searchStatus', 'Download complete!', 'success');
        }
    } catch (error) {
        showStatus('searchStatus', error.message, 'error');
    }
}

function addSearchResultToLibrary(video) {
    const added = library.add(video);

    if (added) {
        showStatus('searchStatus', `"${video.title}" added to library!`, 'success');
        displayLibrary();
    } else {
        showStatus('searchStatus', 'This video is already in your library', 'info');
    }
}

// ─── Popular & Trending Feeds ───────────────────────────────────────────────

let popularLoaded = false;
let trendingCategory = 'default';

async function loadPopularVideos() {
    const container = document.getElementById('popularResults');
    if (!container) return;

    container.innerHTML = '<div class="feed-loading">Loading popular videos...</div>';

    try {
        const data = await invidiousFetch('/api/v1/popular');
        const videos = data.map(mapInvidiousVideo);
        displayFeedResults(container, videos);
        popularLoaded = true;
    } catch (error) {
        container.innerHTML = `<div class="empty-state"><p>Could not load popular videos: ${escapeHtml(error.message)}</p></div>`;
    }
}

async function loadTrendingVideos(category) {
    trendingCategory = category || 'default';
    const container = document.getElementById('trendingResults');
    if (!container) return;

    // Highlight active category button
    document.querySelectorAll('.trending-cat-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === trendingCategory);
    });

    container.innerHTML = '<div class="feed-loading">Loading trending videos...</div>';

    try {
        const typePart = trendingCategory !== 'default' ? `?type=${trendingCategory}` : '';
        const data = await invidiousFetch(`/api/v1/trending${typePart}`);
        const videos = data.map(mapInvidiousVideo);
        displayFeedResults(container, videos);
    } catch (error) {
        container.innerHTML = `<div class="empty-state"><p>Could not load trending videos: ${escapeHtml(error.message)}</p></div>`;
    }
}

function displayFeedResults(container, videos) {
    container.innerHTML = '';

    if (!videos.length) {
        container.innerHTML = '<div class="empty-state"><p>No videos found</p></div>';
        return;
    }

    videos.forEach(video => {
        const card = createResultCard(video);
        container.appendChild(card);
    });
}

// ─── Library ───────────────────────────────────────────────────────────────

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

    const videoData = encodeURIComponent(JSON.stringify(video));

    card.innerHTML = `
        <img src="${escapeHtml(video.thumbnail)}" alt="${escapeHtml(video.title)}" data-video="${videoData}" onclick="playLibraryVideoFromBtn(this)">
        <div class="library-card-body">
            <h4>${escapeHtml(video.title)}</h4>
            <p>${escapeHtml(video.uploader || 'Unknown')} · Added ${new Date(video.savedAt).toLocaleDateString()}</p>
            <div class="library-card-actions">
                <button data-video="${videoData}" onclick="playLibraryVideoFromBtn(this)" class="btn btn-primary">▶️ Watch</button>
                <button data-video="${videoData}" onclick="downloadLibraryVideoFromBtn(this)" class="btn btn-secondary">⬇️</button>
                <button onclick="removeFromLibrary('${video.id}')" class="btn btn-danger">🗑️</button>
            </div>
        </div>
    `;

    return card;
}

function playLibraryVideoFromBtn(btn) {
    const video = getVideoFromBtn(btn);
    playVideoInModal(video);
}

async function downloadLibraryVideoFromBtn(btn) {
    const video = getVideoFromBtn(btn);
    const videoUrl = video.url || `https://www.youtube.com/watch?v=${video.id}`;

    try {
        if (isPipedMode()) {
            await pipedDownload(videoUrl, 'best');
        } else {
            const downloadUrl = `/api/download?url=${encodeURIComponent(videoUrl)}&quality=best`;
            const response = await fetch(downloadUrl);
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Download failed');
            }
            const blob = await response.blob();
            const disposition = response.headers.get('Content-Disposition') || '';
            const filenameMatch = disposition.match(/filename="?(.+?)"?$/);
            const filename = filenameMatch ? filenameMatch[1] : `${video.title}.mp4`;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        alert(error.message);
    }
}

function removeFromLibrary(videoId) {
    if (confirm('Remove this video from library?')) {
        library.remove(videoId);
        displayLibrary();
    }
}

function clearLibrary() {
    if (confirm('Are you sure you want to clear your entire library?')) {
        library.clear();
        displayLibrary();
    }
}

function updateLibraryCount() {
    const countEl = document.getElementById('libraryCount');
    if (countEl) {
        countEl.textContent = library.getAll().length;
    }
}

// ─── Cookie Management ─────────────────────────────────────────────────────

async function checkCookieStatus() {
    if (isPipedMode()) {
        // No cookies needed in piped mode - hide both banners
        const banner = document.getElementById('cookieBanner');
        const success = document.getElementById('cookieSuccess');
        if (banner) banner.classList.add('hidden');
        if (success) success.classList.add('hidden');
        return;
    }
    try {
        const response = await fetch('/api/cookie-status');
        const data = await response.json();
        updateCookieBanner(data.has_cookies);
    } catch {
        updateCookieBanner(false);
    }
}

function updateCookieBanner(hasCookies) {
    const banner = document.getElementById('cookieBanner');
    const success = document.getElementById('cookieSuccess');
    if (!banner || !success) return;

    if (hasCookies) {
        banner.classList.add('hidden');
        success.classList.remove('hidden');
    } else {
        banner.classList.remove('hidden');
        success.classList.add('hidden');
    }
}

async function uploadCookies() {
    const input = document.getElementById('cookieFileInput');
    const statusEl = document.getElementById('cookieStatus');
    if (!input || !input.files.length) return;

    const formData = new FormData();
    formData.append('file', input.files[0]);

    if (statusEl) {
        statusEl.textContent = 'Uploading...';
        statusEl.className = 'cookie-status';
    }

    try {
        const response = await fetch('/api/upload-cookies', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();

        if (data.error) {
            if (statusEl) {
                statusEl.textContent = data.error;
                statusEl.className = 'cookie-status error';
            }
        } else {
            if (statusEl) {
                statusEl.textContent = data.message;
                statusEl.className = 'cookie-status success';
            }
            setTimeout(() => checkCookieStatus(), 1000);
        }
    } catch (error) {
        if (statusEl) {
            statusEl.textContent = 'Upload failed: ' + error.message;
            statusEl.className = 'cookie-status error';
        }
    }

    input.value = '';
}

async function deleteCookies() {
    try {
        await fetch('/api/delete-cookies', { method: 'POST' });
        checkCookieStatus();
    } catch {
        // ignore
    }
}

// ─── Video Player Modal ────────────────────────────────────────────────────

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
