"use strict";
/**
 * 成本控制模块
 * 负责监控 LLM 使用成本，提供预算控制和降级策略
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.costEvents = exports.COST_CONTROL = void 0;
exports.recordUsage = recordUsage;
exports.getBudgetStatus = getBudgetStatus;
exports.isWithinBudget = isWithinBudget;
exports.getModelStrategy = getModelStrategy;
exports.getFallbackModel = getFallbackModel;
exports.getMaxRetries = getMaxRetries;
exports.cleanupOldRecords = cleanupOldRecords;
exports.exportUsageRecords = exportUsageRecords;
const events_1 = require("events");
exports.COST_CONTROL = {
    budget: {
        dailyLimit: 100, // 美元/天
        monthlyLimit: 2000, // 美元/月
        alertThreshold: 0.8 // 80% 时告警
    },
    modelStrategy: {
        basic_report: { model: 'gpt-4o-mini', maxTokens: 1500 },
        pro_report: { model: 'gpt-4o-mini', maxTokens: 3500 },
        master_report: { model: 'gpt-4o-mini', maxTokens: 5000 }
    },
    fallback: {
        enabled: true,
        maxRetries: 2,
        fallbackModel: 'claude-haiku'
    }
};
// 成本事件发射器
exports.costEvents = new events_1.EventEmitter();
// 内存存储（生产环境应使用 Redis/数据库）
const usageRecords = [];
const dailyAlertsSent = new Set();
const monthlyAlertsSent = new Set();
/**
 * 获取今日开始时间戳
 */
function getTodayStart() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
}
/**
 * 获取本月开始时间戳
 */
function getMonthStart() {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now.getTime();
}
/**
 * 记录使用成本
 */
function recordUsage(record) {
    usageRecords.push(record);
    // 检查预算状态
    const status = getBudgetStatus();
    // 触发告警
    if (status.isAlertTriggered) {
        const alertKey = `${new Date().toDateString()}`;
        if (!dailyAlertsSent.has(alertKey)) {
            dailyAlertsSent.add(alertKey);
            exports.costEvents.emit('budgetAlert', {
                type: 'daily',
                percentage: status.dailyPercentage,
                used: status.dailyUsed,
                limit: exports.COST_CONTROL.budget.dailyLimit
            });
        }
        const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`;
        if (!monthlyAlertsSent.has(monthKey)) {
            monthlyAlertsSent.add(monthKey);
            exports.costEvents.emit('budgetAlert', {
                type: 'monthly',
                percentage: status.monthlyPercentage,
                used: status.monthlyUsed,
                limit: exports.COST_CONTROL.budget.monthlyLimit
            });
        }
    }
}
/**
 * 获取预算状态
 */
function getBudgetStatus() {
    const todayStart = getTodayStart();
    const monthStart = getMonthStart();
    const now = Date.now();
    const dailyUsed = usageRecords
        .filter(r => r.timestamp >= todayStart && r.timestamp < now)
        .reduce((sum, r) => sum + r.cost, 0);
    const monthlyUsed = usageRecords
        .filter(r => r.timestamp >= monthStart && r.timestamp < now)
        .reduce((sum, r) => sum + r.cost, 0);
    const dailyPercentage = dailyUsed / exports.COST_CONTROL.budget.dailyLimit;
    const monthlyPercentage = monthlyUsed / exports.COST_CONTROL.budget.monthlyLimit;
    return {
        dailyUsed,
        dailyRemaining: exports.COST_CONTROL.budget.dailyLimit - dailyUsed,
        monthlyUsed,
        monthlyRemaining: exports.COST_CONTROL.budget.monthlyLimit - monthlyUsed,
        dailyPercentage,
        monthlyPercentage,
        isAlertTriggered: dailyPercentage >= exports.COST_CONTROL.budget.alertThreshold ||
            monthlyPercentage >= exports.COST_CONTROL.budget.alertThreshold
    };
}
/**
 * 检查是否超出预算
 */
function isWithinBudget(estimatedCost) {
    const status = getBudgetStatus();
    return status.dailyRemaining >= estimatedCost && status.monthlyRemaining >= estimatedCost;
}
/**
 * 获取报告类型的模型策略
 */
function getModelStrategy(reportType) {
    const strategy = exports.COST_CONTROL.modelStrategy[`${reportType}_report`];
    return strategy || exports.COST_CONTROL.modelStrategy.basic_report;
}
/**
 * 获取降级模型
 */
function getFallbackModel() {
    return exports.COST_CONTROL.fallback.enabled ? exports.COST_CONTROL.fallback.fallbackModel : null;
}
/**
 * 获取最大重试次数
 */
function getMaxRetries() {
    return exports.COST_CONTROL.fallback.maxRetries;
}
/**
 * 清理旧数据（保留最近 30 天）
 */
function cleanupOldRecords() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const index = usageRecords.findIndex(r => r.timestamp >= thirtyDaysAgo);
    if (index > 0) {
        usageRecords.splice(0, index);
    }
    // 清理告警记录
    const today = new Date().toDateString();
    for (const key of dailyAlertsSent) {
        if (key !== today) {
            dailyAlertsSent.delete(key);
        }
    }
}
/**
 * 导出使用记录（用于分析）
 */
function exportUsageRecords(startDate, endDate) {
    return usageRecords.filter(r => {
        if (startDate && r.timestamp < startDate)
            return false;
        if (endDate && r.timestamp > endDate)
            return false;
        return true;
    });
}
// 每天午夜自动清理
setInterval(() => {
    cleanupOldRecords();
}, 24 * 60 * 60 * 1000);
exports.default = {
    COST_CONTROL: exports.COST_CONTROL,
    recordUsage,
    getBudgetStatus,
    isWithinBudget,
    getModelStrategy,
    getFallbackModel,
    getMaxRetries,
    cleanupOldRecords,
    exportUsageRecords,
    costEvents: exports.costEvents
};
//# sourceMappingURL=cost-control.js.map