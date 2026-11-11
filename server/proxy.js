'use strict';

const { Readable } = require('stream');
const { UA, isAllowedUpstream } = require('./resolver');

const BASE_HEADERS = {
  Referer: 'https://stripchat.com/',
  'User-Agent': UA,
  Accept: '*/*',
};

async function fetchUpstream(url) {
  if (!isAllowedUpstream(url)) {
    const err = new Error('upstream host not allowed');
    err.status = 403;
    throw err;
  }
  return fetch(url, {
    headers: BASE_HEADERS,
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });
}

function rewritePlaylist(text, baseUrl, model, token, publicBaseUrl) {
  const base = new URL(baseUrl);
  const qs = `token=${encodeURIComponent(token)}`;
  const lines = String(text).split(/\r?\n/);
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      out.push(line);
      continue;
    }

    if (trimmed.startsWith('#')) {
      if (/URI="/.test(trimmed)) {
        out.push(
          trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
            let abs;
            try {
              abs = new URL(uri, base).toString();
            } catch {
              return match;
            }
            if (!isAllowedUpstream(abs)) return match;
            return `URI="${publicBaseUrl}/api/stream/${encodeURIComponent(model)}/seg?${qs}&src=${encodeURIComponent(abs)}"`;
          })
        );
      } else {
        out.push(line);
      }
      continue;
    }

    let abs;
    try {
      abs = new URL(trimmed, base).toString();
    } catch {
      out.push(line);
      continue;
    }
    const isPlaylist = /\.m3u8(\?|#|$)/i.test(abs);
    const route = isPlaylist ? 'playlist.m3u8' : 'seg';
    out.push(
      `${publicBaseUrl}/api/stream/${encodeURIComponent(model)}/${route}?${qs}&src=${encodeURIComponent(abs)}`
    );
  }

  return out.join('\n');
}

function streamBodyToResponse(upstreamRes, res) {
  res.status(upstreamRes.status);
  res.set('Content-Type', upstreamRes.headers.get('content-type') || 'application/octet-stream');
  res.set('Cache-Control', 'no-store');
  const len = upstreamRes.headers.get('content-length');
  if (len) res.set('Content-Length', len);
  if (!upstreamRes.body) {
    res.end();
    return;
  }
  Readable.fromWeb(upstreamRes.body)
    .on('error', () => res.end())
    .pipe(res);
}

module.exports = { fetchUpstream, rewritePlaylist, streamBodyToResponse };
