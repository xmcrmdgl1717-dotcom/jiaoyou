// chat-service.js
(function() {
    console.log('[客服系统] 正在拉取配置...');
    
    // 1. 获取后台配置
    fetch('https://jiaoyouweb.onrender.com/api/config')
        .then(res => {
            if(!res.ok) throw new Error('网络请求失败');
            return res.json();
        })
        .then(config => {
            const hasTg = !!config.contact_tg;
            const hasWa = !!config.contact_wa;
            const livechatId = config.livechat_license ? String(config.livechat_license).trim() : '';

            console.log('[客服系统] 配置读取成功:', { hasTg, hasWa, livechatId });

            // 如果没有配置任何客服，直接返回
            if (!hasTg && !hasWa && !livechatId) {
                console.log('[客服系统] 未配置任何客服');
                return;
            }

            // 2. 注入 LiveChat (如果配置了)
            if (livechatId) {
                window.__lc = window.__lc || {};
                
                // 🔴 核心修复：兼容新版 UUID 和旧版纯数字
                if (isNaN(Number(livechatId))) {
                    // 如果是新版 UUID (比如包含横杠的字符串)
                    window.__lc.organizationId = livechatId;
                    window.__lc.integration_name = "manual_onboarding";
                    window.__lc.product_name = "text";
                } else {
                    // 如果是旧版纯数字
                    window.__lc.license = Number(livechatId);
                    window.__lc.integration_name = "manual_channels";
                    window.__lc.product_name = "livechat";
                }

                // 加载 LiveChat 官方脚本
                ;(function(n,t,c){
                    function i(n){return e._h?e._h.apply(null,n):e._q.push(n)}
                    var e={_q:[],_h:null,_v:"2.0",on:function(){i(["on",c.call(arguments)])},once:function(){i(["once",c.call(arguments)])},off:function(){i(["off",c.call(arguments)])},get:function(){if(!e._h)throw new Error("[LiveChatWidget] You can't use getters before load.");return i(["get",c.call(arguments)])},call:function(){i(["call",c.call(arguments)])},init:function(){var n=t.createElement("script");n.async=!0;n.type="text/javascript";n.src="https://cdn.livechatinc.com/tracking.js";t.head.appendChild(n)}};
                    !n.__lc.asyncInit&&e.init();
                    n.LiveChatWidget=n.LiveChatWidget||e;
                }(window,document,[].slice));
                
                console.log('[客服系统] LiveChat 脚本已注入');
            }

            // 3. 修复 TG 和 WA 的链接格式
            let tgUrl = config.contact_tg;
            if (tgUrl && !tgUrl.startsWith('http')) {
                tgUrl = 'https://t.me/' + tgUrl.replace('@', '');
            }
            let waUrl = config.contact_wa;
            if (waUrl && !waUrl.startsWith('http')) {
                waUrl = 'https://wa.me/' + waUrl;
            }

            // 4. 渲染点击联系时的选择弹窗
            const modalHtml = `
                <div id="custom-service-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:none;justify-content:center;align-items:center;backdrop-filter:blur(4px);">
                    <div style="background:#fff;width:90%;max-width:320px;border-radius:16px;padding:24px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                        <h3 style="margin:0 0 20px 0;font-size:18px;color:#333;">请选择客服方式</h3>
                        <div style="display:flex;flex-direction:column;gap:12px;">
                            ${livechatId ? `<button onclick="document.getElementById('custom-service-modal').style.display='none'; if(window.LiveChatWidget) window.LiveChatWidget('maximize');" style="background:linear-gradient(90deg,#ff6b9d,#ff3d8b);color:#fff;border:none;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;cursor:pointer;">💬 在线客服</button>` : ''}
                            ${hasTg ? `<a href="${tgUrl}" target="_blank" style="background:#0088cc;color:#fff;text-decoration:none;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;display:block;">✈️ Telegram 客服</a>` : ''}
                            ${hasWa ? `<a href="${waUrl}" target="_blank" style="background:#25D366;color:#fff;text-decoration:none;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;display:block;">📱 WhatsApp 客服</a>` : ''}
                        </div>
                        <button onclick="document.getElementById('custom-service-modal').style.display='none';" style="margin-top:20px;background:none;border:none;color:#999;font-size:14px;cursor:pointer;">取消</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // 暴露全局函数
            window.openServiceModal = function() {
                if (livechatId && !hasTg && !hasWa) {
                    if (window.LiveChatWidget) window.LiveChatWidget('maximize');
                    return;
                }
                document.getElementById('custom-service-modal').style.display = 'flex';
            };
        })
        .catch(err => console.error('[客服系统] 配置加载失败:', err));
})();
