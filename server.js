const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple in-memory cache
const cache = new Map();
function getCache(key) {
  const item = cache.get(key);
  if (item && item.expiry > Date.now()) {
    return item.data;
  }
  return null;
}
function setCache(key, data, ttlSeconds = 180) {
  cache.set(key, { data, expiry: Date.now() + (ttlSeconds * 1000) });
}

// HTTP request helper with redirect following
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;
    
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Referer': 'https://krmzi.org/'
      },
      timeout: 12000
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const origin = new URL(url).origin;
          redirectUrl = new URL(redirectUrl, origin).toString();
        }
        return fetchHtml(redirectUrl).then(resolve).catch(reject);
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout for ' + url));
    });
  });
}

// 1. Get Latest Episodes
app.get('/api/episodes', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const cacheKey = `episodes_page_${page}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = page === 1 ? 'https://krmzi.org/' : `https://krmzi.org/page/${page}/`;
    const html = await fetchHtml(url);
    
    const episodes = [];
    const blockRegex = /<div class="block-post">([\s\S]*?)<\/div>\s*<\/div>/g;
    let blockMatch;

    while ((blockMatch = blockRegex.exec(html)) !== null) {
      const blockHtml = blockMatch[1];
      
      const linkMatch = blockHtml.match(/<a\s+href="(https:\/\/krmzi\.org\/episode\/[^"]+)"\s+title="([^"]+)"/);
      if (!linkMatch) continue;
      
      const epUrl = linkMatch[1];
      const fullTitle = linkMatch[2].replace(/\s*-\s*قرمزي\s*$/, '').trim();
      
      const epNumMatch = blockHtml.match(/<div class="episodeNum">[\s\S]*?<span>(\d+)<\/span>/);
      const episodeNum = epNumMatch ? epNumMatch[1] : '';

      const thumbMatch = blockHtml.match(/url\((https:\/\/krmzi\.org\/wp-content\/uploads\/[^)]+)\)/);
      const thumbnail = thumbMatch ? thumbMatch[1] : '';

      let seriesTitle = fullTitle;
      if (episodeNum) {
        seriesTitle = fullTitle.replace(new RegExp(`الحلقة\\s*${episodeNum}.*`), '').trim();
      }

      episodes.push({
        url: epUrl,
        title: fullTitle,
        seriesTitle: seriesTitle || fullTitle,
        episodeNum,
        thumbnail
      });
    }

    const hasNext = html.includes(`href="https://krmzi.org/page/${page + 1}/"`) || html.includes(`page/${page + 1}/`);
    const result = { page, episodes, hasNext };
    setCache(cacheKey, result, 120);
    res.json(result);
  } catch (err) {
    console.error('Error fetching episodes:', err.message);
    res.status(500).json({ error: 'Failed to fetch episodes', details: err.message });
  }
});

// 2. Get Series List
app.get('/api/series', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const cacheKey = `series_page_${page}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = page === 1 ? 'https://krmzi.org/series-list/' : `https://krmzi.org/series-list/page/${page}/`;
    const html = await fetchHtml(url);
    
    const seriesList = [];
    const blockRegex = /<div class="block-post">([\s\S]*?)<\/div>\s*<\/div>/g;
    let blockMatch;

    while ((blockMatch = blockRegex.exec(html)) !== null) {
      const blockHtml = blockMatch[1];
      
      const linkMatch = blockHtml.match(/<a\s+href="(https:\/\/krmzi\.org\/series\/[^"]+)"\s+title="([^"]+)"/);
      if (!linkMatch) continue;
      
      const serUrl = linkMatch[1];
      const title = linkMatch[2].replace(/\s*-\s*قرمزي\s*$/, '').trim();

      const thumbMatch = blockHtml.match(/url\((https:\/\/krmzi\.org\/wp-content\/uploads\/[^)]+)\)/);
      const thumbnail = thumbMatch ? thumbMatch[1] : '';

      seriesList.push({
        url: serUrl,
        title,
        thumbnail
      });
    }

    const hasNext = html.includes(`series-list/page/${page + 1}/`);
    const result = { page, series: seriesList, hasNext };
    setCache(cacheKey, result, 300);
    res.json(result);
  } catch (err) {
    console.error('Error fetching series list:', err.message);
    res.status(500).json({ error: 'Failed to fetch series list', details: err.message });
  }
});

// 3. Get Series Details with Full Episodes List
app.get('/api/series/detail', async (req, res) => {
  const seriesUrl = req.query.url;
  if (!seriesUrl) return res.status(400).json({ error: 'Missing series url' });

  const cacheKey = `series_detail_${seriesUrl}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const html = await fetchHtml(seriesUrl);

    // Title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || html.match(/<div class="title">\s*([^<]+)\s*<\/div>/);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // Poster
    const posterMatch = html.match(/url\((https:\/\/krmzi\.org\/wp-content\/uploads\/[^)]+)\)/);
    const poster = posterMatch ? posterMatch[1] : '';

    // Story
    const storyMatch = html.match(/<div class="story">([\s\S]*?)<\/div>/) || html.match(/<div class="desc">([\s\S]*?)<\/div>/);
    const story = storyMatch ? storyMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    // Episodes in this series
    const episodes = [];
    const epRegex = /<a\s+href="(https:\/\/krmzi\.org\/episode\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    let epMatch;
    const seenUrls = new Set();

    while ((epMatch = epRegex.exec(html)) !== null) {
      const epUrl = epMatch[1];
      if (seenUrls.has(epUrl)) continue;
      seenUrls.add(epUrl);

      const epInner = epMatch[2];
      const titleClean = epInner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      
      const numMatch = epUrl.match(/الحلقة-(\d+)/) || titleClean.match(/(\d+)/);
      const episodeNum = numMatch ? numMatch[1] : '';

      episodes.push({
        url: epUrl,
        title: titleClean || `الحلقة ${episodeNum}`,
        episodeNum
      });
    }

    // Sort episodes ascending by episodeNum
    episodes.sort((a, b) => (parseInt(a.episodeNum) || 0) - (parseInt(b.episodeNum) || 0));

    const result = {
      url: seriesUrl,
      title,
      poster,
      story,
      episodes
    };

    setCache(cacheKey, result, 600);
    res.json(result);
  } catch (err) {
    console.error('Error fetching series detail:', err.message);
    res.status(500).json({ error: 'Failed to fetch series detail', details: err.message });
  }
});

// 4. Search
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json({ results: [] });

  try {
    const searchUrl = `https://krmzi.org/?s=${encodeURIComponent(query)}`;
    const html = await fetchHtml(searchUrl);

    const results = [];
    const blockRegex = /<div class="block-post">([\s\S]*?)<\/div>\s*<\/div>/g;
    let blockMatch;

    while ((blockMatch = blockRegex.exec(html)) !== null) {
      const blockHtml = blockMatch[1];
      const linkMatch = blockHtml.match(/<a\s+href="(https:\/\/krmzi\.org\/(?:series|episode)\/[^"]+)"\s+title="([^"]+)"/);
      if (!linkMatch) continue;

      const itemUrl = linkMatch[1];
      const title = linkMatch[2].replace(/\s*-\s*قرمزي\s*$/, '').trim();
      const isSeries = itemUrl.includes('/series/');

      const thumbMatch = blockHtml.match(/url\((https:\/\/krmzi\.org\/wp-content\/uploads\/[^)]+)\)/);
      const thumbnail = thumbMatch ? thumbMatch[1] : '';

      results.push({
        url: itemUrl,
        title,
        type: isSeries ? 'series' : 'episode',
        thumbnail
      });
    }

    res.json({ query, results });
  } catch (err) {
    console.error('Error searching:', err.message);
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// 5. Episode Details & Clean Stream Resolver
app.get('/api/episode/detail', async (req, res) => {
  const epUrl = req.query.url;
  if (!epUrl) return res.status(400).json({ error: 'Missing episode url' });

  const cacheKey = `ep_detail_${epUrl}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const html = await fetchHtml(epUrl);

    // Episode Title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || html.match(/<title>([^<]+)<\/title>/);
    const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const title = rawTitle.replace(/\s*-\s*قرمزي\s*$/, '').trim();

    // Episode Number
    const numMatch = epUrl.match(/الحلقة-(\d+)/) || title.match(/الحلقة\s*(\d+)/);
    const episodeNum = numMatch ? numMatch[1] : '';

    // Poster
    const posterMatch = html.match(/url\('(https:\/\/krmzi\.org\/wp-content\/uploads\/[^']+)'\)/) ||
                        html.match(/url\((https:\/\/krmzi\.org\/wp-content\/uploads\/[^)]+)\)/);
    const poster = posterMatch ? posterMatch[1] : '';

    // Series page link
    const seriesLinkMatch = html.match(/<a[^>]+href="(https:\/\/krmzi\.org\/series\/[^"]+)"/);
    const seriesUrl = seriesLinkMatch ? seriesLinkMatch[1] : '';

    // Extract servers from post payload
    let rawServers = [];
    const qesenMatch = html.match(/href="https:\/\/qesen\.net\/krmzi\?post=([^"]+)"/);
    if (qesenMatch) {
      try {
        const decoded = Buffer.from(qesenMatch[1], 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed.servers && Array.isArray(parsed.servers)) {
          rawServers = parsed.servers;
        }
      } catch (e) {
        console.error('Failed to parse qesen post JSON:', e);
      }
    }

    // Process and resolve servers into clean sources
    const servers = [];
    let directStreams = [];

    for (const s of rawServers) {
      const serverName = s.name;
      const id = s.id;
      let embedUrl = '';
      let isDirect = false;

      // Server mappings from dark_vo theme
      if (serverName === 'ok') {
        embedUrl = `https://ok.ru/videoembed/${id}`;
        // Attempt to extract direct MP4/HLS streams from OK.ru
        try {
          const okHtml = await fetchHtml(embedUrl);
          const optMatch = okHtml.match(/data-options="([^"]+)"/);
          if (optMatch) {
            const rawOpt = optMatch[1].replace(/&quot;/g, '"');
            const okData = JSON.parse(rawOpt);
            const meta = typeof okData.flashvars.metadata === 'string'
              ? JSON.parse(okData.flashvars.metadata)
              : okData.flashvars.metadata;

            if (meta && meta.videos && meta.videos.length > 0) {
              const qualityMap = {
                full: '1080p (Full HD)',
                hd: '720p (HD)',
                sd: '480p (SD)',
                low: '360p',
                lowest: '240p',
                mobile: '144p'
              };

              const streams = meta.videos.map(v => ({
                quality: qualityMap[v.name] || v.name,
                url: v.url
              })).reverse(); // high to low

              directStreams = streams;
              isDirect = true;
            }
          }
        } catch (e) {
          console.warn('Could not extract direct stream for ok.ru:', e.message);
        }
      } else if (serverName === 'Arab HD') {
        embedUrl = `https://arabhd.onl/embed-${id}.html`;
      } else if (serverName === 'estream') {
        embedUrl = `https://arabveturk.com/embed-${id}.html`;
      } else if (serverName === 'box') {
        embedUrl = `https://youdboox.com/embed-${id}.html`;
      } else if (serverName === 'now') {
        embedUrl = `https://extreamnow.org/embed-${id}.html`;
      } else if (serverName === 'Red HD') {
        embedUrl = `https://iplayerhls.com/e/${id}`;
      } else if (serverName === 'Pro HD') {
        embedUrl = `https://embedo.co/e/${id}`;
      } else if (serverName === 'dailymotion') {
        embedUrl = `https://www.dailymotion.com/embed/video/${id}`;
      } else if (serverName === 'youtube') {
        embedUrl = `https://www.youtube.com/embed/${id}`;
      }

      if (embedUrl) {
        servers.push({
          name: serverName,
          id,
          embedUrl,
          hasDirectStream: isDirect
        });
      }
    }

    const result = {
      url: epUrl,
      title,
      episodeNum,
      poster,
      seriesUrl,
      servers,
      directStreams
    };

    setCache(cacheKey, result, 300);
    res.json(result);
  } catch (err) {
    console.error('Error fetching episode detail:', err.message);
    res.status(500).json({ error: 'Failed to fetch episode detail', details: err.message });
  }
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  KRMZI PRO PLAYER SERVER IS RUNNING`);
  console.log(`  Open in browser: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
