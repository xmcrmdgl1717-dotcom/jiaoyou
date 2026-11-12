const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const xml2js = require('xml2js');
const axios = require('axios');
const multer = require('multer');
const geoip = require('geoip-lite'); 

const app = express();
const PORT = process.env.PORT || 3000;

// ================= 路径初始化 =================
const DATA_DIR = path.join(__dirname, 'data');
const I18N_DIR = path.join(DATA_DIR, 'i18n');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(I18N_DIR)) fs.mkdirSync(I18N_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const SITES_FILE = path.join(DATA_DIR, 'resource_sites.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const VISITS_FILE = path.join(DATA_DIR, 'visits.json'); 

function readJSON(file, defaultVal = {}) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return defaultVal; } }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

const zhDefault = {
  "brand.name":"嗨呀直播","nav.subtitle":"同城交友 遇见心动","nav.home":"首页","nav.live":"直播","nav.drama":"AI剧场","nav.rank":"排行榜","nav.community":"社区","nav.benefits":"福利中心","nav.more":"更多","nav.login":"登录 / 注册","hero.badge":"真实同城 ✨","hero.title1":"同城心动","hero.title2":"1V1交友","hero.subtitle":"真实认证 · 同城速配 · 遇见身边的心动","hero.chip1.t1":"同城速配","hero.chip1.t2":"距离优先","hero.chip2.t1":"1V1视频","hero.chip2.t2":"私聊","hero.chip3.t1":"真人认证","hero.chip3.t2":"真实交友","hero.chip4.t1":"隐私安全","hero.chip4.t2":"加密保护","hero.promo.title":"遇见身边的TA","hero.promo.amount":"同城1V1","hero.promo.desc":"真实认证，拒绝照骗","hero.promo.btn":"立即免费匹配 ›","hero.promo.note":"注册仅需20秒，即刻开启同城速配","live.title":"正在热播","live.more":"更多人气主播 ›","feat.1.t1":"同城推荐","feat.1.t2":"发现身边的TA","feat.2.t1":"1V1私聊","feat.2.t2":"独享心动时刻","feat.3.t1":"AI短剧乐园","feat.3.t2":"沉浸剧情每日更新","feat.4.t1":"礼物打赏","feat.4.t2":"送礼物传心意","feat.5.t1":"安全私密","feat.5.t2":"加密保护隐私无忧","feat.6.t1":"多端支持","feat.6.t2":"手机·平板·电脑","card.live.tag":"热门","card.left.title":"全球直播大厅","card.left.p1":"与全球主播实时互动","card.left.p2":"真实陪伴·聆听声音·分享生活","card.left.btn":"进入直播大厅 ›","card.new.tag":"最新","card.right.title":"AI短剧乐园","card.right.p1":"原创AI短剧精彩不断","card.right.p2":"多元题材·沉浸体验·每日更新","card.right.btn":"看AI短剧 ›","hot.title":"🔥 精彩视频","hot.more":"全部视频 ›","recommend.title":"🔥 直播推荐","recommend.more":"查看更多 ›","free.title":"🎁 免费精选","free.more":"全部免费 ›","steps.title":"简单四步，开启同城交友","steps.1.t1":"注册账号","steps.1.t2a":"简单注册，完善资料","steps.1.t2b":"大约20秒","steps.2.t1":"真人认证","steps.2.t2a":"真实核验，保障交友安全","steps.2.t2b":"隐私保护","steps.3.t1":"同城匹配","steps.3.t2a":"基于位置","steps.3.t2b":"推荐身边的TA","steps.4.t1":"开始交友","steps.4.t2a":"畅享1V1私密互动","steps.4.t2b":"遇见心动的人","steps.timer":"20秒","stats.online":"🔥 当前 <span id=\"online-count\">0</span> 人在线速配","stats.marquee":"📢 {city}用户 {phone} {action}","stats.action1":"刚刚匹配了同城女生","stats.action2":"成功开启了 1V1 私聊","stats.action3":"给心动主播送出了礼物","stats.action4":"通过了真人认证","cta.text":"遇见同城心动的TA，开启 <b>1V1私聊</b>","cta.note":"注册仅需20秒，即刻开启同城速配","cta.btn":"立即免费注册 →","footer.subtitle":"同城交友 遇见心动","footer.col1.title":"关于我们","footer.col1.a1":"关于嗨呀直播","footer.col1.a2":"联系我们","footer.col1.a3":"合作伙伴","footer.col2.title":"帮助中心","footer.col2.a1":"常见问题","footer.col2.a2":"使用条款","footer.col2.a3":"隐私政策","footer.col3.title":"社区","footer.col3.a1":"社区准则","footer.col3.a2":"主播招募","footer.col3.a3":"举报中心","footer.col4.title":"下载App","footer.col5.title":"安全支付","footer.age":"🔞 仅限18岁以上用户","footer.privacy":"🔒 我们致力于保护您的隐私与数据安全","footer.copyright":"© 2026 嗨呀直播. 保留所有权利。","modal.close":"关闭","modal.title":"创建你的交友账号","modal.field.name":"昵称","modal.field.name.hint":"2–40 个字符","modal.field.email":"邮箱","modal.field.password":"密码","modal.field.password.hint":"至少 8 个字符","modal.field.agree.pre":"我已阅读并同意","modal.field.agree.terms":"使用条款","modal.field.agree.and":"和","modal.field.agree.privacy":"隐私政策","modal.submit":"免费注册","modal.submitting":"提交中…","modal.login.title":"登录你的账号","modal.login.submit":"登录","modal.welcome.title":"欢迎回来！","modal.welcome.desc":"你已成功登录。","modal.welcome.cta":"开始探索","customer.title":"专属客服","customer.desc":"请选择您偏好的客服方式","customer.matching":"正在为你匹配...","customer.seconds":"秒后为你揭晓","customer.success":"联系客服","customer.tip":"请选择您方便的渠道","customer.btn":"联系客服","video.limit.title":"试看已结束","video.limit.desc":"注册登录后可无限畅看完整版视频","video.limit.btn":"免费注册 / 登录"
};

if (!fs.existsSync(path.join(I18N_DIR, 'zh.json'))) writeJSON(path.join(I18N_DIR, 'zh.json'), zhDefault);

if (!fs.existsSync(SETTINGS_FILE)) writeJSON(SETTINGS_FILE, { 
    trc20: '', hotCats: [], recommendCats: [], freeCats: [], 
    hotConfig: { previewLimit: null, regLimit: null, unlockPrice: null },
    recommendConfig: { previewLimit: null, regLimit: null, unlockPrice: null },
    freeConfig: { previewLimit: null, regLimit: null, unlockPrice: null },
    enabledLangs: ['zh', 'en'],
    adminPassword: 'admin888',
    livechat_license: '', // 兼容新旧版，统一叫 LiveChat ID
    contact_tg: '',       
    contact_wa: ''        
});
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, []);
if (!fs.existsSync(VIDEOS_FILE)) writeJSON(VIDEOS_FILE, []);
if (!fs.existsSync(SITES_FILE)) writeJSON(SITES_FILE, []);
if (!fs.existsSync(ORDERS_FILE)) writeJSON(ORDERS_FILE, []);
if (!fs.existsSync(CATEGORIES_FILE)) writeJSON(CATEGORIES_FILE, [{ id: 'c1', name: '默认分类' }]);
if (!fs.existsSync(VISITS_FILE)) writeJSON(VISITS_FILE, []);

let currentSettings = readJSON(SETTINGS_FILE);
if (!currentSettings.adminPassword) currentSettings.adminPassword = 'admin888';
if (currentSettings.livechat_license === undefined) currentSettings.livechat_license = '';
if (currentSettings.contact_tg === undefined) currentSettings.contact_tg = '';
if (currentSettings.contact_wa === undefined) currentSettings.contact_wa = '';
writeJSON(SETTINGS_FILE, currentSettings);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR)); 
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const authMiddleware = (req, res, next) => {
    const settings = readJSON(SETTINGS_FILE);
    const currentPassword = settings.adminPassword || 'admin888';
    if (req.headers['x-admin-token'] !== currentPassword) return res.status(401).json({ error: '未授权' });
    next();
};

// ================= 用户访问追踪 =================
function parseUA(ua) {
    if (!ua) return { device: '未知', os: '未知', browser: '未知' };
    let os = '未知', device = '桌面', browser = '未知';
    if (/iPhone|iPad|iPod/i.test(ua)) { os = 'iOS'; device = '苹果'; }
    else if (/Android/i.test(ua)) { os = 'Android'; device = '安卓'; }
    else if (/Mac OS X/i.test(ua)) { os = 'macOS'; device = '苹果'; }
    else if (/Windows/i.test(ua)) { os = 'Windows'; device = '桌面'; }
    else if (/Linux/i.test(ua)) { os = 'Linux'; device = '桌面'; }

    if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua) && !/OPR/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Edge|Edg/i.test(ua)) browser = 'Edge';
    
    const osVer = ua.match(/(?:Windows NT|Mac OS X|Android|iPhone OS) ([\d_\.]+)/);
    if(osVer) os += ' ' + osVer[1].replace(/_/g, '.');
    const brVer = ua.match(/(?:Chrome|Firefox|Safari|Edg)\/([\d\.]+)/);
    if(brVer) browser += ' ' + brVer[1];

    return { device, os, browser };
}

function getIpCountry(ip) {
    if (!ip || ip === '127.0.0.1' || ip === '::1') return '本地';
    const geo = geoip.lookup(ip);
    if (geo) {
        const countryMap = { 'JP': '日本', 'US': '美国', 'HK': '香港', 'TW': '台湾', 'SG': '新加坡', 'KR': '韩国', 'GB': '英国', 'CA': '加拿大', 'AU': '澳大利亚' };
        return countryMap[geo.country] || geo.country || '未知';
    }
    return '未知';
}

app.post('/api/visit', (req, res) => {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';
    const lang = req.body.lang || 'zh';
    const parse = parseUA(ua);
    
    const visits = readJSON(VISITS_FILE, []);
    const now = Date.now();
    
    const newVisit = {
        id: 'V' + now + Math.floor(Math.random() * 1000),
        enterTime: now,
        lastActive: now,
        submitTime: null,
        leaveTime: null,
        ip: ip || '127.0.0.1',
        country: getIpCountry(ip),
        ua: ua,
        device: parse.device,
        os: parse.os,
        browser: parse.browser,
        lang: lang,
        status: 'visiting',
        userId: null,
        userName: null,
        userEmail: null,
        contact: '',
        payAddress: '',
        rechargeAmount: 0,
        rechargeCount: 0
    };
    visits.unshift(newVisit);
    writeJSON(VISITS_FILE, visits);
    res.json({ visitId: newVisit.id });
});

// ================= 前台公共接口 =================
app.get('/api/config', (req, res) => {
    const s = readJSON(SETTINGS_FILE);
    res.json({
        trc20: s.trc20 || '', hotCats: s.hotCats || [], recommendCats: s.recommendCats || [], freeCats: s.freeCats || [],
        livechat_license: s.livechat_license || '', 
        contact_tg: s.contact_tg || '', 
        contact_wa: s.contact_wa || '',
        hotConfig: {
            previewLimit: s.hotConfig?.previewLimit ?? null, regLimit: s.hotConfig?.regLimit ?? null, unlockPrice: s.hotConfig?.unlockPrice ?? null
        },
        recommendConfig: {
            previewLimit: s.recommendConfig?.previewLimit ?? null, regLimit: s.recommendConfig?.regLimit ?? null, unlockPrice: s.recommendConfig?.unlockPrice ?? null
        },
        freeConfig: {
            previewLimit: s.freeConfig?.previewLimit ?? null, regLimit: s.freeConfig?.regLimit ?? null, unlockPrice: s.freeConfig?.unlockPrice ?? null
        }
    });
});

app.get('/api/i18n/:lang', (req, res) => {
    const filePath = path.join(I18N_DIR, `${req.params.lang}.json`);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({ error: 'Not found' });
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, visitId } = req.body;
        const users = readJSON(USERS_FILE);
        if (users.find(u => u.email === email)) return res.status(409).json({ error: '该邮箱已被注册' });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = { id: Date.now().toString(), name, email, password: hashedPassword, balance: 0, createdAt: new Date().toISOString() };
        users.push(newUser);
        writeJSON(USERS_FILE, users);

        if (visitId) {
            let visits = readJSON(VISITS_FILE, []);
            let visit = visits.find(v => v.id === visitId);
            if (visit) {
                visit.status = 'registered';
                visit.userId = newUser.id;
                visit.userName = newUser.name;
                visit.userEmail = newUser.email;
                writeJSON(VISITS_FILE, visits);
            }
        }

        res.status(201).json({ message: '注册成功', user: { id: newUser.id, name: newUser.name, email: newUser.email } });
    } catch (error) { res.status(500).json({ error: '服务器内部错误' }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = readJSON(USERS_FILE);
        const user = users.find(u => u.email === email);
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: '账号或密码错误' });
        res.json({ message: '登录成功', user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) { res.status(500).json({ error: '服务器内部错误' }); }
});

// ================= 后台：系统设置 =================
app.get('/api/admin/settings', authMiddleware, (req, res) => res.json(readJSON(SETTINGS_FILE)));
app.post('/api/admin/settings', authMiddleware, (req, res) => {
    let s = readJSON(SETTINGS_FILE);
    writeJSON(SETTINGS_FILE, { ...s, ...req.body });
    res.json({ success: true });
});

app.post('/api/admin/change-password', authMiddleware, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const s = readJSON(SETTINGS_FILE);
    const currentPwd = s.adminPassword || 'admin888';
    
    if (oldPassword !== currentPwd) return res.status(400).json({ error: '旧密码错误' });
    if (!newPassword || newPassword.trim().length < 4) return res.status(400).json({ error: '新密码不能少于4位' });

    s.adminPassword = newPassword.trim();
    writeJSON(SETTINGS_FILE, s);
    res.json({ success: true, message: '密码修改成功！请重新登录' });
});

// ================= 后台：多语言管理 =================
app.get('/api/admin/i18n-list', authMiddleware, (req, res) => {
    const files = fs.readdirSync(I18N_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    res.json(files);
});
app.get('/api/admin/i18n-content/:lang', authMiddleware, (req, res) => res.json(readJSON(path.join(I18N_DIR, `${req.params.lang}.json`))));
app.post('/api/admin/i18n/:lang', authMiddleware, (req, res) => {
    writeJSON(path.join(I18N_DIR, `${req.params.lang}.json`), req.body);
    res.json({ success: true });
});
app.delete('/api/admin/i18n/:lang', authMiddleware, (req, res) => {
    const filePath = path.join(I18N_DIR, `${req.params.lang}.json`);
    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
});

app.post('/api/admin/translate/:lang', authMiddleware, async (req, res) => {
    const { apiKey } = req.body;
    const targetLang = req.params.lang;
    if (!apiKey) return res.status(400).json({ error: '请提供 DeepL API Key' });
    if (targetLang === 'zh') return res.status(400).json({ error: '中文无需翻译' });

    const zhPath = path.join(I18N_DIR, 'zh.json');
    if (!fs.existsSync(zhPath)) return res.status(400).json({ error: '基准中文包不存在' });
    const zhDict = readJSON(zhPath);
    const keys = Object.keys(zhDict);
    const texts = keys.map(k => zhDict[k]);

    const deeplMap = { 'en':'EN-US', 'vn':'VI', 'es':'ES', 'tr':'TR', 'id':'ID', 'ja':'JA', 'ko':'KO', 'fr':'FR', 'de':'DE', 'ru':'RU', 'pt':'PT-PT', 'it':'IT', 'ar':'AR', 'th':'TH' };
    
    try {
        let allTexts = [];
        for (let i = 0; i < texts.length; i += 45) {
            const chunk = texts.slice(i, i + 45);
            const params = new URLSearchParams();
            params.append('target_lang', deeplMap[targetLang] || 'EN-US');
            chunk.forEach(t => params.append('text', t));
            const response = await axios.post('https://api-free.deepl.com/v2/translate', params, {
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `DeepL-Auth-Key ${apiKey}`
                }
            });
            allTexts = allTexts.concat(response.data.translations.map(t => t.text));
        }
        const newDict = {};
        keys.forEach((key, index) => { newDict[key] = allTexts[index]; });
        writeJSON(path.join(I18N_DIR, `${targetLang}.json`), newDict);
        res.json({ success: true, message: `${targetLang} 翻译成功` });
    } catch (err) {
        res.status(500).json({ error: err.response?.data?.message || err.message });
    }
});

app.post('/api/admin/translate-all', authMiddleware, async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '请提供 DeepL API Key' });

    const settings = readJSON(SETTINGS_FILE);
    const enabledLangs = settings.enabledLangs || ['zh'];
    const zhPath = path.join(I18N_DIR, 'zh.json');
    const zhDict = readJSON(zhPath);
    const keys = Object.keys(zhDict);
    const texts = keys.map(k => zhDict[k]);

    const deeplMap = { 'en':'EN-US', 'vn':'VI', 'es':'ES', 'tr':'TR', 'id':'ID', 'ja':'JA', 'ko':'KO', 'fr':'FR', 'de':'DE', 'ru':'RU', 'pt':'PT-PT', 'it':'IT', 'ar':'AR', 'th':'TH' };
    let successList = [];
    let failList = [];

    for (const lang of enabledLangs) {
        if (lang === 'zh') continue;
        try {
            let allTexts = [];
            for (let i = 0; i < texts.length; i += 45) {
                const chunk = texts.slice(i, i + 45);
                const params = new URLSearchParams();
                params.append('target_lang', deeplMap[lang] || 'EN-US');
                chunk.forEach(t => params.append('text', t));
                const response = await axios.post('https://api-free.deepl.com/v2/translate', params, {
                    headers: { 
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `DeepL-Auth-Key ${apiKey}`
                    }
                });
                allTexts = allTexts.concat(response.data.translations.map(t => t.text));
            }
            const newDict = {};
            keys.forEach((key, index) => { newDict[key] = allTexts[index]; });
            writeJSON(path.join(I18N_DIR, `${lang}.json`), newDict);
            successList.push(lang);
        } catch (err) {
            failList.push(lang);
        }
    }
    res.json({ success: true, message: `翻译完成！成功: ${successList.join(', ') || '无'}。失败: ${failList.join(', ') || '无'}` });
});

// ================= 后台：视频分类/采集/上传/用户 =================
app.get('/api/admin/categories', authMiddleware, (req, res) => res.json(readJSON(CATEGORIES_FILE, [])));
app.post('/api/admin/categories', authMiddleware, (req, res) => {
    let cats = readJSON(CATEGORIES_FILE, []);
    cats.push({ id: Date.now().toString(), name: req.body.name });
    writeJSON(CATEGORIES_FILE, cats); res.json({ success: true });
});
app.post('/api/admin/categories/edit', authMiddleware, (req, res) => {
    let cats = readJSON(CATEGORIES_FILE, []);
    const cat = cats.find(c => c.id === req.body.id);
    if (cat) { cat.name = req.body.name; writeJSON(CATEGORIES_FILE, cats); res.json({ success: true }); }
    else res.status(404).json({ error: '不存在' });
});
app.delete('/api/admin/categories/:id', authMiddleware, (req, res) => {
    let cats = readJSON(CATEGORIES_FILE, []).filter(c => c.id !== req.params.id);
    writeJSON(CATEGORIES_FILE, cats); res.json({ success: true });
});

app.get('/api/admin/sites', authMiddleware, (req, res) => res.json(readJSON(SITES_FILE)));
app.post('/api/admin/sites', authMiddleware, (req, res) => {
    const sites = readJSON(SITES_FILE); 
    sites.push({ id: Date.now().toString(), ...req.body, categories: [] }); 
    writeJSON(SITES_FILE, sites); res.json({ success: true });
});
app.delete('/api/admin/sites/:id', authMiddleware, (req, res) => {
    writeJSON(SITES_FILE, readJSON(SITES_FILE).filter(s => s.id !== req.params.id)); res.json({ success: true });
});
app.get('/api/admin/sites/:id/categories', authMiddleware, async (req, res) => {
    const site = readJSON(SITES_FILE).find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '不存在' });
    try {
        const baseUrl = site.url.split('?')[0].replace(/\/$/, '');
        const response = await fetch(`${baseUrl}?ac=list`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (site.type === 'json') {
            const data = await response.json();
            res.json((data.class || []).map(c => ({ id: String(c.type_id), name: c.type_name })));
        } else {
            const xmlText = await response.text();
            const result = await new xml2js.Parser().parseStringPromise(xmlText);
            res.json((result.rss?.class?.[0]?.ty || []).map(c => ({ id: String(c.$.id), name: c._ })));
        }
    } catch (err) { res.status(500).json({ error: '获取分类失败' }); }
});
app.post('/api/admin/sites/:id/bind', authMiddleware, (req, res) => {
    const sites = readJSON(SITES_FILE);
    const site = sites.find(s => s.id === req.params.id);
    if (site) { site.categories = req.body.mappings || []; writeJSON(SITES_FILE, sites); res.json({ success: true }); }
});
app.post('/api/admin/collect/:id', authMiddleware, async (req, res) => {
    const site = readJSON(SITES_FILE).find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '不存在' });
    if (!site.categories || site.categories.length === 0) return res.status(400).json({ error: '请先绑定分类！' });

    try {
        let count = 0;
        let allVideos = readJSON(VIDEOS_FILE);
        const baseUrl = site.url.split('?')[0].replace(/\/$/, '');
        for (let pg = 1; pg <= 3; pg++) {
            const response = await fetch(`${baseUrl}?ac=detail&pg=${pg}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            let videoList = [];
            if (site.type === 'json') {
                const data = await response.json();
                videoList = (data.list || []).map(v => ({ id: v.vod_id, name: v.vod_name, typeId: String(v.type_id), pic: v.vod_pic, playUrl: v.vod_play_url }));
            } else {
                const xmlText = await response.text();
                const result = await new xml2js.Parser().parseStringPromise(xmlText);
                const list = result.rss?.list?.[0]?.video || [];
                videoList = list.map(v => ({ id: v.id?.[0], name: v.name?.[0], typeId: String(v.type?.[0]), pic: v.pic?.[0], playUrl: v.dl?.[0]?.dd?.[0]?._ || '' }));
            }
            if (videoList.length === 0) break;
            for (const video of videoList) {
                if (!video.playUrl) continue;
                let targetCategory = '未分类精选'; 
                const binding = site.categories.find(c => String(c.sourceId) === String(video.typeId));
                if (binding) targetCategory = binding.localCategory;
                if (!allVideos.find(v => v.name === video.name)) {
                    allVideos.push({ id: Date.now().toString() + Math.random(), name: video.name, pic: video.pic, category: targetCategory, playUrl: video.playUrl, createdAt: new Date().toISOString() });
                    count++;
                }
            }
            writeJSON(VIDEOS_FILE, allVideos);
        }
        res.json({ success: true, message: `采集完成，新增 ${count} 条` });
    } catch (err) { res.status(500).json({ error: '采集失败' }); }
});

app.post('/api/admin/upload-video', authMiddleware, upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请选择视频' });
    const videos = readJSON(VIDEOS_FILE);
    videos.push({ id: Date.now().toString(), name: req.body.name || req.file.originalname, category: req.body.category || '默认分类', playUrl: `/uploads/${req.file.filename}`, pic: '', createdAt: new Date().toISOString() });
    writeJSON(VIDEOS_FILE, videos); res.json({ success: true, message: '上传成功' });
});
app.get('/api/admin/videos', authMiddleware, (req, res) => res.json(readJSON(VIDEOS_FILE).reverse()));
app.post('/api/admin/videos/edit', authMiddleware, (req, res) => {
    let videos = readJSON(VIDEOS_FILE);
    const v = videos.find(x => x.id === req.body.id);
    if (v) { v.name = req.body.name; v.category = req.body.category; writeJSON(VIDEOS_FILE, videos); res.json({ success: true }); }
    else res.status(404).json({ error: '未找到' });
});
app.delete('/api/admin/videos/:id', authMiddleware, (req, res) => {
    writeJSON(VIDEOS_FILE, readJSON(VIDEOS_FILE).filter(x => x.id !== req.params.id)); res.json({ success: true });
});

app.get('/api/admin/users', authMiddleware, (req, res) => {
    let users = readJSON(USERS_FILE);
    res.json(users.map(u => ({ id: u.id, name: u.name, email: u.email, balance: u.balance || 0, createdAt: u.createdAt })));
});
app.post('/api/admin/users/edit', authMiddleware, async (req, res) => {
    let users = readJSON(USERS_FILE);
    const u = users.find(x => x.id === req.body.id);
    if (u) { 
        u.name = req.body.name; 
        u.email = req.body.email; 
        u.balance = Number(req.body.balance); 
        if (req.body.password && req.body.password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            u.password = await bcrypt.hash(req.body.password.trim(), salt);
        }
        writeJSON(USERS_FILE, users); 
        res.json({ success: true }); 
    }
    else res.status(404).json({ error: '未找到' });
});
app.delete('/api/admin/users/:id', authMiddleware, (req, res) => {
    let users = readJSON(USERS_FILE).filter(x => x.id !== req.params.id);
    writeJSON(USERS_FILE, users); res.json({ success: true });
});

// ================= 前台：订单创建/审核 =================
app.post('/api/orders/create', async (req, res) => {
    const settings = readJSON(SETTINGS_FILE);
    if (!settings.trc20) return res.status(400).json({ error: '未配置TRC20地址' });
    
    const { baseAmount, userId, userName, userEmail, videoId, videoName, configType, visitId, contact, payAddress } = req.body;
    let orders = readJSON(ORDERS_FILE, []);
    let baseAmountNum = Number(baseAmount) || 9.99;
    let finalAmount = baseAmountNum;
    let isUnique = false;
    
    while (!isUnique) {
        finalAmount = baseAmountNum + Number((Math.random() * 0.99 + 0.01).toFixed(2));
        if (!orders.find(o => Number(o.amount) === finalAmount && o.status === 'pending')) isUnique = true;
    }
    
    const order = { 
        id: 'ORD' + Date.now() + Math.floor(Math.random() * 1000), 
        amount: finalAmount, 
        address: settings.trc20, 
        status: 'pending', 
        createdAt: new Date().toISOString(),
        userId: userId || 'guest',
        userName: userName || '游客',
        userEmail: userEmail || '未知',
        videoId: videoId || '',
        videoName: videoName || '未知项目',
        configType: configType || 'hot',
        visitId: visitId || '', 
        contact: contact || '', 
        payAddress: payAddress || '', 
        txHash: '',
        confirmedAt: ''
    };
    orders.push(order); 
    writeJSON(ORDERS_FILE, orders); 

    if (visitId) {
        let visits = readJSON(VISITS_FILE, []);
        let visit = visits.find(v => v.id === visitId);
        if (visit) {
            visit.status = 'pending';
            visit.submitTime = Date.now();
            visit.contact = contact || visit.contact;
            visit.payAddress = payAddress || visit.payAddress;
            writeJSON(VISITS_FILE, visits);
        }
    }

    res.json({ success: true, order });
});

app.get('/api/admin/orders', authMiddleware, (req, res) => res.json(readJSON(ORDERS_FILE, []).reverse()));

app.post('/api/admin/orders/:id/review', authMiddleware, (req, res) => {
    let orders = readJSON(ORDERS_FILE, []);
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    
    order.status = 'paid';
    order.confirmedAt = new Date().toISOString();
    order.txHash = '0x' + Math.random().toString(16).substr(2, 40);
    writeJSON(ORDERS_FILE, orders);

    if (order.visitId) {
        let visits = readJSON(VISITS_FILE, []);
        let visit = visits.find(v => v.id === order.visitId);
        if (visit) {
            visit.status = 'paid';
            visit.rechargeAmount = (visit.rechargeAmount || 0) + order.amount;
            visit.rechargeCount = (visit.rechargeCount || 0) + 1;
            visit.leaveTime = Date.now();
            writeJSON(VISITS_FILE, visits);
        }
    }

    res.json({ success: true, message: '审核通过' });
});

app.post('/api/admin/orders/:id/reject', authMiddleware, (req, res) => {
    let orders = readJSON(ORDERS_FILE, []);
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    
    order.status = 'rejected';
    order.confirmedAt = new Date().toISOString();
    writeJSON(ORDERS_FILE, orders);

    if (order.visitId) {
        let visits = readJSON(VISITS_FILE, []);
        let visit = visits.find(v => v.id === order.visitId);
        if (visit) { visit.status = 'rejected'; writeJSON(VISITS_FILE, visits); }
    }
    res.json({ success: true, message: '已拒绝' });
});

app.delete('/api/admin/orders/:id', authMiddleware, (req, res) => {
    let orders = readJSON(ORDERS_FILE, []).filter(o => o.id !== req.params.id);
    writeJSON(ORDERS_FILE, orders);
    res.json({ success: true });
});

app.delete('/api/admin/visits/:id', authMiddleware, (req, res) => {
    let visits = readJSON(VISITS_FILE, []).filter(v => v.id !== req.params.id);
    writeJSON(VISITS_FILE, visits);
    res.json({ success: true });
});

app.get('/api/admin/dashboard', authMiddleware, (req, res) => {
    const visits = readJSON(VISITS_FILE, []);
    const orders = readJSON(ORDERS_FILE, []);
    
    let stats = {
        total: visits.length,
        visiting: visits.filter(v => v.status === 'visiting').length,
        noSubmit: visits.filter(v => v.status === 'visiting' || v.status === 'registered').length,
        deviceApple: visits.filter(v => v.device === '苹果').length,
        deviceAndroid: visits.filter(v => v.device === '安卓').length,
        deviceDesktop: visits.filter(v => v.device === '桌面').length,
        pending: visits.filter(v => v.status === 'pending').length,
        paid: visits.filter(v => v.status === 'paid').length,
        rejected: visits.filter(v => v.status === 'rejected').length
    };

    const mergedList = visits.map(v => {
        const relatedOrder = orders.find(o => o.visitId === v.id && o.status === 'pending');
        return {
            ...v,
            orderId: relatedOrder ? relatedOrder.id : null,
            orderAmount: relatedOrder ? relatedOrder.amount : null
        };
    });

    res.json({ stats, list: mergedList });
});

app.post('/api/admin/login', (req, res) => {
    const settings = readJSON(SETTINGS_FILE);
    const currentPassword = settings.adminPassword || 'admin888';
    if (req.body.password === currentPassword) res.json({ success: true, token: currentPassword });
    else res.status(401).json({ error: '密码错误' });
});

app.get('/api/videos', (req, res) => {
    const settings = readJSON(SETTINGS_FILE);
    let v = readJSON(VIDEOS_FILE).reverse();
    const cats = settings.hotCats || [];
    if (cats.length > 0) v = v.filter(x => cats.includes(x.category));
    res.json(v);
});
app.get('/api/videos/recommend', (req, res) => {
    const settings = readJSON(SETTINGS_FILE);
    let v = readJSON(VIDEOS_FILE).reverse();
    const cats = settings.recommendCats || [];
    if (cats.length > 0) v = v.filter(x => cats.includes(x.category));
    res.json(v);
});
app.get('/api/videos/free', (req, res) => {
    const settings = readJSON(SETTINGS_FILE);
    let v = readJSON(VIDEOS_FILE).reverse();
    const cats = settings.freeCats || [];
    if (cats.length > 0) v = v.filter(x => cats.includes(x.category));
    res.json(v);
});

app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));
