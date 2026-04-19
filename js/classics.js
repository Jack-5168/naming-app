/**
 * Classics Page JavaScript - 典籍库数据
 */

const classicsData = [
    {id:'shijing',name:'《诗经》',icon:'📖',desc:'中国最早诗歌总集，收录 305 篇',totalChars:127,usageCount:3842,detail:{intro:'《诗经》是中国古代诗歌的开端，收集了西周初年至春秋中叶的诗歌，共 311 篇。',features:['风、雅、颂三部分','赋、比、兴三种表现手法'],example:{source:'《诗经·大雅·烝民》',text:'既明且哲，以保其身',meaning:'既有智慧又能明辨事理',names:['既明','哲明','明哲']}}},
    {id:'chuci',name:'《楚辞》',icon:'🌿',desc:'屈原开创的浪漫主义诗歌总集',totalChars:98,usageCount:2156,detail:{intro:'《楚辞》是战国时期楚国诗人屈原开创的新诗体。',features:['浪漫主义风格','香草美人意象'],example:{source:'《楚辞·离骚》',text:'路漫漫其修远兮',meaning:'追求理想道路漫长',names:['修远','求索']}}},
    {id:'zhouyi',name:'《周易》',icon:'☯️',desc:'群经之首，大道之源',totalChars:85,usageCount:1923,detail:{intro:'《周易》即《易经》，是中华传统文化的源头活水。',features:['阴阳哲学','六十四卦'],example:{source:'《周易·乾卦》',text:'天行健，君子以自强不息',meaning:'天道刚健，君子应奋发图强',names:['行健','自强']}}},
    {id:'daodejing',name:'《道德经》',icon:'☯️',desc:'老子著，道家核心经典',totalChars:92,usageCount:2345,detail:{intro:'《道德经》是道家哲学思想的重要来源，共 81 章。',features:['道法自然','无为而治'],example:{source:'《道德经·第八章》',text:'上善若水',meaning:'最高尚的品德像水一样',names:['若水','善利']}}},
    {id:'lunyu',name:'《论语》',icon:'📜',desc:'孔子及其弟子言行录',totalChars:76,usageCount:1654,detail:{intro:'《论语》是记录孔子及其弟子言行的语录体著作。',features:['仁义礼智信','中庸之道'],example:{source:'《论语·学而》',text:'学而时习之',meaning:'学习并时常温习',names:['时习','知新']}}},
    {id:'mengzi',name:'《孟子》',icon:'📜',desc:'孟子及其弟子著，儒家经典',totalChars:81,usageCount:1654,detail:{intro:'《孟子》记录孟子言行，主张性善论。',features:['性善论','仁政思想'],example:{source:'《孟子·公孙丑上》',text:'我善养吾浩然之气',meaning:'培养正大刚直的精神',names:['浩然','正然']}}},
    {id:'tangshi',name:'《唐诗》',icon:'🏮',desc:'唐代诗歌巅峰',totalChars:156,usageCount:2876,detail:{intro:'唐诗是中国古典诗歌的高峰，现存五万多首。',features:['格律严谨','意境深远'],example:{source:'《唐诗·登鹳雀楼》',text:'欲穷千里目',meaning:'站得高看得远',names:['千里','远目']}}},
    {id:'songci',name:'《宋词》',icon:'🎵',desc:'宋代文学的代表',totalChars:134,usageCount:2234,detail:{intro:'宋词是宋代文学的精华，分婉约和豪放两派。',features:['词牌格律','情景交融'],example:{source:'《宋词·水调歌头》',text:'但愿人长久',meaning:'希望亲人平安',names:['长久','婵娟']}}},
    {id:'shangshu',name:'《尚书》',icon:'📚',desc:'中国最早的史书',totalChars:68,usageCount:1234,detail:{intro:'《尚书》是中国最早的皇室文献汇编。',features:['上古史料','政治智慧'],example:{source:'《尚书·尧典》',text:'克明俊德',meaning:'发扬美德',names:['明俊','俊德']}}},
    {id:'daxue',name:'《大学》',icon:'🎓',desc:'儒家修身治国经典',totalChars:70,usageCount:1432,detail:{intro:'《大学》提出"三纲领"和"八条目"。',features:['三纲领','八条目'],example:{source:'《大学》',text:'在明明德',meaning:'彰显光明品德',names:['明德','至善']}}},
    {id:'zhongyong',name:'《中庸》',icon:'⚖️',desc:'儒家核心经典',totalChars:77,usageCount:1567,detail:{intro:'《中庸》论述中庸之道。',features:['中庸之道','致中和'],example:{source:'《中庸》',text:'中也者，天下之大本',meaning:'中庸是天下根本',names:['中和','致中']}}},
    {id:'lij',name:'《礼记》',icon:'🎋',desc:'儒家礼仪制度汇编',totalChars:72,usageCount:1456,detail:{intro:'《礼记》主要记载先秦的礼制。',features:['礼仪规范','修身之道'],example:{source:'《礼记·大学》',text:'在明明德',meaning:'彰显美德',names:['明德','格物']}}},
    {id:'zuozhuan',name:'《左传》',icon:'📖',desc:'春秋时期编年体史书',totalChars:89,usageCount:1567,detail:{intro:'《左传》是中国第一部叙事详细的编年体史书。',features:['编年体','叙事生动'],example:{source:'《左传》',text:'志在四方',meaning:'志向远大',names:['志远','四方']}}},
    {id:'guoyu',name:'《国语》',icon:'🗣️',desc:'中国最早的国别体史书',totalChars:65,usageCount:987,detail:{intro:'《国语》记载周、鲁、齐、晋等八国历史。',features:['国别体','记言为主'],example:{source:'《国语·周语》',text:'防民之口',meaning:'言论自由重要',names:['知言']}}},
    {id:'zhanguoce',name:'《战国策》',icon:'⚔️',desc:'战国谋臣策士言论',totalChars:78,usageCount:1345,detail:{intro:'《战国策》记载战国时期各国政治、军事、外交活动。',features:['纵横捭阖','谋略智慧'],example:{source:'《战国策·齐策》',text:'士为知己者死',meaning:'为赏识自己的人效命',names:['知己']}}},
    {id:'zhuangzi',name:'《庄子》',icon:'🦋',desc:'道家经典',totalChars:87,usageCount:1876,detail:{intro:'《庄子》以寓言故事阐述哲理。',features:['寓言故事','逍遥思想'],example:{source:'《庄子·逍遥游》',text:'乘天地之正',meaning:'顺应自然',names:['逍遥','天游']}}},
    {id:'xunzi',name:'《荀子》',icon:'📚',desc:'儒家集大成之作',totalChars:74,usageCount:1123,detail:{intro:'《荀子》主张性恶论，强调后天教育。',features:['性恶论','劝学思想'],example:{source:'《荀子·劝学》',text:'不积跬步',meaning:'积累才能成功',names:['千里','至远']}}},
    {id:'hanfeizi',name:'《韩非子》',icon:'⚖️',desc:'法家思想集大成',totalChars:69,usageCount:987,detail:{intro:'《韩非子》主张法治、术治、势治相结合。',features:['法家思想','法治主张'],example:{source:'《韩非子·五蠹》',text:'世异则事异',meaning:'与时俱进',names:['知变']}}},
    {id:'sunzi',name:'《孙子兵法》',icon:'🎯',desc:'世界最早的兵书',totalChars:83,usageCount:1765,detail:{intro:'《孙子兵法》是中国现存最早的兵书。',features:['兵法策略','知己知彼'],example:{source:'《孙子兵法·谋攻篇》',text:'知己知彼',meaning:'了解自己和对手',names:['知彼','知胜']}}},
    {id:'shanjing',name:'《山海经》',icon:'🏔️',desc:'上古地理志怪古籍',totalChars:95,usageCount:1432,detail:{intro:'《山海经》记载古代地理、物产、神话。',features:['神话传说','奇珍异兽'],example:{source:'《山海经·南山经》',text:'五采而文',meaning:'美丽的凤凰',names:['五采','凤鸣']}}},
    {id:'chunqiu',name:'《春秋》',icon:'📅',desc:'孔子编订的鲁国编年史',totalChars:71,usageCount:1234,detail:{intro:'《春秋》是鲁国的编年史，由孔子修订。',features:['编年体','微言大义'],example:{source:'《春秋·隐公元年》',text:'元年春王正月',meaning:'历史开端',names:['元春','王春']}}},
    {id:'xiaojing',name:'《孝经》',icon:'❤️',desc:'儒家伦理经典',totalChars:63,usageCount:1098,detail:{intro:'《孝经》是儒家阐述孝道和孝治思想的经典。',features:['孝道伦理','尊老爱幼'],example:{source:'《孝经·开宗明义》',text:'夫孝，德之本也',meaning:'孝道是道德根本',names:['德本','孝德']}}}
];

// 初始化典籍库
function initClassics() {
    const grid = document.getElementById('classicsGrid');
    if (!grid) return;
    
    grid.innerHTML = classicsData.map(classic => `
        <div class="classic-card" onclick="showClassicDetail('${classic.id}')">
            <div class="classic-icon">${classic.icon}</div>
            <h3 class="classic-name">${classic.name}</h3>
            <p class="classic-desc">${classic.desc}</p>
            <div class="classic-stats">
                <span>收录字词：<strong>${classic.totalChars}</strong>个</span>
                <span>已使用：<strong>${classic.usageCount.toLocaleString()}</strong>次</span>
            </div>
        </div>
    `).join('');
}

// 显示典籍详情
function showClassicDetail(classicId) {
    const classic = classicsData.find(c => c.id === classicId);
    if (!classic) return;
    
    document.getElementById('modalTitle').textContent = classic.name;
    document.getElementById('modalBody').innerHTML = `
        <p style="margin-bottom: 20px;"><strong>简介：</strong>${classic.detail?.intro || classic.desc}</p>
        ${classic.detail?.features ? `
        <p style="margin-bottom: 12px;"><strong>特点：</strong></p>
        <ul style="margin-left: 20px; margin-bottom: 20px;">
            ${classic.detail.features.map(f => `<li style="margin-bottom: 8px;">${f}</li>`).join('')}
        </ul>
        ` : ''}
        ${classic.detail?.example ? `
        <div style="background: var(--cream); padding: 20px; border-radius: 8px; margin-top: 20px;">
            <p style="margin-bottom: 12px;"><strong>名句示例：</strong></p>
            <p style="font-size: 16px; color: var(--china-red); margin-bottom: 8px;">"${classic.detail.example.text}"</p>
            <p style="margin-bottom: 8px;"><strong>出处：</strong>${classic.detail.example.source}</p>
            <p style="margin-bottom: 12px;"><strong>寓意：</strong>${classic.detail.example.meaning}</p>
            <p><strong>推荐名字：</strong>${classic.detail.example.names.join('、')}</p>
        </div>
        ` : ''}
    `;
    
    document.getElementById('classicModal').style.display = 'flex';
}

// 关闭弹窗
function closeModal() {
    document.getElementById('classicModal').style.display = 'none';
}

// 点击弹窗外部关闭
window.onclick = function(event) {
    const modal = document.getElementById('classicModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// 页面加载
document.addEventListener('DOMContentLoaded', function() {
    initClassics();
});
