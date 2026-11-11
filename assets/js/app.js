'use strict';

/* ================= 核心配置 ================= */
const API_BASE_URL = 'https://jiaoyouweb.onrender.com'; 

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
  catch (e) { dict = enDict; lang = 'zh'; }

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
}

/* ================= 解析苹果CMS的播放地址 ================= */
function parsePlayUrl(urlStr) {
  if (!urlStr) return '';
  if (urlStr.includes('$')) {
    const parts = urlStr.split('#');
    if (parts.length > 0 && parts[0].includes('$')) return parts[0].split('$')[1];
  }
  return urlStr; 
}

/* ================= 加载首页动态视频 ================= */
async function loadHomeVideos() {
  const hotRow = document.getElementById('index-video-list');
  if (!hotRow) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/videos`);
    const videos = await res.json();
    
    if (!videos || videos.length === 0) return; 

    const homeVideos = videos.slice(0, 7);
    const cities = ['北京', '上海', '广州', '成都', '杭州', '深圳', '重庆'];

    hotRow.innerHTML = homeVideos.map((v, index) => {
      const realUrl = parsePlayUrl(v.playUrl);
      const randomLikes = (Math.random() * 5 + 1).toFixed(1) + 'K';
      const city = v.category || cities[index % 7];
      
      // 🔴 注意这里：给渲染出来的卡片加上 data-video-src
      return `
        <div class="hcard" data-register role="button" tabindex="0" 
             data-video-src="${realUrl}" 
             data-video-poster="${v.pic || 'assets/img/live/1.webp'}">
          <video class="hvideo" autoplay loop muted playsinline poster="${v.pic || 'assets/img/live/1.webp'}"></video>
          <span class="live">LIVE</span>
          <div class="ov">
            <div class="nm">${v.name}</div>
            <div class="meta">
              <span class="cty">🇨🇳 <span>${city}</span></span>
              <span>🔥 ${randomLikes}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.warn('首页视频加载失败', error);
  }
}

/* ================= 全局拦截点击事件 ================= */
function initAuthEvents() {
  document.addEventListener('click', (e) => {
    // 1. 如果点击的是语言切换、导航等特定区域，跳过
    const noRegister = e.target.closest('[data-legal],[data-lang-select],[data-nav-toggle],.modal-overlay');
    if (noRegister && !e.target.closest('.modal-dialog')) return;
    
    // 2. 查找最近的 data-register 元素
    const hit = e.target.closest('[data-register]');
    if (!hit) return;

    // 🔴 关键修复：如果点击的是视频卡片，优先打开播放器，绝不弹窗
    if (hit.hasAttribute('data-video-src')) {
      e.preventDefault();
      e.stopPropagation(); // 阻止事件冒泡
      openVideoPlayer(hit);
      return;
    }

    // 3. 否则判断是否登录，触发注册/客服弹窗
    e.preventDefault();
    const savedUser = localStorage.getItem('hiya_user');
    if (savedUser) {
      openCustomerModal(); 
    } else {
      openRegisterModal(); 
    }
  });
}

/* ================= 渲染登录状态 ================= */
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

/* ================= 注册 / 登录 弹窗逻辑 ================= */
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

function openRegisterModal() {
  const overlay = document.getElementById('register-modal');
  if (!overlay) return;
  lastFocused = document.activeElement;
  resetToForm();
  overlay.hidden = false;
  overlay.style.display = 'flex';
  scrollY = window.scrollY;
  document.body.style.top = (-scrollY) + 'px';
  document.body.classList.add('modal-open');
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  const first = overlay.querySelector(FOCUSABLE);
  if (first) first.focus();
}

function closeRegisterModal() {
  const overlay = document.getElementById('register-modal');
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  overlay.style.display = 'none';
  document.body.classList.remove('modal-open');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, scrollY);
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
}

function initModalEvents() {
  const overlay = document.getElementById('register-modal');
  if (!overlay) return;

  overlay.querySelector('[data-modal-close]').addEventListener('click', closeRegisterModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeRegisterModal(); });
  
  document.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeRegisterModal(); }
  });

  overlay.querySelector('[data-register-form]').addEventListener('submit', onSubmitRegister);
  overlay.querySelector('[data-login-form]').addEventListener('submit', onSubmitLogin);
}

window.showLoginView = function() {
  showView('login');
  document.querySelector('#register-modal [data-login-error]').style.display = 'none';
};
window.showRegisterView = function() {
  showView('form');
  document.querySelector('#register-modal [data-form-error]').style.display = 'none';
};
window.closeModal = closeRegisterModal;

/* ================= 真实网络请求逻辑 ================= */
function onSubmitRegister(e) {
  e.preventDefault();
  if (submitting) return;
  const form = e.currentTarget;
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = form.querySelector('.modal-submit');
  const errorBox = form.querySelector('[data-form-error]');
  const formData = new FormData(form);
  const data = { name: formData.get('name').trim(), email: formData.get('email').trim(), password: formData.get('password') };

  btn.disabled = true;
  btn.textContent = '提交中…';
  if (errorBox) errorBox.style.display = 'none';
  submitting = true;

  fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(async (res) => {
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || '注册失败');
    return result;
  }).then((result) => {
    localStorage.setItem('hiya_user', JSON.stringify(result.user));
    submitting = false;
    form.reset();
    showView('welcome');
    renderAuthArea();
  }).catch((err) => {
    submitting = false;
    btn.disabled = false;
    btn.textContent = getSubmitText(btn, 'modal.submit');
    if (errorBox) {
      errorBox.textContent = err.message === 'Failed to fetch' ? '服务器启动中，请等待50秒' : err.message;
      errorBox.style.display = 'block';
    }
  });
}

function onSubmitLogin(e) {
  e.preventDefault();
  if (submitting) return;
  const form = e.currentTarget;
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = form.querySelector('.modal-submit');
  const errorBox = form.querySelector('[data-login-error]');
  const formData = new FormData(form);
  const data = { email: formData.get('email').trim(), password: formData.get('password') };

  btn.disabled = true;
  btn.textContent = '登录中…';
  if (errorBox) errorBox.style.display = 'none';
  submitting = true;

  fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
  }).then(async (res) => {
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || '登录失败');
    return result;
  }).then((result) => {
    localStorage.setItem('hiya_user', JSON.stringify(result.user));
    submitting = false;
    form.reset();
    showView('welcome');
    renderAuthArea();
  }).catch((err) => {
    submitting = false;
    btn.disabled = false;
    btn.textContent = '登录';
    if (errorBox) {
      errorBox.textContent = err.message === 'Failed to fetch' ? '服务器启动中，请等待50秒' : err.message;
      errorBox.style.display = 'block';
    }
  });
}

/* ================= 客服引导弹窗 ================= */
let customerTimer = null;

function openCustomerModal() {
  const overlay = document.getElementById('customer-modal');
  if (!overlay) return;
  
  overlay.hidden = false;
  overlay.style.display = 'flex';
  document.body.classList.add('modal-open');
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';

  document.getElementById('customer-countdown-area').style.display = 'block';
  document.getElementById('customer-result-area').style.display = 'none';
  document.getElementById('customer-timer').textContent = '15';

  if (customerTimer) clearInterval(customerTimer);
  let count = 15;
  customerTimer = setInterval(() => {
    count--;
    document.getElementById('customer-timer').textContent = count;
    if (count <= 0) {
      clearInterval(customerTimer);
      customerTimer = null;
      document.getElementById('customer-countdown-area').style.display = 'none';
      document.getElementById('customer-result-area').style.display = 'block';
    }
  }, 1000);
}

function closeCustomerModal() {
  const overlay = document.getElementById('customer-modal');
  if (!overlay) return;
  if (customerTimer) { clearInterval(customerTimer); customerTimer = null; }
  overlay.hidden = true;
  overlay.style.display = 'none';
  document.body.classList.remove('modal-open');
  document.body.style.position = '';
  document.body.style.width = '';
}

/* ================= 视频播放器 ================= */
let hls = null;

function openVideoPlayer(card) {
  const playerModal = document.getElementById('video-player-modal');
  const videoEl = document.getElementById('video-player');
  if (!playerModal || !videoEl) return;
  
  const src = card.getAttribute('data-video-src');
  const poster = card.getAttribute('data-video-poster');
  const name = card.querySelector('.nm')?.textContent || '';
  const meta = card.querySelector('.meta')?.textContent?.replace(/\s+/g, ' ').trim() || '';

  if (!src) {
    alert('该视频暂未配置播放源');
    return;
  }

  document.getElementById('video-player-name').textContent = name;
  document.getElementById('video-player-meta').textContent = meta;

  // 判断是否支持 HLS (m3u8)
  if (src.includes('.m3u8')) {
    if (window.Hls && Hls.isSupported()) {
      if (hls) { hls.destroy(); }
      hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(videoEl);
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = src;
    }
  } else {
    videoEl.src = src;
  }
  
  videoEl.poster = poster || '';
  videoEl.load();

  playerModal.hidden = false;
  playerModal.style.display = 'flex';
  document.body.classList.add('modal-open');
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';

  videoEl.play().catch(() => {});
}

function closeVideoPlayer() {
  const playerModal = document.getElementById('video-player-modal');
  const videoEl = document.getElementById('video-player');
  if (!playerModal || !videoEl) return;
  
  if (hls) { hls.destroy(); hls = null; }
  
  videoEl.pause();
  videoEl.removeAttribute('src');
  videoEl.load();
  
  playerModal.hidden = true;
  playerModal.style.display = 'none';
  document.body.classList.remove('modal-open');
  document.body.style.position = '';
  document.body.style.width = '';
}

/* ================= 初始化 ================= */
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initNavToggle();
  initAuthEvents();
  initModalEvents();
  renderAuthArea();
  loadHomeVideos();

  // 绑定客服弹窗关闭
  const cModal = document.getElementById('customer-modal');
  if (cModal) {
    document.querySelector('[data-customer-close]').addEventListener('click', closeCustomerModal);
    cModal.addEventListener('click', (e) => { if (e.target === cModal) closeCustomerModal(); });
  }

  // 绑定视频播放器关闭
  const playerModal = document.getElementById('video-player-modal');
  if (playerModal) {
    document.getElementById('video-close-btn').addEventListener('click', closeVideoPlayer);
    playerModal.addEventListener('click', (e) => { if (e.target === playerModal) closeVideoPlayer(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !playerModal.hidden) closeVideoPlayer();
    });
  }
});
