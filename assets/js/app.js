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
  // 苹果CMS格式通常是 "第1集$http://xxx.m3u8#第2集$http://yyy.m3u8"
  if (urlStr.includes('$')) {
    const parts = urlStr.split('#');
    if (parts.length > 0 && parts[0].includes('$')) {
      return parts[0].split('$')[1];
    }
  }
  return urlStr; // 如果是普通 mp4 直接返回
}

/* ================= 🔴 新增：加载首页动态视频 ================= */
async function loadHomeVideos() {
  const hotRow = document.querySelector('.hot-row');
  if (!hotRow) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/videos`);
    const videos = await res.json();
    
    if (!videos || videos.length === 0) return; // 没数据就保留 HTML 里的静态占位

    // 只取最新的 7 个
    const homeVideos = videos.slice(0, 7);
    const cities = ['北京', '上海', '广州', '成都', '杭州', '深圳', '重庆'];

    hotRow.innerHTML = homeVideos.map((v, index) => {
      const realUrl = parsePlayUrl(v.playUrl);
      const randomLikes = (Math.random() * 5 + 1).toFixed(1) + 'K';
      const city = v.category || cities[index % 7];
      
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
    console.warn('首页视频加载失败，保留静态数据', error);
  }
}

/* ================= bootstrap ================= */
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initNavToggle();
  loadHomeVideos(); // 触发动态视频加载
  if (document.getElementById('register-modal')) {
    initEntry();
    initModal();
  }
});
// ... (后面的 initEntry, initModal, openVideoPlayer 等逻辑保持你原来的不变) ...
