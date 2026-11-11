'use strict';

/* ================= 核心配置 ================= */
const API_BASE_URL = 'https://jiaoyouweb.onrender.com'; 

/* ================= i18n 多语言逻辑 ================= */
// 🔴 将越南语的 vi 改为了 vn，与后台匹配
const SUPPORTED = ['zh', 'en', 'vn', 'es', 'tr', 'id'];
const RTL = new Set(['ar']); 
const LS_KEY = 'hiya_lang';
const dictCache = new Map();      
let enDict = null;                

const COUNTRY_TO_LANG = {
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh',
  VN: 'vn',  // 映射修改为 vn
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es',
  TR: 'tr',
  ID: 'id',
  US: 'en', GB: 'en', AU: 'en', CA: 'en'
};

async function resolveInitialLang() {
  // 1. IP 定位
  try {
    const ipRes = await fetch('https://ipapi.co/json/', { timeout: 3000 });
    const ipData = await ipRes.json();
    const countryCode = ipData.country_code; 
    if (countryCode && COUNTRY_TO_LANG[countryCode]) {
      const mappedLang = COUNTRY_TO_LANG[countryCode];
      if (SUPPORTED.includes(mappedLang)) return mappedLang;
    }
  } catch (e) {}

  // 2. 设备语言
  const cands = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
  for (const tag of cands) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (SUPPORTED.includes(base)) return base;
  }

  // 3. 手动选择
  let saved = null;
  try { saved = localStorage.getItem(LS_KEY); } catch (e) {}
  if (saved && SUPPORTED.includes(saved)) return saved;

  // 4. 默认英文
  return 'en';
}

async function loadDict(lang) {
  if (dictCache.has(lang)) return dictCache.get(lang);
  try {
    const res = await fetch('i18n/' + lang + '.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('not found');
    const dict = await res.json();
    dictCache.set(lang, dict);
    return dict;
  } catch (err) { return null; }
}

function translate(dict, key) {
  if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  if (enDict && Object.prototype.hasOwnProperty.call(enDict, key)) return enDict[key];
  return null;
}

async function applyLang(lang) {
  if (!SUPPORTED.includes(lang)) lang = 'en';
  if (!enDict) { try { enDict = await loadDict('en'); } catch (e) { enDict = {}; } }
  
  let dict = await loadDict(lang);
  if (!dict) { dict = enDict; lang = 'en'; } 

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

  // 更新下拉菜单选中状态
  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.style.fontWeight = opt.dataset.lang === lang ? 'bold' : 'normal';
    opt.style.color = opt.dataset.lang === lang ? '#ff3d8b' : '#3a3f5f';
  });

  // 更新动态数据条的文字
  if (window.initLiveStats) {
    window.initLiveStats(); 
  }

  const titleMap = { zh: '嗨呀直播', en: 'Hiya Live', vn: 'Hiya Live', es: 'Hiya Live', tr: 'Hiya Live', id: 'Hiya Live' };
  document.title = titleMap[lang] || titleMap.en;
}

function initLangSelector() {
  const langBtn = document.getElementById('lang-btn');
  const langDropdown = document.getElementById('lang-dropdown');
  if (!langBtn || !langDropdown) return;

  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    langDropdown.style.display = langDropdown.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', () => {
    if (langDropdown) langDropdown.style.display = 'none';
  });

  langDropdown.querySelectorAll('.lang-option').forEach(opt => {
    opt.addEventListener('click', () => {
      applyLang(opt.dataset.lang);
      langDropdown.style.display = 'none';
    });
  });
}

function initI18n() {
  initLangSelector();
  resolveInitialLang().then(lang => applyLang(lang));
}

/* ================= 实时在线动态模拟 ================= */
let statsTimer = null;
function initLiveStats() {
  const countEl = document.getElementById('online-count');
  const marqueeEl = document.getElementById('live-marquee');
  const avatarsWrap = document.getElementById('live-avatars');
  if (!countEl || !marqueeEl) return;

  // 避免重复开启定时器
  if (statsTimer) clearInterval(statsTimer);

  // 1. 在线人数跳动
  let baseCount = Math.floor(Math.random() * 5000) + 8000; 
  countEl.textContent = baseCount.toLocaleString();
  
  setInterval(() => {
    const increase = Math.floor(Math.random() * 5) + 1;
    baseCount += increase;
    countEl.textContent = baseCount.toLocaleString();
  }, 3000);

  // 2. 播报内容轮播
  const cities = ['北京', '上海', '广州', '深圳', '成都', '杭州', '重庆', '武汉', '南京'];
  
  function updateMarquee() {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const phone = `1${Math.floor(Math.random() * 9) + 3}${Math.floor(Math.random() * 9)}****${Math.floor(Math.random() * 90) + 10}`;
    
    const dict = dictCache.get(document.documentElement.lang) || {};
    const actions = [
      translate(dict, 'stats.action1') || '刚刚匹配了同城女生',
      translate(dict, 'stats.action2') || '成功开启了 1V1 私聊',
      translate(dict, 'stats.action3') || '给心动主播送出了礼物',
      translate(dict, 'stats.action4') || '通过了真人认证'
    ];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const template = translate(dict, 'stats.marquee') || '📢 {city}用户 {phone} {action}';
    
    let text = template.replace('{city}', city).replace('{phone}', phone).replace('{action}', action);

    marqueeEl.style.opacity = 0; 
    setTimeout(() => {
      marqueeEl.textContent = text;
      marqueeEl.style.opacity = 1;
    }, 300);
  }
  
  updateMarquee();
  statsTimer = setInterval(updateMarquee, 4000);

  // 3. 头像轮换
  const avatars = avatarsWrap.querySelectorAll('img');
  setInterval(() => {
    const randomIndex = Math.floor(Math.random() * avatars.length);
    avatars[randomIndex].style.opacity = '0.5';
    setTimeout(() => { avatars[randomIndex].style.opacity = '1'; }, 500);
  }, 2000);
}

/* ================= 其它业务逻辑 ================= */
function initNavToggle() {
  const btn = document.querySelector('[data-nav-toggle]');
  const links = document.querySelector('.nav-links');
  if (!btn || !links) return;
  btn.addEventListener('click', () => {
    links.classList.toggle('is-open');
  });
}

function parsePlayUrl(urlStr) {
  if (!urlStr) return '';
  if (urlStr.includes('$')) {
    const parts = urlStr.split('#');
    if (parts.length > 0 && parts[0].includes('$')) return parts[0].split('$')[1];
  }
  return urlStr; 
}

async function loadHomeVideos() {
  const hotRow = document.getElementById('index-video-list');
  if (!hotRow) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/videos`);
    const videos = await res.json();
    if (!videos || videos.length === 0) return; 

    hotRow.innerHTML = videos.slice(0, 7).map((v, i) => {
      const realUrl = parsePlayUrl(v.playUrl);
      const city = v.category || ['北京','上海','广州','成都','杭州','深圳','重庆'][i%7];
      return `
        <div class="hcard" data-register role="button" tabindex="0" 
             data-video-src="${realUrl}" data-video-poster="${v.pic || 'assets/img/live/1.webp'}">
          <video class="hvideo" autoplay loop muted playsinline poster="${v.pic || 'assets/img/live/1.webp'}"></video>
          <span class="live">LIVE</span>
          <div class="ov"><div class="nm">${v.name}</div><div class="meta"><span class="cty">🇨🇳 <span>${city}</span></span><span>🔥 ${(Math.random() * 5 + 1).toFixed(1)}K</span></div></div>
        </div>
      `;
    }).join('');
  } catch (error) {}
}

function renderAuthArea() {
  const authArea = document.getElementById('auth-area');
  if (!authArea) return;
  const savedUser = localStorage.getItem('hiya_user');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    authArea.innerHTML = `
      <div style="position:relative;">
        <div id="user-trigger" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 8px;">
          <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ff5c9d&color=fff&size=32" style="width:32px;height:32px;border-radius:50%;">
          <span style="font-size:13px;font-weight:600;">${user.name}</span>
        </div>
        <div id="user-dropdown" style="display:none;position:absolute;top:110%;right:0;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.15);padding:8px;min-width:120px;z-index:50;">
          <a href="#" id="logout-btn" style="display:block;padding:8px 12px;font-size:13px;color:#ff3d8b;">🚪 退出登录</a>
        </div>
      </div>
    `;
    const trigger = document.getElementById('user-trigger');
    const dropdown = document.getElementById('user-dropdown');
    trigger.onclick = (e) => { e.stopPropagation(); dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none'; };
    document.addEventListener('click', () => { dropdown.style.display = 'none'; });
    document.getElementById('logout-btn').onclick = (e) => {
      e.preventDefault(); localStorage.removeItem('hiya_user'); window.location.reload();
    };
  } else {
    authArea.innerHTML = `<a class="login-btn" data-i18n="nav.login" data-register role="button" tabindex="0">登录 / 注册</a>`;
    // 重新应用翻译
    const lang = document.documentElement.lang || 'zh';
    const dict = dictCache.get(lang) || enDict || {};
    if (dict['nav.login']) {
      authArea.querySelector('.login-btn').textContent = dict['nav.login'];
    }
  }
}

function initAuthEvents() {
  document.addEventListener('click', (e) => {
    const noRegister = e.target.closest('[data-legal],.lang-wrap,[data-nav-toggle],.modal-overlay');
    if (noRegister && !e.target.closest('.modal-dialog')) return;
    const hit = e.target.closest('[data-register]');
    if (!hit) return;

    if (hit.hasAttribute('data-video-src')) {
      e.preventDefault(); e.stopPropagation(); openVideoPlayer(hit); return;
    }
    e.preventDefault();
    const savedUser = localStorage.getItem('hiya_user');
    if (savedUser) openCustomerModal(); else openRegisterModal(); 
  });
}

let lastFocused = null, scrollY = 0, submitting = false;

function showView(name) {
  document.querySelectorAll('#register-modal .modal-view').forEach((v) => {
    v.hidden = v.getAttribute('data-view') !== name;
  });
}

function openRegisterModal() {
  const overlay = document.getElementById('register-modal');
  if (!overlay) return;
  lastFocused = document.activeElement;
  showView('form');
  overlay.hidden = false; overlay.style.display = 'flex';
  scrollY = window.scrollY;
  document.body.style.top = (-scrollY) + 'px';
  document.body.classList.add('modal-open');
  document.body.style.position = 'fixed'; document.body.style.width = '100%';
}
window.openRegisterModal = openRegisterModal;

function closeRegisterModal() {
  const overlay = document.getElementById('register-modal');
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true; overlay.style.display = 'none';
  document.body.classList.remove('modal-open');
  document.body.style.position = ''; document.body.style.top = ''; document.body.style.width = '';
  window.scrollTo(0, scrollY);
}
window.closeModal = closeRegisterModal;
window.showLoginView = () => showView('login');
window.showRegisterView = () => showView('form');

function initModalEvents() {
  const overlay = document.getElementById('register-modal');
  if (!overlay) return;
  overlay.querySelector('[data-modal-close]').onclick = closeRegisterModal;
  overlay.onclick = (e) => { if (e.target === overlay) closeRegisterModal(); };
  overlay.querySelector('[data-register-form]').onsubmit = onSubmitRegister;
  overlay.querySelector('[data-login-form]').onsubmit = onSubmitLogin;
}

function onSubmitRegister(e) {
  e.preventDefault(); if (submitting) return;
  const form = e.currentTarget; if (!form.checkValidity()) { form.reportValidity(); return; }
  const btn = form.querySelector('.modal-submit'), errorBox = form.querySelector('[data-form-error]');
  const data = { name: form.name.value.trim(), email: form.email.value.trim(), password: form.password.value };
  btn.disabled = true; btn.textContent = '提交中…'; if (errorBox) errorBox.style.display = 'none'; submitting = true;

  fetch(`${API_BASE_URL}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  .then(async (res) => { const r = await res.json().catch(()=>({})); if (!res.ok) throw new Error(r.error || '失败'); return r; })
  .then((r) => {
    localStorage.setItem('hiya_user', JSON.stringify(r.user)); submitting = false; form.reset();
    showView('welcome'); renderAuthArea();
  }).catch((err) => {
    submitting = false; btn.disabled = false; btn.textContent = '免费注册';
    if (errorBox) { errorBox.textContent = err.message; errorBox.style.display = 'block'; }
  });
}

function onSubmitLogin(e) {
  e.preventDefault(); if (submitting) return;
  const form = e.currentTarget; if (!form.checkValidity()) { form.reportValidity(); return; }
  const btn = form.querySelector('.modal-submit'), errorBox = form.querySelector('[data-login-error]');
  const data = { email: form.email.value.trim(), password: form.password.value };
  btn.disabled = true; btn.textContent = '登录中…'; if (errorBox) errorBox.style.display = 'none'; submitting = true;

  fetch(`${API_BASE_URL}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  .then(async (res) => { const r = await res.json().catch(()=>({})); if (!res.ok) throw new Error(r.error || '失败'); return r; })
  .then((r) => {
    localStorage.setItem('hiya_user', JSON.stringify(r.user)); submitting = false; form.reset();
    showView('welcome'); renderAuthArea();
  }).catch((err) => {
    submitting = false; btn.disabled = false; btn.textContent = '登录';
    if (errorBox) { errorBox.textContent = err.message; errorBox.style.display = 'block'; }
  });
}

let customerTimer = null;
function openCustomerModal() {
  const overlay = document.getElementById('customer-modal');
  if (!overlay) return;
  overlay.hidden = false; overlay.style.display = 'flex';
  document.getElementById('customer-countdown-area').style.display = 'block';
  document.getElementById('customer-result-area').style.display = 'none';
  document.getElementById('customer-timer').textContent = '15';
  if (customerTimer) clearInterval(customerTimer);
  let count = 15;
  customerTimer = setInterval(() => {
    count--; document.getElementById('customer-timer').textContent = count;
    if (count <= 0) {
      clearInterval(customerTimer); customerTimer = null;
      document.getElementById('customer-countdown-area').style.display = 'none';
      document.getElementById('customer-result-area').style.display = 'block';
    }
  }, 1000);
}
function closeCustomerModal() {
  const overlay = document.getElementById('customer-modal');
  if (!overlay) return;
  if (customerTimer) { clearInterval(customerTimer); customerTimer = null; }
  overlay.hidden = true; overlay.style.display = 'none';
}

let hls = null;
let videoLimitHandler = null;

function openVideoPlayer(card) {
  const playerModal = document.getElementById('video-player-modal');
  const videoEl = document.getElementById('video-player');
  const limitOverlay = document.getElementById('video-limit-overlay');
  if (!playerModal || !videoEl) return;
  
  const src = card.getAttribute('data-video-src');
  const poster = card.getAttribute('data-video-poster');
  const name = card.querySelector('.nm')?.textContent || '';
  const meta = card.querySelector('.meta')?.textContent?.replace(/\s+/g, ' ').trim() || '';

  if (!src) { alert('该视频暂未配置播放源'); return; }

  document.getElementById('video-player-name').textContent = name;
  document.getElementById('video-player-meta').textContent = meta;
  
  limitOverlay.style.display = 'none';

  if (src.includes('.m3u8')) {
    if (window.Hls && Hls.isSupported()) {
      if (hls) { hls.destroy(); }
      hls = new Hls(); hls.loadSource(src); hls.attachMedia(videoEl);
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) { videoEl.src = src; }
  } else {
    videoEl.src = src;
  }
  
  videoEl.poster = poster || '';
  videoEl.load();

  playerModal.hidden = false; playerModal.style.display = 'flex';
  document.body.classList.add('modal-open');
  document.body.style.position = 'fixed'; document.body.style.width = '100%';

  videoEl.play().catch(() => {});

  if (videoLimitHandler) videoEl.removeEventListener('timeupdate', videoLimitHandler);
  const isLoggedIn = !!localStorage.getItem('hiya_user');

  if (!isLoggedIn) {
    videoLimitHandler = function() {
      if (videoEl.currentTime >= 15 && limitOverlay.style.display !== 'flex') {
        videoEl.pause();
        limitOverlay.style.display = 'flex';
      }
    };
    videoEl.addEventListener('timeupdate', videoLimitHandler);
  }
}

function closeVideoPlayer() {
  const playerModal = document.getElementById('video-player-modal');
  const videoEl = document.getElementById('video-player');
  if (!playerModal || !videoEl) return;
  
  if (hls) { hls.destroy(); hls = null; }
  if (videoLimitHandler) { videoEl.removeEventListener('timeupdate', videoLimitHandler); videoLimitHandler = null; }
  
  videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load();
  
  playerModal.hidden = true; playerModal.style.display = 'none';
  document.body.classList.remove('modal-open');
  document.body.style.position = ''; document.body.style.width = '';
}
window.closeVideoPlayer = closeVideoPlayer;

document.addEventListener('DOMContentLoaded', () => {
  initI18n(); 
  initNavToggle(); 
  initAuthEvents(); 
  initModalEvents(); 
  renderAuthArea(); 
  loadHomeVideos();
  initLiveStats(); 

  const cModal = document.getElementById('customer-modal');
  if (cModal) {
    document.querySelector('[data-customer-close]').onclick = closeCustomerModal;
    cModal.onclick = (e) => { if (e.target === cModal) closeCustomerModal(); };
  }

  const playerModal = document.getElementById('video-player-modal');
  if (playerModal) {
    document.getElementById('video-close-btn').onclick = closeVideoPlayer;
    playerModal.onclick = (e) => { if (e.target === playerModal) closeVideoPlayer(); };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !playerModal.hidden) closeVideoPlayer();
    });
  }
});
