const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const xml2js = require('xml2js');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= 路径与数据初始化 =================
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const SITES_FILE = path.join(DATA_DIR, 'resource_sites.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(VIDEOS_FILE)) fs.writeFileSync(VIDEOS_FILE, '[]');
if (!fs.existsSync(SITES_FILE)) fs.writeFileSync(SITES_FILE, '[]');

function readJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// ================= 中间件 =================
app.use(cors());
app.use(express.json());
// 关键：托管 public 文件夹，这样访问 /admin.html 才能生效
app.use(express.static(path.join(__dirname, 'public')));

// ================= 根路由（检测服务是否存活） =================
app.get('/', (req, res) => {
    res.send('Hiya Live Backend is Running! Access /admin.html for Admin Panel.');
});

// ================= 前台：注册/登录 =================
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
        const newUser = { id: Date.now().toString(), name, email, password: hashedPassword, createdAt: new Date().toISOString() };
        
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

// ================= 后台鉴权与接口 =================
const ADMIN_PASSWORD = 'admin888';
const authMiddleware = (req, res, next) => {
    if (req.headers['x-admin-token'] !== ADMIN_PASSWORD) return res.status(401).json({ error: '未授权' });
    next();
};

app.post('/api/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) res.json({ success: true, token: ADMIN_PASSWORD });
    else res.status(401).json({ error: '密码错误' });
});

app.get('/api/admin/sites', authMiddleware, (req, res) => {
    res.json(readJSON(SITES_FILE));
});

app.post('/api/admin/sites', authMiddleware, (req, res) => {
    const sites = readJSON(SITES_FILE);
    const newSite = { id: Date.now().toString(), ...req.body, categories: [] };
    sites.push(newSite);
    writeJSON(SITES_FILE, sites);
    res.json(newSite);
});

app.delete('/api/admin/sites/:id', authMiddleware, (req, res) => {
    let sites = readJSON(SITES_FILE).filter(s => s.id !== req.params.id);
    writeJSON(SITES_FILE, sites);
    res.json({ success: true });
});

app.get('/api/admin/sites/:id/categories', authMiddleware, async (req, res) => {
    const site = readJSON(SITES_FILE).find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '资源站不存在' });
    try {
        const url = site.url.replace(/\/$/, '') + '?ac=list';
        const response = await fetch(url);
        if (site.type === 'json') {
            const data = await response.json();
            res.json((data.class || []).map(c => ({ id: c.type_id, name: c.type_name })));
        } else {
            const xmlText = await response.text();
            const result = await new xml2js.Parser().parseStringPromise(xmlText);
            res.json((result.rss?.class?.[0]?.ty || []).map(c => ({ id: c.$.id, name: c._ })));
        }
    } catch (err) {
        res.status(500).json({ error: '获取分类失败: ' + err.message });
    }
});

app.post('/api/admin/sites/:id/bind', authMiddleware, (req, res) => {
    const sites = readJSON(SITES_FILE);
    const site = sites.find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '资源站不存在' });
    site.categories = req.body.mappings;
    writeJSON(SITES_FILE, sites);
    res.json({ success: true });
});

app.post('/api/admin/collect/:id', authMiddleware, async (req, res) => {
    const site = readJSON(SITES_FILE).find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '资源站不存在' });

    try {
        let count = 0;
        let allVideos = readJSON(VIDEOS_FILE);
        
        // 为了演示，只采集前3页
        for (let pg = 1; pg <= 3; pg++) {
            const url = site.url.replace(/\/$/, '') + `?ac=detail&pg=${pg}`;
            const response = await fetch(url);
            let videoList = [];

            if (site.type === 'json') {
                const data = await response.json();
                videoList = (data.list || []).map(v => ({
                    id: v.vod_id, name: v.vod_name, typeId: v.type_id, typeName: v.type_name, pic: v.vod_pic, playUrl: v.vod_play_url
                }));
            } else {
                const xmlText = await response.text();
                const result = await new xml2js.Parser().parseStringPromise(xmlText);
                const list = result.rss?.list?.[0]?.video || [];
                videoList = list.map(v => ({
                    id: v.id?.[0], name: v.name?.[0], typeId: v.type?.[0], typeName: v.typename?.[0], pic: v.pic?.[0], playUrl: v.dl?.[0]?.dd?.[0]?._
                }));
            }

            if (videoList.length === 0) break;

            for (const video of videoList) {
                if (!video.playUrl) continue;
                const binding = site.categories.find(c => c.sourceId == video.typeId);
                if (!binding) continue;

                if (!allVideos.find(v => v.name === video.name)) {
                    allVideos.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        name: video.name, pic: video.pic, category: binding.localCategory, playUrl: video.playUrl
                    });
                    count++;
                }
            }
            writeJSON(VIDEOS_FILE, allVideos);
        }
        res.json({ success: true, count, message: `成功采集 ${count} 条视频` });
    } catch (err) {
        res.status(500).json({ error: '采集失败: ' + err.message });
    }
});

app.get('/api/admin/videos', authMiddleware, (req, res) => {
    res.json(readJSON(VIDEOS_FILE));
});

app.listen(PORT, () => {
    console.log(`✅ 服务已启动: http://localhost:${PORT}`);
    console.log(`🔑 后台地址: http://localhost:${PORT}/admin.html`);
});
