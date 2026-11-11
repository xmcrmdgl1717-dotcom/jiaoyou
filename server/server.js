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

// 初始化基础数据
if (!fs.existsSync(SETTINGS_FILE)) writeJSON(SETTINGS_FILE, { trc20: '', recommendCat: 'all', hotCat: 'all' });
if (!fs.existsSync(USERS_FILE)) writeJSON(USERS_FILE, []);
if (!fs.existsSync(VIDEOS_FILE)) writeJSON(VIDEOS_FILE, []);
if (!fs.existsSync(SITES_FILE)) writeJSON(SITES_FILE, []);
if (!fs.existsSync(ORDERS_FILE)) writeJSON(ORDERS_FILE, []);
if (!fs.existsSync(CATEGORIES_FILE)) writeJSON(CATEGORIES_FILE, [{ id: 'c1', name: '默认分类' }]);

// 初始化语言包
const zhDefault = { "brand.name":"嗨呀直播","nav.subtitle":"同城交友 遇见心动" }; // 简写，保持之前的完整版即可
if (!fs.existsSync(path.join(I18N_DIR, 'zh.json'))) writeJSON(path.join(I18N_DIR, 'zh.json'), zhDefault);

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

// ================= API 路由 =================

// 1. 设置与分类
app.get('/api/admin/settings', authMiddleware, (req, res) => res.json(readJSON(SETTINGS_FILE)));
app.post('/api/admin/settings', authMiddleware, (req, res) => {
    writeJSON(SETTINGS_FILE, { ...readJSON(SETTINGS_FILE), ...req.body });
    res.json({ success: true });
});
app.get('/api/admin/categories', authMiddleware, (req, res) => res.json(readJSON(CATEGORIES_FILE, [])));
app.post('/api/admin/categories', authMiddleware, (req, res) => {
    let cats = readJSON(CATEGORIES_FILE, []);
    if (req.body.action === 'add') cats.push({ id: Date.now().toString(), name: req.body.name });
    if (req.body.action === 'delete') cats = cats.filter(c => c.id !== req.body.id);
    writeJSON(CATEGORIES_FILE, cats);
    res.json({ success: true });
});

// 2. 视频上传与管理
app.post('/api/admin/upload-video', authMiddleware, upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '请选择视频文件' });
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
    const { id, name, category } = req.body;
    let videos = readJSON(VIDEOS_FILE);
    const v = videos.find(x => x.id === id);
    if (v) { v.name = name; v.category = category; writeJSON(VIDEOS_FILE, videos); res.json({ success: true }); }
    else res.status(404).json({ error: '未找到视频' });
});
app.delete('/api/admin/videos/:id', authMiddleware, (req, res) => {
    let videos = readJSON(VIDEOS_FILE).filter(x => x.id !== req.params.id);
    writeJSON(VIDEOS_FILE, videos);
    res.json({ success: true });
});

// 3. 采集功能 (恢复)
app.get('/api/admin/sites', authMiddleware, (req, res) => res.json(readJSON(SITES_FILE)));
app.post('/api/admin/sites', authMiddleware, (req, res) => {
    const sites = readJSON(SITES_FILE); 
    sites.push({ id: Date.now().toString(), ...req.body, categories: [] }); 
    writeJSON(SITES_FILE, sites); 
    res.json({ success: true });
});
app.delete('/api/admin/sites/:id', authMiddleware, (req, res) => {
    writeJSON(SITES_FILE, readJSON(SITES_FILE).filter(x => x.id !== req.params.id)); 
    res.json({ success: true });
});
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
    } catch (err) { res.status(500).json({ error: '获取失败' }); }
});
app.post('/api/admin/sites/:id/bind', authMiddleware, (req, res) => {
    const sites = readJSON(SITES_FILE);
    const site = sites.find(s => s.id === req.params.id);
    if (site) { site.categories = req.body.mappings; writeJSON(SITES_FILE, sites); res.json({ success: true }); }
});
app.post('/api/admin/collect/:id', authMiddleware, async (req, res) => {
    const site = readJSON(SITES_FILE).find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '资源站不存在' });
    try {
        let count = 0; let allVideos = readJSON(VIDEOS_FILE);
        const baseUrl = site.url.split('?')[0].replace(/\/$/, '');
        const response = await fetch(`${baseUrl}?ac=detail&pg=1`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
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
        for (const video of videoList) {
            if (!video.playUrl) continue;
            let targetCategory = '未分类精选'; 
            const binding = site.categories?.find(c => String(c.sourceId) === String(video.typeId));
            if (binding) targetCategory = binding.localCategory;
            if (!allVideos.find(v => v.name === video.name)) {
                allVideos.push({ id: Date.now().toString() + Math.random(), name: video.name, pic: video.pic, category: targetCategory, playUrl: video.playUrl });
                count++;
            }
        }
        writeJSON(VIDEOS_FILE, allVideos);
        res.json({ success: true, message: `成功采集 ${count} 条视频` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. 用户管理
app.get('/api/admin/users', authMiddleware, (req, res) => res.json(readJSON(USERS_FILE)));
app.post('/api/admin/users/balance', authMiddleware, (req, res) => {
    const { email, balance } = req.body;
    let users = readJSON(USERS_FILE);
    const u = users.find(x => x.email === email);
    if (u) { u.balance = Number(balance); writeJSON(USERS_FILE, users); res.json({ success: true }); }
    else res.status(404).json({ error: '未找到用户' });
});

// 5. 订单 (忽略细节，保持存在)
app.get('/api/admin/orders', authMiddleware, (req, res) => res.json(readJSON(ORDERS_FILE, [])));

// 基础
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === 'admin888') res.json({ success: true, token: 'admin888' });
    else res.status(401).json({ error: '密码错误' });
});
app.get('/api/i18n/:lang', (req, res) => {
    const f = path.join(I18N_DIR, `${req.params.lang}.json`);
    if (fs.existsSync(f)) res.sendFile(f); else res.status(404).json({});
});
app.get('/api/admin/i18n-list', authMiddleware, (req, res) => {
    res.json(fs.readdirSync(I18N_DIR).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')));
});
app.post('/api/admin/i18n/:lang', authMiddleware, (req, res) => {
    writeJSON(path.join(I18N_DIR, `${req.params.lang}.json`), req.body); res.json({ success: true });
});

// 前端数据接口
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
