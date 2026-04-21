#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
IRT 参数标定脚本
================
用于人格测试题目的项目反应理论（Item Response Theory）参数估计

功能:
- 数据清理（无效样本剔除、缺失值处理、反向计分转换）
- IRT 参数估计（2PL 模型，五维度独立估计）
- 题目筛选（基于区分度和难度）
- 信效度分析（Cronbach's α、重测信度、结构效度）

依赖:
- pandas >= 1.3.0
- numpy >= 1.20.0
- mirt >= 1.0.0 (或 pyirt)
- scipy >= 1.7.0
- sklearn >= 1.0.0
- matplotlib >= 3.4.0
- seaborn >= 0.11.0

作者：Persona Lab
日期：2026-04
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import json
import warnings
warnings.filterwarnings('ignore')

# 尝试导入 mirt，如果不可用则使用备选方案
try:
    import mirt
    MIRT_AVAILABLE = True
except ImportError:
    MIRT_AVAILABLE = False
    print("警告：mirt 库未安装，将使用简化版 IRT 估计")

from scipy import stats
from sklearn.factor_analysis import FactorAnalyzer
import matplotlib.pyplot as plt
import seaborn as sns

# 设置绘图风格
sns.set_style("whitegrid")
plt.rcParams['font.sans-serif'] = ['SimHei', 'DejaVu Sans']  # 支持中文
plt.rcParams['axes.unicode_minus'] = False


# ============================================================================
# 1. 数据清理模块
# ============================================================================

def clean_data(raw_data: pd.DataFrame, 
               config: Dict) -> Tuple[pd.DataFrame, Dict]:
    """
    数据清理主函数
    
    参数:
        raw_data: 原始数据 DataFrame
        config: 配置字典，包含:
            - reverse_items: 反向计分题目列表
            - attention_items: 注意力检测题
            - lie_items: 测谎题
            - min_duration: 最小答题时间（秒）
            - max_duration: 最大答题时间（秒）
            - missing_threshold: 最大缺失题数
    
    返回:
        cleaned_data: 清理后的数据
        cleaning_report: 清理报告字典
    """
    cleaning_report = {
        'initial_n': len(raw_data),
        'excluded': {
            'time': 0,
            'attention': 0,
            'social_desirability': 0,
            'missing': 0,
            'response_set': 0
        },
        'final_n': 0,
        'missing_imputed': 0
    }
    
    df = raw_data.copy()
    
    # 1. 剔除答题时间异常
    if 'duration' in df.columns:
        time_mask = (df['duration'] >= config['min_duration']) & \
                    (df['duration'] <= config['max_duration'])
        cleaning_report['excluded']['time'] = (~time_mask).sum()
        df = df[time_mask]
    
    # 2. 剔除注意力检测失败
    if 'attention_correct' in df.columns:
        attention_mask = df['attention_correct'] >= 2
        cleaning_report['excluded']['attention'] = (~attention_mask).sum()
        df = df[attention_mask]
    
    # 3. 剔除社会赞许性过高
    if config.get('lie_items'):
        lie_score = df[config['lie_items']].sum(axis=1)
        lie_mask = lie_score < 11  # 满分 12，≥11 为过高
        cleaning_report['excluded']['social_desirability'] = (~lie_mask).sum()
        df = df[lie_mask]
    
    # 4. 处理缺失值
    item_cols = get_item_columns(df, config)
    missing_counts = df[item_cols].isna().sum(axis=1)
    missing_mask = missing_counts <= config['missing_threshold']
    cleaning_report['excluded']['missing'] = (~missing_mask).sum()
    df = df[missing_mask]
    
    # 缺失值插补（均值）
    missing_before = df[item_cols].isna().sum().sum()
    for col in item_cols:
        if df[col].isna().any():
            df[col].fillna(df[col].mean(), inplace=True)
    cleaning_report['missing_imputed'] = missing_before
    
    # 5. 检测反应定势
    response_set_mask = ~detect_response_set(df[item_cols])
    cleaning_report['excluded']['response_set'] = (~response_set_mask).sum()
    df = df[response_set_mask]
    
    # 6. 反向计分转换
    df = reverse_score(df, config['reverse_items'])
    
    cleaning_report['final_n'] = len(df)
    cleaning_report['exclusion_rate'] = 1 - cleaning_report['final_n'] / cleaning_report['initial_n']
    
    return df, cleaning_report


def get_item_columns(df: pd.DataFrame, config: Dict) -> List[str]:
    """获取所有题目列名"""
    # 简单实现：假设题目列名为 item_1, item_2, ... 或 q1, q2, ...
    item_cols = []
    for col in df.columns:
        if col.startswith('item_') or col.startswith('q'):
            try:
                int(col.split('_')[-1])
                item_cols.append(col)
            except:
                pass
    return item_cols if item_cols else config.get('item_columns', [])


def reverse_score(df: pd.DataFrame, reverse_items: List[str]) -> pd.DataFrame:
    """
    反向计分转换
    
    公式：转换分 = 6 - 原始分（5 点量表）
    """
    df = df.copy()
    for item in reverse_items:
        if item in df.columns:
            df[item] = 6 - df[item]
    return df


def detect_response_set(df: pd.DataFrame, 
                        threshold: int = 20,
                        variance_threshold: float = 0.5) -> pd.Series:
    """
    检测反应定势
    
    标准:
    - 连续 threshold 题选择相同选项
    - 或整体方差 < variance_threshold
    """
    # 方法 1: 检查连续相同回答
    consecutive_same = []
    for idx, row in df.iterrows():
        values = row.values
        max_consecutive = 1
        current_consecutive = 1
        for i in range(1, len(values)):
            if values[i] == values[i-1]:
                current_consecutive += 1
                max_consecutive = max(max_consecutive, current_consecutive)
            else:
                current_consecutive = 1
        consecutive_same.append(max_consecutive < threshold)
    
    # 方法 2: 检查方差
    variances = df.var(axis=1)
    low_variance = variances >= variance_threshold
    
    # 两者满足其一即可
    return pd.Series(consecutive_same, index=df.index) & low_variance


# ============================================================================
# 2. IRT 参数估计模块
# ============================================================================

def estimate_parameters(data: pd.DataFrame,
                        dimensions: Dict[str, List[str]],
                        model: str = '2PL') -> Dict:
    """
    IRT 参数估计
    
    参数:
        data: 清理后的数据
        dimensions: 维度定义字典 {维度名：[题目列表]}
        model: 模型类型 ('2PL' 或 '3PL')
    
    返回:
        parameters: 参数字典 {维度名：{题目：{a, b}}}
    """
    parameters = {}
    
    if not MIRT_AVAILABLE:
        # 简化版：使用逻辑回归近似
        print("使用简化版 IRT 估计（逻辑回归近似）")
        for dim_name, items in dimensions.items():
            dim_params = estimate_2pl_simple(data, items)
            parameters[dim_name] = dim_params
        return parameters
    
    # 完整版：使用 mirt 库
    for dim_name, items in dimensions.items():
        print(f"估计维度 {dim_name} 的参数...")
        dim_data = data[items].values
        
        # 2PL 模型
        try:
            # mirt 使用
            # item_params = mirt.estimate(dim_data, model='2PL')
            # 这里使用伪代码，实际需要根据 mirt API 调整
            dim_params = estimate_with_mirt(dim_data, items)
            parameters[dim_name] = dim_params
        except Exception as e:
            print(f"维度 {dim_name} 估计失败：{e}")
            # 回退到简化版
            dim_params = estimate_2pl_simple(data, items)
            parameters[dim_name] = dim_params
    
    return parameters


def estimate_with_mirt(data: np.ndarray, items: List[str]) -> Dict:
    """使用 mirt 库估计参数（伪代码）"""
    # 实际使用时需要安装 mirt 并调整 API 调用
    # 这里提供框架
    pass


def estimate_2pl_simple(data: pd.DataFrame, items: List[str]) -> Dict:
    """
    简化版 2PL 参数估计
    
    使用逻辑回归近似:
    - a (区分度): 与总分的相关系数 * 缩放因子
    - b (难度): 答对率转换
    
    注意：这是近似方法，正式研究应使用专业 IRT 软件
    """
    params = {}
    
    # 计算维度总分
    total_score = data[items].sum(axis=1)
    
    for item in items:
        item_scores = data[item]
        
        # 区分度 (a): 与总分的相关（点二列相关）
        a = np.corrcoef(item_scores, total_score)[0, 1]
        if np.isnan(a):
            a = 0.5  # 默认值
        
        # 难度 (b): 基于答对率（这里用平均分近似）
        # 5 点量表转换为 -2 到 +2 范围
        mean_score = item_scores.mean()
        b = (mean_score - 3) / 2  # 中心化到 -2~2
        
        # 参数范围限制
        a = np.clip(a * 2, 0.5, 2.5)  # 缩放并限制范围
        b = np.clip(b, -2, 2)
        
        params[item] = {
            'a': round(float(a), 3),
            'b': round(float(b), 3),
            'mean': round(float(mean_score), 3),
            'sd': round(float(item_scores.std()), 3)
        }
    
    return params


def filter_items(parameters: Dict,
                 a_min: float = 0.8,
                 a_max: float = 2.5,
                 b_min: float = -2,
                 b_max: float = 2) -> Dict:
    """
    筛选题目
    
    标准:
    - 区分度 a < a_min: 删除（区分度不足）
    - 区分度 a > a_max: 删除（可能有问题）
    - 难度 b 超出范围：删除（太易或太难）
    """
    filtered = {}
    removed = {}
    
    for dim_name, items in parameters.items():
        filtered[dim_name] = {}
        removed[dim_name] = []
        
        for item, params in items.items():
            a = params['a']
            b = params['b']
            
            if a < a_min:
                removed[dim_name].append({
                    'item': item, 
                    'reason': f'区分度过低 (a={a})'
                })
            elif a > a_max:
                removed[dim_name].append({
                    'item': item, 
                    'reason': f'区分度过高 (a={a})'
                })
            elif b < b_min or b > b_max:
                removed[dim_name].append({
                    'item': item, 
                    'reason': f'难度极端 (b={b})'
                })
            else:
                filtered[dim_name][item] = params
    
    return filtered, removed


# ============================================================================
# 3. 信效度分析模块
# ============================================================================

def analyze_reliability(data: pd.DataFrame,
                        dimensions: Dict[str, List[str]],
                        retest_data: Optional[pd.DataFrame] = None) -> Dict:
    """
    信度分析
    
    包括:
    - Cronbach's α（内部一致性）
    - 重测信度（如有重测数据）
    - 分半信度
    """
    reliability = {}
    
    # 1. Cronbach's α
    reliability['cronbach_alpha'] = {}
    for dim_name, items in dimensions.items():
        alpha = calculate_cronbach_alpha(data[items])
        reliability['cronbach_alpha'][dim_name] = round(alpha, 3)
    
    # 总体 α
    all_items = [item for items in dimensions.values() for item in items]
    reliability['cronbach_alpha']['total'] = round(
        calculate_cronbach_alpha(data[all_items]), 3
    )
    
    # 2. 重测信度
    if retest_data is not None:
        reliability['test_retest'] = {}
        for dim_name, items in dimensions.items():
            baseline_scores = data[items].sum(axis=1)
            retest_scores = retest_data[items].sum(axis=1)
            
            # 对齐被试
            common_idx = baseline_scores.index.intersection(retest_scores.index)
            if len(common_idx) > 10:
                corr = np.corrcoef(
                    baseline_scores.loc[common_idx],
                    retest_scores.loc[common_idx]
                )[0, 1]
                reliability['test_retest'][dim_name] = round(float(corr), 3)
    
    # 3. 分半信度
    reliability['split_half'] = {}
    for dim_name, items in dimensions.items():
        if len(items) >= 4:
            odd_items = items[::2]
            even_items = items[1::2]
            odd_score = data[odd_items].sum(axis=1)
            even_score = data[even_items].sum(axis=1)
            corr = np.corrcoef(odd_score, even_score)[0, 1]
            # Spearman-Brown 校正
            split_half = 2 * corr / (1 + corr)
            reliability['split_half'][dim_name] = round(float(split_half), 3)
    
    return reliability


def calculate_cronbach_alpha(data: pd.DataFrame) -> float:
    """计算 Cronbach's α系数"""
    n_items = data.shape[1]
    if n_items < 2:
        return np.nan
    
    # 计算题目方差和总分方差
    item_variances = data.var(axis=0).sum()
    total_variance = data.sum(axis=1).var()
    
    # Cronbach's α公式
    alpha = (n_items / (n_items - 1)) * (1 - item_variances / total_variance)
    
    return max(0, min(1, alpha))  # 限制在 0-1 范围


def analyze_validity(data: pd.DataFrame,
                     dimensions: Dict[str, List[str]]) -> Dict:
    """
    效度分析
    
    包括:
    - 结构效度（探索性因子分析）
    - 收敛效度
    - 区分效度
    """
    validity = {}
    
    # 1. 探索性因子分析 (EFA)
    try:
        all_items = [item for items in dimensions.values() for item in items]
        fa = FactorAnalyzer(n_factors=len(dimensions), rotation='varimax')
        fa.fit(data[all_items])
        
        # 因子载荷矩阵
        loadings = pd.DataFrame(
            fa.loadings_,
            index=all_items,
            columns=list(dimensions.keys())
        )
        
        # 拟合指数（简化版）
        validity['efa'] = {
            'loadings': loadings.round(2).to_dict(),
            'variance_explained': fa.get_factor_variance()[0].round(3).tolist()
        }
        
        # 验证五因子结构
        validity['five_factor_fit'] = check_five_factor_structure(loadings, dimensions)
        
    except Exception as e:
        validity['efa_error'] = str(e)
    
    # 2. 收敛效度（维度内题目相关）
    validity['convergent'] = {}
    for dim_name, items in dimensions.items():
        corr_matrix = data[items].corr()
        # 平均题目间相关
        upper_tri = corr_matrix.where(
            np.triu(np.ones(corr_matrix.shape), k=1).astype(bool)
        )
        mean_corr = upper_tri.stack().mean()
        validity['convergent'][dim_name] = round(float(mean_corr), 3)
    
    # 3. 区分效度（维度间相关）
    validity['discriminant'] = {}
    dim_scores = {}
    for dim_name, items in dimensions.items():
        dim_scores[dim_name] = data[items].sum(axis=1)
    
    dim_corr = pd.DataFrame(dim_scores).corr()
    validity['discriminant']['correlations'] = dim_corr.round(3).to_dict()
    
    return validity


def check_five_factor_structure(loadings: pd.DataFrame,
                                 dimensions: Dict[str, List[str]],
                                 threshold: float = 0.4) -> Dict:
    """检查五因子模型拟合"""
    fit_report = {
        'items_loaded_correctly': 0,
        'total_items': len(loadings),
        'cross_loadings': 0,
        'poor_loadings': 0
    }
    
    for item in loadings.index:
        item_loadings = loadings.loc[item]
        max_loading = item_loadings.abs().max()
        max_dim = item_loadings.abs().idxmax()
        
        # 检查是否加载到预期因子
        expected_dim = None
        for dim_name, items in dimensions.items():
            if item in items:
                expected_dim = dim_name
                break
        
        if expected_dim and max_dim == expected_dim and max_loading >= threshold:
            fit_report['items_loaded_correctly'] += 1
        elif max_loading < threshold:
            fit_report['poor_loadings'] += 1
        else:
            fit_report['cross_loadings'] += 1
    
    fit_report['fit_rate'] = round(
        fit_report['items_loaded_correctly'] / fit_report['total_items'], 3
    )
    
    return fit_report


# ============================================================================
# 4. 可视化模块
# ============================================================================

def plot_item_parameters(parameters: Dict, output_path: str):
    """绘制题目参数分布图"""
    fig, axes = plt.subplots(2, 3, figsize=(15, 10))
    axes = axes.flatten()
    
    dim_names = list(parameters.keys())
    colors = plt.cm.Set3(np.linspace(0, 1, len(dim_names)))
    
    # 图 1: 区分度分布
    for i, (dim_name, items) in enumerate(parameters.items()):
        a_values = [params['a'] for params in items.values()]
        axes[0].hist(a_values, alpha=0.6, label=dim_name, color=colors[i], bins=20)
    axes[0].axvline(x=0.8, color='red', linestyle='--', label='阈值 (0.8)')
    axes[0].set_xlabel('区分度 (a)')
    axes[0].set_ylabel('题目数量')
    axes[0].set_title('题目区分度分布')
    axes[0].legend()
    
    # 图 2: 难度分布
    for i, (dim_name, items) in enumerate(parameters.items()):
        b_values = [params['b'] for params in items.values()]
        axes[1].hist(b_values, alpha=0.6, label=dim_name, color=colors[i], bins=20)
    axes[1].axvline(x=-2, color='red', linestyle='--')
    axes[1].axvline(x=2, color='red', linestyle='--')
    axes[1].set_xlabel('难度 (b)')
    axes[1].set_ylabel('题目数量')
    axes[1].set_title('题目难度分布')
    
    # 图 3: 维度平均分
    dim_means = {}
    for dim_name, items in parameters.items():
        means = [params['mean'] for params in items.values()]
        dim_means[dim_name] = np.mean(means)
    
    axes[2].bar(dim_means.keys(), dim_means.values(), color=colors[:len(dim_means)])
    axes[2].axhline(y=3, color='red', linestyle='--', label='中点 (3)')
    axes[2].set_ylabel('平均分')
    axes[2].set_title('各维度题目平均分')
    axes[2].legend()
    
    # 图 4-6: 各维度参数散点图
    for i, (dim_name, items) in enumerate(parameters.items()):
        ax = axes[i + 3]
        a_values = [params['a'] for params in items.values()]
        b_values = [params['b'] for params in items.values()]
        ax.scatter(b_values, a_values, alpha=0.6, color=colors[i])
        ax.set_xlabel('难度 (b)')
        ax.set_ylabel('区分度 (a)')
        ax.set_title(f'{dim_name} 参数分布')
        ax.axhline(y=0.8, color='red', linestyle='--', alpha=0.5)
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"参数图已保存至：{output_path}")


def plot_reliability(reliability: Dict, output_path: str):
    """绘制信度分析图"""
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    
    # Cronbach's α
    if 'cronbach_alpha' in reliability:
        alpha_data = reliability['cronbach_alpha']
        dims = list(alpha_data.keys())
        values = list(alpha_data.values())
        
        colors = ['green' if v >= 0.8 else 'orange' if v >= 0.7 else 'red' for v in values]
        axes[0].bar(dims, values, color=colors)
        axes[0].axhline(y=0.8, color='green', linestyle='--', label='优秀 (0.8)')
        axes[0].axhline(y=0.7, color='orange', linestyle='--', label='可接受 (0.7)')
        axes[0].set_ylabel("Cronbach's α")
        axes[0].set_title('内部一致性信度')
        axes[0].legend()
        axes[0].set_ylim(0, 1)
    
    # 重测信度
    if 'test_retest' in reliability:
        retest_data = reliability['test_retest']
        dims = list(retest_data.keys())
        values = list(retest_data.values())
        
        colors = ['green' if v >= 0.75 else 'orange' if v >= 0.6 else 'red' for v in values]
        axes[1].bar(dims, values, color=colors)
        axes[1].axhline(y=0.75, color='green', linestyle='--', label='优秀 (0.75)')
        axes[1].axhline(y=0.6, color='orange', linestyle='--', label='可接受 (0.6)')
        axes[1].set_ylabel('重测相关')
        axes[1].set_title('重测信度')
        axes[1].legend()
        axes[1].set_ylim(0, 1)
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"信度图已保存至：{output_path}")


# ============================================================================
# 5. 输出模块
# ============================================================================

def export_calibrated_items(parameters: Dict,
                            dimensions: Dict[str, List[str]],
                            output_path: str):
    """导出标定后题库（JSON 格式）"""
    calibrated题库 = {
        'metadata': {
            'version': '1.0',
            'date': pd.Timestamp.now().strftime('%Y-%m-%d'),
            'model': '2PL',
            'dimensions': list(dimensions.keys())
        },
        'items': {}
    }
    
    for dim_name, items in parameters.items():
        for item_id, params in items.items():
            calibrated 题库['items'][item_id] = {
                'dimension': dim_name,
                'a': params['a'],
                'b': params['b'],
                'mean': params.get('mean', None),
                'sd': params.get('sd', None)
            }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(calibrated 题库，f, ensure_ascii=False, indent=2)
    
    print(f"标定题库已保存至：{output_path}")


def generate_report(cleaning_report: Dict,
                    parameters: Dict,
                    reliability: Dict,
                    validity: Dict,
                    removed_items: Dict,
                    output_path: str):
    """生成质量报告（Markdown 格式）"""
    report = []
    report.append("# IRT 参数标定报告\n")
    report.append(f"**生成日期**: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')}\n")
    
    # 1. 样本描述
    report.append("## 样本描述\n")
    report.append(f"- **初始样本**: N = {cleaning_report['initial_n']}")
    report.append(f"- **最终样本**: N = {cleaning_report['final_n']}")
    report.append(f"- **剔除率**: {cleaning_report['exclusion_rate']:.1%}\n")
    
    report.append("### 剔除原因\n")
    for reason, count in cleaning_report['excluded'].items():
        report.append(f"- {reason}: {count} 人")
    report.append(f"- **缺失值插补**: {cleaning_report['missing_imputed']} 个\n")
    
    # 2. 题目参数统计
    report.append("## 题目参数统计\n")
    for dim_name, items in parameters.items():
        a_values = [p['a'] for p in items.values()]
        b_values = [p['b'] for p in items.values()]
        
        report.append(f"### {dim_name}\n")
        report.append(f"- 题目数量：{len(items)}")
        report.append(f"- 区分度 (a): M = {np.mean(a_values):.2f}, SD = {np.std(a_values):.2f}")
        report.append(f"- 难度 (b): M = {np.mean(b_values):.2f}, SD = {np.std(b_values):.2f}\n")
    
    # 3. 删除题目
    report.append("## 删除题目\n")
    total_removed = sum(len(items) for items in removed_items.values())
    report.append(f"共删除 {total_removed} 题\n")
    for dim_name, items in removed_items.items():
        if items:
            report.append(f"### {dim_name}\n")
            for item in items:
                report.append(f"- {item['item']}: {item['reason']}")
    report.append("")
    
    # 4. 信度分析
    report.append("## 信度分析\n")
    report.append("### Cronbach's α系数\n")
    for dim, alpha in reliability.get('cronbach_alpha', {}).items():
        report.append(f"- {dim}: {alpha:.3f}")
    
    if 'test_retest' in reliability:
        report.append("\n### 重测信度\n")
        for dim, corr in reliability['test_retest'].items():
            report.append(f"- {dim}: {corr:.3f}")
    
    if 'split_half' in reliability:
        report.append("\n### 分半信度\n")
        for dim, corr in reliability['split_half'].items():
            report.append(f"- {dim}: {corr:.3f}")
    report.append("")
    
    # 5. 效度分析
    report.append("## 效度分析\n")
    if 'five_factor_fit' in validity.get('efa', {}):
        fit = validity['efa']['five_factor_fit']
        report.append("### 结构效度（五因子模型）\n")
        report.append(f"- 正确加载题目：{fit['items_loaded_correctly']}/{fit['total_items']} ({fit['fit_rate']:.1%})")
        report.append(f"- 交叉加载：{fit['cross_loadings']}")
        report.append(f"- 低载荷：{fit['poor_loadings']}\n")
    
    report.append("### 收敛效度（平均题目间相关）\n")
    for dim, corr in validity.get('convergent', {}).items():
        report.append(f"- {dim}: {corr:.3f}")
    report.append("")
    
    # 6. 最终题库
    report.append("## 最终题库\n")
    total_items = sum(len(items) for items in parameters.values())
    report.append(f"**总题目数**: {total_items} 题\n")
    for dim_name, items in parameters.items():
        report.append(f"- {dim_name}: {len(items)} 题")
    
    # 保存报告
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(report))
    
    print(f"质量报告已保存至：{output_path}")


# ============================================================================
# 6. 主函数
# ============================================================================

def main():
    """主函数"""
    print("=" * 60)
    print("IRT 参数标定脚本")
    print("=" * 60)
    
    # 配置
    config = {
        'reverse_items': [
            # IPIP-NEO-60 反向题
            'item_9', 'item_10', 'item_11', 'item_12',
            'item_16', 'item_28', 'item_30', 'item_31', 'item_32',
            'item_33', 'item_34', 'item_36', 'item_39', 'item_40',
            'item_43', 'item_44', 'item_45', 'item_46', 'item_52',
            'item_54', 'item_58', 'item_59', 'item_60',
            # 中文补充题反向题（根据实际题目调整）
        ],
        'attention_items': ['item_106', 'item_107', 'item_108'],
        'lie_items': ['item_97', 'item_98', 'item_99', 'item_100'],
        'min_duration': 300,  # 5 分钟
        'max_duration': 3600,  # 60 分钟
        'missing_threshold': 10,  # 最多缺失 10 题
        'item_columns': []  # 会自动检测
    }
    
    # 维度定义
    dimensions = {
        'Neuroticism': [f'item_{i}' for i in range(1, 13)],
        'Extraversion': [f'item_{i}' for i in range(13, 25)],
        'Openness': [f'item_{i}' for i in range(25, 37)],
        'Agreeableness': [f'item_{i}' for i in range(37, 49)],
        'Conscientiousness': [f'item_{i}' for i in range(49, 61)]
    }
    
    # 创建输出目录
    output_dir = Path('/home/admin/.openclaw/workspace/persona-lab/output')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. 读取数据
    data_path = Path('/home/admin/.openclaw/workspace/persona-lab/data/raw_data.csv')
    if not data_path.exists():
        print(f"数据文件不存在：{data_path}")
        print("请确保数据文件位于正确位置")
        return
    
    print(f"读取数据：{data_path}")
    raw_data = pd.read_csv(data_path)
    print(f"初始样本量：{len(raw_data)}")
    
    # 2. 数据清理
    print("\n正在进行数据清理...")
    cleaned_data, cleaning_report = clean_data(raw_data, config)
    print(f"清理后样本量：{len(cleaned_data)}")
    print(f"剔除率：{cleaning_report['exclusion_rate']:.1%}")
    
    # 3. IRT 参数估计
    print("\n正在进行 IRT 参数估计...")
    parameters = estimate_parameters(cleaned_data, dimensions)
    
    # 4. 题目筛选
    print("\n正在筛选题目...")
    filtered_params, removed_items = filter_items(parameters)
    total_removed = sum(len(items) for items in removed_items.values())
    print(f"删除题目数：{total_removed}")
    
    # 5. 信度分析
    print("\n正在进行信度分析...")
    reliability = analyze_reliability(cleaned_data, dimensions)
    print(f"总体 Cronbach's α: {reliability['cronbach_alpha'].get('total', 'N/A')}")
    
    # 6. 效度分析
    print("\n正在进行效度分析...")
    validity = analyze_validity(cleaned_data, dimensions)
    
    # 7. 可视化
    print("\n正在生成图表...")
    plot_item_parameters(parameters, str(output_dir / 'item_parameters.png'))
    plot_reliability(reliability, str(output_dir / 'reliability.png'))
    
    # 8. 导出结果
    print("\n正在导出结果...")
    export_calibrated_items(
        filtered_params, 
        dimensions,
        str(output_dir / 'calibrated_items.json')
    )
    
    generate_report(
        cleaning_report,
        filtered_params,
        reliability,
        validity,
        removed_items,
        str(output_dir / 'calibration_report.md')
    )
    
    # 9. 保存清理后数据
    cleaned_data.to_csv(output_dir / 'clean_data.csv', index=False)
    print(f"清理后数据已保存至：{output_dir / 'clean_data.csv'}")
    
    print("\n" + "=" * 60)
    print("IRT 参数标定完成！")
    print("=" * 60)


if __name__ == '__main__':
    main()
