/**
 * DimensionSpectrum - 连续谱可视化组件 (Big Five)
 * 展示五大人格维度的连续谱分布
 */

import React, { useMemo } from 'react';
import { DimensionSpectrumData, StabilityResult, Big5Dimension } from '../../types';

interface DimensionSpectrumProps {
  dimensions: DimensionSpectrumData[];
  overallStability?: StabilityResult;
  onDimensionClick?: (dimension: DimensionSpectrumData) => void;
  showConfidenceInterval?: boolean;
  showStability?: boolean;
  className?: string;
}

interface DimensionBarProps {
  data: DimensionSpectrumData;
  showConfidenceInterval: boolean;
  showStability: boolean;
  onClick?: () => void;
}

/**
 * 获取维度中文名称
 */
function getDimensionName(dimension: Big5Dimension): string {
  switch (dimension) {
    case 'O': return '开放性';
    case 'C': return '尽责性';
    case 'E': return '外向性';
    case 'A': return '宜人性';
    case 'N': return '神经质';
    default: return dimension;
  }
}

/**
 * 获取维度描述
 */
function getDimensionDescription(dimension: Big5Dimension, score: number): string {
  const name = getDimensionName(dimension);
  
  if (score < 20) {
    return `极低${name}`;
  } else if (score < 35) {
    return `较低${name}`;
  } else if (score < 45) {
    return `略低${name}`;
  } else if (score < 55) {
    return `中等${name}`;
  } else if (score < 65) {
    return `略高${name}`;
  } else if (score < 80) {
    return `较高${name}`;
  } else {
    return `极高${name}`;
  }
}

/**
 * 获取维度颜色
 */
function getDimensionColor(dimension: Big5Dimension): string {
  switch (dimension) {
    case 'O': return '#8b5cf6';  // purple
    case 'C': return '#3b82f6';  // blue
    case 'E': return '#f59e0b';  // amber
    case 'A': return '#22c55e';  // green
    case 'N': return '#ef4444';  // red
    default: return '#6b7280';
  }
}

/**
 * 获取稳定性状态颜色
 */
function getStabilityColor(status: string): string {
  switch (status) {
    case 'stable':
      return '#22c55e';
    case 'evolving':
      return '#f59e0b';
    case 'unstable':
      return '#ef4444';
    default:
      return '#9ca3af';
  }
}

/**
 * 单个维度谱条组件
 */
const DimensionBar: React.FC<DimensionBarProps> = ({
  data,
  showConfidenceInterval,
  showStability,
  onClick
}) => {
  const dimensionName = getDimensionName(data.dimension as Big5Dimension);
  const description = getDimensionDescription(data.dimension as Big5Dimension, data.score);
  const color = getDimensionColor(data.dimension as Big5Dimension);

  // 计算位置百分比
  const positionPercent = data.score;
  
  // 计算置信区间位置
  const ciLeft = (data.confidenceInterval[0] / 100) * 100;
  const ciRight = (data.confidenceInterval[1] / 100) * 100;
  const ciWidth = ciRight - ciLeft;

  return (
    <div 
      className="dimension-bar-container"
      onClick={onClick}
      style={{
        marginBottom: '24px',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {/* 维度标题和分数 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <span style={{
          fontSize: '14px',
          fontWeight: 600,
          color: color
        }}>
          {dimensionName}
        </span>
        <span style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#374151'
        }}>
          {data.score}/100
        </span>
      </div>

      {/* 谱条背景 */}
      <div style={{
        position: 'relative',
        height: '32px',
        background: `linear-gradient(90deg, #f3f4f6 0%, ${color}20 50%, #f3f4f6 100%)`,
        borderRadius: '16px',
        overflow: 'visible',
        border: '1px solid #e5e7eb'
      }}>
        {/* 置信区间 */}
        {showConfidenceInterval && (
          <div style={{
            position: 'absolute',
            left: `${ciLeft}%`,
            width: `${ciWidth}%`,
            height: '100%',
            background: `${color}40`,
            borderRadius: '16px',
            border: `2px dashed ${color}`
          }} />
        )}

        {/* 位置标记 */}
        <div style={{
          position: 'absolute',
          left: `${positionPercent}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '4px',
          height: '40px',
          background: color,
          borderRadius: '2px',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }}>
          {/* 稳定性指示器 */}
          {showStability && (
            <div style={{
              position: 'absolute',
              top: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '16px',
              height: '16px',
              background: getStabilityColor(data.stabilityStatus),
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
            }} />
          )}
        </div>

        {/* 刻度线 */}
        {[0, 25, 50, 75, 100].map(tick => (
          <div key={tick} style={{
            position: 'absolute',
            left: `${tick}%`,
            top: '0',
            width: '1px',
            height: '8px',
            background: '#9ca3af',
            transform: 'translateX(-50%)'
          }} />
        ))}
      </div>

      {/* 描述 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '8px'
      }}>
        <span style={{
          fontSize: '12px',
          color: '#6b7280'
        }}>
          {description}
        </span>
        {showConfidenceInterval && (
          <span style={{
            fontSize: '11px',
            color: '#9ca3af'
          }}>
            95% CI: [{data.confidenceInterval[0]}, {data.confidenceInterval[1]}]
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * 稳定性仪表盘组件
 */
const StabilityGauge: React.FC<{ stability: StabilityResult }> = ({ stability }) => {
  const percentage = Math.round(stability.stabilityProbability);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = getStabilityColor(stability.status);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px',
      background: '#f9fafb',
      borderRadius: '12px',
      marginTop: '24px'
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        fontSize: '16px',
        fontWeight: 600,
        color: '#374151'
      }}>
        人格稳定性
      </h3>

      {/* 仪表盘 */}
      <div style={{
        position: 'relative',
        width: '120px',
        height: '120px'
      }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* 背景圆环 */}
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
          />
          {/* 进度圆环 */}
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>

        {/* 中心文字 */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#1f2937'
          }}>
            {stability.isRange ? '~' : ''}{percentage}%
          </div>
          <div style={{
            fontSize: '12px',
            color: '#6b7280',
            marginTop: '4px'
          }}>
            {stability.status === 'stable' ? '稳定' : 
             stability.status === 'evolving' ? '发展中' : 
             stability.status === 'unstable' ? '不稳定' : '数据不足'}
          </div>
        </div>
      </div>

      {/* 警告信息 */}
      {stability.stabilityWarning && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#fef3c7',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#92400e',
          maxWidth: '300px',
          textAlign: 'center'
        }}>
          {stability.stabilityWarning}
        </div>
      )}

      {/* 置信区间 */}
      <div style={{
        marginTop: '12px',
        fontSize: '12px',
        color: '#6b7280'
      }}>
        置信区间：[{Math.round(stability.confidenceBand[0] * 100)}%, {Math.round(stability.confidenceBand[1] * 100)}%]
      </div>
    </div>
  );
};

/**
 * 主组件
 */
export const DimensionSpectrum: React.FC<DimensionSpectrumProps> = ({
  dimensions,
  overallStability,
  onDimensionClick,
  showConfidenceInterval = true,
  showStability = true,
  className = ''
}) => {
  const sortedDimensions = useMemo(() => {
    const order: Big5Dimension[] = ['O', 'C', 'E', 'A', 'N'];
    return [...dimensions].sort((a, b) => {
      return order.indexOf(a.dimension as Big5Dimension) - order.indexOf(b.dimension as Big5Dimension);
    });
  }, [dimensions]);

  return (
    <div className={`dimension-spectrum ${className}`}>
      {/* 维度谱条 */}
      {sortedDimensions.map(dim => (
        <DimensionBar
          key={dim.dimension}
          data={dim}
          showConfidenceInterval={showConfidenceInterval}
          showStability={showStability}
          onClick={onDimensionClick ? () => onDimensionClick(dim) : undefined}
        />
      ))}

      {/* 稳定性仪表盘 */}
      {showStability && overallStability && (
        <StabilityGauge stability={overallStability} />
      )}

      {/* 样式定义 */}
      <style>{`
        .dimension-spectrum {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          padding: 16px;
          background: white;
          border-radius: '12px';
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .dimension-bar-container:hover {
          opacity: 0.95;
        }
      `}</style>
    </div>
  );
};

export default DimensionSpectrum;
