// chat-service.js
(function() {
    // 1. 获取后台配置
    fetch('https://jiaoyouweb.onrender.com/api/config')
        .then(res => res.json())
        .then(config => {
            const hasTg = !!config.contact_tg;
            const hasWa = !!config.contact_wa;
            const hasLivechat = !!config.livechat_license;

            // 如果没有配置任何客服，就不管了
            if (!hasTg && !hasWa && !hasLivechat) return;

            // 2. 注入 LiveChat (如果配置了)
            if (hasLivechat) {
                const licenseId = String(config.livechat_license).trim();
                if (licenseId && !isNaN(Number(licenseId))) {
                    window.__lc = window.__lc || {};
                    window.__lc.license = Number(licenseId);
                    window.__lc.integration_name = "manual_channels";
                    window.__lc.product_name = "livechat";
                    (function(n,t,c){function i(n){return e._h?e._h.apply(null,n):e._q.push([function(){var n=this,t=arguments;return new Promise(function(r){r(n.apply(t,Array.from(arguments)))})},n,Array.from(arguments)])}function o(){return function(){var n=arguments;return new Promise(function(r){r(i(n))})}}var e={_q:[],_h:null,_v:"2.0",on:o(),once:o(),off:o(),get:o(),call:o()};if(!window.LiveChatWidget){window.LiveChatWidget=e}var a=t.createElement("script");a.async=true;a.src="https://cdn.livechatinc.com/tracking.js";var s=t.getElementsByTagName("head")[0];s.appendChild(a)})(window,document);
                }
            }

            // 3. 修复 TG 和 WA 的链接格式 (防止相对路径)
            let tgUrl = config.contact_tg;
            if (tgUrl && !tgUrl.startsWith('http')) {
                // 如果用户只填了 11 或 @abc，自动补全
                tgUrl = 'https://t.me/' + tgUrl.replace('@', '');
            }
            let waUrl = config.contact_wa;
            if (waUrl && !waUrl.startsWith('http')) {
                waUrl = 'https://wa.me/' + waUrl;
            }

            // 4. 渲染用户点击“联系客服”时的弹窗
            // 这里我们动态创建一个弹窗，防止污染原有页面的 HTML
            const modalHtml = `
                <div id="custom-service-modal" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:none;justify-content:center;align-items:center;">
                    <div style="background:#fff;width:90%;max-width:320px;border-radius:16px;padding:24px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                        <h3 style="margin:0 0 20px 0;font-size:18px;color:#333;">请选择客服方式</h3>
                        <div style="display:flex;flex-direction:column;gap:12px;">
                            ${hasLivechat ? `<button onclick="document.getElementById('custom-service-modal').style.display='none'; window.LiveChatWidget('maximize');" style="background:linear-gradient(90deg,#ff6b9d,#ff3d8b);color:#fff;border:none;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;cursor:pointer;">💬 在线客服</button>` : ''}
                            ${hasTg ? `<a href="${tgUrl}" target="_blank" style="background:#0088cc;color:#fff;text-decoration:none;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;display:block;">✈️ Telegram 客服</a>` : ''}
                            ${hasWa ? `<a href="${waUrl}" target="_blank" style="background:#25D366;color:#fff;text-decoration:none;padding:14px;border-radius:30px;font-size:15px;font-weight:bold;display:block;">📱 WhatsApp 客服</a>` : ''}
                        </div>
                        <button onclick="document.getElementById('custom-service-modal').style.display='none';" style="margin-top:20px;background:none;border:none;color:#999;font-size:14px;cursor:pointer;">取消</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // 暴露一个全局函数，供页面里的按钮调用
            window.openServiceModal = function() {
                // 如果只配置了 LiveChat 且没配 TG/WA，直接弹 LiveChat
                if (hasLivechat && !hasTg && !hasWa) {
                    if (window.LiveChatWidget) window.LiveChatWidget('maximize');
                    return;
                }
                // 否则弹选择框
                document.getElementById('custom-service-modal').style.display = 'flex';
            };
        })
        .catch(err => console.warn('客服配置加载失败:', err));
})();
