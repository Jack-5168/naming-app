/**
 * Main JavaScript - 全局共享功能
 */

// ==================== 汉堡菜单控制 ====================

function initHamburgerMenu() {
    const hamburger = document.getElementById('hamburgerMenu');
    const mobileNav = document.getElementById('mobileNavOverlay');
    const mobileLinks = document.querySelectorAll('.mobile-nav-link');
    
    if (!hamburger || !mobileNav) return;
    
    // 点击汉堡按钮切换菜单
    hamburger.addEventListener('click', function() {
        const isActive = hamburger.classList.toggle('active');
        mobileNav.classList.toggle('active');
        
        // 阻止背景滚动
        if (isActive) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    });
    
    // 点击导航链接时关闭菜单
    mobileLinks.forEach(link => {
        link.addEventListener('click', function() {
            hamburger.classList.remove('active');
            mobileNav.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
    
    // 点击覆盖层空白区域关闭菜单
    mobileNav.addEventListener('click', function(e) {
        if (e.target === mobileNav) {
            hamburger.classList.remove('active');
            mobileNav.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// ==================== 回到顶部按钮 ====================

function initBackToTop() {
    const backToTopBtn = document.getElementById('backToTop');
    
    if (!backToTopBtn) return;
    
    // 滚动时显示/隐藏
    window.addEventListener('scroll', function() {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('show');
        } else {
            backToTopBtn.classList.remove('show');
        }
    });
    
    // 点击回到顶部
    backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ==================== 分享功能 ====================

function initScrollShare() {
    // 检查是否支持 Web Share API
    if (!navigator.share) {
        console.log('当前浏览器不支持 Web Share API');
        return;
    }
}

async function sharePage() {
    const shareData = {
        title: '文昌赐名 · 专业起名机构',
        text: '源自《诗经》《楚辞》《周易》等 20+ 先秦经典，结合传统命理学与现代审美，15 年专业积淀，10000+ 家庭信赖之选！',
        url: window.location.href
    };
    
    try {
        await navigator.share(shareData);
    } catch (err) {
        console.log('分享取消或失败:', err);
    }
}

// ==================== 统计数字动画 ====================

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
            
            const currentValue = Math.floor(stat.target * easedProgress);
            if (stat.suffix === '%') {
                const decimalValue = (stat.target * easedProgress).toFixed(1);
                element.textContent = decimalValue + stat.suffix;
            } else {
                element.textContent = currentValue.toLocaleString() + stat.suffix;
            }
        });
        
        if (progress < 1) {
            requestAnimationFrame(updateStats);
        }
    }
    
    updateStats();
}

// ==================== 页面加载初始化 ====================

document.addEventListener('DOMContentLoaded', function() {
    initHamburgerMenu();
    initBackToTop();
    initScrollShare();
    animateStats();
});

// 导出函数供其他页面使用
window.sharePage = sharePage;
