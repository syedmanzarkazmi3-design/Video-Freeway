// Shared downloader logic for single-platform pages.
// Each page must define `const PLATFORM = 'tiktok' | 'youtube' | 'facebook' | 'pinterest';`
// before loading this script.

const platformPatterns = {
  tiktok: /(?:tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/i,
  youtube: /(?:youtube\.com|youtu\.be)/i,
  facebook: /(?:facebook\.com|fb\.watch)/i,
  pinterest: /(?:pinterest\.com|pin\.it)/i,
};
const platformNames = { tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', pinterest: 'Pinterest' };

let videoData = null;

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function clearInput() {
  document.getElementById('videoUrl').value = '';
  document.getElementById('resultCard').classList.add('hidden');
}

async function analyzeVideo() {
  const urlInput = document.getElementById('videoUrl');
  const url = urlInput.value.trim();
  if (!url) { alert('Please enter a video URL'); return; }
  const pattern = platformPatterns[PLATFORM];
  if (!pattern.test(url)) { alert(`Please enter a valid ${platformNames[PLATFORM]} URL`); return; }

  document.getElementById('loadingState').classList.remove('hidden');
  document.getElementById('resultCard').classList.add('hidden');

  try {
    let data;

    if (PLATFORM === 'tiktok') {
      const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (json.code === 0 && json.data) {
        const dur = json.data.duration || 0;
        data = {
          thumbnail: json.data.cover,
          title: json.data.title || 'TikTok Video',
          author: json.data.author?.nickname || '@' + (json.data.author?.unique_id || 'unknown'),
          duration: `${Math.floor(dur / 60)}:${(dur % 60).toString().padStart(2, '0')}`,
          videoUrl: json.data.hdplay || json.data.play,
          audioUrl: json.data.music,
          platform: 'TikTok'
        };
      } else {
        throw new Error('Video not found');
      }
    } else if (PLATFORM === 'youtube') {
      const videoId = extractYouTubeId(url);
      let meta = null;
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (res.ok) {
          const json = await res.json();
          if (json && (json.title || json.thumbnail_url)) meta = json;
        }
      } catch (e) {}
      if (!meta) {
        try {
          const res2 = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
          if (res2.ok) {
            const json2 = await res2.json();
            if (json2 && !json2.error && (json2.title || json2.thumbnail_url)) meta = json2;
          }
        } catch (e) {}
      }
      if (!meta && videoId) {
        meta = {
          title: 'YouTube Video',
          author_name: 'YouTube',
          thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        };
      }
      if (!meta) {
        throw new Error('Video not found. Please check the URL and try again.');
      }
      data = {
        thumbnail: meta.thumbnail_url,
        title: meta.title || 'YouTube Video',
        author: meta.author_name || 'YouTube Creator',
        duration: 'Watch on YouTube',
        videoUrl: url,
        audioUrl: url,
        platform: 'YouTube'
      };
    } else if (PLATFORM === 'facebook') {
      const res = await fetch(`/.netlify/functions/facebook?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (res.ok && json && json.videoUrl) {
        data = {
          thumbnail: json.thumbnail,
          title: json.title || 'Facebook Video',
          author: json.author || '@facebook',
          duration: json.duration || '0:00',
          videoUrl: json.videoUrl,
          audioUrl: json.audioUrl || null,
          platform: 'Facebook'
        };
      } else {
        throw new Error(json && json.error ? json.error : 'Video not found');
      }
    } else if (PLATFORM === 'pinterest') {
      const res = await fetch(`/.netlify/functions/pinterest?url=${encodeURIComponent(url)}`);
      const json = await res.json();
      if (res.ok && json && json.videoUrl) {
        data = {
          thumbnail: json.thumbnail,
          title: json.title || 'Pinterest Video',
          author: json.author || '@pinterest',
          duration: json.duration || '0:00',
          videoUrl: json.videoUrl,
          audioUrl: null,
          platform: 'Pinterest'
        };
      } else {
        throw new Error(json && json.error ? json.error : 'Video not found');
      }
    }

    if (data) {
      videoData = data;
      document.getElementById('videoThumbnail').src = data.thumbnail;
      document.getElementById('videoTitle').textContent = data.title;
      document.getElementById('videoAuthor').querySelector('span').textContent = data.author;
      document.getElementById('durationBadge').textContent = data.duration;
      document.getElementById('platformTag').textContent = data.platform;
      document.getElementById('resultCard').classList.remove('hidden');
      if (window.lucide) lucide.createIcons();

      trackDownload(PLATFORM, data.title);

      setTimeout(() => document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } else {
      throw new Error('Video not found');
    }
  } catch (error) {
    alert(error && error.message ? error.message : 'Failed to fetch video. Please check the URL and try again.');
  } finally {
    document.getElementById('loadingState').classList.add('hidden');
  }
}

// Track Download (writes to the same localStorage keys the main dashboard reads,
// so stats stay consistent no matter which tool page the download happened on)
function trackDownload(platform, title) {
  const users = JSON.parse(localStorage.getItem('vf_users') || '[]');
  const analytics = JSON.parse(localStorage.getItem('vf_analytics') || '{}');
  const today = new Date().toISOString().split('T')[0];

  analytics.downloads = analytics.downloads || [];
  analytics.downloads.push({ platform, title, date: new Date().toISOString(), user: 'anonymous' });
  analytics.visitors = analytics.visitors || {};
  analytics.visitors[today] = (analytics.visitors[today] || 0) + 1;
  localStorage.setItem('vf_analytics', JSON.stringify(analytics));
}

// Download Video
// Note: YouTube redirects to the real video ONLY when a download button is
// clicked (never on Analyze) — this shows the preview first, matching the
// intended "watch/download it on YouTube itself" behavior.
async function downloadVideo(quality) {
  if (!videoData || !videoData.videoUrl) { alert('No video available'); return; }
  if (videoData.platform === 'YouTube') {
    window.open(videoData.videoUrl, '_blank');
    return;
  }
  try {
    const response = await fetch(videoData.videoUrl);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${videoData.platform}_${quality}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    window.open(videoData.videoUrl, '_blank');
  }
}

async function downloadAudio() {
  if (!videoData || !videoData.audioUrl) { alert('Audio not available'); return; }
  if (videoData.platform === 'YouTube') {
    window.open(videoData.videoUrl, '_blank');
    return;
  }
  try {
    const response = await fetch(videoData.audioUrl);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${videoData.platform}_audio.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    window.open(videoData.audioUrl, '_blank');
  }
}
