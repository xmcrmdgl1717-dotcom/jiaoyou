'use strict';

const express = require('express');
const {
  port,
  publicBaseUrl,
  corsOrigin,
  trialSeconds,
  trialTokenTtl,
  paidTokenTtl,
} = require('./config');
const token = require('./token');
const { resolveStripchat, httpError } = require('./resolver');
const { fetchUpstream, rewritePlaylist, streamBodyToResponse } = require('./proxy');

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', corsOrigin);
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.set('Access-Control-Max-Age', '600');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

function handleError(res, err) {
  const status = err && err.status ? err.status : 500;
  if (status >= 500) console.error('[proxy]', err);
  res.status(status).json({ error: (err && err.message) || 'internal error' });
}

function buildPlaybackUrl(model, signedToken) {
  return `${publicBaseUrl}/api/stream/${encodeURIComponent(model)}/playlist.m3u8?token=${encodeURIComponent(signedToken)}`;
}

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/api/stream/:model/start', async (req, res) => {
  try {
    const { model } = req.params;
    await resolveStripchat(model); // 先探测，确保开播
    const signed = token.issue({ model, trial: true, ttl: trialTokenTtl });
    res.json({
      model,
      trialSeconds,
      expiresIn: trialTokenTtl,
      playbackUrl: buildPlaybackUrl(model, signed),
    });
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/stream/:model/playlist.m3u8', async (req, res) => {
  try {
    const { model } = req.params;
    const rawToken = String(req.query.token || '');
    const payload = token.verify(rawToken);
    if (payload.model !== model) throw httpError(403, 'token/model mismatch');

    let upstreamUrl = req.query.src ? String(req.query.src) : null;
    if (upstreamUrl) {
      if (!/^https?:\/\//i.test(upstreamUrl)) throw httpError(400, 'bad src');
    } else {
      const resolved = await resolveStripchat(model);
      upstreamUrl = resolved.masterUrl;
    }

    const upstream = await fetchUpstream(upstreamUrl);
    if (!upstream.ok) throw httpError(upstream.status, `upstream ${upstream.status}`);
    const text = await upstream.text();
    if (!text.includes('#EXTM3U')) throw httpError(502, 'invalid playlist');

    const rewritten = rewritePlaylist(text, upstreamUrl, model, rawToken, publicBaseUrl);
    res.set('Content-Type', 'application/vnd.apple.mpegurl');
    res.set('Cache-Control', 'no-store');
    res.send(rewritten);
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/stream/:model/seg', async (req, res) => {
  try {
    const { model } = req.params;
    const rawToken = String(req.query.token || '');
    const payload = token.verify(rawToken);
    if (payload.model !== model) throw httpError(403, 'token/model mismatch');

    const src = String(req.query.src || '');
    if (!/^https?:\/\//i.test(src)) throw httpError(400, 'bad src');

    const upstream = await fetchUpstream(src);
    streamBodyToResponse(upstream, res);
  } catch (err) {
    if (!res.headersSent) handleError(res, err);
  }
});

// 支付成功回调占位：真实场景必须校验支付商 webhook 签名
app.post('/api/stream/:model/unlock', async (req, res) => {
  try {
    const { model } = req.params;
    // TODO: 校验 CCBill / SegPay webhook 签名与订单状态
    const signed = token.issue({ model, trial: false, ttl: paidTokenTtl });
    res.json({
      model,
      trialSeconds: 0,
      expiresIn: paidTokenTtl,
      playbackUrl: buildPlaybackUrl(model, signed),
    });
  } catch (err) {
    handleError(res, err);
  }
});

app.listen(port, () => {
  console.log(`[hiya-live-proxy] listening on :${port}`);
  console.log(`[hiya-live-proxy] public base = ${publicBaseUrl}`);
});
