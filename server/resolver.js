'use strict';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const CACHE_TTL = 60 * 1000;
const STREAM_CACHE = new Map();

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function fetchJson(url, headers) {
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw httpError(res.status, `upstream ${res.status}`);
  return res.json();
}

async function probePlaylist(url) {
  try {
    const res = await fetch(url, {
      headers: { Referer: 'https://stripchat.com/', 'User-Agent': UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const text = await res.text();
    return text.includes('#EXTM3U');
  } catch {
    return false;
  }
}

async function resolveStripchat(model) {
  const cached = STREAM_CACHE.get(model);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const api = `https://stripchat.com/api/front/v2/models/username/${encodeURIComponent(model)}/cam`;
  const data = await fetchJson(api, {
    Accept: 'application/json, text/plain, */*',
    Referer: `https://stripchat.com/${encodeURIComponent(model)}`,
    'User-Agent': UA,
    'X-Requested-With': 'XMLHttpRequest',
  });

  const cam = (data && (data.cam || (data.item && data.item.cam) || (data.model && data.model.cam))) || null;
  if (!cam) throw httpError(404, 'cam payload missing');
  if (!cam.streamName) throw httpError(409, 'model is offline');

  const streamName = cam.streamName;
  const servers = cam.viewServers || {};
  const host = servers['flashphoner-hls'] || servers.hls || servers.flashphoner;
  if (!host) throw httpError(409, 'no hls server available');

  const candidates = [
    `https://b-${host}.doppiocdn.com/hls/${streamName}/master/${streamName}_auto.m3u8`,
    `https://b-${host}.doppiocdn.live/hls/${streamName}/master/${streamName}_auto.m3u8`,
    `https://b-${host}.doppiocdn.net/hls/${streamName}/master/${streamName}_auto.m3u8`,
  ];

  let masterUrl = null;
  for (const url of candidates) {
    if (await probePlaylist(url)) {
      masterUrl = url;
      break;
    }
  }
  if (!masterUrl) throw httpError(502, 'no reachable master playlist');

  const payload = { model, masterUrl };
  STREAM_CACHE.set(model, { data: payload, expiresAt: Date.now() + CACHE_TTL });
  return payload;
}

const ALLOWED_HOSTS = [
  /\.doppiocdn\.com$/i,
  /\.doppiocdn\.live$/i,
  /\.doppiocdn\.net$/i,
  /(^|\.)stripchat\.com$/i,
];

function isAllowedUpstream(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
    return ALLOWED_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

module.exports = {
  UA,
  resolveStripchat,
  isAllowedUpstream,
  httpError,
};
