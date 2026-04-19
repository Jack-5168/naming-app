/**
 * Naming Page JavaScript - 起名核心功能
 */

let currentNames = [];
let selectedForCompare = [];
let isSubmitting = false;

// 表单验证
function clearAllErrors() {
    document.querySelectorAll('.form-group input, .form-group select').forEach(input => {
        input.classList.remove('error', 'success');
    });
    document.querySelectorAll('.error-message').forEach(errorEl => {
        errorEl.textContent = '';
        errorEl.classList.remove('show');
    });
}

function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorEl = document.getElementById(fieldId + 'Error');
    if (input) {
        input.classList.add('error');
        input.classList.remove('success');
    }
    if (errorEl) {
        errorEl.textContent = '❌ ' + message;
        errorEl.classList.add('show');
    }
}

function validateForm(formData) {
    clearAllErrors();
    if (!formData.surname || !/^[\u4e00-\u9fa5]{1,4}$/.test(formData.surname)) {
        showFieldError('surname', '姓氏必须是 1-4 个中文字符');
        document.getElementById('surname').focus();
        return false;
    }
    if (!formData.gender) {
        showFieldError('gender', '请选择性别');
        document.getElementById('gender').focus();
        return false;
    }
    const birthDateObj = new Date(formData.birthDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (birthDateObj > today) {
        showFieldError('birthDate', '出生日期不能是未来');
        document.getElementById('birthDate').focus();
        return false;
    }
    if (formData.birthLocation && formData.birthLocation.length > 50) {
        showFieldError('birthLocation', '出生地点不能超过 50 个字符');
        document.getElementById('birthLocation').focus();
        return false;
    }
    return true;
}

// 加载动画
function runLoadingSteps() {
    return new Promise(resolve => {
        const steps = ['step1', 'step2', 'step3', 'step4', 'step5'].map(id => document.getElementById(id));
        const progressBar = document.getElementById('loadingProgressBar');
        const progressText = document.getElementById('loadingProgressText');
        let currentStep = 0;
        
        function nextStep() {
            if (currentStep > 0) {
                steps[currentStep - 1].classList.remove('active');
                steps[currentStep - 1].classList.add('completed');
            }
            if (currentStep < steps.length) {
                steps[currentStep].classList.add('active');
                const progress = (currentStep + 1) * 20;
                if (progressBar) progressBar.style.width = progress + '%';
                if (progressText) progressText.textContent = progress + '%';
                currentStep++;
                setTimeout(nextStep, 800);
            } else {
                if (progressBar) progressBar.style.width = '100%';
                if (progressText) progressText.textContent = '100%';
                setTimeout(resolve, 500);
            }
        }
        nextStep();
    });
}

// 生成名字（模拟）
function generateNames(formData) {
    const names = [
        {name:'既明',score:98,source:'《诗经·大雅·烝民》',meaning:'既有智慧又能明辨事理，天赋异禀',pinyin:'Jì Míng',tone:'去声 阳平',pingze:'仄平',yinlv:'优美',wuxing:'火 火',bazi:{analysis:'八字喜火，既明二字五行属火，完美匹配'}},
        {name:'修远',score:96,source:'《楚辞·离骚》',meaning:'路漫漫其修远兮，追求真理，志向远大',pinyin:'Xiū Yuǎn',tone:'阴平 上声',pingze:'平仄',yinlv:'悦耳',wuxing:'金 土',bazi:{analysis:'修身养性，志在远方，五行平衡'}},
        {name:'若水',score:95,source:'《道德经》',meaning:'上善若水，利万物而不争，品德高尚',pinyin:'Ruò Shuǐ',tone:'去声 上声',pingze:'仄仄',yinlv:'和谐',wuxing:'木 水',bazi:{analysis:'水性智慧，木性仁慈，相生相合'}}
    ];
    return names;
}

// 创建名字卡片
function createNameCard(name, index) {
    const wuxingTags = name.wuxing ? name.wuxing.split('、').map(w => `<span class="wuxing-tag">${w.trim()}</span>`).join('') : '';
    const isSelected = selectedForCompare.includes(index);
    
    return `
        <div class="name-card" id="nameCard${index}">
            <div class="compare-checkbox">
                <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleCompare(${index})" aria-label="选择对比">
            </div>
            <div class="name-header">
                <div class="name-main">
                    <div class="name-text">${name.name}</div>
                    <div class="name-score">⭐ ${name.score}分</div>
                </div>
            </div>
            <div class="name-source">📖 ${name.source}</div>
            <div class="name-meaning">💡 ${name.meaning}</div>
            <div class="name-details">
                <div class="detail-item"><strong>拼音：</strong>${name.pinyin}</div>
                <div class="detail-item"><strong>声调：</strong>${name.tone}</div>
                <div class="detail-item"><strong>平仄：</strong>${name.pingze}</div>
                <div class="detail-item"><strong>音律：</strong>${name.yinlv}</div>
                <div class="detail-item"><strong>五行：</strong>${wuxingTags}</div>
            </div>
            <div class="name-bazi">🔮 <strong>八字分析：</strong>${name.bazi.analysis}</div>
            <div class="name-actions">
                <button class="action-btn" onclick="copyName('${name.name}')">📋 复制</button>
            </div>
        </div>
    `;
}

// 显示结果
function displayResults(names) {
    const resultsSection = document.getElementById('results');
    const nameCards = document.getElementById('nameCards');
    const resultCount = document.getElementById('resultCount');
    const compareBtn = document.getElementById('compareBtn');
    
    resultCount.textContent = names.length;
    nameCards.innerHTML = names.map((name, index) => createNameCard(name, index)).join('');
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
    compareBtn.disabled = false;
}

// 切换对比
function toggleCompare(index) {
    const pos = selectedForCompare.indexOf(index);
    if (pos > -1) {
        selectedForCompare.splice(pos, 1);
    } else {
        selectedForCompare.push(index);
    }
    document.getElementById('compareBtn').disabled = selectedForCompare.length < 2;
}

// 打开对比
function openCompareModal() {
    if (selectedForCompare.length < 2) {
        alert('请至少选择 2 个名字进行对比');
        return;
    }
    const selectedNames = selectedForCompare.map(i => currentNames[i]);
    const tableHTML = generateCompareTable(selectedNames);
    document.getElementById('compareTableContainer').innerHTML = tableHTML;
    document.getElementById('compareModal').style.display = 'flex';
}

// 生成对比表格
function generateCompareTable(names) {
    const dimensions = [
        {key:'name',label:'名字'},
        {key:'score',label:'评分'},
        {key:'source',label:'典籍出处'},
        {key:'meaning',label:'寓意'},
        {key:'pinyin',label:'拼音'},
        {key:'tone',label:'声调'},
        {key:'pingze',label:'平仄'},
        {key:'yinlv',label:'音律'},
        {key:'wuxing',label:'五行'},
        {key:'bazi',label:'八字分析',isBazi:true}
    ];
    
    let html = '<table class="compare-table"><thead><tr><th>维度</th>';
    names.forEach(name => {
        html += `<th style="font-family: 'Ma Shan Zheng'; font-size: 24px; color: var(--china-red);">${name.name}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    dimensions.forEach(dim => {
        html += `<tr><td><strong>${dim.label}</strong></td>`;
        names.forEach((name, idx) => {
            let value = name[dim.key];
            if (dim.isBazi) value = value.analysis;
            const isBest = idx === 0 && dim.key === 'score';
            html += `<td class="${isBest ? 'compare-highlight' : ''}">${value}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
}

// 关闭对比
function closeCompareModal() {
    document.getElementById('compareModal').style.display = 'none';
}

// 复制名字
function copyName(name) {
    navigator.clipboard.writeText(name).then(() => {
        alert(`已复制：${name}`);
    });
}

// 表单提交
document.getElementById('namingForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    if (isSubmitting) {
        alert('正在处理中，请稍候...');
        return;
    }
    
    const formData = {
        surname: document.getElementById('surname').value.trim(),
        gender: document.getElementById('gender').value,
        birthDate: document.getElementById('birthDate').value,
        birthTime: document.getElementById('birthTime').value,
        birthLocation: document.getElementById('birthLocation').value.trim()
    };
    
    if (!validateForm(formData)) return;
    
    isSubmitting = true;
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = 'flex';
    
    try {
        await runLoadingSteps();
        const names = generateNames(formData);
        currentNames = names;
        selectedForCompare = [];
        displayResults(names);
    } catch (error) {
        console.error('起名失败:', error);
        alert('起名失败，请重试');
    } finally {
        loadingOverlay.style.display = 'none';
        isSubmitting = false;
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('Naming page loaded');
});
