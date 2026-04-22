#!/bin/bash
set -e

echo "🚀 Persona Lab Vercel 部署脚本"
echo "=============================="

cd /home/admin/.openclaw/workspace/persona-lab

# 检查 Vercel CLI
if ! command -v npx &> /dev/null; then
    echo "❌ 错误：需要安装 Node.js 和 npm"
    exit 1
fi

# 检查是否已登录 Vercel
echo "📝 检查 Vercel 登录状态..."
if ! npx vercel whoami &> /dev/null; then
    echo "⚠️  未登录 Vercel，请先运行：npx vercel login"
    echo "   或者访问 https://vercel.com/login 进行登录"
    exit 1
fi

echo "✅ Vercel 登录成功"

# 链接项目
echo "🔗 链接 Vercel 项目..."
if [ ! -f ".vercel/project.json" ]; then
    echo "首次部署，需要创建新项目"
    npx vercel link --create persona-lab
fi

# 部署到生产环境
echo "🚀 开始部署到生产环境..."
npx vercel --prod

echo ""
echo "✅ 部署完成！"
echo "📋 请查看上方输出中的 Production URL"
