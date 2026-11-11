const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // 新增

const app = express();
app.use(cors());
app.use(express.json());

// 你的其它接口代码（注册、登录、采集等）保持不变，省略...
// ...

// ================= DeepL 一键翻译接口 =================
app.post('/api/admin/translate', async (req, res) => {
    const { apiKey, targetLang } = req.body;
    
    // DeepL 支持的语言代码映射
    const deeplLangMap = { 'en': 'EN-US', 'vi': 'VI', 'es': 'ES', 'tr': 'TR', 'id': 'ID' };
    if (!deeplLangMap[targetLang]) return res.status(400).json({ error: '不支持的目标语言' });
    
    if (!apiKey) return res.status(400).json({ error: '请提供 DeepL API Key' });

    try {
        const zhFilePath = path.join(__dirname, '../public/i18n/zh.json'); // 确保路径正确
        if (!fs.existsSync(zhFilePath)) return res.status(404).json({ error: '找不到基准 zh.json' });
        
        const zhDict = JSON.parse(fs.readFileSync(zhFilePath, 'utf8'));
        const keys = Object.keys(zhDict);
        const texts = keys.map(k => zhDict[k]);

        // 调用 DeepL API (免费版接口地址)
        const response = await axios.post(
            'https://api-free.deepl.com/v2/translate',
            new URLSearchParams({
                auth_key: apiKey,
                text: texts, // 批量发送
                target_lang: deeplLangMap[targetLang]
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        const translatedTexts = response.data.translations.map(t => t.text);
        
        // 重新组合 JSON
        const newDict = {};
        keys.forEach((key, index) => {
            newDict[key] = translatedTexts[index];
        });

        // 保存到本地 i18n 文件夹
        const targetFilePath = path.join(__dirname, `../public/i18n/${targetLang}.json`);
        fs.writeFileSync(targetFilePath, JSON.stringify(newDict, null, 2));

        res.json({ success: true, message: `已成功翻译并生成 ${targetLang}.json` });
    } catch (error) {
        console.error('翻译失败:', error.response?.data || error.message);
        res.status(500).json({ error: '翻译失败: ' + (error.response?.data?.message || error.message) });
    }
});

// ...
