# Phase 5: 商业化 + 增长 (排除支付)

**周期**: 2026-05-11 → 2026-05-18  
**排除**: 支付模块（上架前再接入）

---

## Day 15 (5/11) — 会员系统完善

| 时间        | 任务                           | 产出                                               |
| ----------- | ------------------------------ | -------------------------------------------------- |
| 14:30-16:00 | 会员权益系统 (权限检查中间件)  | `server/src/middleware/membership-check.ts`        |
| 16:00-17:30 | 订阅管理 (创建/查询/续费/取消) | `server/src/controllers/subscriptions.ts`          |
| 17:30-19:00 | 会员状态前端展示               | `miniapp/src/pages/membership/membership.tsx` 改造 |
| 19:00-20:30 | 续费提醒 (定时任务 + 推送)     | `server/src/services/renewal-reminder.ts`          |

---

## Day 16 (5/12) — 用户增长引擎

| 时间        | 任务                        | 产出                                      |
| ----------- | --------------------------- | ----------------------------------------- |
| 10:00-11:30 | 邀请码系统 (生成/验证/奖励) | `server/src/services/invite-system.ts`    |
| 11:30-13:00 | 分享裂变 (分享得免费测试)   | `server/src/controllers/sharing.ts`       |
| 14:00-15:30 | 推荐奖励 (双方获会员天数)   | `server/src/services/referral-rewards.ts` |
| 15:30-17:00 | 邀请页面 UI                 | `miniapp/src/pages/invite/invite.tsx`     |

---

## Day 17 (5/13) — 数据分析面板

| 时间        | 任务                             | 产出                                    |
| ----------- | -------------------------------- | --------------------------------------- |
| 10:00-11:30 | 用户行为追踪 (事件埋点)          | `server/src/services/analytics.ts`      |
| 11:30-13:00 | 转化率漏斗 (登录→测试→报告→会员) | `server/src/controllers/analytics.ts`   |
| 14:00-15:30 | 留存分析 (7日/30日)              | `server/src/services/retention.ts`      |
| 15:30-17:00 | 管理后台数据看板                 | `miniapp/src/pages/admin/dashboard.tsx` |

---

## Day 18 (5/14) — 性能极致优化

| 时间        | 任务                | 产出                              |
| ----------- | ------------------- | --------------------------------- |
| 10:00-11:30 | 数据库索引优化      | `prisma/migrations/` + 优化报告   |
| 11:30-13:00 | Redis 缓存策略优化  | `server/src/services/cache-v3.ts` |
| 14:00-15:30 | 前端包体积优化      | 分析 + 分割 + 懒加载              |
| 15:30-17:00 | Lighthouse 评分 ≥95 | 性能审计报告                      |

---

## Day 19 (5/15) — 内容管理系统

| 时间        | 任务              | 产出                                            |
| ----------- | ----------------- | ----------------------------------------------- |
| 10:00-11:30 | 文章/内容管理 API | `server/src/controllers/content.ts`             |
| 11:30-13:00 | 内容推荐引擎      | `server/src/services/content-recommendation.ts` |
| 14:00-15:30 | 内容展示页面      | `miniapp/src/pages/content/content.tsx`         |
| 15:30-17:00 | 内容分类/标签系统 | `server/src/models/content.ts`                  |

---

## Day 20 (5/16) — 通知系统增强

| 时间        | 任务                     | 产出                                            |
| ----------- | ------------------------ | ----------------------------------------------- |
| 10:00-11:30 | 通知中心 (统一通知管理)  | `server/src/services/notifications.ts`          |
| 11:30-13:00 | 推送偏好设置             | `miniapp/src/pages/settings/notifications.tsx`  |
| 14:00-15:30 | 定时推送 (每日洞察/周报) | `server/src/services/scheduled-push.ts`         |
| 15:30-17:00 | 通知模板系统             | `server/src/services/notification-templates.ts` |

---

## Day 21 (5/17) — 最终集成测试

| 时间        | 任务                      | 产出                 |
| ----------- | ------------------------- | -------------------- |
| 10:00-12:00 | 端到端测试 (完整用户旅程) | `tests/e2e/`         |
| 14:00-16:00 | 压力测试 (并发用户)       | `tests/load/` + 报告 |
| 16:00-18:00 | Bug 修复 + 优化           | 代码提交             |

---

## Day 22 (5/18) — Phase 5 复盘

| 时间        | 任务             | 产出                               |
| ----------- | ---------------- | ---------------------------------- |
| 10:00-12:00 | Phase 5 复盘     | `docs/PHASE5-RETROSPECTIVE.md`     |
| 14:00-16:00 | Phase 6 上线计划 | `docs/PHASE6-LAUNCH-PLAN.md`       |
| 16:00-18:00 | 支付接入计划     | `docs/PAYMENT-INTEGRATION-PLAN.md` |
