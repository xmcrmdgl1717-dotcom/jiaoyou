'use strict';

/* ================= 核心配置 ================= */
const API_BASE_URL = 'https://jiaoyouweb.onrender.com'; 
const MOCK_MODE = false; 

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

/* ================= nav toggle ================= */
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
  initModal();
  renderAuthArea();
});

/* ================= 渲染顶部登录状态 ================= */
function renderAuthArea() {
  const authArea = document.getElementById('auth-area');
  if (!authArea) return;
  
  const savedUser = localStorage.getItem('hiya_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      authArea.innerHTML = `
        <div class="user-menu-wrapper" style="position:relative;">
          <div class="user-trigger" id="user-trigger" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 8px;border-radius:20px;transition:background 0.2s;">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ff5c9d&color=fff&size=32&bold=true" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
            <span style="font-size:13px;font-weight:600;color:#2b2f5b;">${user.name}</span>
            <span style="font-size:10px;color:#9a9fb2;">▼</span>
          </div>
          <div class="user-dropdown" id="user-dropdown" style="display:none;position:absolute;top:110%;right:0;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.15);padding:8px;min-width:140px;z-index:50;">
            <a href="#" style="display:block;padding:8px 12px;font-size:13px;color:#3a3f5f;border-radius:8px;" onmouseover="this.style.background='#fdf2f7'" onmouseout="this.style.background='transparent'">👤 个人中心</a>
            <a href="#" id="logout-btn" style="display:block;padding:8px 12px;font-size:13px;color:#ff3d8b;border-radius:8px;" onmouseover="this.style.background='#fdf2f7'" onmouseout="this.style.background='transparent'">🚪 退出登录</a>
          </div>
        </div>
      `;
      bindUserMenuEvents();
    } catch(e) { console.error(e); }
  } else {
    authArea.innerHTML = `<a class="login-btn" data-i18n="nav.login" data-register role="button" tabindex="0">登录 / 注册</a>`;
    // 如果当前有语言包，恢复一下翻译
    const lang = document.documentElement.lang || 'zh';
    const dict = dictCache.get(lang) || enDict || {};
    if (dict['nav.login']) {
       authArea.querySelector('.login-btn').textContent = dict['nav.login'];
    }
  }
}

function bindUserMenuEvents() {
  const trigger = document.getElementById('user-trigger');
  const dropdown = document.getElementById('user-dropdown');
  if (!trigger || !dropdown) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { if (dropdown) dropdown.style.display = 'none'; });
  
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('hiya_user');
      window.location.reload();
    });
  }
}

/* ================= Modal 弹窗逻辑 ================= */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
let lastFocused = null;
let scrollY = 0;
let submitting = false;

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

function showView(name) {
  document.querySelectorAll('#register-modal .modal-view').forEach((v) => {
    v.hidden = v.getAttribute('data-view') !== name;
  });
}

function openModal() {
  const overlay = document.getElementById('register-modal');
  if (!overlay) return;
  resetToForm();
  overlay.hidden = false;
  overlay.style.display = 'flex'; // 强制显示
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
  overlay.style.display = 'none'; // 强制隐藏
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
  if (!overlay) return;

  // 全局事件委托（保证动态渲染的按钮也能点）
  document.addEventListener('click', (e) => {
    const noRegister = e.target.closest('[data-legal],[data-lang-select],[data-nav-toggle],.modal-overlay');
    if (noRegister && !e.target.closest('.modal-dialog')) {
      return; // 如果点在弹窗外的遮罩层，或者法律/语言按钮，不触发弹窗
    }
    
    const hit = e.target.closest('[data-register]');
    if (hit) {
      e.preventDefault();
      openModal();
    }
  });

  overlay.querySelector('[data-modal-close]').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  
  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); }
    trapFocus(e);
  });

  overlay.querySelector('[data-register-form]').addEventListener('submit', onSubmit);
  overlay.querySelector('[data-login-form]').addEventListener('submit', onLoginSubmit);
}

// 暴露给 inline onclick
window.showLoginView = function() {
  showView('login');
  document.querySelector('#register-modal [data-login-error]').style.display = 'none';
};
window.showRegisterView = function() {
  showView('form');
  document.querySelector('#register-modal [data-form-error]').style.display = 'none';
};
window.closeModal = closeModal;

/* ================= 真实网络请求逻辑 ================= */
function onSubmit(e) {
  e.preventDefault();
  if (submitting) return;
  const form = e.currentTarget;
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = form.querySelector('.modal-submit');
  const errorBox = form.querySelector('[data-form-error]');
  
  const formData = new FormData(form);
  const data = {
    name: formData.get('name').trim(),
    email: formData.get('email').trim(),
    password: formData.get('password')
  };

  btn.disabled = true;
  btn.textContent = '提交中…';
  if (errorBox) errorBox.style.display = 'none';
  submitting = true;

  fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(async (res) => {
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || '注册失败');
    return result;
  })
  .then((result) => {
    localStorage.setItem('hiya_user', JSON.stringify(result.user));
    submitting = false;
    form.reset();
    showView('welcome');
    renderAuthArea();
  })
  .catch((err) => {
    submitting = false;
    btn.disabled = false;
    btn.textContent = getSubmitText(btn, 'modal.submit');
    if (errorBox) {
      errorBox.textContent = err.message === 'Failed to fetch' ? '服务器正在启动中，请等待50秒后重试' : err.message;
      errorBox.style.display = 'block';
    }
  });
}

function onLoginSubmit(e) {
  e.preventDefault();
  if (submitting) return;
  const form = e.currentTarget;
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = form.querySelector('.modal-submit');
  const errorBox = form.querySelector('[data-login-error]');
  
  const formData = new FormData(form);
  const data = {
    email: formData.get('email').trim(),
    password: formData.get('password')
  };

  btn.disabled = true;
  btn.textContent = '登录中…';
  if (errorBox) errorBox.style.display = 'none';
  submitting = true;

  fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(async (res) => {
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || '登录失败');
    return result;
  })
  .then((result) => {
    localStorage.setItem('hiya_user', JSON.stringify(result.user));
    submitting = false;
    form.reset();
    showView('welcome');
    renderAuthArea();
  })
  .catch((err) => {
    submitting = false;
    btn.disabled = false;
    btn.textContent = '登录';
    if (errorBox) {
      errorBox.textContent = err.message === 'Failed to fetch' ? '服务器正在启动中，请等待50秒后重试' : err.message;
      errorBox.style.display = 'block';
    }
  });
}
