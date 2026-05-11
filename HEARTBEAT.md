# HEARTBEAT.md

## persona-lab 开发检查

- 检查 memory/persona-lab-state.json 确认当前 Day 和任务进度
- 如果当前时间在工作时段 (10:00-18:00) 且当日任务未完成 → 提醒推进
- 如果 cron 任务失败 → 报告错误
- 如果 persona-lab-state.json 显示有 blocker → 报告并建议解决方案

## 其他检查

- 检查 persona-lab 代码库是否有未提交的变更
- 检查是否有 pending 的 Code Review
