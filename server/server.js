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
if (!fs.existsSync(CATEGORIES_FILE)) {
    writeJSON(CATEGORIES_FILE, [{ id: 'c1', name: '默认分类' }]);
}

// 初始化完整中文语言包
const zhDefault = {
  "brand.name":"嗨呀直播","nav.subtitle":"同城交友 遇见心动","nav.home":"首页","nav.live":"直播","nav.drama":"AI剧场","nav.rank":"排行榜","nav.community":"社区","nav.benefits":"福利中心","nav.more":"更多","nav.login":"登录 / 注册","hero.badge":"真实同城 ✨","hero.title1":"同城心动","hero.title2":"1V1交友","hero.subtitle":"真实认证 · 同城速配 · 遇见身边的心动","hero.chip1.t1":"同城速配","hero.chip1.t2":"距离优先","hero.chip2.t1":"1V1视频","hero.chip2.t2":"独享私聊","hero.chip3.t1":"真人认证","hero.chip3.t2":"真实交友","hero.chip4.t1":"隐私安全","hero.chip4.t2":"加密保护","hero.promo.title":"遇见身边的TA","hero.promo.amount":"同城1V1","hero.promo.desc":"真实认证，拒绝照骗","hero.promo.btn":"立即免费匹配 ›","hero.promo.note":"注册仅需20秒，即刻开启同城速配","live.title":"正在热播","live.more":"更多人气主播 ›","feat.1.t1":"同城推荐","feat.1.t2":"发现身边的TA","feat.2.t1":"1V1私聊","feat.2.t2":"独享心动时刻","feat.3.t1":"AI短剧乐园","feat.3.t2":"沉浸剧情每日更新","feat.4.t1":"礼物打赏","feat.4.t2":"送礼物传心意","feat.5.t1":"安全私密","feat.5.t2":"加密保护隐私无忧","feat.6.t1":"多端支持","feat.6.t2":"手机·平板·电脑","card.live.tag":"热门","card.left.title":"全球直播大厅","card.left.p1":"与全球主播实时互动","card.left.p2":"真实陪伴·聆听声音·分享生活","card.left.btn":"进入直播大厅 ›","card.new.tag":"最新","card.right.title":"AI短剧乐园","card.right.p1":"原创AI短剧精彩不断","card.right.p2":"多元题材·沉浸体验·每日更新","card.right.btn":"看AI短剧 ›","hot.title":"🔥 精彩视频","hot.more":"全部视频 ›","steps.title":"简单四步，开启同城交友","steps.1.t1":"注册账号","steps.1.t2a":"简单注册，完善资料","steps.1.t2b":"大约20秒","steps.2.t1":"真人认证","steps.2.t2a":"真实核验，保障交友安全","steps.2.t2b":"隐私保护","steps.3.t1":"同城匹配","steps.3.t2a":"基于位置","steps.3.t2b":"推荐身边的TA","steps.4.t1":"开始交友","steps.4.t2a":"畅享1V1私密互动","steps.4.t2b":"遇见心动的人","steps.timer":"20秒","stats.online":"🔥 当前 <span id=\"online-count\">0</span> 人在线速配","stats.marquee":"📢 {city}用户 {phone} {action}","stats.action1":"刚刚匹配了同城女生","stats.action2":"成功开启了 1V1 私聊","stats.action3":"给心动主播送出了礼物","stats.action4":"通过了真人认证","cta.text":"遇见同城心动的TA，开启 <b>1V1私聊</b>","cta.note":"注册仅需20秒，即刻开启同城速配","cta.btn":"立即免费注册 →","footer.subtitle":"同城交友 遇见心动","footer.col1.title":"关于我们","footer.col1.a1":"关于嗨呀直播","footer.col1.a2":"联系我们","footer.col1.a3":"合作伙伴","footer.col2.title":"帮助中心","footer.col2.a1":"常见问题","footer.col2.a2":"使用条款","footer.col2.a3":"隐私政策","footer.col3.title":"社区","footer.col3.a1":"社区准则","footer.col3.a2":"主播招募","footer.col3.a3":"举报中心","footer.col4.title":"下载App","footer.col5.title":"安全支付","footer.age":"🔞 仅限18岁以上用户","footer.privacy":"🔒 我们致力于保护您的隐私与数据安全","footer.copyright":"© 2026 嗨呀直播. 保留所有权利。","modal.close":"关闭","modal.title":"创建你的交友账号","modal.field.name":"昵称","modal.field.name.hint":"2–40 个字符","modal.field.email":"邮箱","modal.field.password":"密码","modal.field.password.hint":"至少 8 个字符","modal.field.agree.pre":"我已阅读并同意","modal.field.agree.terms":"使用条款","modal.field.agree.and":"和","modal.field.agree.privacy":"隐私政策","modal.submit":"免费注册","modal.submitting":"提交中…","modal.login.title":"登录你的账号","modal.login.submit":"登录","modal.welcome.title":"欢迎回来！","modal.welcome.desc":"你已成功登录。","modal.welcome.cta":"开始探索","customer.title":"深夜同城 专属1V1","customer.desc":"发现附近刚刚上线的心动女孩","customer.matching":"正在为你匹配同城高颜值空姐/学生…","customer.seconds":"秒后为你揭晓神秘联系方式","customer.success":"匹配成功！🎉","customer.tip":"添加 Telegram 专属客服，获取同城资源","customer.btn":"添加 Telegram 客服","video.limit.title":"试看已结束","video.limit.desc":"注册登录后可无限畅看完整版视频","video.limit.btn":"免费注册 / 登录"
};
if (!fs.existsSync(path.join(I18N_DIR, 'zh.json'))) writeJSON(path.join(I18N_DIR, 'zh.json'), zhDefault);

// ================= 中间件 =================
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR)); // 静态托管上传的文件
app.use(express.static(path.join(__dirname, 'public')));

// 文件上传配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, UPLOAD_DIR) },
  filename: function (req, file, cb) { cb(null, Date.now() + path.extname(file.originalname)) }
});
const upload = multer({ storage: storage });

const authMiddleware = (req, res, next) => {
    if (req.headers['x-admin-token'] !== 'admin888') return res.status(401).json({ error: '未授权' });
    next();
};

// ================= API 路由 =================

// 1. 全局设置 (支付、分类配置)
app.get('/api/admin/settings', authMiddleware, (req, res) => res.json(readJSON(SETTINGS_FILE)));
app.post('/api/admin/settings', authMiddleware, (req, res) => {
    const current = readJSON(SETTINGS_FILE);
    writeJSON(SETTINGS_FILE, { ...current, ...req.body });
    res.json({ success: true });
});

// 2. 分类管理
app.get('/api/admin/categories', authMiddleware, (req, res) => res.json(readJSON(CATEGORIES_FILE, [])));
app.post('/api/admin/categories', authMiddleware, (req, res) => {
    let cats = readJSON(CATEGORIES_FILE, []);
    if (req.body.action === 'add') {
        cats.push({ id: Date.now().toString(), name: req.body.name });
    } else if (req.body.action === 'delete') {
        cats = cats.filter(c => c.id !== req.body.id);
    }
    writeJSON(CATEGORIES_FILE, cats);
    res.json({ success: true });
});

// 3. 视频上传
app.post('/api/admin/upload-video', authMiddleware, upload.single('video'), (req, res) => {
    const { name, category } = req.body;
    if (!req.file) return res.status(400).json({ error: '请选择视频文件' });
    
    const videoUrl = `/uploads/${req.file.filename}`;
    const videos = readJSON(VIDEOS_FILE);
    videos.push({
        id: Date.now().toString(),
        name: name || req.file.originalname,
        category: category || '默认分类',
        playUrl: videoUrl,
        pic: '',
        createdAt: new Date().toISOString()
    });
    writeJSON(VIDEOS_FILE, videos);
    res.json({ success: true, message: '上传成功' });
});

// 4. 视频拉取接口 (前端用)
app.get('/api/videos', (req, res) => {
    const videos = readJSON(VIDEOS_FILE);
    // 根据设置返回
    const settings = readJSON(SETTINGS_FILE);
    let result = videos.reverse();
    if (settings.hotCat && settings.hotCat !== 'all') {
        result = result.filter(v => v.category === settings.hotCat);
    }
    res.json(result);
});
app.get('/api/videos/recommend', (req, res) => {
    const videos = readJSON(VIDEOS_FILE);
    const settings = readJSON(SETTINGS_FILE);
    let result = videos.reverse();
    if (settings.recommendCat && settings.recommendCat !== 'all') {
        result = result.filter(v => v.category === settings.recommendCat);
    }
    res.json(result);
});

// 5. 订单系统 (TRC20)
app.post('/api/orders/create', async (req, res) => {
    const { amount, userId } = req.body;
    if (!amount || amount < 10) return res.status(400).json({ error: '最低充值 10 USDT' });
    
    const settings = readJSON(SETTINGS_FILE);
    if (!settings.trc20) return res.status(400).json({ error: '后台未配置 TRC20 地址' });

    let orders = readJSON(ORDERS_FILE, []);
    let baseAmount = Number(amount);
    let finalAmount = baseAmount;
    let isUnique = false;
    
    // 循环生成唯一尾数
    while (!isUnique) {
        finalAmount = baseAmount + Number((Math.random() * 0.99 + 0.01).toFixed(2));
        // 检查是否有未过期的同名金额
        const conflict = orders.find(o => Number(o.amount) === finalAmount && o.status === 'pending' && new Date(o.expireAt) > new Date());
        if (!conflict) isUnique = true;
    }

    const order = {
        id: 'ORD' + Date.now() + Math.floor(Math.random() * 1000),
        userId: userId || 'guest',
        amount: finalAmount,
        address: settings.trc20,
        status: 'pending', // pending, paid, expired, rejected
        createdAt: new Date().toISOString(),
        expireAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
    
    orders.push(order);
    writeJSON(ORDERS_FILE, orders);
    res.json({ success: true, order });
});

// 后台订单管理
app.get('/api/admin/orders', authMiddleware, (req, res) => res.json(readJSON(ORDERS_FILE, [])));
app.post('/api/admin/orders/:id/status', authMiddleware, (req, res) => {
    let orders = readJSON(ORDERS_FILE, []);
    const order = orders.find(o => o.id === req.params.id);
    if (order) {
        order.status = req.body.status;
        writeJSON(ORDERS_FILE, orders);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: '订单不存在' });
    }
});

// 6. 多语言 API
app.get('/api/i18n/:lang', (req, res) => {
    const filePath = path.join(I18N_DIR, `${req.params.lang}.json`);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).json({ error: 'Not found' });
});

app.get('/api/admin/i18n-list', authMiddleware, (req, res) => {
    const files = fs.readdirSync(I18N_DIR).filter(f => f.endsWith('.json'));
    res.json(files.map(f => f.replace('.json', '')));
});

// 全局一键翻译 (自动补齐所有缺失的语言)
app.post('/api/admin/translate-all', authMiddleware, async (req, res) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: '请提供 DeepL API Key' });

    const targetLangs = ['en', 'vn', 'es', 'tr', 'id']; // 需要翻译的目标语言
    const deeplLangMap = { 'en': 'EN-US', 'vn': 'VI', 'es': 'ES', 'tr': 'TR', 'id': 'ID' };
    
    const zhDict = readJSON(path.join(I18N_DIR, 'zh.json'));
    const keys = Object.keys(zhDict);
    const texts = keys.map(k => zhDict[k]);
    
    let results = {};

    try {
        for (const lang of targetLangs) {
            let translatedTexts = [];
            const chunkSize = 45;
            for (let i = 0; i < texts.length; i += chunkSize) {
                const chunk = texts.slice(i, i + chunkSize);
                const params = new URLSearchParams();
                params.append('auth_key', apiKey);
                params.append('target_lang', deeplLangMap[lang]);
                chunk.forEach(t => params.append('text', t));
                
                const response = await axios.post('https://api-free.deepl.com/v2/translate', params, {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                translatedTexts = translatedTexts.concat(response.data.translations.map(t => t.text));
            }
            const newDict = {};
            keys.forEach((key, index) => { newDict[key] = translatedTexts[index]; });
            writeJSON(path.join(I18N_DIR, `${lang}.json`), newDict);
            results[lang] = 'success';
        }
        res.json({ success: true, message: '所有语言翻译并覆盖完毕！', details: results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 保存/编辑特定语言字典
app.post('/api/admin/i18n/:lang', authMiddleware, (req, res) => {
    writeJSON(path.join(I18N_DIR, `${req.params.lang}.json`), req.body);
    res.json({ success: true });
});

// 其他基础功能（登录、采集等）保持精简...
app.post('/api/admin/login', (req, res) => {
    if (req.body.password === 'admin888') res.json({ success: true, token: 'admin888' });
    else res.status(401).json({ error: '密码错误' });
});
app.get('/api/admin/videos', authMiddleware, (req, res) => res.json(readJSON(VIDEOS_FILE)));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
