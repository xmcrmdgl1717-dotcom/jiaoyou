const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const xml2js = require('xml2js');
const axios = require('axios');
const multer = require('multer');

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

function readJSON(file, defaultVal = {}) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return defaultVal; } }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// 初始化配置
if (!fs.existsSync(SETTINGS_FILE)) writeJSON(SETTINGS_FILE, { 
    trc20: '', 
    recommendCat: 'all', 
    hotCat: 'all',
    videoPreviewLimit: 15, // 未登录试看秒数
    registeredPreviewLimit: 120, // 登录后试看秒数
    unlockPrice: 9.99, // 解锁全集金额
    enabledLangs: ['zh', 'en'] // 启用的语言
});
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, []);
if (!fs.existsSync(VIDEOS_FILE)) writeJSON(VIDEOS_FILE, []);
if (!fs.existsSync(SITES_FILE)) writeJSON(SITES_FILE, []);
if (!fs.existsSync(ORDERS_FILE)) writeJSON(ORDERS_FILE, []);
if (!fs.existsSync(CATEGORIES_FILE)) writeJSON(CATEGORIES_FILE, [{ id: 'c1', name: '默认分类' }]);
if (!fs.existsSync(path.join(I18N_DIR, 'zh.json'))) writeJSON(path.join(I18N_DIR, 'zh.json'), {});

// ================= 中间件 =================
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
    if (req.headers['x-admin-token'] !== 'admin888') return res.status(401).json({ error: '未授权' });
    next();
};

// ================= 前台公共接口 =================
app.get('/api/config', (req, res) => {
    const s = readJSON(SETTINGS_FILE);
    res.json({
        trc20: s.trc20,
        videoPreviewLimit: s.videoPreviewLimit || 15,
        registeredPreviewLimit: s.registeredPreviewLimit || 120,
        unlockPrice: s.unlockPrice || 9.99,
        enabledLangs: s.enabledLangs || ['zh']
    });
});

app.get('/api/i18n/:lang', (req, res) => {
    const filePath = path.join(I18N_DIR, `${req.params.lang}.json`);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({ error: 'Not found' });
});

// ================= 前台：用户注册与登录 =================
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) return res.status(400).json({ error: '请填写所有必填字段' });
        if (name.length < 2 || name.length > 40) return res.status(400).json({ error: '昵称长度需在 2-40 个字符之间' });
        if (password.length < 8) return res.status(400).json({ error: '密码至少需要 8 个字符' });

        const users = readJSON(USERS_FILE);
        if (users.find(u => u.email === email)) return res.status(409).json({ error: '该邮箱已被注册，请直接登录' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = { id: Date.now().toString(), name, email, password: hashedPassword, balance: 0, createdAt: new Date().toISOString() };
        
        users.push(newUser);
        writeJSON(USERS_FILE, users);
        res.status(201).json({ message: '注册成功', user: { id: newUser.id, name: newUser.name, email: newUser.email } });
    } catch (error) {
        res.status(500).json({ error: '服务器内部错误' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = readJSON(USERS_FILE);
        const user = users.find(u => u.email === email);
        if (!user) return res.status(401).json({ error: '邮箱或密码错误' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: '邮箱或密码错误' });

        res.json({ message: '登录成功', user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).json({ error: '服务器内部错误' });
    }
});

// ================= 后台接口 =================

// 1. 系统配置
app.get('/api/admin/settings', authMiddleware, (req, res) => res.json(readJSON(SETTINGS_FILE)));
app.post('/api/admin/settings', authMiddleware, (req, res) => {
    writeJSON(SETTINGS_FILE, { ...readJSON(SETTINGS_FILE), ...req.body });
    res.json({ success: true });
});

// 2. 多语言管理
app.get('/api/admin/i18n-list', authMiddleware, (req, res) => {
    const files = fs.readdirSync(I18N_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    res.json(files);
});
app.get('/api/admin/i18n-content/:lang', authMiddleware, (req, res) => {
    const filePath = path.join(I18N_DIR, `${req.params.lang}.json`);
    if (fs.existsSync(filePath)) res.json(readJSON(filePath));
    else res.json({});
});
app.post('/api/admin/i18n/:lang', authMiddleware, (req, res) => {
    writeJSON(path.join(I18N_DIR, `${req.params.lang}.json`), req.body);
    res.json({ success: true });
});
// 🔴 补回：删除语言
app.delete('/api/admin/i18n/:lang', authMiddleware, (req, res) => {
    const filePath = path.join(I18N_DIR, `${req.params.lang}.json`);
    if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
});

app.post('/api/admin/translate-missing', authMiddleware, async (req, res) => {
    const { apiKey } = req.body;
    const settings = readJSON(SETTINGS_FILE);
    const enabledLangs = settings.enabledLangs || [];
    
    const zhPath = path.join(I18N_DIR, 'zh.json');
    if (!fs.existsSync(zhPath)) return res.status(400).json({ error: '基准中文包不存在' });
    const zhDict = readJSON(zhPath);
    const keys = Object.keys(zhDict);
    const texts = keys.map(k => zhDict[k]);

    const results = [];
    const deeplMap = { 'en':'EN-US', 'vn':'VI', 'es':'ES', 'tr':'TR', 'id':'ID', 'ja':'JA', 'ko':'KO', 'fr':'FR', 'de':'DE', 'ru':'RU' };

    for (const lang of enabledLangs) {
        if (lang === 'zh') continue;
        const targetPath = path.join(I18N_DIR, `${lang}.json`);
        if (fs.existsSync(targetPath) && Object.keys(readJSON(targetPath)).length > 0) continue;
        try {
            let allTexts = [];
            for (let i = 0; i < texts.length; i += 45) {
                const chunk = texts.slice(i, i + 45);
                const params = new URLSearchParams();
                params.append('auth_key', apiKey);
                params.append('target_lang', deeplMap[lang] || 'EN-US');
                chunk.forEach(t => params.append('text', t));
                const response = await axios.post('https://api-free.deepl.com/v2/translate', params);
                allTexts = allTexts.concat(response.data.translations.map(t => t.text));
            }
            const newDict = {};
            keys.forEach((key, index) => { newDict[key] = allTexts[index]; });
            writeJSON(targetPath, newDict);
            results.push(lang);
        } catch (err) { console.error(err.message); }
    }
    res.json({ success: true, message: `翻译完成，已补齐：${results.join(', ') || '无缺失'}` });
});

// 3. 分类与资源站
app.get('/api/admin/categories', authMiddleware, (req, res) => res.json(readJSON(CATEGORIES_FILE, [])));
app.post('/api/admin/categories', authMiddleware, (req, res) => {
    let cats = readJSON(CATEGORIES_FILE, []);
    if (req.body.action === 'add') cats.push({ id: Date.now().toString(), name: req.body.name });
    if (req.body.action === 'delete') cats = cats.filter(c => c.id !== req.body.id);
    writeJSON(CATEGORIES_FILE, cats); res.json({ success: true });
});
app.get('/api/admin/sites', authMiddleware, (req, res) => res.json(readJSON(SITES_FILE)));
app.post('/api/admin/sites', authMiddleware, (req, res) => {
    const sites = readJSON(SITES_FILE); 
    sites.push({ id: Date.now().toString(), ...req.body, categories: [] }); 
    writeJSON(SITES_FILE, sites); res.json({ success: true });
});
// 🔴 补回：删除资源站
app.delete('/api/admin/sites/:id', authMiddleware, (req, res) => {
    let sites = readJSON(SITES_FILE).filter(s => s.id !== req.params.id);
    writeJSON(SITES_FILE, sites);
    res.json({ success: true });
});
// 🔴 补回：获取资源站分类
app.get('/api/admin/sites/:id/categories', authMiddleware, async (req, res) => {
    const site = readJSON(SITES_FILE).find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '资源站不存在' });
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
    } catch (err) { res.status(500).json({ error: '获取分类失败: ' + err.message }); }
});
// 🔴 补回：保存分类绑定关系
app.post('/api/admin/sites/:id/bind', authMiddleware, (req, res) => {
    const sites = readJSON(SITES_FILE);
    const site = sites.find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '资源站不存在' });
    site.categories = req.body.mappings || [];
    writeJSON(SITES_FILE, sites);
    res.json({ success: true });
});

// 🔴 补回并完善：一键采集逻辑 (处理了分类绑定和去重)
app.post('/api/admin/collect/:id', authMiddleware, async (req, res) => {
    const site = readJSON(SITES_FILE).find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '资源站不存在' });
    if (!site.categories || site.categories.length === 0) return res.status(400).json({ error: '请先绑定分类再采集！' });

    try {
        let count = 0;
        let allVideos = readJSON(VIDEOS_FILE);
        const baseUrl = site.url.split('?')[0].replace(/\/$/, '');

        for (let pg = 1; pg <= 3; pg++) {
            const url = `${baseUrl}?ac=detail&pg=${pg}`;
            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
            let videoList = [];

            if (site.type === 'json') {
                const data = await response.json();
                const list = data.list || data.data || [];
                videoList = list.map(v => ({ id: v.vod_id, name: v.vod_name, typeId: String(v.type_id), pic: v.vod_pic, playUrl: v.vod_play_url }));
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
                    allVideos.push({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), name: video.name, pic: video.pic, category: targetCategory, playUrl: video.playUrl, createdAt: new Date().toISOString() });
                    count++;
                }
            }
            writeJSON(VIDEOS_FILE, allVideos);
        }
        res.json({ success: true, message: `采集完成，新增 ${count} 条视频` });
    } catch (err) {
        res.status(500).json({ error: '采集失败: ' + err.message });
    }
});

// 4. 视频上传与管理
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

// 5. 用户管理
app.get('/api/admin/users', authMiddleware, (req, res) => {
    let users = readJSON(USERS_FILE);
    const safeUsers = users.map(u => ({ id: u.id, name: u.name, email: u.email, balance: u.balance || 0, createdAt: u.createdAt }));
    res.json(safeUsers);
});
app.post('/api/admin/users/balance', authMiddleware, (req, res) => {
    const { email, balance } = req.body;
    let users = readJSON(USERS_FILE);
    const u = users.find(x => x.email === email);
    if (u) { u.balance = Number(balance); writeJSON(USERS_FILE, users); res.json({ success: true }); }
    else res.status(404).json({ error: '未找到用户' });
});

// 6. 订单管理
app.post('/api/orders/create', async (req, res) => {
    const settings = readJSON(SETTINGS_FILE);
    if (!settings.trc20) return res.status(400).json({ error: '后台未配置TRC20地址' });

    let orders = readJSON(ORDERS_FILE, []);
    let baseAmount = Number(settings.unlockPrice);
    let finalAmount = baseAmount;
    let isUnique = false;
    
    while (!isUnique) {
        finalAmount = baseAmount + Number((Math.random() * 0.99 + 0.01).toFixed(2));
        const conflict = orders.find(o => Number(o.amount) === finalAmount && o.status === 'pending');
        if (!conflict) isUnique = true;
    }

    const order = { id: 'ORD' + Date.now() + Math.floor(Math.random() * 1000), amount: finalAmount, address: settings.trc20, status: 'pending', createdAt: new Date().toISOString() };
    orders.push(order); writeJSON(ORDERS_FILE, orders); res.json({ success: true, order });
});
app.get('/api/admin/orders', authMiddleware, (req, res) => res.json(readJSON(ORDERS_FILE, [])));
app.post('/api/admin/orders/:id/status', authMiddleware, (req, res) => {
    let orders = readJSON(ORDERS_FILE, []);
    const order = orders.find(o => o.id === req.params.id);
    if (order) { order.status = req.body.status; writeJSON(ORDERS_FILE, orders); res.json({ success: true }); }
    else res.status(404).json({ error: '订单不存在' });
});

// ================= 其他基础路由 =================
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === 'admin888') res.json({ success: true, token: 'admin888' });
    else res.status(401).json({ error: '密码错误' });
});
app.get('/api/videos', (req, res) => {
    const settings = readJSON(SETTINGS_FILE);
    let v = readJSON(VIDEOS_FILE).reverse();
    if (settings.hotCat !== 'all') v = v.filter(x => x.category === settings.hotCat);
    res.json(v);
});
app.get('/api/videos/recommend', (req, res) => {
    const settings = readJSON(SETTINGS_FILE);
    let v = readJSON(VIDEOS_FILE).reverse();
    if (settings.recommendCat !== 'all') v = v.filter(x => x.category === settings.recommendCat);
    res.json(v);
});

app.listen(PORT, () => console.log(`🚀 Server on ${PORT}`));
