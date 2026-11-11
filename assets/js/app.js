'use strict';

const API_BASE_URL = 'https://jiaoyouweb.onrender.com'; 

/* ================= i18n 多语言逻辑 ================= */
const SUPPORTED = ['zh', 'en', 'vi', 'es', 'tr', 'id'];
const LS_KEY = 'hiya_lang';
const dictCache = new Map();      
let enDict = null;                
let currentDict = {}; // 当前生效的字典

const COUNTRY_TO_LANG = {
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh',
  VN: 'vi',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', CL: 'es',
  TR: 'tr',
  ID: 'id',
  US: 'en', GB: 'en', AU: 'en', CA: 'en'
};

// 🔴 严格按要求：1. IP -> 2. 设备语言 -> 3. 手动选择 -> 4. 默认英文
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

  // 3. 手动选择 (localStorage)
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
  
  currentDict = dict; // 保存给动态内容使用

  // 替换静态 HTML 元素
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
}

/* ================= 实时在线动态模拟 (支持多语言) ================= */
function initLiveStats() {
  const countEl = document.getElementById('online-count');
  const marqueeEl = document.getElementById('live-marquee');
  const avatarsWrap = document.getElementById('live-avatars');
  if (!countEl || !marqueeEl) return;

  // 在线人数跳动
  let baseCount = Math.floor(Math.random() * 5000) + 8000;
  countEl.textContent = baseCount.toLocaleString();
  setInterval(() => {
    baseCount += Math.floor(Math.random() * 5) + 1;
    countEl.textContent = baseCount.toLocaleString();
  }, 3000);

  // 播报内容轮播 (国际化)
  function updateMarquee() {
    const cities = ['北京', '上海', '广州', '深圳', '成都', '杭州', '重庆', '武汉', '南京'];
    const city = cities[Math.floor(Math.random() * cities.length)];
    const phone = `1${Math.floor(Math.random() * 9) + 3}${Math.floor(Math.random() * 9)}****${Math.floor(Math.random() * 90) + 10}`;
    
    // 从字典中取 Action 和 模板
    const actions = [
      translate(currentDict, 'stats.action1') || '刚刚匹配了同城女生',
      translate(currentDict, 'stats.action2') || '成功开启了 1V1 私聊',
      translate(currentDict, 'stats.action3') || '给心动主播送出了礼物',
      translate(currentDict, 'stats.action4') || '通过了真人认证'
    ];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const template = translate(currentDict, 'stats.marquee') || '📢 {city}用户 {phone} {action}';
    
    // 替换模板中的变量
    let text = template.replace('{city}', city).replace('{phone}', phone).replace('{action}', action);

    marqueeEl.style.opacity = 0;
    setTimeout(() => {
      marqueeEl.textContent = text;
      marqueeEl.style.opacity = 1;
    }, 300);
  }
  
  updateMarquee();
  setInterval(updateMarquee, 4000);

  const avatars = avatarsWrap.querySelectorAll('img');
  setInterval(() => {
    const randomIndex = Math.floor(Math.random() * avatars.length);
    avatars[randomIndex].style.opacity = '0.5';
    setTimeout(() => { avatars[randomIndex].style.opacity = '1'; }, 500);
  }, 2000);
}

/* ================= 其它业务逻辑 ================= */
// 启动
document.addEventListener('DOMContentLoaded', async () => {
  // 先加载语言包，加载完再启动其他
  const initialLang = await resolveInitialLang();
  await applyLang(initialLang);

  initLangSelector();
  initNavToggle();
  initAuthEvents();
  initModalEvents();
  renderAuthArea();
  loadHomeVideos();
  initLiveStats(); // 启动动态播报

  // ... 绑定弹窗关闭事件等 ...
});
