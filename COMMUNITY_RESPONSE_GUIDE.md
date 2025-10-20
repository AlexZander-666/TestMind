# 社区响应指南

**用途**: 快速、专业、友好地响应社区反馈

---

## 🎯 响应原则

1. **快速**: Critical 24h, High 48h, Normal 72h
2. **友好**: 感谢贡献，尊重反馈
3. **专业**: 提供clear的解决方案或计划
4. **透明**: 说明优先级和时间线

---

## 📋 响应模板

### 1. Critical Bug

```markdown
感谢报告此关键bug！🐛

**严重程度**: Critical  
**承诺**: 24小时内修复

**行动计划**:
1. [ ] 重现问题（2小时内）
2. [ ] 识别根因（6小时内）
3. [ ] 实施修复（12小时内）
4. [ ] 测试验证（4小时内）
5. [ ] 发布v0.4.X修复版本

我会在这个Issue中每4-6小时更新进展。

**临时解决方案**: [如果有]

谢谢您帮助改进TestMind！
```

### 2. High Priority Bug

```markdown
感谢报告！这是一个重要问题。

**优先级**: High  
**预计修复时间**: 48-72小时

**评估**:
- 影响范围：[具体说明]
- 根本原因：[初步分析]
- 修复复杂度：[评估]

**计划**:
将在v0.4.X或v0.5.0中修复，取决于复杂度。

**临时解决方案**: [如果有]

我会持续更新进展。感谢耐心！
```

### 3. Feature Request - High Value

```markdown
感谢这个很棒的建议！💡

这个功能确实能解决[具体问题]，与TestMind的核心价值对齐。

**评估**:
- **价值**: 高（解决[用户痛点]）
- **技术可行性**: [评估]
- **工作量**: [评估]
- **优先级**: 加入v0.5.0计划

**设计讨论**:
我们需要考虑：
1. [设计问题1]
2. [设计问题2]

欢迎在这个Issue中讨论设计方案！

**贡献机会**:
如果您愿意贡献，我可以提供：
- 技术指导
- Code review
- 测试支持

查看[CONTRIBUTING.md](../CONTRIBUTING.md)了解如何开始。
```

### 4. Feature Request - Low Priority

```markdown
感谢建议！

这是一个interesting的想法。不过基于当前路线图，可能不会在近期（v0.5.0-v0.6.0）优先实现。

**原因**: [说明why]

**替代方案**: [如果有]

**未来可能性**:
这个功能可能适合：
- [ ] 作为社区贡献的Skill
- [ ] v1.0+的扩展功能
- [ ] 第三方插件

如果有足够的社区需求（👍reactions或讨论），我们会重新评估优先级。

欢迎贡献！
```

### 5. Question / Help Wanted

```markdown
感谢提问！

[回答问题]

**相关资源**:
- 📚 文档：[链接]
- 💡 示例：[链接]
- 🔍 类似问题：[链接]

**如果这解决了您的问题**:
- 请考虑⭐ Star项目支持我们
- 欢迎分享使用体验
- 欢迎贡献文档改进

还有其他问题欢迎继续提问！😊
```

### 6. Spam / Invalid

```markdown
感谢关注TestMind。

这个Issue似乎不符合我们的Issue指南。如果您有具体的bug报告或功能建议，请：

1. 查看现有Issues避免重复
2. 使用Issue模板提供完整信息
3. 清楚描述问题或建议

如果有questions，请使用GitHub Discussions:
https://github.com/AlexZander-666/TestMind/discussions

谢谢理解！
```

---

## 🔍 识别Issue类型

### Critical Bug指标

- ❌ TestMind完全无法运行
- ❌ 数据丢失或损坏
- ❌ 安全漏洞
- ❌ 影响所有用户的regression

### High Priority Bug指标

- ⚠️ 核心功能失效（测试生成、自愈）
- ⚠️ 影响多数用户
- ⚠️ 无workaround
- ⚠️ 性能严重下降

### Medium Bug指标

- ⚠️ 边缘情况bug
- ⚠️ 有workaround
- ⚠️ 仅影响特定配置

### Low Bug指标

- 📝 文档错误
- 🎨 UI/UX小问题
- 💡 改进建议

---

## 📊 响应时间SLA

| 严重程度 | 首次响应 | 修复时间 |
|---------|---------|---------|
| Critical | 4小时内 | 24小时内 |
| High | 24小时内 | 72小时内 |
| Medium | 48小时内 | 1-2周 |
| Low | 72小时内 | 按优先级 |

---

## 💡 最佳实践

### Do's ✅

- ✅ 感谢每个贡献者
- ✅ 提供clear的行动计划
- ✅ 更新进展
- ✅ 关闭时总结解决方案
- ✅ 使用emoji增加友好度

### Don'ts ❌

- ❌ 忽视用户反馈
- ❌ 防御性回应
- ❌ 承诺无法兑现的时间
- ❌ 关闭Issue而不说明原因
- ❌ 使用专业术语不解释

---

## 📈 反馈追踪

### 创建反馈统计

**每周总结**:
```markdown
# Week X Community Feedback Summary

## New Issues: 12
- Critical: 1 (fixed)
- High: 3 (2 fixed, 1 in progress)
- Medium: 5 (prioritized)
- Low: 3 (backlog)

## New Feature Requests: 8
- Accepted: 3 (added to v0.5.0)
- Under discussion: 2
- Declined: 1 (out of scope)
- Pending evaluation: 2

## Community Engagement:
- GitHub Stars: +25 (total: 125)
- Discussions: 5 new threads
- Shannon PR feedback: Awaiting review

## Top Requests:
1. React Testing Library support (5 votes)
2. Python support (4 votes)
3. VS Code extension (3 votes)
```

---

**查看**: `.github/COMMUNITY_LAUNCH.md` 了解宣传材料

