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

function readJSON(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}
function writeJSON(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ================= 全局中间件 =================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.send('Hiya Live Backend is Running Successfully! Access /admin.html for Admin Panel.');
});

// ================= 前台：注册与登录接口 =================
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

// ================= 后台：鉴权与接口 =================
const ADMIN_PASSWORD = 'admin888';
const authMiddleware = (req, res, next) => {
    if (req.headers['x-admin-token'] !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: '未授权' });
    }
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
        const baseUrl = site.url.split('?')[0].replace(/\/$/, '');
        const url = `${baseUrl}?ac=list`;
        console.log(`\n[获取分类] 请求 URL: ${url}`);

        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

        if (site.type === 'json') {
            const data = await response.json();
            res.json((data.class || []).map(c => ({ id: String(c.type_id), name: c.type_name })));
        } else {
            const xmlText = await response.text();
            const result = await new xml2js.Parser().parseStringPromise(xmlText);
            res.json((result.rss?.class?.[0]?.ty || []).map(c => ({ id: String(c.$.id), name: c._ })));
        }
    } catch (err) {
        console.error('[获取分类失败]', err);
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

    if (!site.categories || site.categories.length === 0) {
        return res.status(400).json({ error: '请先绑定分类再采集！' });
    }

    try {
        let count = 0;
        let allVideos = readJSON(VIDEOS_FILE);
        const baseUrl = site.url.split('?')[0].replace(/\/$/, '');

        console.log(`\n==================== 开始采集 ====================`);
        console.log(`[采集配置] 资源站: ${site.name}, 类型: ${site.type}`);
        console.log(`[已绑定分类]`, site.categories.map(c => `${c.sourceName}(${c.sourceId}) -> ${c.localCategory}`).join(', '));

        for (let pg = 1; pg <= 3; pg++) {
            const url = `${baseUrl}?ac=detail&pg=${pg}`;
            console.log(`\n[采集] 请求第 ${pg} 页: ${url}`);

            const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
            console.log(`[采集] HTTP 状态码: ${response.status}`);

            let videoList = [];

            if (site.type === 'json') {
                const rawText = await response.text();
                console.log(`[采集] 返回数据前 150 个字符:`, rawText.substring(0, 150).replace(/\n/g, ''));
                
                try {
                    const data = JSON.parse(rawText);
                    const list = data.list || data.data || [];
                    console.log(`[采集] 解析到视频数据条数: ${list.length}`);
                    
                    videoList = list.map(v => ({
                        id: v.vod_id,
                        name: v.vod_name,
                        typeId: String(v.type_id), // 强制转字符串，防止匹配失败
                        typeName: v.type_name,
                        pic: v.vod_pic,
                        playUrl: v.vod_play_url
                    }));
                } catch (e) {
                    console.error('[采集] JSON 解析异常:', e.message);
                }
            } else {
                const xmlText = await response.text();
                try {
                    const result = await new xml2js.Parser().parseStringPromise(xmlText);
                    const list = result.rss?.list?.[0]?.video || [];
                    console.log(`[采集] 解析到视频数据条数: ${list.length}`);
                    
                    videoList = list.map(v => ({
                        id: v.id?.[0],
                        name: v.name?.[0],
                        typeId: String(v.type?.[0]),
                        typeName: v.typename?.[0],
                        pic: v.pic?.[0],
                        playUrl: v.dl?.[0]?.dd?.[0]?._ || ''
                    }));
                } catch (e) {
                    console.error('[采集] XML 解析异常:', e.message);
                }
            }

            if (videoList.length === 0) {
                console.log(`[采集] 第 ${pg} 页无数据，停止采集。`);
                break;
            }

            let skipNoPlayUrl = 0;
            let skipNoCategory = 0;

            for (const video of videoList) {
                if (!video.playUrl) {
                    skipNoPlayUrl++;
                    continue;
                }

                // 匹配分类（严格转字符串比较）
                const binding = site.categories.find(c => String(c.sourceId) === String(video.typeId));
                
                if (!binding) {
                    skipNoCategory++;
                    // 打印未匹配的分类，方便核对
                    if (skipNoCategory <= 3) {
                        console.log(`  -> 分类未匹配跳过: ${video.name} (ID: ${video.typeId}, 名称: ${video.typeName})`);
                    }
                    continue;
                }

                if (!allVideos.find(v => v.name === video.name)) {
                    allVideos.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        name: video.name,
                        pic: video.pic,
                        category: binding.localCategory,
                        playUrl: video.playUrl
                    });
                    count++;
                }
            }

            console.log(`[采集] 第 ${pg} 页统计: 成功入库 ${count} 条, 无播放地址跳过 ${skipNoPlayUrl} 条, 分类未匹配跳过 ${skipNoCategory} 条`);
            writeJSON(VIDEOS_FILE, allVideos);
        }
        
        console.log(`==================== 采集结束，共入库 ${count} 条 ====================\n`);
        res.json({ success: true, count, message: `成功采集 ${count} 条视频` });
    } catch (err) {
        console.error('[采集] 严重错误:', err);
        res.status(500).json({ error: '采集失败: ' + err.message });
    }
});

app.get('/api/admin/videos', authMiddleware, (req, res) => {
    res.json(readJSON(VIDEOS_FILE));
});

app.listen(PORT, () => {
    console.log(`✅ 后端服务已启动: http://localhost:${PORT}`);
});
