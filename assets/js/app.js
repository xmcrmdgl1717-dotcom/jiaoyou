'use strict';

const API_BASE_URL = 'https://jiaoyouweb.onrender.com'; 

/* ================= i18n 多语言逻辑 ================= */
const SUPPORTED = ['zh', 'en', 'vn', 'es', 'tr', 'id'];
const LS_KEY = 'hiya_lang';
const dictCache = new Map();      
let enDict = null;                

const COUNTRY_TO_LANG = {
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh',
  VN: 'vn', ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es',
  TR: 'tr', ID: 'id', US: 'en', GB: 'en', AU: 'en', CA: 'en'
};

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

// 🔴 核心修改：改为从后端 API 获取语言包
async function loadDict(lang) {
  if (dictCache.has(lang)) return dictCache.get(lang);
  try {
    const res = await fetch(`${API_BASE_URL}/api/i18n/${lang}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error('not found');
    const dict = await res.json();
    dictCache.set(lang, dict);
    return dict;
  } catch (err) { 
    console.warn(`[i18n] 获取 ${lang} 失败，回退`);
    return null; 
  }
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

/* ================= 其它业务逻辑 (保持不变) ================= */
// ... [保留你原有的 在线动态、视频加载、弹窗逻辑等] ...
// 将之前发给你的 app.js 的业务逻辑原封不动拼在下面即可，不需要做任何修改。
