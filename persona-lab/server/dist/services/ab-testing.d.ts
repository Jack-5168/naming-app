/**
 * A/B Testing Framework - 实验配置管理和效果分析
 * 支持流量分配、数据埋点和统计分析
 *
 * 实验配置:
 * - CAT vs 经典模式对比
 * - 连续谱 vs 类型标签
 * - 五维度 vs 四维度呈现
 */
import { ABTestConfig, ABTestExposure, ABTestEvent, ABTestResults } from '../types';
/**
 * A/B 测试管理器
 */
export declare class ABTestingManager {
    private experiments;
    private exposures;
    private events;
    constructor();
    /**
     * 创建实验
     */
    createExperiment(config: ABTestConfig): ABTestConfig;
    /**
     * 更新实验配置
     */
    updateExperiment(experimentId: string, updates: Partial<ABTestConfig>): ABTestConfig | null;
    /**
     * 获取实验配置
     */
    getExperiment(experimentId: string): ABTestConfig | null;
    /**
     * 获取所有运行中的实验
     */
    getRunningExperiments(): ABTestConfig[];
    /**
     * 流量分配 - 确定用户应该进入哪个实验组
     * 使用一致性哈希确保同一用户始终进入同一组
     */
    assignVariant(experimentId: string, userId: string): string | null;
    /**
     * 记录用户曝光
     */
    private recordExposure;
    /**
     * 记录事件
     */
    recordEvent(experimentId: string, userId: string, variantId: string, metricId: string, value: number): void;
    /**
     * 获取用户的实验分配
     */
    getUserExposure(experimentId: string, userId: string): ABTestExposure | null;
    /**
     * 分析实验结果
     */
    analyzeResults(experimentId: string): ABTestResults | null;
    /**
     * 计算统计量
     */
    private calculateStats;
    /**
     * 双样本 t 检验
     */
    private tTest;
    /**
     * 近似 p 值计算 (使用标准正态分布近似)
     */
    private approximatePValue;
    /**
     * 误差函数近似
     */
    private erf;
    /**
     * t 分布临界值表 (95% 置信水平)
     */
    private tValue95;
    /**
     * 找到最佳变体
     */
    private findBestVariant;
    /**
     * 用户 ID 哈希
     */
    private hashUserId;
    /**
     * 导出实验数据
     */
    exportData(experimentId: string): {
        config: ABTestConfig | null;
        exposures: ABTestExposure[];
        events: ABTestEvent[];
    };
    /**
     * 清除实验数据
     */
    clearExperiment(experimentId: string): boolean;
}
/**
 * 创建预设实验配置 (v2 版 - 基于 IPIP-NEO 五维度)
 */
export declare function createPresetExperiments(): ABTestConfig[];
/**
 * 创建实验并立即启动
 */
export declare function createAndStartExperiment(manager: ABTestingManager, experimentId: string): ABTestConfig | null;
export default ABTestingManager;
//# sourceMappingURL=ab-testing.d.ts.map