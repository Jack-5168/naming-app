# Persona-Lab SPEC

_Design Doc - 2026-05-25 v2_

## 产品

- 人格探索局 - AI心理测评
- 定位: 18-35岁年青人

## 技术栈

- 后端: Node.js + Express + PostgreSQL
- 前端: H5 (miniapp-h5/)
- 测试: NEO-FFI 25题

## 核心文件

- /server - 原后端(legacy)
- /miniapp-h5 - 新H5服务端(v2.5)
- /docs - 文档

## API

- POST /sessions - 创建
- GET /sessions/:id/next - 下一题
- POST /sessions/:id/answer - 回答

# 25题目 -5维度(O,C,E,A,N)

# 结果:M BT I风栛+百分为

## 下步

1. UX优化
2. 用户系系统
3. Vercel部署
