import os
import json
import shutil
import tempfile
import threading
import uuid
import requests
from flask import Flask, request, jsonify, send_from_directory, send_file, after_this_request, Response
import yt_dlp

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COOKIES_FILE = os.path.join(BASE_DIR, 'cookies.txt')
HAS_FFMPEG = shutil.which('ffmpeg') is not None

# In-memory storage for SSE download jobs
download_jobs = {}
download_jobs_lock = threading.Lock()

INVIDIOUS_INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://inv.tux.pizza',
]


def get_cookie_opts():
    """Return cookie options if cookies.txt exists."""
    if os.path.isfile(COOKIES_FILE):
        return {'cookiefile': COOKIES_FILE}
    return {}


# ─── Static file serving ────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)


# ─── API: Video Info ────────────────────────────────────────────────────────

@app.route('/api/info')
def video_info():
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Missing url parameter'}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'no_color': True,
        **get_cookie_opts(),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        thumbnail = info.get('thumbnail', '')
        if not thumbnail:
            thumbnails = info.get('thumbnails', [])
            if thumbnails:
                thumbnail = thumbnails[-1].get('url', '')

        return jsonify({
            'id': info.get('id', ''),
            'title': info.get('title', 'Unknown'),
            'uploader': info.get('uploader', info.get('channel', 'Unknown')),
            'duration': info.get('duration', 0),
            'view_count': info.get('view_count', 0),
            'thumbnail': thumbnail,
            'url': info.get('webpage_url', url),
        })
    except yt_dlp.utils.DownloadError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── API: Search ────────────────────────────────────────────────────────────

@app.route('/api/search')
def search_videos():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'Missing q parameter'}), 400

    max_results = min(int(request.args.get('max', 8)), 20)

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'no_color': True,
        'extract_flat': True,
        **get_cookie_opts(),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f'ytsearch{max_results}:{query}', download=False)

        results = []
        for entry in info.get('entries', []):
            if not entry:
                continue

            thumb = ''
            thumbnails = entry.get('thumbnails', [])
            if thumbnails:
                thumb = thumbnails[-1].get('url', '')
            if not thumb and entry.get('id'):
                thumb = f"https://img.youtube.com/vi/{entry['id']}/mqdefault.jpg"

            results.append({
                'id': entry.get('id', ''),
                'title': entry.get('title', 'Unknown'),
                'uploader': entry.get('uploader', entry.get('channel', 'Unknown')),
                'duration': entry.get('duration', 0),
                'view_count': entry.get('view_count', 0),
                'thumbnail': thumb,
                'url': entry.get('url', entry.get('webpage_url', '')),
            })

        return jsonify({'results': results})
    except yt_dlp.utils.DownloadError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── API: Invidious Proxy ────────────────────────────────────────────────────

def invidious_fetch(path):
    """Try fetching from Invidious instances with fallback."""
    for instance in INVIDIOUS_INSTANCES:
        try:
            resp = requests.get(f'{instance}{path}', timeout=10)
            if resp.ok:
                return resp.json()
        except Exception:
            continue
    return None


@app.route('/api/popular')
def popular_videos():
    data = invidious_fetch('/api/v1/popular')
    if data is None:
        return jsonify({'error': 'Could not fetch popular videos'}), 502
    return jsonify(data)


@app.route('/api/trending')
def trending_videos():
    vtype = request.args.get('type', '')
    path = '/api/v1/trending'
    if vtype:
        path += f'?type={vtype}'
    data = invidious_fetch(path)
    if data is None:
        return jsonify({'error': 'Could not fetch trending videos'}), 502
    return jsonify(data)


@app.route('/api/invidious-search')
def invidious_search():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'error': 'Missing q parameter'}), 400
    sort_by = request.args.get('sort_by', 'relevance')
    date = request.args.get('date', '')
    path = f'/api/v1/search?q={query}&type=video&sort_by={sort_by}'
    if date:
        path += f'&date={date}'
    data = invidious_fetch(path)
    if data is None:
        return jsonify({'error': 'Could not fetch search results'}), 502
    return jsonify(data)


# ─── API: Cookies ────────────────────────────────────────────────────────────

@app.route('/api/cookie-status')
def cookie_status():
    return jsonify({'has_cookies': os.path.isfile(COOKIES_FILE)})


@app.route('/api/upload-cookies', methods=['POST'])
def upload_cookies():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    f = request.files['file']
    if not f.filename:
        return jsonify({'error': 'No file selected'}), 400

    content = f.read().decode('utf-8', errors='ignore')

    # Basic validation: Netscape cookie format starts with comments or domain lines
    lines = [l.strip() for l in content.splitlines() if l.strip() and not l.startswith('#')]
    if not lines:
        return jsonify({'error': 'Cookie file appears empty'}), 400

    # Check that at least some lines have tab-separated fields (Netscape format)
    valid_lines = [l for l in lines if l.count('\t') >= 4]
    if not valid_lines:
        return jsonify({'error': 'Invalid cookie file format. Export cookies in Netscape/Mozilla format.'}), 400

    try:
        with open(COOKIES_FILE, 'w') as out:
            out.write(content)
        return jsonify({'success': True, 'message': f'Cookies saved ({len(valid_lines)} cookies loaded)'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/delete-cookies', methods=['POST'])
def delete_cookies():
    if os.path.isfile(COOKIES_FILE):
        os.remove(COOKIES_FILE)
    return jsonify({'success': True})


# ─── API: Download ──────────────────────────────────────────────────────────

if HAS_FFMPEG:
    FORMAT_MAP = {
        'best': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '2160': 'bestvideo[height<=2160][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=2160]+bestaudio/best[height<=2160]',
        '1440': 'bestvideo[height<=1440][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1440]+bestaudio/best[height<=1440]',
        '1080': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]',
        '720': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
        '480': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
        '360': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]',
        'audio': 'bestaudio[ext=m4a]/bestaudio',
    }
else:
    FORMAT_MAP = {
        'best': 'best[ext=mp4]/best',
        '2160': 'best[height<=2160][ext=mp4]/best[height<=2160]',
        '1440': 'best[height<=1440][ext=mp4]/best[height<=1440]',
        '1080': 'best[height<=1080][ext=mp4]/best[height<=1080]',
        '720': 'best[height<=720][ext=mp4]/best[height<=720]',
        '480': 'best[height<=480][ext=mp4]/best[height<=480]',
        '360': 'best[height<=360][ext=mp4]/best[height<=360]',
        'audio': 'bestaudio[ext=m4a]/bestaudio',
    }


@app.route('/api/download')
def download_video():
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Missing url parameter'}), 400

    quality = request.args.get('quality', 'best').strip()
    fmt = FORMAT_MAP.get(quality, FORMAT_MAP['best'])

    tmpdir = tempfile.mkdtemp()

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'no_color': True,
        'format': fmt,
        'outtmpl': os.path.join(tmpdir, '%(title)s.%(ext)s'),
        **get_cookie_opts(),
    }

    if quality != 'audio' and HAS_FFMPEG:
        ydl_opts['merge_output_format'] = 'mp4'

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Find the downloaded file
        files = os.listdir(tmpdir)
        if not files:
            shutil.rmtree(tmpdir, ignore_errors=True)
            return jsonify({'error': 'Download failed - no file produced'}), 500

        filepath = os.path.join(tmpdir, files[0])
        filename = files[0]

        @after_this_request
        def cleanup(response):
            shutil.rmtree(tmpdir, ignore_errors=True)
            return response

        return send_file(
            filepath,
            as_attachment=True,
            download_name=filename,
        )
    except yt_dlp.utils.DownloadError as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        error_msg = str(e)
        if 'Sign in to confirm' in error_msg or 'cookies' in error_msg.lower():
            return jsonify({
                'error': 'YouTube requires authentication. Please add a cookies.txt file to the project directory. '
                         'Export cookies from your browser using a browser extension like "Get cookies.txt LOCALLY".'
            }), 403
        return jsonify({'error': error_msg}), 400
    except Exception as e:
        shutil.rmtree(tmpdir, ignore_errors=True)
        return jsonify({'error': str(e)}), 500


# ─── API: Available Formats ──────────────────────────────────────────────────

@app.route('/api/formats')
def video_formats():
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Missing url parameter'}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'no_color': True,
        **get_cookie_opts(),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        formats = info.get('formats', [])
        seen = {}

        for f in formats:
            height = f.get('height')
            if not height:
                continue
            vcodec = f.get('vcodec', 'none')
            if vcodec == 'none':
                continue

            label = f'{height}p'
            filesize = f.get('filesize') or f.get('filesize_approx') or 0

            if label not in seen or filesize > seen[label]['filesize']:
                seen[label] = {
                    'label': label,
                    'height': height,
                    'filesize': filesize,
                    'ext': f.get('ext', 'mp4'),
                    'fps': f.get('fps', 0),
                }

        # Add audio option
        audio_formats = [f for f in formats if f.get('acodec', 'none') != 'none' and f.get('vcodec', 'none') == 'none']
        if audio_formats:
            best_audio = max(audio_formats, key=lambda x: x.get('abr', 0) or 0)
            seen['audio'] = {
                'label': 'Audio Only',
                'height': 0,
                'filesize': best_audio.get('filesize') or best_audio.get('filesize_approx') or 0,
                'ext': best_audio.get('ext', 'm4a'),
                'fps': 0,
            }

        result = sorted(seen.values(), key=lambda x: x['height'], reverse=True)
        return jsonify({'formats': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── API: SSE Download with Progress ────────────────────────────────────────

def _run_download(job_id, url, quality):
    """Background download thread that updates job progress."""
    job = download_jobs[job_id]
    fmt = FORMAT_MAP.get(quality, FORMAT_MAP['best'])
    tmpdir = job['tmpdir']

    def progress_hook(d):
        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
            downloaded = d.get('downloaded_bytes', 0)
            speed = d.get('speed', 0) or 0
            eta = d.get('eta', 0) or 0
            percent = (downloaded / total * 100) if total > 0 else 0
            with download_jobs_lock:
                job['progress'] = {
                    'status': 'downloading',
                    'percent': round(percent, 1),
                    'downloaded': downloaded,
                    'total': total,
                    'speed': round(speed),
                    'eta': eta,
                }
        elif d['status'] == 'finished':
            with download_jobs_lock:
                job['progress'] = {
                    'status': 'processing',
                    'percent': 100,
                    'downloaded': d.get('total_bytes', 0) or d.get('downloaded_bytes', 0),
                    'total': d.get('total_bytes', 0) or d.get('downloaded_bytes', 0),
                    'speed': 0,
                    'eta': 0,
                }

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'no_color': True,
        'format': fmt,
        'outtmpl': os.path.join(tmpdir, '%(title)s.%(ext)s'),
        'progress_hooks': [progress_hook],
        **get_cookie_opts(),
    }

    if quality != 'audio' and HAS_FFMPEG:
        ydl_opts['merge_output_format'] = 'mp4'

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        files = os.listdir(tmpdir)
        if files:
            with download_jobs_lock:
                job['filepath'] = os.path.join(tmpdir, files[0])
                job['filename'] = files[0]
                job['progress'] = {'status': 'complete', 'percent': 100}
        else:
            with download_jobs_lock:
                job['progress'] = {'status': 'error', 'message': 'No file produced'}
    except Exception as e:
        with download_jobs_lock:
            error_msg = str(e)
            if 'Sign in to confirm' in error_msg or 'cookies' in error_msg.lower():
                error_msg = 'YouTube requires authentication. Please upload cookies.txt.'
            job['progress'] = {'status': 'error', 'message': error_msg}


@app.route('/api/download-start', methods=['POST'])
def download_start():
    data = request.get_json() or {}
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Missing url parameter'}), 400

    quality = data.get('quality', 'best').strip()
    job_id = str(uuid.uuid4())
    tmpdir = tempfile.mkdtemp()

    with download_jobs_lock:
        download_jobs[job_id] = {
            'tmpdir': tmpdir,
            'filepath': None,
            'filename': None,
            'progress': {'status': 'starting', 'percent': 0},
        }

    thread = threading.Thread(target=_run_download, args=(job_id, url, quality), daemon=True)
    thread.start()

    return jsonify({'job_id': job_id})


@app.route('/api/download-progress/<job_id>')
def download_progress(job_id):
    def generate():
        import time
        while True:
            with download_jobs_lock:
                job = download_jobs.get(job_id)
                if not job:
                    yield f"data: {json.dumps({'status': 'error', 'message': 'Job not found'})}\n\n"
                    break
                progress = dict(job['progress'])

            yield f"data: {json.dumps(progress)}\n\n"

            if progress.get('status') in ('complete', 'error'):
                break
            time.sleep(0.5)

    return Response(generate(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


@app.route('/api/download-file/<job_id>')
def download_file(job_id):
    with download_jobs_lock:
        job = download_jobs.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        if not job.get('filepath'):
            return jsonify({'error': 'Download not complete'}), 400
        filepath = job['filepath']
        filename = job['filename']
        tmpdir = job['tmpdir']

    @after_this_request
    def cleanup(response):
        with download_jobs_lock:
            download_jobs.pop(job_id, None)
        shutil.rmtree(tmpdir, ignore_errors=True)
        return response

    return send_file(filepath, as_attachment=True, download_name=filename)


# ─── API: Playlist Info ──────────────────────────────────────────────────────

@app.route('/api/playlist')
def playlist_info():
    url = request.args.get('url', '').strip()
    if not url:
        return jsonify({'error': 'Missing url parameter'}), 400

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'no_color': True,
        'extract_flat': True,
        **get_cookie_opts(),
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        if info.get('_type') != 'playlist' and not info.get('entries'):
            return jsonify({'error': 'URL is not a playlist'}), 400

        videos = []
        for entry in (info.get('entries') or []):
            if not entry:
                continue
            vid_id = entry.get('id', '')
            thumb = ''
            thumbnails = entry.get('thumbnails', [])
            if thumbnails:
                thumb = thumbnails[-1].get('url', '')
            if not thumb and vid_id:
                thumb = f"https://img.youtube.com/vi/{vid_id}/mqdefault.jpg"

            videos.append({
                'id': vid_id,
                'title': entry.get('title', 'Unknown'),
                'uploader': entry.get('uploader', entry.get('channel', 'Unknown')),
                'duration': entry.get('duration', 0),
                'thumbnail': thumb,
                'url': entry.get('url', entry.get('webpage_url', '')),
            })

        return jsonify({
            'title': info.get('title', 'Playlist'),
            'uploader': info.get('uploader', info.get('channel', 'Unknown')),
            'count': len(videos),
            'videos': videos,
        })
    except yt_dlp.utils.DownloadError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Main ───────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    has_cookies = os.path.isfile(COOKIES_FILE)
    print(f'\n  FFmpeg: {"FOUND" if HAS_FFMPEG else "NOT FOUND (video+audio merging disabled)"}')
    if has_cookies:
        print(f'  Cookies: LOADED ({COOKIES_FILE})')
    else:
        print(f'  Cookies: not configured (optional)')
        print(f'  To enable age-restricted downloads, place a cookies.txt file in: {BASE_DIR}')
    print()
    app.run(host='0.0.0.0', port=8000, debug=True, threaded=True)
