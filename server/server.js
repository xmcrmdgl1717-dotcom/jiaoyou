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

// 初始化配置 (修复了缺失的配置项)
if (!fs.existsSync(SETTINGS_FILE)) writeJSON(SETTINGS_FILE, { 
    trc20: '', 
    recommendCat: 'all', 
    hotCat: 'all',
    videoPreviewLimit: 15, // 未登录试看秒数
    registeredPreviewLimit: 120, // 登录后试看秒数
    unlockPrice: 9.99, // 解锁全集金额
    enabledLangs: ['zh', 'en', 'vn'] // 启用的语言
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

// 读取单个字典内容
app.get('/api/admin/i18n-content/:lang', authMiddleware, (req, res) => {
    const filePath = path.join(I18N_DIR, `${req.params.lang}.json`);
    if (fs.existsSync(filePath)) res.json(readJSON(filePath));
    else res.json({});
});

// 保存字典
app.post('/api/admin/i18n/:lang', authMiddleware, (req, res) => {
    writeJSON(path.join(I18N_DIR, `${req.params.lang}.json`), req.body);
    res.json({ success: true });
});

// 一键翻译缺失语言
app.post('/api/admin/translate-missing', authMiddleware, async (req, res) => {
    const { apiKey } = req.body;
    const settings = readJSON(SETTINGS_FILE);
    const enabledLangs = settings.enabledLangs || [];
    
    const zhPath = path.join(I18N_DIR, 'zh.json');
    if (!fs.existsSync(zhPath)) return res.status(400).json({ error: '基准中文包不存在' });
    const zhDict = readJSON(zhPath);
    const keys = Object.keys(zhDict);
    const texts = keys.map(k => zhDict[k]);

    let translatedCount = 0;
    const results = [];
    
    // DeepL语言映射
    const deeplMap = { 'en':'EN-US', 'vn':'VI', 'es':'ES', 'tr':'TR', 'id':'ID', 'ja':'JA', 'ko':'KO', 'fr':'FR', 'de':'DE', 'ru':'RU' };

    for (const lang of enabledLangs) {
        if (lang === 'zh') continue;
        const targetPath = path.join(I18N_DIR, `${lang}.json`);
        if (fs.existsSync(targetPath) && Object.keys(readJSON(targetPath)).length > 0) continue; // 已有翻译则跳过
        
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
            translatedCount++;
            results.push(lang);
        } catch (err) { console.error(err.message); }
    }
    res.json({ success: true, message: `翻译完成，已补齐：${results.join(', ') || '无缺失'}` });
});

// 3. 视频分类与采集
app.get('/api/admin/categories', authMiddleware, (req, res) => res.json(readJSON(CATEGORIES_FILE, [])));
app.post('/api/admin/categories', authMiddleware, (req, res) => {
    let cats = readJSON(CATEGORIES_FILE, []);
    if (req.body.action === 'add') cats.push({ id: Date.now().toString(), name: req.body.name });
    if (req.body.action === 'delete') cats = cats.filter(c => c.id !== req.body.id);
    writeJSON(CATEGORIES_FILE, cats);
    res.json({ success: true });
});
app.get('/api/admin/sites', authMiddleware, (req, res) => res.json(readJSON(SITES_FILE)));
app.post('/api/admin/sites', authMiddleware, (req, res) => {
    const sites = readJSON(SITES_FILE); 
    sites.push({ id: Date.now().toString(), ...req.body, categories: [] }); 
    writeJSON(SITES_FILE, sites); res.json({ success: true });
});
app.post('/api/admin/collect/:id', authMiddleware, async (req, res) => {
    const site = readJSON(SITES_FILE).find(s => s.id === req.params.id);
    try {
        let allVideos = readJSON(VIDEOS_FILE);
        const response = await fetch(`${site.url.split('?')[0]}?ac=detail&pg=1`);
        if (site.type === 'json') {
            const data = await response.json();
            (data.list || []).forEach(v => {
                if (!allVideos.find(x => x.name === v.vod_name)) {
                    allVideos.push({ id: Date.now().toString() + Math.random(), name: v.vod_name, category: '默认分类', playUrl: v.vod_play_url, pic: v.vod_pic });
                }
            });
        }
        writeJSON(VIDEOS_FILE, allVideos);
        res.json({ success: true, message: `采集完成` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. 视频上传与管理
app.post('/api/admin/upload-video', authMiddleware, upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请选择视频' });
    const videos = readJSON(VIDEOS_FILE);
    videos.push({
        id: Date.now().toString(),
        name: req.body.name || req.file.originalname,
        category: req.body.category || '默认分类',
        playUrl: `/uploads/${req.file.filename}`,
        pic: '',
        createdAt: new Date().toISOString()
    });
    writeJSON(VIDEOS_FILE, videos);
    res.json({ success: true, message: '上传成功' });
});
app.get('/api/admin/videos', authMiddleware, (req, res) => res.json(readJSON(VIDEOS_FILE).reverse()));
app.post('/api/admin/videos/edit', authMiddleware, (req, res) => {
    let videos = readJSON(VIDEOS_FILE);
    const v = videos.find(x => x.id === req.body.id);
    if (v) { v.name = req.body.name; v.category = req.body.category; writeJSON(VIDEOS_FILE, videos); res.json({ success: true }); }
    else res.status(404).json({ error: '未找到' });
});
app.delete('/api/admin/videos/:id', authMiddleware, (req, res) => {
    writeJSON(VIDEOS_FILE, readJSON(VIDEOS_FILE).filter(x => x.id !== req.params.id));
    res.json({ success: true });
});

// 5. 订单管理
app.post('/api/orders/create', async (req, res) => {
    const settings = readJSON(SETTINGS_FILE);
    if (!settings.trc20) return res.status(400).json({ error: '后台未配置TRC20地址' });

    let orders = readJSON(ORDERS_FILE, []);
    let baseAmount = Number(settings.unlockPrice);
    let finalAmount = baseAmount;
    let isUnique = false;
    
    while (!isUnique) {
        // 生成带 2 位小数的唯一金额（如 9.99 -> 9.9945）
        finalAmount = baseAmount + Number((Math.random() * 0.99 + 0.01).toFixed(2));
        const conflict = orders.find(o => Number(o.amount) === finalAmount && o.status === 'pending');
        if (!conflict) isUnique = true;
    }

    const order = {
        id: 'ORD' + Date.now() + Math.floor(Math.random() * 1000),
        amount: finalAmount,
        address: settings.trc20,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
    orders.push(order);
    writeJSON(ORDERS_FILE, orders);
    res.json({ success: true, order });
});
app.get('/api/admin/orders', authMiddleware, (req, res) => res.json(readJSON(ORDERS_FILE, [])));
app.post('/api/admin/orders/:id/status', authMiddleware, (req, res) => {
    let orders = readJSON(ORDERS_FILE, []);
    const order = orders.find(o => o.id === req.params.id);
    if (order) { order.status = req.body.status; writeJSON(ORDERS_FILE, orders); res.json({ success: true }); }
    else res.status(404).json({ error: '订单不存在' });
});

// 用户登录等
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
