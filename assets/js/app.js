'use strict';

/* ================= i18n ================= */
const SUPPORTED = ['zh', 'en'];
const RTL = new Set(['ar']);
const LS_KEY = 'hiya_lang';
const dictCache = new Map();      // lang -> {key: value}
let enDict = null;                // 预加载的英文兜底字典

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
    else console.warn('[i18n] missing key:', el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const v = translate(dict, el.getAttribute('data-i18n-html'));
    if (v != null) el.innerHTML = v;
  });

  document.documentElement.lang = lang;
  document.documentElement.dir = RTL.has(lang) ? 'rtl' : 'ltr';
  try { localStorage.setItem(LS_KEY, lang); } catch (e) {}

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
});

/* ================= entry delegation ================= */
const NO_REGISTER = '[data-legal],[data-lang-select],[data-nav-toggle],.modal-overlay';
function initEntry() {
  const trigger = (e) => {
    if (e.target.closest(NO_REGISTER)) return;
    const hit = e.target.closest('[data-register]');
    if (!hit) return;
    e.preventDefault();
    openModal(hit);
  };
  document.addEventListener('click', trigger);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const el = e.target;
    if (!el || !el.hasAttribute || !el.hasAttribute('data-register')) return;
    if (el.closest(NO_REGISTER)) return;
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
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    trapFocus(e);
  });
  overlay.querySelector('[data-register-form]').addEventListener('submit', onSubmit);
  overlay.addEventListener('focusout', () => {
    setTimeout(() => {
      if (overlay.hidden) return;
      if (!overlay.contains(document.activeElement)) {
        const dlg = overlay.querySelector('[data-modal-dialog]');
        if (dlg) dlg.focus();
      }
    }, 0);
  });
}

/* ================= register flow (Real API) ================= */
// 配置你的后端 API 地址（生产环境请改为真实域名）
const API_BASE_URL = 'http://localhost:3000'; 

let submitting = false;

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
  submitting = false;
  showView('form');
  const btn = document.querySelector('#register-modal .modal-submit');
  if (btn) {
    btn.disabled = false;
    const text = getSubmitText(btn, 'modal.submit');
    if (text != null) btn.textContent = text;
  }
  const errorBox = document.querySelector('#register-modal [data-form-error]');
  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }
}

function onSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (submitting) return;
  
  // 浏览器原生格式校验
  if (!form.checkValidity()) { 
    form.reportValidity(); 
    return; 
  }

  const btn = form.querySelector('.modal-submit');
  const errorBox = form.querySelector('[data-form-error]');
  
  // 收集数据
  const formData = new FormData(form);
  const data = {
    name: formData.get('name').trim(),
    email: formData.get('email').trim(),
    password: formData.get('password')
  };

  // UI 状态更新
  btn.disabled = true;
  btn.textContent = t('modal.submitting', '提交中…');
  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }
  submitting = true;

  // 发送真实请求到后端
  fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(async (res) => {
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.error || 'Registration failed');
    }
    return result;
  })
  .then(() => {
    submitting = false;
    form.reset(); // 注册成功，清空表单
    showView('complete'); // 展示成功界面
  })
  .catch((err) => {
    submitting = false;
    btn.disabled = false;
    btn.textContent = getSubmitText(btn, 'modal.submit');
    if (errorBox) {
      errorBox.textContent = err.message || '网络异常，请稍后重试';
      errorBox.style.display = 'block';
    }
  });
}
