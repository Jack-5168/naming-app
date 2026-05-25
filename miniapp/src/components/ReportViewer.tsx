/**
 * 报告可视化组件
 * 负责 16 页报告的分页展示、导航、保存和分享
 */

import React, { useState, useEffect, useRef } from 'react';

interface ReportSection {
  id: string;
  title: string;
  content: string;
  highlights?: string[];
  chart?: ChartData;
}

interface ChartData {
  type: 'radar' | 'bar' | 'line';
  data: number[];
  labels: string[];
  max?: number;
}

interface ReportViewerProps {
  reportContent: string;
  reportType: 'basic' | 'pro' | 'master';
  userName?: string;
  mbtiType?: string;
  testDate?: string;
  onSave?: (image: Blob) => void;
  onShare?: () => void;
}

interface TOCItem {
  id: string;
  title: string;
  page: number;
  level: number;
}

/**
 * 解析报告内容为结构化章节
 */
function parseReportContent(content: string): ReportSection[] {
  const sections: ReportSection[] = [];
  const lines = content.split('\n');
  
  let currentSection: ReportSection | null = null;
  let currentContent: string[] = [];
  
  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    
    if (headingMatch) {
      // 保存之前的章节
      if (currentSection) {
        currentSection.content = currentContent.join('\n').trim();
        sections.push(currentSection);
      }
      
      // 创建新章节
      currentSection = {
        id: headingMatch[1].replace(/\s+/g, '-').toLowerCase(),
        title: headingMatch[1],
        content: '',
        highlights: []
      };
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  
  // 保存最后一个章节
  if (currentSection) {
    currentSection.content = currentContent.join('\n').trim();
    sections.push(currentSection);
  }
  
  return sections;
}

/**
 * 生成目录
 */
function generateTOC(sections: ReportSection[]): TOCItem[] {
  const toc: TOCItem[] = [];
  const totalPages = Math.ceil(sections.length / 1);  // 每页一个章节
  
  sections.forEach((section, index) => {
    const level = section.title.startsWith('##') ? 2 : section.title.startsWith('###') ? 3 : 1;
    toc.push({
      id: section.id,
      title: section.title.replace(/^#+\s*/, ''),
      page: index + 1,
      level
    });
  });
  
  return toc;
}

/**
 * 提取高亮内容
 */
function extractHighlights(content: string): string[] {
  const highlights: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    if (line.includes('**') || line.includes('*') || line.startsWith('- ')) {
      highlights.push(line.replace(/\*\*/g, '').replace(/\*/g, '').trim());
    }
  }
  
  return highlights.slice(0, 5);
}

/**
 * 生成维度雷达图数据
 */
function generateRadarData(mbtiType: string): ChartData {
  // 根据 MBTI 类型生成示例数据
  const typeData: Record<string, number[]> = {
    'INTJ': [30, 70, 80, 40, 75, 35, 85, 25],
    'INTP': [25, 75, 85, 35, 70, 40, 45, 65],
    'ENTJ': [75, 35, 70, 40, 80, 30, 85, 25],
    'ENTP': [80, 30, 85, 25, 65, 45, 50, 60],
    'INFJ': [35, 75, 75, 35, 45, 65, 70, 40],
    'INFP': [30, 80, 80, 30, 35, 75, 40, 70],
    'ENFJ': [75, 35, 70, 40, 40, 70, 75, 35],
    'ENFP': [85, 25, 80, 30, 35, 75, 45, 65],
    'ISTJ': [35, 75, 40, 70, 75, 35, 85, 25],
    'ISFJ': [30, 80, 35, 75, 45, 65, 80, 30],
    'ESTJ': [75, 35, 35, 75, 80, 30, 85, 25],
    'ESFJ': [80, 30, 40, 70, 45, 65, 80, 30],
    'ISTP': [40, 70, 45, 65, 70, 40, 50, 60],
    'ISFP': [35, 75, 50, 60, 40, 70, 45, 65],
    'ESTP': [85, 25, 45, 65, 75, 35, 55, 55],
    'ESFP': [90, 20, 55, 55, 35, 75, 40, 70]
  };
  
  const data = typeData[mbtiType] || [50, 50, 50, 50, 50, 50, 50, 50];
  
  return {
    type: 'radar',
    data,
    labels: ['E', 'I', 'N', 'S', 'T', 'F', 'J', 'P'],
    max: 100
  };
}

/**
 * 报告页面组件
 */
const ReportPage: React.FC<{
  section: ReportSection;
  pageNumber: number;
  totalPages: number;
  chart?: ChartData;
}> = ({ section, pageNumber, totalPages, chart }) => {
  return (
    <div className="report-page" style={{
      padding: '40px',
      minHeight: '800px',
      backgroundColor: '#fff',
      pageBreakAfter: 'always'
    }}>
      {/* 页眉 */}
      <div style={{
        borderBottom: '2px solid #2c3e50',
        paddingBottom: '15px',
        marginBottom: '30px'
      }}>
        <h2 style={{
          margin: 0,
          color: '#2c3e50',
          fontSize: '28px',
          fontWeight: '600'
        }}>
          {section.title}
        </h2>
        <div style={{
          color: '#7f8c8d',
          fontSize: '14px',
          marginTop: '5px'
        }}>
          第 {pageNumber} 页 / 共 {totalPages} 页
        </div>
      </div>
      
      {/* 内容 */}
      <div style={{
        lineHeight: '1.8',
        fontSize: '16px',
        color: '#34495e'
      }}>
        {section.content.split('\n').map((paragraph, idx) => (
          <p key={idx} style={{
            marginBottom: '15px',
            textAlign: 'justify'
          }}>
            {paragraph}
          </p>
        ))}
      </div>
      
      {/* 高亮卡片 */}
      {section.highlights && section.highlights.length > 0 && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#ecf0f1',
          borderRadius: '8px',
          borderLeft: '4px solid #3498db'
        }}>
          <h4 style={{
            margin: '0 0 15px 0',
            color: '#2c3e50'
          }}>
            💡 关键洞察
          </h4>
          <ul style={{
            margin: 0,
            paddingLeft: '20px'
          }}>
            {section.highlights.map((highlight, idx) => (
              <li key={idx} style={{
                marginBottom: '8px',
                color: '#34495e'
              }}>
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* 图表 */}
      {chart && (
        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <RadarChart data={chart} />
        </div>
      )}
      
      {/* 页脚 */}
      <div style={{
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid #ecf0f1',
        textAlign: 'center',
        fontSize: '12px',
        color: '#95a5a6'
      }}>
        人格探索局 · 专业人格分析报告
      </div>
    </div>
  );
};

/**
 * 雷达图组件
 */
const RadarChart: React.FC<{ data: ChartData }> = ({ data }) => {
  const size = 300;
  const center = size / 2;
  const radius = (size / 2) - 40;
  
  // 计算多边形点
  const points = data.data.map((value, index) => {
    const angle = (Math.PI * 2 * index) / data.labels.length - Math.PI / 2;
    const r = (value / (data.max || 100)) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  });
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  
  return (
    <div style={{ textAlign: 'center' }}>
      <h4 style={{ marginBottom: '20px', color: '#2c3e50' }}>人格维度雷达图</h4>
      <svg width={size} height={size} style={{ maxWidth: '100%' }}>
        {/* 背景网格 */}
        {[1, 2, 3, 4].map(level => (
          <polygon
            key={level}
            points={data.labels.map((_, i) => {
              const angle = (Math.PI * 2 * i) / data.labels.length - Math.PI / 2;
              const r = (radius / 4) * level;
              return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
            }).join(' ')}
            fill="none"
            stroke="#ecf0f1"
            strokeWidth="1"
          />
        ))}
        
        {/* 轴线 */}
        {data.labels.map((label, i) => {
          const angle = (Math.PI * 2 * i) / data.labels.length - Math.PI / 2;
          return (
            <line
              key={label}
              x1={center}
              y1={center}
              x2={center + radius * Math.cos(angle)}
              y2={center + radius * Math.sin(angle)}
              stroke="#ecf0f1"
              strokeWidth="1"
            />
          );
        })}
        
        {/* 数据多边形 */}
        <path
          d={pathD}
          fill="rgba(52, 152, 219, 0.3)"
          stroke="#3498db"
          strokeWidth="2"
        />
        
        {/* 数据点 */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#3498db"
          />
        ))}
        
        {/* 标签 */}
        {data.labels.map((label, i) => {
          const angle = (Math.PI * 2 * i) / data.labels.length - Math.PI / 2;
          const labelX = center + (radius + 20) * Math.cos(angle);
          const labelY = center + (radius + 20) * Math.sin(angle);
          return (
            <text
              key={label}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
              fill="#2c3e50"
              fontWeight="600"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

/**
 * 目录组件
 */
const TableOfContents: React.FC<{
  toc: TOCItem[];
  currentPage: number;
  onPageChange: (page: number) => void;
}> = ({ toc, currentPage, onPageChange }) => {
  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      maxHeight: '600px',
      overflowY: 'auto'
    }}>
      <h3 style={{
        margin: '0 0 15px 0',
        color: '#2c3e50',
        fontSize: '18px'
      }}>
        📑 目录
      </h3>
      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: 0
      }}>
        {toc.map((item) => (
          <li
            key={item.id}
            onClick={() => onPageChange(item.page)}
            style={{
              padding: '10px 15px',
              marginBottom: '5px',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: currentPage === item.page ? '#3498db' : 'transparent',
              color: currentPage === item.page ? '#fff' : '#2c3e50',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
          >
            <span style={{
              display: 'inline-block',
              width: '30px',
              color: currentPage === item.page ? '#fff' : '#7f8c8d'
            }}>
              P{item.page}
            </span>
            {item.title}
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * 主报告查看器组件
 */
const ReportViewer: React.FC<ReportViewerProps> = ({
  reportContent,
  reportType,
  userName = '用户',
  mbtiType = 'INTJ',
  testDate = new Date().toISOString(),
  onSave,
  onShare
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showTOC, setShowTOC] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const sections = parseReportContent(reportContent);
  const toc = generateTOC(sections);
  const totalPages = sections.length;
  
  const currentSection = sections[currentPage - 1];
  const chart = currentPage === 1 ? generateRadarData(mbtiType) : undefined;
  
  // 添加高亮
  useEffect(() => {
    if (currentSection) {
      currentSection.highlights = extractHighlights(currentSection.content);
    }
  }, [currentPage, currentSection]);
  
  // 处理保存为图片
  const handleSave = async () => {
    setIsGenerating(true);
    try {
      // 实际实现需要使用 html2canvas 或类似库
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = 800;
        canvas.height = 1132;
        
        // 绘制白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 绘制内容（简化版本）
        ctx.fillStyle = '#2c3e50';
        ctx.font = '24px Arial';
        ctx.fillText(currentSection?.title || '', 40, 60);
        
        ctx.fillStyle = '#34495e';
        ctx.font = '14px Arial';
        ctx.fillText(`第 ${currentPage} 页 / 共 ${totalPages} 页`, 40, 90);
        
        // 转换为 Blob
        canvas.toBlob((blob) => {
          if (blob && onSave) {
            onSave(blob);
          }
        }, 'image/png');
      }
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // 处理分享
  const handleShare = () => {
    if (onShare) {
      onShare();
    } else {
      // 默认分享实现
      if (navigator.share) {
        navigator.share({
          title: `${userName}的人格分析报告`,
          text: `我的 MBTI 类型是 ${mbtiType}，快来看看我的人格特质！`,
          url: window.location.href
        });
      } else {
        // 复制链接
        navigator.clipboard.writeText(window.location.href);
        alert('链接已复制到剪贴板！');
      }
    }
  };
  
  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    }}>
      {/* 顶部控制栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '15px 20px',
        backgroundColor: '#2c3e50',
        borderRadius: '8px',
        color: '#fff'
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: '600'
          }}>
            📊 人格分析报告
          </h1>
          <div style={{
            fontSize: '14px',
            opacity: 0.8,
            marginTop: '5px'
          }}>
            {userName} · {mbtiType} · {reportType === 'basic' ? '基础版' : reportType === 'pro' ? '专业版' : '大师版'}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowTOC(!showTOC)}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {showTOC ? '📑 隐藏目录' : '📑 显示目录'}
          </button>
          
          <button
            onClick={handleSave}
            disabled={isGenerating}
            style={{
              padding: '10px 20px',
              backgroundColor: '#27ae60',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: isGenerating ? 0.7 : 1
            }}
          >
            {isGenerating ? '⏳ 生成中...' : '💾 保存图片'}
          </button>
          
          <button
            onClick={handleShare}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3498db',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            📤 分享
          </button>
        </div>
      </div>
      
      {/* 主内容区 */}
      <div style={{
        display: 'flex',
        gap: '20px'
      }}>
        {/* 目录侧边栏 */}
        {showTOC && (
          <div style={{ width: '250px', flexShrink: 0 }}>
            <TableOfContents
              toc={toc}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
        
        {/* 报告页面 */}
        <div style={{ flex: 1 }}>
          {currentSection && (
            <ReportPage
              section={currentSection}
              pageNumber={currentPage}
              totalPages={totalPages}
              chart={chart}
            />
          )}
          
          {/* 分页导航 */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            marginTop: '20px',
            padding: '15px'
          }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '10px 20px',
                backgroundColor: currentPage === 1 ? '#ecf0f1' : '#3498db',
                border: 'none',
                borderRadius: '4px',
                color: currentPage === 1 ? '#bdc3c7' : '#fff',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              ← 上一页
            </button>
            
            <span style={{
              fontSize: '16px',
              color: '#2c3e50'
            }}>
              第 {currentPage} 页 / 共 {totalPages} 页
            </span>
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: '10px 20px',
                backgroundColor: currentPage === totalPages ? '#ecf0f1' : '#3498db',
                border: 'none',
                borderRadius: '4px',
                color: currentPage === totalPages ? '#bdc3c7' : '#fff',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              下一页 →
            </button>
          </div>
        </div>
      </div>
      
      {/* 免责声明 */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#fef9e7',
        borderRadius: '8px',
        border: '1px solid #f1c40f',
        fontSize: '13px',
        color: '#7f8c8d'
      }}>
        <strong>⚠️ 免责声明：</strong>
        本报告基于心理学理论和用户提供信息生成，仅供参考，不构成专业心理评估、诊断或治疗建议。
        如有心理健康方面的疑问，请咨询专业心理咨询师或医疗机构。
      </div>
    </div>
  );
};

export default ReportViewer;
