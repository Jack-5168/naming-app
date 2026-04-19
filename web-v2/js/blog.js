/**
 * Blog Page JavaScript - 博客文章数据
 */

const blogPosts = [
    {category:'命名知识',title:'2024 年宝宝起名趋势分析',excerpt:'分析 2024 年热门起名趋势，避开网红字，打造独特好名字。',date:'2024-04-15',icon:'📊'},
    {category:'文化科普',title:'诗经起名全攻略',excerpt:'详解诗经中适合起名的经典篇章，提供 100+ 个好名字推荐。',date:'2024-04-12',icon:'📖'},
    {category:'命名知识',title:'五行缺什么怎么补？',excerpt:'科学理解五行理论，合理平衡宝宝八字，避免盲目补五行。',date:'2024-04-10',icon:'☯️'},
    {category:'文化科普',title:'楚辞中的浪漫主义名字',excerpt:'探索楚辞中的浪漫主义诗篇，为宝宝起一个诗意的名字。',date:'2024-04-08',icon:'🌿'},
    {category:'实用技巧',title:'如何避免重名？',excerpt:'分享避免重名的实用技巧，查询重名率的方法和工具。',date:'2024-04-05',icon:'🔍'},
    {category:'命名知识',title:'男孩起名 vs 女孩起名',excerpt:'男女宝宝起名的不同侧重点，提供针对性建议。',date:'2024-04-03',icon:'👶'},
    {category:'文化科普',title:'周易起名入门',excerpt:'了解周易起名的基本原理，掌握简单实用的起名方法。',date:'2024-04-01',icon:'☯️'},
    {category:'实用技巧',title:'名字评分标准详解',excerpt:'解析专业名字评分的 10 个维度，教你如何评估名字质量。',date:'2024-03-28',icon:'⭐'}
];

function initBlog() {
    const grid = document.getElementById('blogGrid');
    if (!grid) return;
    
    grid.innerHTML = blogPosts.map(post => `
        <div class="blog-card">
            <div class="blog-image">${post.icon}</div>
            <div class="blog-content">
                <span class="blog-category">${post.category}</span>
                <h3 class="blog-title">${post.title}</h3>
                <p class="blog-excerpt">${post.excerpt}</p>
                <div class="blog-meta">
                    <span>📅 ${post.date}</span>
                    <span>📖 阅读更多 →</span>
                </div>
            </div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', function() {
    initBlog();
});
