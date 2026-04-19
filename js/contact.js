/**
 * Contact Page JavaScript - FAQ 数据
 */

const faqData = [
    {question:'起名流程是怎样的？',answer:'填写宝宝姓氏、性别、出生日期和时间 → 选择套餐 → 点击"开始专业起名" → 等待 30 秒 → 获取名字报告。'},
    {question:'免费和付费有什么区别？',answer:'免费体验提供 3 个基础名字；深度体验版（¥28.8）提供 10 个名字 + 深度解读；定制臻选版（¥68.8）提供 30 个名字 + 1 对 1 咨询。'},
    {question:'名字的独特性如何保证？',answer:'我们基于 20+ 部先秦经典，结合八字五行分析，提供重名率查询，确保名字独特性。'},
    {question:'多久能收到名字？',answer:'提交信息后 30 秒内生成名字报告，付费套餐立即解锁完整报告。'},
    {question:'提供修改服务吗？',answer:'定制臻选版用户可享受 30 天内不满意重起服务，并提供 1 对 1 命名师咨询。'},
    {question:'如何获取分析报告？',answer:'生成名字后可在线查看、下载 PDF 报告、生成分享海报，或使用对比功能。'},
    {question:'八字分析准确吗？',answer:'我们采用传统命理学理论，结合《周易》等经典分析，但命名仅供参考，建议理性对待。'},
    {question:'支持哪些支付方式？',answer:'支持微信支付、支付宝、银联卡等多种支付方式，支付成功后立即解锁服务。'}
];

function initFaq() {
    const grid = document.getElementById('faqGrid');
    if (!grid) return;
    
    grid.innerHTML = faqData.map((item, index) => `
        <div class="faq-item" id="faqItem${index}">
            <div class="faq-question" onclick="toggleFaq(${index})">
                <span>${item.question}</span>
                <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 9l-7 7-7-7"/>
                </svg>
            </div>
            <div class="faq-answer">
                <p>${item.answer}</p>
            </div>
        </div>
    `).join('');
}

function toggleFaq(index) {
    const item = document.getElementById(`faqItem${index}`);
    if (!item) return;
    
    document.querySelectorAll('.faq-item').forEach((el, i) => {
        if (i !== index) el.classList.remove('active');
    });
    
    item.classList.toggle('active');
}

// 联系表单提交
const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;
        
        alert(`感谢您的留言！\n\n姓名：${name}\n邮箱：${email}\n\n我们会在 24 小时内回复您。`);
        contactForm.reset();
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initFaq();
});
