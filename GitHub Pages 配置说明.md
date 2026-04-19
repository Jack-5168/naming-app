# GitHub Pages 配置说明

## 📋 配置步骤

### 方案 A：使用 GitHub UI（推荐）

1. **打开 GitHub 仓库**
   - 访问：https://github.com/Jack-5168/naming-app

2. **进入 Settings**
   - 点击顶部的 "Settings" 标签

3. **配置 Pages**
   - 左侧菜单找到 "Pages"
   - 在 "Build and deployment" 部分：
     - **Source**: 选择 "Deploy from a branch"
     - **Branch**: 选择 "master"
     - **Folder**: 选择 "/web-v2"
   - 点击 "Save" 保存

4. **等待部署**
   - GitHub 会自动构建和部署
   - 约 1-2 分钟后完成

5. **访问网站**
   - URL: https://jack-5168.github.io/naming-app/web-v2/

---

### 方案 B：使用 GitHub CLI（如果已安装）

```bash
# 启用 GitHub Pages
gh api repos/Jack-5168/naming-app/pages \
  --method POST \
  -f source='{"branch":"master","path":"/web-v2"}'
```

---

## ✅ 当前状态

- **当前分支**: master ✅
- **最新提交**: f7a76b11
- **推送状态**: 已推送到 origin/master ✅
- **web-v2 目录**: 已包含所有 26 个文件 ✅

---

## 🔍 验证配置

配置完成后，访问以下地址验证：

1. **主页**: https://jack-5168.github.io/naming-app/web-v2/
2. **关于页**: https://jack-5168.github.io/naming-app/web-v2/about.html
3. **服务页**: https://jack-5168.github.io/naming-app/web-v2/services.html
4. **典籍页**: https://jack-5168.github.io/naming-app/web-v2/classics.html
5. **案例页**: https://jack-5168.github.io/naming-app/web-v2/cases.html
6. **博客页**: https://jack-5168.github.io/naming-app/web-v2/blog.html
7. **联系页**: https://jack-5168.github.io/naming-app/web-v2/contact.html
8. **起名页**: https://jack-5168.github.io/naming-app/web-v2/naming.html

---

## ⚠️ 注意事项

1. **分支名称**: 必须使用 master（不是 main）
2. **文件夹路径**: 必须是 /web-v2（不是根目录）
3. **部署时间**: 首次部署约需 1-2 分钟
4. **缓存刷新**: 更新后可能需要强制刷新（Ctrl+Shift+R）

---

## 🐛 故障排查

### 如果页面显示 404

1. 确认 Branch 选择的是 master
2. 确认 Folder 选择的是 /web-v2
3. 等待 2-3 分钟让 GitHub 完成构建
4. 检查 Actions 标签页是否有构建错误

### 如果显示旧版本

1. 强制刷新浏览器（Ctrl+Shift+R）
2. 清除浏览器缓存
3. 检查是否有多个 Pages 配置

---

**配置完成后，新 Web 站就正式上线了！** 🎉
