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

            if (!hasTg && !hasWa && !livechatId) {
                console.log('[客服系统] 未配置任何客服');
                return;
            }

            // 2. 注入 LiveChat
            if (livechatId) {
                window.__lc = window.__lc || {};
                if (isNaN(Number(livechatId))) {
                    window.__lc.organizationId = livechatId;
                    window.__lc.integration_name = "manual_onboarding";
                    window.__lc.product_name = "text";
                } else {
                    window.__lc.license = Number(livechatId);
                    window.__lc.integration_name = "manual_channels";
                    window.__lc.product_name = "livechat";
                }
                ;(function(n,t,c){
                    function i(n){return e._h?e._h.apply(null,n):e._q.push(n)}
                    var e={_q:[],_h:null,_v:"2.0",on:function(){i(["on",c.call(arguments)])},once:function(){i(["once",c.call(arguments)])},off:function(){i(["off",c.call(arguments)])},get:function(){if(!e._h)throw new Error("[LiveChatWidget] You can't use getters before load.");return i(["get",c.call(arguments)])},call:function(){i(["call",c.call(arguments)])},init:function(){var n=t.createElement("script");n.async=!0;n.type="text/javascript";n.src="https://cdn.livechatinc.com/tracking.js";t.head.appendChild(n)}};
                    !n.__lc.asyncInit&&e.init();
                    n.LiveChatWidget=n.LiveChatWidget||e;
                }(window,document,[].slice));
                console.log('[客服系统] LiveChat 脚本已注入');
            }

            // 3. 核心修复：处理 TG 和 WA 的链接格式
            let tgUrl = '';
            if (config.contact_tg) {
                let rawTg = String(config.contact_tg).trim();
                if (rawTg.startsWith('http')) {
                    tgUrl = rawTg;
                } else {
                    tgUrl = 'https://t.me/' + rawTg.replace('@', '');
                }
            }

            let waUrl = '';
            if (config.contact_wa) {
                let rawWa = String(config.contact_wa).trim();
                if (rawWa.startsWith('http')) {
                    waUrl = rawWa;
                } else {
                    waUrl = 'https://wa.me/' + rawWa;
                }
            }

            // 4. 渲染选择弹窗
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
                // 如果只有一种客服，直接跳转/唤起
                if (livechatId && !hasTg && !hasWa) {
                    if (window.LiveChatWidget) window.LiveChatWidget('maximize');
                    return;
                }
                if (!livechatId && hasTg && !hasWa) {
                    window.open(tgUrl, '_blank');
                    return;
                }
                if (!livechatId && !hasTg && hasWa) {
                    window.open(waUrl, '_blank');
                    return;
                }
                // 如果都没配
                if (!livechatId && !hasTg && !hasWa) {
                    alert('客服暂未上线');
                    return;
                }
                // 如果配了多个，弹出选择框
                document.getElementById('custom-service-modal').style.display = 'flex';
            };
        })
        .catch(err => console.error('[客服系统] 配置加载失败:', err));
})();
