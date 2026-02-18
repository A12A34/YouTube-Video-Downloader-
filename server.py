import os
import shutil
import tempfile
from flask import Flask, request, jsonify, send_from_directory, send_file, after_this_request
import yt_dlp

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COOKIES_FILE = os.path.join(BASE_DIR, 'cookies.txt')
HAS_FFMPEG = shutil.which('ffmpeg') is not None


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
        '720': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
        '480': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
        '360': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]',
        'audio': 'bestaudio[ext=m4a]/bestaudio',
    }
else:
    FORMAT_MAP = {
        'best': 'best[ext=mp4]/best',
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
