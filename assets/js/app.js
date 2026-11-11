'use strict';

/* ================= 核心配置 ================= */
const API_BASE_URL = 'https://jiaoyouweb.onrender.com'; 
let globalConfig = { hotConfig: {}, recommendConfig: {}, freeConfig: {}, trc20: '' };
let currentVisitId = '';

async function fetchGlobalConfig() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/config`);
        globalConfig = await res.json();
        console.log('首页全局配置已加载:', globalConfig);
    } catch(e) { console.warn('配置拉取失败'); }
}

// 记录访客信息
async function trackVisit() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/visit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lang: localStorage.getItem('hiya_lang') || 'zh' })
        });
        const data = await res.json();
        if(data.visitId) {
            currentVisitId = data.visitId;
            sessionStorage.setItem('hiya_visit_id', data.visitId);
        }
    } catch(e) { console.warn('访客记录失败', e); }
}

/* ================= i18n 多语言逻辑 ================= */
const SUPPORTED = ['zh', 'en', 'vn', 'es', 'tr', 'id'];
const RTL = new Set(['ar']); 
const LS_KEY = 'hiya_lang';
const dictCache = new Map();      
let enDict = null;                
const COUNTRY_TO_LANG = { CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh', VN: 'vn', ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es', TR: 'tr', ID: 'id', US: 'en', GB: 'en', AU: 'en', CA: 'en' };

async function resolveInitialLang() {
  try {
    const ipRes = await fetch('https://ipapi.co/json/', { timeout: 3000 });
    const ipData = await ipRes.json();
    const countryCode = ipData.country_code; 
    if (countryCode && COUNTRY_TO_LANG[countryCode]) {
      const mappedLang = COUNTRY_TO_LANG[countryCode];
      if (SUPPORTED.includes(mappedLang)) return mappedLang;
    }
  } catch (e) {}
  const cands = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'en'];
  for (const tag of cands) {
    const base = String(tag).toLowerCase().split('-')[0];
    if (SUPPORTED.includes(base)) return base;
  }
  let saved = null;
  try { saved = localStorage.getItem(LS_KEY); } catch (e) {}
  if (saved && SUPPORTED.includes(saved)) return saved;
  return 'en';
}

async function loadDict(lang) {
  if (dictCache.has(lang)) return dictCache.get(lang);
  try {
    const res = await fetch(`${API_BASE_URL}/api/i18n/${lang}`, { cache: 'no-cache' });
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

  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.style.fontWeight = opt.dataset.lang === lang ? 'bold' : 'normal';
    opt.style.color = opt.dataset.lang === lang ? '#ff3d8b' : '#3a3f5f';
  });

  if (window.initLiveStats) window.initLiveStats(); 
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
  if (statsTimer) clearInterval(statsTimer);

  let baseCount = Math.floor(Math.random() * 5000) + 8000; 
  countEl.textContent = baseCount.toLocaleString();
  setInterval(() => {
    const increase = Math.floor(Math.random() * 5) + 1;
    baseCount += increase;
    countEl.textContent = baseCount.toLocaleString();
  }, 3000);

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
    setTimeout(() => { marqueeEl.textContent = text; marqueeEl.style.opacity = 1; }, 300);
  }
  updateMarquee();
  statsTimer = setInterval(updateMarquee, 4000);

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
  btn.addEventListener('click', () => { links.classList.toggle('is-open'); });
}

function parsePlayUrl(urlStr) {
  if (!urlStr) return '';
  if (urlStr.includes('$')) {
    const parts = urlStr.split('#');
    if (parts.length > 0 && parts[0].includes('$')) return parts[0].split('$')[1];
  }
  return urlStr; 
}

// 加载免费精选
async function loadFreeVideos() {
  const freeRow = document.getElementById('index-free-list');
  if (!freeRow) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/videos/free`);
    const videos = await res.json();
    if (!videos || videos.length === 0) return; 

    freeRow.innerHTML = videos.slice(0, 7).map((v, i) => {
      const realUrl = parsePlayUrl(v.playUrl);
      const city = v.category || ['北京','上海','广州','成都','杭州','深圳','重庆'][i%7];
      return `
        <div class="hcard" data-register role="button" tabindex="0" 
             data-config-type="free" data-video-id="${v.id}"
             data-video-src="${realUrl}" data-video-poster="${v.pic || 'assets/img/live/1.webp'}">
          <video class="hvideo" autoplay loop muted playsinline poster="${v.pic || 'assets/img/live/1.webp'}"></video>
          <span class="live">FREE</span>
          <div class="ov"><div class="nm">${v.name}</div><div class="meta"><span class="cty">🇨🇳 <span>${city}</span></span><span>🔥 ${(Math.random() * 5 + 1).toFixed(1)}K</span></div></div>
        </div>
      `;
    }).join('');
  } catch (error) {}
}

// 加载精彩视频
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
             data-config-type="hot" data-video-id="${v.id}"
             data-video-src="${realUrl}" data-video-poster="${v.pic || 'assets/img/live/1.webp'}">
          <video class="hvideo" autoplay loop muted playsinline poster="${v.pic || 'assets/img/live/1.webp'}"></video>
          <span class="live">LIVE</span>
          <div class="ov"><div class="nm">${v.name}</div><div class="meta"><span class="cty">🇨🇳 <span>${city}</span></span><span>🔥 ${(Math.random() * 5 + 1).toFixed(1)}K</span></div></div>
        </div>
      `;
    }).join('');
  } catch (error) {}
}

// 加载直播推荐
async function loadRecommendVideos() {
  const recommendRow = document.getElementById('index-recommend-list');
  if (!recommendRow) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/videos/recommend`);
    const videos = await res.json();
    if (!videos || videos.length === 0) return; 

    recommendRow.innerHTML = videos.slice(0, 7).map((v, i) => {
      const realUrl = parsePlayUrl(v.playUrl);
      const city = v.category || ['北京','上海','广州','成都','杭州','深圳','重庆'][i%7];
      return `
        <div class="hcard" data-register role="button" tabindex="0" 
             data-config-type="recommend" data-video-id="${v.id}"
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
    const lang = document.documentElement.lang || 'zh';
    const dict = dictCache.get(lang) || enDict || {};
    if (dict['nav.login']) authArea.querySelector('.login-btn').textContent = dict['nav.login'];
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
  document.querySelectorAll('#register-modal .modal-view').forEach((v) => { v.hidden = v.getAttribute('data-view') !== name; });
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

// 注册时携带 visitId
function onSubmitRegister(e) {
  e.preventDefault(); if (submitting) return;
  const form = e.currentTarget; if (!form.checkValidity()) { form.reportValidity(); return; }
  const btn = form.querySelector('.modal-submit'), errorBox = form.querySelector('[data-form-error]');
  const data = { 
      name: form.name.value.trim(), 
      email: form.email.value.trim(), 
      password: form.password.value,
      visitId: currentVisitId || sessionStorage.getItem('hiya_visit_id') 
  };
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

/* ================= 首页视频播放与限制逻辑 (两步式) ================= */
let hls = null;
let videoLimitHandler = null;
let currentVideoId = null;
let currentVideoName = '';

function isVideoPurchased(vid) {
  let purchased = JSON.parse(localStorage.getItem('purchased_videos') || '[]');
  return purchased.includes(vid);
}
function markVideoPurchased(vid) {
  let purchased = JSON.parse(localStorage.getItem('purchased_videos') || '[]');
  if(!purchased.includes(vid)) { purchased.push(vid); localStorage.setItem('purchased_videos', JSON.stringify(purchased)); }
}

function openVideoPlayer(card) {
  const playerModal = document.getElementById('video-player-modal');
  const videoEl = document.getElementById('video-player');
  const limitOverlay = document.getElementById('video-limit-overlay');
  const progressFill = document.getElementById('video-progress-fill');
  const timeText = document.getElementById('video-time-text');
  const timePrice = document.getElementById('video-time-price');
  
  if (!playerModal || !videoEl) return;
  
  const src = card.getAttribute('data-video-src');
  const vid = card.getAttribute('data-video-id');
  const configType = card.getAttribute('data-config-type') || 'hot';
  currentVideoName = card.querySelector('.nm')?.textContent || '未知视频';
  
  if (!src) { alert('该视频暂未配置播放源'); return; }

  currentVideoId = vid;
  limitOverlay.style.display = 'none';
  playerModal.hidden = false; playerModal.style.display = 'flex';
  document.body.classList.add('modal-open');
  document.body.style.overflow = 'hidden';

  if (src.includes('.m3u8') && window.Hls && Hls.isSupported()) {
    if (hls) { hls.destroy(); }
    hls = new Hls(); hls.loadSource(src); hls.attachMedia(videoEl);
  } else { videoEl.src = src; }
  
  videoEl.play().catch(() => {});

  const isLogin = !!localStorage.getItem('hiya_user');
  const isPurchased = isVideoPurchased(vid);
  
  let configData = configType === 'free' ? globalConfig.freeConfig : (configType === 'recommend' ? globalConfig.recommendConfig : globalConfig.hotConfig);
  let previewLimit = configData?.previewLimit ?? null;
  let regLimit = configData?.regLimit ?? null;
  let price = configData?.unlockPrice ?? null;

  let maxTime = isPurchased ? Infinity : (isLogin ? regLimit : previewLimit);

  if (videoLimitHandler) videoEl.removeEventListener('timeupdate', videoLimitHandler);

  if (isPurchased || maxTime === null || maxTime <= 0) {
    timeText.innerText = "已解锁完整版";
    timePrice.innerText = "";
    progressFill.style.width = '0%';
    progressFill.style.background = '#4ade80';
  } else {
    if (!isLogin) {
      timeText.innerText = `试看剩余: ${maxTime} 秒（注册解锁）`;
    } else {
      timeText.innerText = `试看剩余: ${maxTime} 秒`;
      if (price !== null) timePrice.innerText = `解锁需 ${price} USDT`;
    }
    progressFill.style.width = '0%';
    progressFill.style.background = 'linear-gradient(90deg, #ff9a4d, #ff4d94)';
  }

  let isBlocked = false;
  videoLimitHandler = () => {
    const curTime = videoEl.currentTime;
    if (!isBlocked && maxTime !== Infinity && maxTime > 0) {
      const remain = Math.max(0, maxTime - curTime);
      if (!isLogin) {
        timeText.innerText = `试看剩余: ${Math.ceil(remain)} 秒（注册解锁）`;
      } else {
        timeText.innerText = `试看剩余: ${Math.ceil(remain)} 秒`;
      }
      progressFill.style.width = `${Math.min(100, (curTime / maxTime) * 100)}%`;
      
      if (curTime >= maxTime) {
        videoEl.pause(); 
        isBlocked = true; 
        showVideoPaywall(limitOverlay, vid, isLogin, price, globalConfig.trc20, configType);
      }
    }
    if (isBlocked && curTime < maxTime - 1) {
      isBlocked = false; limitOverlay.style.display = 'none'; videoEl.play();
    }
  };
  videoEl.addEventListener('timeupdate', videoLimitHandler);
}

// 第一步：展示地址与金额，点击“我已转账”去填写
function showVideoPaywall(overlay, vid, isLogin, price, trc20, configType) {
  if (!isLogin) {
    overlay.innerHTML = `<h3>试看已结束</h3><p style="font-size:13px; opacity:0.8; margin-bottom:20px;">请先登录/注册观看完整版</p><button onclick="window.closeVideoPlayer(); window.openRegisterModal();" style="background:linear-gradient(90deg,#ff9a4d,#ff4d94); color:#fff; border:none; padding:12px 30px; border-radius:25px; font-size:15px; font-weight:bold; cursor:pointer;">去登录</button>`;
    overlay.style.display = 'flex'; return;
  }
  if (price === null) {
    overlay.innerHTML = `<h3>试看已结束</h3><p style="font-size:13px; opacity:0.8;">请联系客服开通观看权限</p>`;
    overlay.style.display = 'flex'; return;
  }

  overlay.innerHTML = `
    <h3>试看已结束</h3>
    <p>开通全集需支付 <strong style="color:#ff1a75;">${price} USDT</strong></p>
    <p style="font-size:12px;opacity:0.7;margin-bottom:10px;">TRC20 转账地址:</p>
    <div style="background:#333; padding:8px; border-radius:4px; font-family:monospace; word-break:break-all; font-size:12px; margin-bottom:20px; width:100%;">${trc20}</div>
    
    <button onclick="showPayForm('${vid}', ${price}, '${configType}')" id="go-pay-btn" style="background:linear-gradient(90deg,#ff9a4d,#ff4d94); color:#fff; border:none; padding:12px 30px; border-radius:25px; font-size:15px; font-weight:bold; cursor:pointer;">我已转账，去填写凭证</button>
    <div id="home-pay-detail" style="margin-top:15px; font-size:14px; color:#fff;"></div>
  `;
  overlay.style.display = 'flex';
}

// 第二步：下拉框+输入框
window.showPayForm = function(vid, price, configType) {
  const overlay = document.getElementById('video-limit-overlay');
  overlay.innerHTML = `
    <h3>提交付款凭证</h3>
    <div style="text-align:left; font-size:12px; margin-bottom:10px; width: 100%; max-width: 300px;">
      <label style="display:block; margin-bottom:5px; color:#aaa;">选择联系方式并填写：</label>
      <div style="display:flex; gap:10px; margin-bottom:10px;">
        <select id="pay-contact-type" style="flex:1; padding:8px; border-radius:4px; border:1px solid #ccc; color:#000;">
          <option value="Telegram">Telegram</option>
          <option value="WhatsApp">WhatsApp</option>
        </select>
        <input type="text" id="pay-contact-value" placeholder="输入账号" style="flex:2; padding:8px; border-radius:4px; border:1px solid #ccc; color:#000;">
      </div>
      
      <label style="display:block; margin-bottom:5px; color:#aaa;">你的付款TRC20地址：</label>
      <input type="text" id="pay-address" placeholder="请输入你的付款地址" style="width:100%; padding:8px; border-radius:4px; border:1px solid #ccc; color:#000;">
    </div>
    
    <button onclick="generateHomeOrder('${vid}', ${price}, '${configType}')" id="gen-home-order-btn" style="background:linear-gradient(90deg,#ff9a4d,#ff4d94); color:#fff; border:none; padding:12px 30px; border-radius:25px; font-size:15px; font-weight:bold; cursor:pointer; margin-top:10px;">确认提交</button>
    <div id="home-pay-detail" style="margin-top:15px; font-size:14px; color:#fff;"></div>
  `;
}

async function generateHomeOrder(vid, price, configType) {
  const btn = document.getElementById('gen-home-order-btn');
  
  const cType = document.getElementById('pay-contact-type').value;
  const cVal = document.getElementById('pay-contact-value').value.trim();
  const payAddress = document.getElementById('pay-address').value.trim();
  const contact = cVal ? `${cType}: ${cVal}` : '';

  if(!cVal) return alert('请填写联系方式账号');
  if(!payAddress) return alert('请填写您的付款 TRC20 地址');

  btn.disabled = true; btn.innerText = '提交中...';
  
  const userStr = localStorage.getItem('hiya_user');
  let user = { id: 'guest', name: '游客', email: '未知' };
  if (userStr) { const parsed = JSON.parse(userStr); user = { id: parsed.id, name: parsed.name, email: parsed.email }; }

  try {
    const res = await fetch(`${API_BASE_URL}/api/orders/create`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            baseAmount: price,
            userId: user.id, userName: user.name, userEmail: user.email,
            videoId: vid, videoName: currentVideoName, configType: configType,
            visitId: currentVisitId || sessionStorage.getItem('hiya_visit_id'),
            contact: contact, payAddress: payAddress
        })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    document.getElementById('home-pay-detail').innerHTML = `
      <p style="color:#4ade80; font-weight:bold; margin-bottom:5px;">提交成功！</p>
      <p style="font-size:11px; opacity:0.7; margin-bottom:15px;">请等待客服审核，通过后即可观看</p>
      <button onclick="mockHomePaySuccess('${vid}')" class="unlock-btn" style="background:#4ade80; color:#fff; border:none; padding:10px 20px; border-radius:20px; font-weight:bold; cursor:pointer;">【测试】立即解锁</button>
    `;
  } catch(e) {
    alert('提交失败: ' + e.message);
    btn.disabled = false; btn.innerText = '确认提交';
  }
}

function mockHomePaySuccess(vid) {
  markVideoPurchased(vid); 
  alert('支付成功！已解锁该视频完整版');
  document.getElementById('video-limit-overlay').style.display = 'none';
  
  document.getElementById('video-time-text').innerText = "已解锁完整版";
  document.getElementById('video-time-price').innerText = "";
  const fill = document.getElementById('video-progress-fill');
  fill.style.width = '0%'; fill.style.background = '#4ade80';
  
  const videoEl = document.getElementById('video-player');
  videoEl.currentTime = 0; videoEl.play();
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
  document.body.style.overflow = '';
}
window.closeVideoPlayer = closeVideoPlayer;

document.addEventListener('DOMContentLoaded', async () => {
  await trackVisit(); 
  await fetchGlobalConfig(); 
  initI18n(); 
  initNavToggle(); 
  initAuthEvents(); 
  initModalEvents(); 
  renderAuthArea(); 
  loadFreeVideos(); 
  loadHomeVideos();
  loadRecommendVideos(); 
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
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !playerModal.hidden) closeVideoPlayer(); });
  }
});
