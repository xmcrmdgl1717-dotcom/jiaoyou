'use strict';

/* ================= i18n ================= */
const SUPPORTED = ['zh', 'en'];
const RTL = new Set(['ar']);
const LS_KEY = 'hiya_lang';
const dictCache = new Map();
let enDict = null;

function resolveInitialLang() {
  let saved = null;
  try { saved = localStorage.getItem(LS_KEY); } catch (e) {}
  if (saved && SUPPORTED.includes(saved)) return saved;
  const cands = (navigator.languages && navigator.languages.length)
    ? navigator.languages : [navigator.language || 'zh'];
  for (const tag of cands) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (SUPPORTED.includes(base)) return base;
  }
  return 'zh';
}

async function loadDict(lang) {
  if (dictCache.has(lang)) return dictCache.get(lang);
  const res = await fetch('i18n/' + lang + '.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('dict ' + lang + ' ' + res.status);
  const dict = await res.json();
  dictCache.set(lang, dict);
  return dict;
}

function translate(dict, key) {
  if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  if (enDict && Object.prototype.hasOwnProperty.call(enDict, key)) return enDict[key];
  return null;
}

async function applyLang(lang) {
  if (!SUPPORTED.includes(lang)) lang = 'zh';
  if (!enDict) { try { enDict = await loadDict('en'); } catch (e) { enDict = {}; } }
  let dict;
  try { dict = await loadDict(lang); }
  catch (e) { console.warn('[i18n] load failed, falling back to zh:', e); dict = enDict; lang = 'zh'; }

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = translate(dict, el.getAttribute('data-i18n'));
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const v = translate(dict, el.getAttribute('data-i18n-html'));
    if (v != null) el.innerHTML = v;
  });

  document.documentElement.lang = lang;
  document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr';
  try { localStorage.setItem(LS_KEY, lang); } catch (e) {}

  if (tickTimer) { lastRemainSec = -1; renderProgress(); renderTip(); }

  const sel = document.querySelector('[data-lang-select]');
  if (sel && sel.value !== lang) sel.value = lang;

  const titleMap = { zh: '嗨呀直播', en: 'Hiya Live' };
  document.title = titleMap[lang] || titleMap.zh;
}

function initI18n() {
  const sel = document.querySelector('[data-lang-select]');
  if (sel) sel.addEventListener('change', () => applyLang(sel.value));
  applyLang(resolveInitialLang());
}

/* ================= nav toggle (mobile) ================= */
function initNavToggle() {
  const btn = document.querySelector('[data-nav-toggle]');
  const links = document.querySelector('.nav-links');
  if (!btn || !links) return;
  btn.addEventListener('click', () => {
    const open = links.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
  });
  links.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      links.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ================= bootstrap ================= */
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initNavToggle();
  if (document.getElementById('register-modal')) {
    initEntry();
    initModal();
  }
  if (document.getElementById('player-modal')) {
    initPlayer();
  }
});

/* ================= entry delegation ================= */
const NO_REGISTER = '[data-legal],[data-lang-select],[data-nav-toggle],.modal-overlay';

function initEntry() {
  const trigger = (e) => {
    if (e.target.closest(NO_REGISTER)) return;

    const playerHit = e.target.closest('[data-model]');
    if (playerHit) {
      e.preventDefault();
      openPlayer(playerHit.getAttribute('data-model'));
      return;
    }

    const hit = e.target.closest('[data-register]');
    if (!hit) return;
    e.preventDefault();
    openModal(hit);
  };
  document.addEventListener('click', trigger);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const el = e.target;
    if (!el || !el.hasAttribute) return;
    if (el.closest(NO_REGISTER)) return;

    if (el.hasAttribute('data-model')) {
      e.preventDefault();
      openPlayer(el.getAttribute('data-model'));
      return;
    }
    if (!el.hasAttribute('data-register')) return;
    e.preventDefault();
    openModal(el);
  });
}

/* ================= modal shell ================= */
let lastFocused = null;
let scrollY = 0;
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

function showView(name) {
  document.querySelectorAll('#register-modal .modal-view').forEach((v) => {
    v.hidden = v.getAttribute('data-view') !== name;
  });
}

function openModal(trigger) {
  const overlay = document.getElementById('register-modal');
  lastFocused = trigger || document.activeElement;
  resetToForm();
  overlay.hidden = false;
  scrollY = window.scrollY;
  document.body.style.top = (-scrollY) + 'px';
  document.body.classList.add('modal-open');
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  const first = overlay.querySelector(FOCUSABLE);
  if (first) first.focus();
}

function closeModal() {
  const overlay = document.getElementById('register-modal');
  if (!overlay || overlay.hidden) return;
  cleanupTimers();
  overlay.hidden = true;
  document.body.classList.remove('modal-open');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, scrollY);
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
}

function trapFocus(e) {
  const overlay = document.getElementById('register-modal');
  if (overlay.hidden || e.key !== 'Tab') return;
  const items = [...overlay.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0], last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function initModal() {
  const overlay = document.getElementById('register-modal');
  overlay.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); onEscape(); }
    trapFocus(e);
  });
  overlay.querySelector('[data-register-form]').addEventListener('submit', onSubmit);
  overlay.querySelector('[data-modal-cancel]').addEventListener('click', cancelWaiting);
}

function onEscape() {
  const waiting = !document.querySelector('#register-modal .modal-view[data-view="waiting"]').hidden;
  if (waiting) cancelWaiting(); else closeModal();
}

/* ================= register flow ================= */
const WAIT_MS = 20000;
const TIP_MS = 4500;
const DONE_URL = 'https://abc.com';
const DONE_REDIRECT_MS = 1000;
let tickTimer = null;
let tipTimer = null;
let startedAt = 0;
let tipIndex = 0;
let submitting = false;
let lastRemainSec = -1;

function currentDict() {
  const lang = document.documentElement.lang || 'zh';
  return dictCache.get(lang) || enDict || {};
}

function t(key, fallback) {
  const d = currentDict();
  if (Object.prototype.hasOwnProperty.call(d, key)) return d[key];
  if (enDict && Object.prototype.hasOwnProperty.call(enDict, key)) return enDict[key];
  return fallback != null ? fallback : null;
}

function getSubmitText(btn, key) {
  const lang = document.documentElement.lang || 'zh';
  const dict = dictCache.get(lang);
  if (dict && typeof dict[key] === 'string') return dict[key];
  if (enDict && typeof enDict[key] === 'string') return enDict[key];
  const attr = 'data-default-' + lang;
  if (btn && btn.getAttribute(attr)) return btn.getAttribute(attr);
  if (btn && btn.getAttribute('data-default-zh')) return btn.getAttribute('data-default-zh');
  return null;
}

function resetToForm() {
  cleanupTimers();
  submitting = false;
  showView('form');
  const btn = document.querySelector('#register-modal .modal-submit');
  if (btn) {
    btn.disabled = false;
    const text = getSubmitText(btn, 'modal.submit');
    if (text != null) btn.textContent = text;
  }
}

function onSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (tickTimer) return;
  if (submitting) return;
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = form.querySelector('.modal-submit');
  btn.disabled = true;
  btn.textContent = t('modal.submitting', '提交中…');

  submitting = true;
  window.setTimeout(() => {
    if (document.getElementById('register-modal').hidden) return;
    startWaiting();
  }, 300);
}

function startWaiting() {
  showView('waiting');
  startedAt = Date.now();
  lastRemainSec = -1;
  submitting = false;
  tipIndex = 0;
  renderTip();
  renderProgress();
  tickTimer = window.setInterval(renderProgress, 100);
  tipTimer = window.setInterval(() => { tipIndex = (tipIndex + 1) % 3; renderTip(); }, TIP_MS);
}

function renderProgress() {
  const elapsed = Date.now() - startedAt;
  const remain = Math.max(0, WAIT_MS - elapsed);
  const bar = document.querySelector('#register-modal [data-progress-bar]');
  const rem = document.querySelector('#register-modal [data-remain]');
  if (bar) bar.style.width = Math.min(100, (elapsed / WAIT_MS) * 100) + '%';
  const sec = Math.ceil(remain / 1000);
  if (rem && sec !== lastRemainSec) {
    lastRemainSec = sec;
    const tpl = t('modal.waiting.remain', '剩余 {n} 秒');
    rem.textContent = tpl.replace('{n}', String(sec));
  }
  if (elapsed >= WAIT_MS) completeWaiting();
}

function renderTip() {
  const tip = document.querySelector('#register-modal [data-tip]');
  if (!tip) return;
  tip.textContent = t('modal.tips.' + (tipIndex + 1), '') || '';
}

function cancelWaiting() { resetToForm(); }

function completeWaiting() {
  cleanupTimers();
  showView('complete');
  const enter = document.querySelector('#register-modal .modal-enter');
  if (enter) enter.focus();
  window.setTimeout(() => {
    const view = document.querySelector('#register-modal .modal-view[data-view="complete"]');
    if (!view || view.hidden) return;
    window.location.href = DONE_URL;
  }, DONE_REDIRECT_MS);
}

function cleanupTimers() {
  if (tickTimer) { window.clearInterval(tickTimer); tickTimer = null; }
  if (tipTimer) { window.clearInterval(tipTimer); tipTimer = null; }
}

/* ================= live player ================= */
const API_BASE = (typeof window !== 'undefined' && window.__API_BASE__) || '';
const PLAYER_TICK_MS = 200;

let hlsInstance = null;
let playerSession = null;

function getPlayerEls() {
  const modal = document.getElementById('player-modal');
  if (!modal) return null;
  return {
    modal,
    dialog: modal.querySelector('.player-dialog'),
    video: modal.querySelector('#live-player'),
    status: modal.querySelector('[data-player-status]'),
    mask: modal.querySelector('#paywall-mask'),
    badge: modal.querySelector('[data-trial-badge]'),
    left: modal.querySelector('[data-trial-left]'),
    payBtn: modal.querySelector('#pay-btn'),
  };
}

function setPlayerStatus(text) {
  const els = getPlayerEls();
  if (!els) return;
  if (text) {
    els.status.textContent = text;
    els.status.hidden = false;
  } else {
    els.status.hidden = true;
  }
}

function updateTrialBadge(leftMs) {
  const els = getPlayerEls();
  if (!els || !els.left) return;
  els.left.textContent = String(Math.max(0, Math.ceil(leftMs / 1000)));
}

function openPlayer(model) {
  const els = getPlayerEls();
  if (!els || !model) return;
  els.modal.hidden = false;
  els.mask.hidden = true;
  els.badge.hidden = true;
  document.body.classList.add('player-open');
  setPlayerStatus(t('player.status.connecting', '正在连接主播…'));

  startPlayback(model).catch((err) => {
    console.warn('[player]', err);
    setPlayerStatus(t('player.status.error', '主播当前未开播或连接失败，请稍后再试'));
  });
}

async function startPlayback(model) {
  const els = getPlayerEls();
  cleanupPlayer();

  const res = await fetch(`${API_BASE}/api/stream/${encodeURIComponent(model)}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('start http ' + res.status);

  const data = await res.json();
  if (!data || !data.playbackUrl) throw new Error('bad start payload');

  setPlayerStatus('');
  attachHls(els.video, data.playbackUrl);
  beginTrial(Number(data.trialSeconds) || 20);
}

function attachHls(video, src) {
  if (window.Hls && window.Hls.isSupported()) {
    hlsInstance = new window.Hls({ lowLatencyMode: true, backBufferLength: 30 });
    hlsInstance.loadSource(src);
    hlsInstance.attachMedia(video);
    hlsInstance.on(window.Hls.Events.ERROR, (_evt, data) => {
      if (data && data.fatal) {
        setPlayerStatus(t('player.status.error', '主播当前未开播或连接失败，请稍后再试'));
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
  } else {
    setPlayerStatus(t('player.status.unsupported', '当前浏览器不支持该直播流'));
    return;
  }
  const p = video.play();
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

function beginTrial(seconds) {
  const els = getPlayerEls();
  if (!els) return;

  const limitMs = Math.max(1, seconds) * 1000;
  let watchedMs = 0;
  let lastTs = 0;

  els.badge.hidden = false;
  updateTrialBadge(limitMs);

  const video = els.video;
  const onPlaying = () => { lastTs = performance.now(); };
  const onPause = () => { lastTs = 0; };
  video.addEventListener('playing', onPlaying);
  video.addEventListener('pause', onPause);

  const timer = window.setInterval(() => {
    if (video.paused || video.ended) {
      lastTs = 0;
      return;
    }
    const now = performance.now();
    if (lastTs) watchedMs += now - lastTs;
    lastTs = now;

    updateTrialBadge(limitMs - watchedMs);
    if (watchedMs >= limitMs) {
      window.clearInterval(timer);
      triggerPaywall();
    }
  }, PLAYER_TICK_MS);

  playerSession = { timer, onPlaying, onPause };
}

function triggerPaywall() {
  const els = getPlayerEls();
  if (!els) return;
  els.video.pause();
  els.badge.hidden = true;
  els.mask.hidden = false;
  if (els.payBtn) els.payBtn.focus();
}

function cleanupPlayer() {
  const els = getPlayerEls();
  if (!els) return;

  if (playerSession) {
    window.clearInterval(playerSession.timer);
    els.video.removeEventListener('playing', playerSession.onPlaying);
    els.video.removeEventListener('pause', playerSession.onPause);
    playerSession = null;
  }
  if (hlsInstance) {
    try { hlsInstance.destroy(); } catch (e) {}
    hlsInstance = null;
  }
  try { els.video.pause(); } catch (e) {}
  els.video.removeAttribute('src');
  try { els.video.load(); } catch (e) {}
  els.mask.hidden = true;
  els.badge.hidden = true;
}

function closePlayer() {
  const els = getPlayerEls();
  if (!els) return;
  cleanupPlayer();
  els.modal.hidden = true;
  document.body.classList.remove('player-open');
}

function initPlayer() {
  const els = getPlayerEls();
  if (!els) return;

  els.modal.querySelector('[data-player-close]').addEventListener('click', closePlayer);
  els.modal.addEventListener('click', (e) => {
    if (e.target === els.modal) closePlayer();
  });
  document.addEventListener('keydown', (e) => {
    if (els.modal.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePlayer();
    }
  });

  if (els.payBtn) {
    els.payBtn.addEventListener('click', () => {
      // TODO: 接入 CCBill / SegPay 托管支付页，拿到 session URL 后跳转
      // 支付成功回调里调用后端 /api/stream/:model/unlock 获取新 token 再替换播放地址
      alert('充值入口占位：请接入成人支付处理商后替换此逻辑');
    });
  }
}
