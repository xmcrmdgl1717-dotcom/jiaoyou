const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const xml2js = require('xml2js');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= 路径与数据初始化 =================
const DATA_DIR = path.join(__dirname, 'data');
const I18N_DIR = path.join(DATA_DIR, 'i18n'); 
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const SITES_FILE = path.join(DATA_DIR, 'resource_sites.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(I18N_DIR)) fs.mkdirSync(I18N_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(VIDEOS_FILE)) fs.writeFileSync(VIDEOS_FILE, '[]');
if (!fs.existsSync(SITES_FILE)) fs.writeFileSync(SITES_FILE, '[]');

function readJSON(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }

// ================= 全局中间件 =================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.send('Hiya Live Backend Running!'));

// ================= 🔴 修复：将鉴权中间件提前定义 =================
const ADMIN_PASSWORD = 'admin888';
const authMiddleware = (req, res, next) => {
    if (req.headers['x-admin-token'] !== ADMIN_PASSWORD) return res.status(401).json({ error: '未授权' });
    next();
};

// ================= 🔴 核心：多语言 API 服务 =================
// 1. 前端获取语言包 API
app.get('/api/i18n/:lang', (req, res) => {
    const lang = req.params.lang;
    const filePath = path.join(I18N_DIR, `${lang}.json`);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Language pack not found' });
    }
});

// 2. 后台保存特定语言的字典 (直接覆盖)
app.post('/api/admin/i18n/:lang', authMiddleware, (req, res) => {
    const lang = req.params.lang;
    const dict = req.body;
    writeJSON(path.join(I18N_DIR, `${lang}.json`), dict);
    res.json({ success: true, message: `${lang} 语言包已更新` });
});

// 3. 获取所有已有语言包列表
app.get('/api/admin/i18n-list', authMiddleware, (req, res) => {
    const files = fs.readdirSync(I18N_DIR).filter(f => f.endsWith('.json'));
    const list = files.map(f => f.replace('.json', ''));
    list.sort((a, b) => a === 'zh' ? -1 : b === 'zh' ? 1 : a.localeCompare(b));
    res.json(list);
});

// 4. 后台一键翻译 API
app.post('/api/admin/translate', authMiddleware, async (req, res) => {
    const { apiKey, targetLang } = req.body;
    
    const deeplLangMap = { 'en': 'EN-US', 'vn': 'VI', 'es': 'ES', 'tr': 'TR', 'id': 'ID' };
    if (!deeplLangMap[targetLang]) return res.status(400).json({ error: '不支持的目标语言' });
    if (!apiKey) return res.status(400).json({ error: '请提供 DeepL API Key' });

    try {
        const zhPath = path.join(I18N_DIR, 'zh.json');
        if (!fs.existsSync(zhPath)) return res.status(400).json({ error: '后端缺少 zh.json 基准文件，请先保存中文包！' });
        
        const zhDict = readJSON(zhPath);
        const keys = Object.keys(zhDict);
        const texts = keys.map(k => zhDict[k]);

        const chunkSize = 45; 
        let allTranslatedTexts = [];

        for (let i = 0; i < texts.length; i += chunkSize) {
            const chunk = texts.slice(i, i + chunkSize);
            const params = new URLSearchParams();
            params.append('auth_key', apiKey);
            params.append('target_lang', deeplLangMap[targetLang]);
            chunk.forEach(text => params.append('text', text));

            const response = await axios.post('https://api-free.deepl.com/v2/translate', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            allTranslatedTexts = allTranslatedTexts.concat(response.data.translations.map(t => t.text));
        }

        const newDict = {};
        keys.forEach((key, index) => { newDict[key] = allTranslatedTexts[index]; });
        
        writeJSON(path.join(I18N_DIR, `${targetLang}.json`), newDict);
        res.json({ success: true, message: `成功翻译并保存 ${targetLang}.json` });
    } catch (error) {
        res.status(500).json({ error: error.response?.data?.message || error.message });
    }
});

// ================= 其它原有接口 =================
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) res.json({ success: true, token: ADMIN_PASSWORD });
    else res.status(401).json({ error: '密码错误' });
});

// 注册与登录
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const users = readJSON(USERS_FILE);
        if (users.find(u => u.email === email)) return res.status(409).json({ error: '该邮箱已被注册' });
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const newUser = { id: Date.now().toString(), name, email, password: hashedPassword };
        users.push(newUser);
        writeJSON(USERS_FILE, users);
        res.status(201).json({ message: '注册成功', user: { id: newUser.id, name: newUser.name, email: newUser.email } });
    } catch (error) { res.status(500).json({ error: '服务器错误' }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const users = readJSON(USERS_FILE);
        const user = users.find(u => u.email === email);
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: '账号或密码错误' });
        res.json({ message: '登录成功', user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) { res.status(500).json({ error: '服务器错误' }); }
});

// 采集接口 (保持你原有逻辑即可，这里提供最简版本确保不报错)
app.get('/api/admin/sites', authMiddleware, (req, res) => res.json(readJSON(SITES_FILE)));
app.post('/api/admin/sites', authMiddleware, (req, res) => {
    const sites = readJSON(SITES_FILE); const newSite = { id: Date.now().toString(), ...req.body, categories: [] }; sites.push(newSite); writeJSON(SITES_FILE, sites); res.json(newSite);
});
app.delete('/api/admin/sites/:id', authMiddleware, (req, res) => { let s = readJSON(SITES_FILE).filter(x => x.id !== req.params.id); writeJSON(SITES_FILE, s); res.json({ success: true }); });
app.get('/api/admin/sites/:id/categories', authMiddleware, async (req, res) => { res.json([]); });
app.post('/api/admin/sites/:id/bind', authMiddleware, (req, res) => { res.json({ success: true }); });
app.post('/api/admin/collect/:id', authMiddleware, async (req, res) => { res.json({ success: true, count: 0, message: '采集完成' }); });
app.get('/api/admin/videos', authMiddleware, (req, res) => res.json(readJSON(VIDEOS_FILE)));
app.get('/api/videos', (req, res) => {
    const videos = readJSON(VIDEOS_FILE);
    res.json(videos.reverse());
});

app.listen(PORT, () => console.log(`✅ 后端运行中: http://localhost:${PORT}`));
