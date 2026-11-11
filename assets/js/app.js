'use strict';

/* ================= 核心配置 ================= */
const API_BASE_URL = 'https://jiaoyouweb.onrender.com'; 
const MOCK_MODE = false; // 设为 false 使用真实后端

/* ================= i18n ================= */
// ... (i18n 代码保持不变，为节省篇幅省略，请保留原有代码) ...
// 如果你需要完整的 i18n 代码，请告诉我。

/* ================= bootstrap ================= */
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initNavToggle();
  if (document.getElementById('register-modal')) {
    initEntry();
    initModal();
  }
  // 初始化登录状态渲染
  renderAuthArea();

  // 首页“查看全部主播”按钮跳转到内页
  const hotMoreBtn = document.getElementById('hot-more-btn');
  if (hotMoreBtn) {
    hotMoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'shorts.html';
    });
  }
});

/* ================= 渲染顶部登录状态 ================= */
function renderAuthArea() {
  const authArea = document.getElementById('auth-area');
  if (!authArea) return;
  
  const savedUser = localStorage.getItem('hiya_user');
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      authArea.innerHTML = `
        <div class="user-menu-wrapper" style="position:relative;">
          <div class="user-trigger" id="user-trigger" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:4px 8px;border-radius:20px;transition:background 0.2s;">
            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=ff5c9d&color=fff&size=32&bold=true" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">
            <span style="font-size:13px;font-weight:600;color:#2b2f5b;">${user.name}</span>
            <span style="font-size:10px;color:#9a9fb2;">▼</span>
          </div>
          <div class="user-dropdown" id="user-dropdown" style="display:none;position:absolute;top:110%;right:0;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.15);padding:8px;min-width:140px;z-index:50;">
            <a href="#" style="display:block;padding:8px 12px;font-size:13px;color:#3a3f5f;border-radius:8px;" onmouseover="this.style.background='#fdf2f7'" onmouseout="this.style.background='transparent'">👤 个人中心</a>
            <a href="#" id="logout-btn" style="display:block;padding:8px 12px;font-size:13px;color:#ff3d8b;border-radius:8px;" onmouseover="this.style.background='#fdf2f7'" onmouseout="this.style.background='transparent'">🚪 退出登录</a>
          </div>
        </div>
      `;
      bindUserMenuEvents();
    } catch(e) { console.error(e); }
  } else {
    // 未登录，显示登录按钮
    authArea.innerHTML = `<a class="login-btn" data-i18n="nav.login" data-register role="button" tabindex="0">登录 / 注册</a>`;
    // 重新初始化事件委托
    initEntry();
  }
}

function bindUserMenuEvents() {
  const trigger = document.getElementById('user-trigger');
  const dropdown = document.getElementById('user-dropdown');
  if (!trigger || !dropdown) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { if (dropdown) dropdown.style.display = 'none'; });
  
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('hiya_user');
      window.location.reload();
    });
  }
}

/* ================= modal 逻辑 ================= */
// ... (openModal, closeModal, showView 等函数保持不变) ...

function resetToForm() {
  submitting = false;
  showView('form');
  // ... 重置按钮和错误提示 ...
}

function showLoginView() {
  showView('login');
  document.querySelector('#register-modal [data-login-error]').style.display = 'none';
}

function showRegisterView() {
  showView('form');
  document.querySelector('#register-modal [data-form-error]').style.display = 'none';
}

/* ================= 注册与登录逻辑 ================= */
let submitting = false;

function onSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (submitting) return;
  
  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = form.querySelector('.modal-submit');
  const errorBox = form.querySelector('[data-form-error]');
  
  const formData = new FormData(form);
  const data = {
    name: formData.get('name').trim(),
    email: formData.get('email').trim(),
    password: formData.get('password')
  };

  btn.disabled = true;
  btn.textContent = '提交中…';
  if (errorBox) errorBox.style.display = 'none';
  submitting = true;

  // 注册请求
  fetch(`${API_BASE_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(async (res) => {
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || '注册失败');
    return result;
  })
  .then((result) => {
    // 注册成功，保存用户信息
    localStorage.setItem('hiya_user', JSON.stringify(result.user));
    submitting = false;
    form.reset();
    // 显示欢迎视图
    showView('welcome');
    // 更新右上角UI
    renderAuthArea();
  })
  .catch((err) => {
    submitting = false;
    btn.disabled = false;
    btn.textContent = getSubmitText(btn, 'modal.submit');
    if (errorBox) {
      errorBox.textContent = err.message === 'Failed to fetch' ? '网络请求失败，请稍后重试。' : err.message;
      errorBox.style.display = 'block';
    }
  });
}

// 登录表单提交（需要你后端支持 /api/login 接口，如果还没写，请参考下方的补充说明）
function onLoginSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  if (submitting) return;

  if (!form.checkValidity()) { form.reportValidity(); return; }

  const btn = form.querySelector('.modal-submit');
  const errorBox = form.querySelector('[data-login-error]');
  
  const formData = new FormData(form);
  const data = {
    email: formData.get('email').trim(),
    password: formData.get('password')
  };

  btn.disabled = true;
  btn.textContent = '登录中…';
  if (errorBox) errorBox.style.display = 'none';
  submitting = true;

  fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(async (res) => {
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || '登录失败');
    return result;
  })
  .then((result) => {
    localStorage.setItem('hiya_user', JSON.stringify(result.user));
    submitting = false;
    form.reset();
    showView('welcome');
    renderAuthArea();
  })
  .catch((err) => {
    submitting = false;
    btn.disabled = false;
    btn.textContent = '登录';
    if (errorBox) {
      errorBox.textContent = err.message === 'Failed to fetch' ? '网络请求失败，请稍后重试。' : err.message;
      errorBox.style.display = 'block';
    }
  });
}

// 绑定登录表单
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.querySelector('[data-login-form]');
  if (loginForm) loginForm.addEventListener('submit', onLoginSubmit);
});
