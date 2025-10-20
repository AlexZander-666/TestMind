# TestMind v0.3.0 发布检查清单

**发布日期**: 2025-10-20  
**发布类型**: GitHub Release  
**发布负责人**: _____________

---

## 📋 发布前检查

### 版本统一
- [x] 所有 package.json 版本统一为 0.3.0
  - [x] packages/cli/package.json → 0.3.0
  - [x] packages/core/package.json → 0.3.0
  - [x] packages/shared/package.json → 0.3.0
  - [x] 根 package.json → 0.3.0
- [x] README.md 版本信息更新为 v0.3.0
- [x] DOCS.md 版本信息更新为 v0.3.0

### 文档整理
- [x] 开发文档归档到 `archive/v0.3.0-development/`
- [x] 快速开始文档整合（保留 `docs/QUICK_START_v0.3.0.md`）
- [x] DOCS.md 索引已更新，包含所有 v0.3.0 新文档
- [x] CHANGELOG.md v0.3.0 条目完整且准确
- [x] README 引用链接正确

### 代码质量
- [ ] 所有包编译成功: `pnpm build`
- [ ] 测试通过（或已知失败记录）: `pnpm test`
- [ ] TypeScript 类型检查通过: `pnpm typecheck`
- [ ] 代码格式检查通过: `pnpm format:check`

### 发布材料
- [x] `RELEASE_CHECKLIST_v0.3.0.md` 创建
- [x] `GITHUB_RELEASE_NOTES_v0.3.0.md` 创建
- [x] `scripts/release-v0.3.0.sh` 脚本创建
- [ ] 所有发布材料经过审核

---

## 🚀 发布步骤

### 1. 最终验证
```bash
# 清理并重新构建
pnpm clean
pnpm install
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm typecheck
```

**结果**: ✅ / ❌  
**备注**: _____________

### 2. Git 状态检查
```bash
# 确保所有更改已提交
git status

# 确保在主分支
git branch --show-current
```

**当前分支**: _____________  
**未提交更改**: ✅ 无 / ❌ 有（如有，请先提交）

### 3. 创建发布提交
```bash
# 提交发布准备更改
git add .
git commit -m "chore: prepare for v0.3.0 release

- Unified all package versions to 0.3.0
- Archived development documents to archive/v0.3.0-development/
- Updated documentation index and references
- Created release materials and checklist"

# 推送到远程
git push origin main
```

**提交 SHA**: _____________  
**推送状态**: ✅ / ❌

### 4. 创建 Git Tag
```bash
# 创建带注释的 tag
git tag -a v0.3.0 -m "Release v0.3.0

Major improvements:
- Unified version across all packages
- Enhanced observability with structured logging
- Multi-LLM support (OpenAI, Gemini, Anthropic, Ollama)
- Comprehensive Skills Framework documentation
- Production-ready infrastructure

See GITHUB_RELEASE_NOTES_v0.3.0.md for full details."

# 推送 tag
git push origin v0.3.0
```

**Tag 创建**: ✅ / ❌  
**Tag 推送**: ✅ / ❌

### 5. 创建 GitHub Release

1. 访问 GitHub Releases 页面:
   `https://github.com/[your-username]/testmind/releases/new`

2. 填写 Release 信息:
   - **Tag**: v0.3.0 (选择刚创建的 tag)
   - **Title**: `v0.3.0 - Foundation for v1.0`
   - **Description**: 复制 `GITHUB_RELEASE_NOTES_v0.3.0.md` 内容

3. 附件（可选）:
   - 无需手动上传，GitHub 自动生成源代码压缩包

4. 发布选项:
   - [ ] Set as a pre-release (如果是测试版)
   - [ ] Set as the latest release ✅
   - [ ] Create a discussion for this release （推荐）

5. 点击 **Publish release**

**Release URL**: _____________  
**发布状态**: ✅ / ❌

---

## 📢 发布后任务

### 通知与推广
- [ ] 在 GitHub Discussions 发布公告
- [ ] 更新 Twitter/社交媒体（如适用）
- [ ] 通知早期用户和贡献者
- [ ] 在相关社区分享（Reddit, Hacker News 等）

### 文档与归档
- [ ] 将 `V0.3.0_RELEASE_SUMMARY.md` 移至 `archive/v0.2.0-release/`
- [ ] 将 `RELEASE_CHECKLIST_v0.3.0.md` 移至 `archive/v0.2.0-release/`
- [ ] 更新项目 README 的 badge 链接（如需要）

### 下一步规划
- [ ] 创建 v0.5.0 里程碑
- [ ] 规划下一个开发周期任务
- [ ] 收集社区反馈

---

## ⚠️ 回滚计划

如果发布后发现严重问题：

```bash
# 1. 删除 GitHub Release
# 在 GitHub 网页界面操作

# 2. 删除 Git tag（本地和远程）
git tag -d v0.3.0
git push origin :refs/tags/v0.3.0

# 3. 修复问题后重新发布
# 重复上述发布步骤
```

---

## ✅ 发布完成确认

- [ ] GitHub Release 已发布且可访问
- [ ] Tag v0.3.0 已创建并推送
- [ ] 文档和代码版本一致
- [ ] 所有检查项已完成
- [ ] 发布后任务已规划

**发布完成时间**: _____________  
**最终确认人**: _____________

---

## 📝 备注

**发布中遇到的问题**:


**需要跟进的事项**:


**给下次发布的建议**:


---

**检查清单版本**: 1.0  
**创建日期**: 2025-10-20

