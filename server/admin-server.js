const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js'); // 需安装: npm install xml2js

const app = express();
const PORT = 3001; // 后台专用端口，避免和前台3000冲突
const ADMIN_PASSWORD = 'admin888';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 数据存储路径
const DATA_DIR = path.join(__dirname, 'data');
const SITES_FILE = path.join(DATA_DIR, 'resource_sites.json');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');

// 初始化数据文件
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(SITES_FILE)) fs.writeFileSync(SITES_FILE, '[]');
if (!fs.existsSync(VIDEOS_FILE)) fs.writeFileSync(VIDEOS_FILE, '[]');

function readJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// ================= 鉴权中间件 =================
const authMiddleware = (req, res, next) => {
    const token = req.headers['x-admin-token'];
    if (token !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: '未授权，请重新登录' });
    }
    next();
};

// ================= 登录接口 =================
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, token: ADMIN_PASSWORD, message: '登录成功' });
    } else {
        res.status(401).json({ error: '密码错误' });
    }
});

// ================= 资源站管理 =================
app.get('/api/admin/sites', authMiddleware, (req, res) => {
    res.json(readJSON(SITES_FILE));
});

app.post('/api/admin/sites', authMiddleware, (req, res) => {
    const { name, url, type } = req.body; // type: 'xml' | 'json'
    if (!name || !url) return res.status(400).json({ error: '名称和地址必填' });
    const sites = readJSON(SITES_FILE);
    const newSite = { id: Date.now().toString(), name, url, type: type || 'xml', categories: [] };
    sites.push(newSite);
    writeJSON(SITES_FILE, sites);
    res.json(newSite);
});

app.delete('/api/admin/sites/:id', authMiddleware, (req, res) => {
    let sites = readJSON(SITES_FILE);
    sites = sites.filter(s => s.id !== req.params.id);
    writeJSON(SITES_FILE, sites);
    res.json({ success: true });
});

// ================= 获取分类（用于绑定） =================
app.get('/api/admin/sites/:id/categories', authMiddleware, async (req, res) => {
    const sites = readJSON(SITES_FILE);
    const site = sites.find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '资源站不存在' });

    try {
        let categories = [];
        if (site.type === 'xml') {
            // 请求 XML 并解析
            const xmlRes = await fetch(site.url + '?ac=list');
            const xmlText = await xmlRes.text();
            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(xmlText);
            const classList = result.rss?.class?.[0]?.ty || [];
            categories = classList.map(c => ({ id: c.$.id, name: c._ }));
        } else {
            // 请求 JSON
            const jsonRes = await fetch(site.url + '?ac=list');
            const data = await jsonRes.json();
            const classList = data.class || [];
            categories = classList.map(c => ({ id: c.type_id, name: c.type_name }));
        }
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: '获取分类失败: ' + err.message });
    }
});

// 保存分类绑定
app.post('/api/admin/sites/:id/bind', authMiddleware, (req, res) => {
    const { mappings } = req.body; // [{ sourceId, sourceName, localCategory }]
    const sites = readJSON(SITES_FILE);
    const site = sites.find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '资源站不存在' });
    site.categories = mappings;
    writeJSON(SITES_FILE, sites);
    res.json({ success: true });
});

// ================= 一键采集 =================
app.post('/api/admin/collect/:id', authMiddleware, async (req, res) => {
    const site = readJSON(SITES_FILE).find(s => s.id === req.params.id);
    if (!site) return res.status(404).json({ error: '资源站不存在' });

    try {
        let collectedCount = 0;
        let allVideos = readJSON(VIDEOS_FILE);
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            let videoList = [];
            if (site.type === 'xml') {
                const xmlRes = await fetch(`${site.url}?ac=detail&pg=${page}`);
                const xmlText = await xmlRes.text();
                const parser = new xml2js.Parser();
                const result = await parser.parseStringPromise(xmlText);
                videoList = result.rss?.list?.[0]?.video || [];
                videoList = videoList.map(v => ({
                    id: v.id?.[0],
                    name: v.name?.[0],
                    pic: v.pic?.[0] || '',
                    typeId: v.type?.[0],
                    typeName: v.typename?.[0],
                    playUrl: v.dl?.[0]?.dd?.[0]?._ || '',
                    playFrom: v.dl?.[0]?.dd?.[0]?.$?.flag || 'naixx',
                    content: v.des?.[0] || ''
                }));
            } else {
                const jsonRes = await fetch(`${site.url}?ac=detail&pg=${page}`);
                const data = await jsonRes.json();
                videoList = data.list || [];
                if (!videoList.length) hasMore = false;
                videoList = videoList.map(v => ({
                    id: v.vod_id,
                    name: v.vod_name,
                    pic: v.vod_pic,
                    typeId: v.type_id,
                    typeName: v.type_name,
                    playUrl: v.vod_play_url || '',
                    playFrom: v.vod_play_from || 'naixx',
                    content: v.vod_content || ''
                }));
            }

            if (!videoList.length) break;

            // 过滤掉无播放地址的视频
            for (const video of videoList) {
                if (!video.playUrl) continue;
                
                // 查找分类绑定
                const binding = site.categories.find(c => c.sourceId == video.typeId);
                if (!binding) continue;

                // 去重（根据名称+分类判断）
                const exists = allVideos.find(v => v.name === video.name && v.category === binding.localCategory);
                if (!exists) {
                    allVideos.push({
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        name: video.name,
                        pic: video.pic,
                        category: binding.localCategory,
                        playUrl: video.playUrl,
                        playFrom: video.playFrom,
                        content: video.content,
                        createdAt: new Date().toISOString()
                    });
                    collectedCount++;
                }
            }
            writeJSON(VIDEOS_FILE, allVideos);
            page++;
            if (page > 5) break; // 防止无限循环，演示限制采集5页
        }

        res.json({ success: true, count: collectedCount, message: `成功采集 ${collectedCount} 条视频` });
    } catch (err) {
        res.status(500).json({ error: '采集失败: ' + err.message });
    }
});

// ================= 查询已采集视频 =================
app.get('/api/admin/videos', authMiddleware, (req, res) => {
    res.json(readJSON(VIDEOS_FILE));
});

app.listen(PORT, () => {
    console.log(`✅ 后台服务已启动: http://localhost:${PORT}/admin.html`);
    console.log(`🔑 后台密码: ${ADMIN_PASSWORD}`);
});
