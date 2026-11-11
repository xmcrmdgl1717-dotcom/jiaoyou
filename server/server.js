const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();
// 🔴 关键修改：Render 会动态分配端口，必须使用 process.env.PORT
const PORT = process.env.PORT || 3000; 
const DB_FILE = path.join(__dirname, 'users.json');

// 中间件
app.use(cors()); // 允许前端跨域请求
app.use(express.json()); // 解析 JSON 请求体

// 初始化数据库文件（Render 免费版文件系统是临时的，重启会重置）
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// 读取用户数据
function getUsers() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// 保存用户数据
function saveUsers(users) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('保存数据失败:', error);
  }
}

// 测试接口 (防止 Render 根路径 404)
app.get('/', (req, res) => {
  res.send('Hiya Live Backend is Running!');
});

// 注册接口
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. 基础校验
    if (!name || !email || !password) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }
    if (name.length < 2 || name.length > 40) {
      return res.status(400).json({ error: '昵称长度需在 2-40 个字符之间' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: '密码至少需要 8 个字符' });
    }

    const users = getUsers();

    // 2. 检查邮箱是否已注册
    if (users.find(u => u.email === email)) {
      return res.status(409).json({ error: '该邮箱已被注册，请直接登录' });
    }

    // 3. 密码加密 (bcrypt)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. 保存新用户
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers(users);

    // 5. 返回成功（不返回密码）
    res.status(201).json({ 
      message: '注册成功', 
      user: { id: newUser.id, name: newUser.name, email: newUser.email } 
    });

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '服务器内部错误，请稍后再试' });
  }
});

// 启动服务
app.listen(PORT, () => {
  console.log(`✅ 后端服务已启动: http://localhost:${PORT}`);
  console.log(`📁 用户数据保存在: ${DB_FILE}`);
});
