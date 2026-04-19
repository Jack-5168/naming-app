/**
 * 移动端 H5 核心功能
 */

// Tab 切换
function switchTab(tabName) {
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(`page-${tabName}`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        }
    });
    
    // 滚动到顶部
    window.scrollTo(0, 0);
}

// 初始化 Tab 导航
function initTabs() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const tabName = this.dataset.tab;
            switchTab(tabName);
        });
    });
}

// 加载典籍数据
function loadClassics() {
    const grid = document.getElementById('classicsGrid');
    if (!grid) return;
    
    grid.innerHTML = classicsData.map(classic => `
        <div class="classic-card" onclick="showClassicDetail('${classic.id}')">
            <div class="classic-icon">${classic.icon}</div>
            <div class="classic-name">${classic.name}</div>
            <div class="classic-desc">${classic.desc}</div>
            <div style="font-size:12px;color:#999;margin-top:8px;">已使用 ${classic.usageCount.toLocaleString()} 次</div>
        </div>
    `).join('');
}

// 显示典籍详情
function showClassicDetail(classicId) {
    const classic = classicsData.find(c => c.id === classicId);
    if (!classic) return;
    
    const modalContent = `
        <div class="modal-header">
            <div class="modal-title">${classic.name}</div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-content">
            <p style="margin-bottom:20px;line-height:1.8;">${classic.detail?.intro || classic.desc}</p>
            ${classic.detail?.features ? `
                <div style="margin-bottom:20px;">
                    <strong style="color:var(--china-red);">特点：</strong>
                    <ul style="margin:12px 0;padding-left:20px;line-height:2;">
                        ${classic.detail.features.map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            ${classic.detail?.example ? `
                <div style="background:var(--cream);padding:20px;border-radius:12px;margin-top:20px;">
                    <div style="color:var(--china-red);font-size:18px;margin-bottom:12px;">"${classic.detail.example.text}"</div>
                    <div style="font-size:14px;color:#666;margin-bottom:8px;">出处：${classic.detail.example.source}</div>
                    <div style="font-size:14px;color:#666;margin-bottom:12px;">寓意：${classic.detail.example.meaning}</div>
                    <div style="font-size:14px;"><strong>推荐名字：</strong>${classic.detail.example.names.join('、')}</div>
                </div>
            ` : ''}
        </div>
    `;
    
    showModal(modalContent);
}

// 加载案例数据
function loadCases() {
    const grid = document.getElementById('casesGrid');
    if (!grid) return;
    
    grid.innerHTML = casesData.map(caseItem => `
        <div class="case-card">
            <div class="case-header">
                <div class="case-avatar">${caseItem.initial}</div>
                <div class="case-info">
                    <h4>${caseItem.parent}</h4>
                    <p>${caseItem.date}</p>
                </div>
            </div>
            <div class="case-content">
                <span class="case-name">${caseItem.name}</span>
                ${caseItem.content}
            </div>
            <div class="case-frequency">
                📊 ${caseItem.frequency}
            </div>
        </div>
    `).join('');
}

// 弹窗控制
function showModal(content) {
    document.getElementById('modalContainer').innerHTML = content;
    document.getElementById('modalOverlay').classList.add('active');
    setTimeout(() => {
        document.getElementById('modalContainer').classList.add('active');
    }, 10);
}

function closeModal() {
    document.getElementById('modalContainer').classList.remove('active');
    setTimeout(() => {
        document.getElementById('modalOverlay').classList.remove('active');
    }, 300);
}

// 显示套餐
function showPackages() {
    const modalContent = `
        <div class="modal-header">
            <div class="modal-title">服务套餐</div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-content">
            <div style="background:var(--cream);padding:20px;border-radius:12px;margin-bottom:16px;">
                <div style="font-size:20px;font-weight:700;color:var(--china-red);margin-bottom:8px;">免费体验版</div>
                <div style="font-size:28px;font-weight:700;margin-bottom:12px;">¥0</div>
                <ul style="line-height:2;font-size:14px;">
                    <li>✅ 3 个精选名字</li>
                    <li>✅ 基础分析报告</li>
                    <li>✅ 典籍出处</li>
                </ul>
                <button onclick="switchTab('naming');closeModal();" style="width:100%;padding:14px;margin-top:16px;background:var(--cream-dark);border:none;border-radius:8px;font-size:16px;font-weight:600;">立即体验</button>
            </div>
            <div style="background:linear-gradient(135deg,var(--china-red) 0%,var(--china-red-dark) 100%);color:white;padding:20px;border-radius:12px;margin-bottom:16px;">
                <div style="font-size:20px;font-weight:700;margin-bottom:8px;">⭐ 深度体验版</div>
                <div style="font-size:28px;font-weight:700;margin-bottom:12px;">¥28.8</div>
                <ul style="line-height:2;font-size:14px;">
                    <li>✅ 10 个定制名字</li>
                    <li>✅ 深度文化解读</li>
                    <li>✅ 八字五行分析</li>
                    <li>✅ 下载 PDF 报告</li>
                </ul>
                <button onclick="switchTab('naming');closeModal();" style="width:100%;padding:14px;margin-top:16px;background:white;color:var(--china-red);border:none;border-radius:8px;font-size:16px;font-weight:600;">选择此套餐</button>
            </div>
            <div style="background:var(--cream);padding:20px;border-radius:12px;">
                <div style="font-size:20px;font-weight:700;color:var(--china-red);margin-bottom:8px;">💎 定制臻选版</div>
                <div style="font-size:28px;font-weight:700;margin-bottom:12px;">¥68.8</div>
                <ul style="line-height:2;font-size:14px;">
                    <li>✅ 30 个定制名字</li>
                    <li>✅ 避讳字排除</li>
                    <li>✅ 30 天不满意重起</li>
                    <li>✅ 1 对 1 命名师咨询</li>
                </ul>
                <button onclick="switchTab('naming');closeModal();" style="width:100%;padding:14px;margin-top:16px;background:var(--cream-dark);border:none;border-radius:8px;font-size:16px;font-weight:600;">选择此套餐</button>
            </div>
        </div>
    `;
    showModal(modalContent);
}

// 显示关于
function showAbout() {
    const modalContent = `
        <div class="modal-header">
            <div class="modal-title">品牌故事</div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-content">
            <div style="line-height:2;margin-bottom:20px;">
                <p>文昌赐名创立于 2009 年，源自对中华传统命名文化的热爱与传承。</p>
                <p style="margin-top:12px;">我们坚信，真正的专业起名应当：</p>
                <ul style="margin:12px 0;padding-left:20px;">
                    <li>✅ 引经据典 - 每一个名字都有典籍出处</li>
                    <li>✅ 八字合和 - 结合传统命理学，平衡五行</li>
                    <li>✅ 音韵优美 - 读音悦耳，平仄协调</li>
                    <li>✅ 字形美观 - 结构平衡，书写美观</li>
                    <li>✅ 寓意美好 - 内涵深刻，寄托期望</li>
                </ul>
                <p style="margin-top:12px;">15 年来，我们已为 10,000+ 家庭提供了专业起名服务。</p>
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:20px;">
                <div style="text-align:center;padding:20px;background:var(--cream);border-radius:12px;">
                    <div style="font-size:32px;font-weight:700;color:var(--china-red);">15+</div>
                    <div style="font-size:14px;color:#666;">年专业经验</div>
                </div>
                <div style="text-align:center;padding:20px;background:var(--cream);border-radius:12px;">
                    <div style="font-size:32px;font-weight:700;color:var(--china-red);">10,000+</div>
                    <div style="font-size:14px;color:#666;">服务家庭</div>
                </div>
            </div>
        </div>
    `;
    showModal(modalContent);
}

// 显示联系
function showContact() {
    const modalContent = `
        <div class="modal-header">
            <div class="modal-title">联系客服</div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-content">
            <div style="text-align:center;margin-bottom:24px;">
                <div style="font-size:14px;color:#666;margin-bottom:8px;">专业客服为您解答</div>
                <div style="font-size:18px;font-weight:600;">🕒 9:00-21:00</div>
            </div>
            <div style="background:var(--cream);padding:20px;border-radius:12px;margin-bottom:16px;">
                <div style="font-size:16px;font-weight:600;margin-bottom:12px;">联系方式</div>
                <div style="line-height:2.5;">
                    <div>📧 contact@wenchang.cn</div>
                    <div>📱 400-888-8888</div>
                    <div>💬 微信：wenchangcn</div>
                </div>
            </div>
            <div style="background:var(--cream);padding:20px;border-radius:12px;">
                <div style="font-size:16px;font-weight:600;margin-bottom:12px;">常见问题</div>
                <div style="line-height:2;font-size:14px;">
                    <div style="border-bottom:1px solid var(--cream-dark);padding:8px 0;">❓ 起名流程是怎样的？</div>
                    <div style="border-bottom:1px solid var(--cream-dark);padding:8px 0;">❓ 免费和付费有什么区别？</div>
                    <div style="border-bottom:1px solid var(--cream-dark);padding:8px 0;">❓ 名字的独特性如何保证？</div>
                    <div style="padding:8px 0;">❓ 多久能收到名字？</div>
                </div>
            </div>
        </div>
    `;
    showModal(modalContent);
}

// 统计数字动画
function animateStats() {
    const stats = [
        { id: 'statToday', target: 127, suffix: '' },
        { id: 'statMonth', target: 3842, suffix: '' },
        { id: 'statTotal', target: 10247, suffix: '' },
        { id: 'statSatisfaction', target: 98.5, suffix: '%' }
    ];
    
    const duration = 2000;
    const startTime = Date.now();
    
    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }
    
    function updateStats() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutQuart(progress);
        
        stats.forEach(stat => {
            const element = document.getElementById(stat.id);
            if (!element) return;
            
            if (stat.suffix === '%') {
                const decimalValue = (stat.target * easedProgress).toFixed(1);
                element.textContent = decimalValue + stat.suffix;
            } else {
                const currentValue = Math.floor(stat.target * easedProgress);
                element.textContent = currentValue.toLocaleString() + stat.suffix;
            }
        });
        
        if (progress < 1) {
            requestAnimationFrame(updateStats);
        }
    }
    
    updateStats();
}

// 页面加载初始化
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    loadClassics();
    loadCases();
    animateStats();
    console.log('Mobile H5 loaded');
});
