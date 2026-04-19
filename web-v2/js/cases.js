/**
 * Cases Page JavaScript - 用户案例数据
 */

const casesData = [
    {initial:'张',parent:'北京张先生',date:'2024 年 3 月',name:'既明',content:'想要一个有文化底蕴的名字，避开网红字。既明出自诗经大雅，独特又有深度，家里人都很喜欢。',frequency:'2014-2023 年全国使用 17 次，重名率 0.002%'},
    {initial:'李',parent:'上海李女士',date:'2024 年 2 月',name:'采蘩',content:'诗经里的名字太美了！"于以采蘩，于沼于沚"，女儿名字寓意美好，读音也悦耳。',frequency:'2014-2023 年全国使用 23 次，重名率 0.003%'},
    {initial:'王',parent:'广州王先生',date:'2024 年 1 月',name:'修远',content:'楚辞离骚的"路漫漫其修远兮"，希望孩子有追求真理的精神，名字大气又有内涵。',frequency:'2014-2023 年全国使用 156 次，重名率 0.018%'},
    {initial:'陈',parent:'深圳陈女士',date:'2024 年 3 月',name:'若水',content:'道德经"上善若水"，希望孩子像水一样包容万物，性格温和但内心强大。',frequency:'2014-2023 年全国使用 89 次，重名率 0.010%'},
    {initial:'刘',parent:'杭州刘先生',date:'2024 年 2 月',name:'浩然',content:'孟子说"我善养吾浩然之气"，希望孩子正直刚毅，有担当有气魄。',frequency:'2014-2023 年全国使用 234 次，重名率 0.027%'},
    {initial:'杨',parent:'成都杨女士',date:'2024 年 1 月',name:'知行',content:'王阳明"知行合一"，希望孩子理论与实践并重，做一个有行动力的人。',frequency:'2014-2023 年全国使用 178 次，重名率 0.021%'},
    {initial:'赵',parent:'南京赵先生',date:'2023 年 12 月',name:'思齐',content:'论语"见贤思齐焉"，希望孩子向优秀的人学习，不断进步。',frequency:'2014-2023 年全国使用 145 次，重名率 0.017%'},
    {initial:'黄',parent:'武汉黄女士',date:'2023 年 12 月',name:'清扬',content:'诗经"有美一人，清扬婉兮"，女儿名字清新脱俗，读音优美。',frequency:'2014-2023 年全国使用 67 次，重名率 0.008%'},
    {initial:'周',parent:'西安周先生',date:'2023 年 11 月',name:'致远',content:'诸葛亮"非宁静无以致远"，希望孩子心境平和，志向远大。',frequency:'2014-2023 年全国使用 312 次，重名率 0.036%'},
    {initial:'吴',parent:'苏州吴女士',date:'2023 年 11 月',name:'婉清',content:'诗经"有美一人，婉如清扬"，名字温婉清新，很有江南气质。',frequency:'2014-2023 年全国使用 54 次，重名率 0.006%'},
    {initial:'徐',parent:'北京徐先生',date:'2023 年 10 月',name:'北辰',content:'论语"为政以德，譬如北辰"，希望孩子有领导力，受人敬仰。',frequency:'2014-2023 年全国使用 43 次，重名率 0.005%'},
    {initial:'孙',parent:'广州孙女士',date:'2023 年 10 月',name:'子衿',content:'诗经"青青子衿，悠悠我心"，名字文雅有书卷气，很有文化底蕴。',frequency:'2014-2023 年全国使用 76 次，重名率 0.009%'},
    {initial:'马',parent:'成都马先生',date:'2023 年 9 月',name:'景行',content:'诗经"高山仰止，景行行止"，希望孩子品德高尚，行为端正。',frequency:'2014-2023 年全国使用 98 次，重名率 0.011%'},
    {initial:'朱',parent:'上海朱女士',date:'2023 年 9 月',name:'静好',content:'诗经"琴瑟在御，莫不静好"，希望孩子一生平安顺遂，岁月静好。',frequency:'2014-2023 年全国使用 123 次，重名率 0.014%'},
    {initial:'胡',parent:'深圳胡先生',date:'2023 年 8 月',name:'鸿渐',content:'周易"鸿渐于陆"，希望孩子像大雁一样步步高升，事业有成。',frequency:'2014-2023 年全国使用 34 次，重名率 0.004%'}
];

function initCases() {
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

document.addEventListener('DOMContentLoaded', function() {
    initCases();
});
