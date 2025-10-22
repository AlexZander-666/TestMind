# TestMind v0.8.0 快速开始指南

**5 分钟上手新功能** 🚀

---

## 📋 前置要求

- Node.js 20+
- pnpm（推荐）或 npm
- OpenAI API Key（或兼容的 LLM API）

---

## 🚀 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/testmind.git
cd testmind

# 切换到 v0.8.0
git checkout v0.8.0

# 安装依赖
pnpm install

# 构建
pnpm build

# 配置 API Key
cp env.example .env
# 编辑 .env 文件，设置 OPENAI_API_KEY
```

---

## 🌟 新功能体验

### 1. Vue 组件测试生成（新）

TestMind v0.8.0 完整支持 Vue 2/3，包括 Composition API 和 Options API。

#### 示例：LoginForm 组件测试

```bash
# 生成 Vue 组件测试
cd testmind
pnpm exec tsx scripts/demo-vue-test.ts
```

**或者直接使用 CLI**:

```bash
testmind generate examples/vue-component-test/LoginForm.vue --framework vitest
```

**生成的测试将包含**:
- ✅ Props 验证测试
- ✅ Events 触发测试
- ✅ 用户交互测试（点击、输入）
- ✅ 表单验证测试
- ✅ 响应式状态测试
- ✅ Pinia/Vuex store mock

**示例输出**:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import LoginForm from './LoginForm.vue';

describe('LoginForm', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(LoginForm, {
      props: {
        title: 'Login'
      }
    });
  });

  it('should render correctly', () => {
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('h2').text()).toBe('Login');
  });

  it('should validate email format', async () => {
    const emailInput = wrapper.find('[data-testid="email-input"]');
    await emailInput.setValue('invalid-email');
    await emailInput.trigger('blur');
    
    expect(wrapper.find('.error').text()).toContain('Invalid email');
  });

  it('should emit submit event with credentials', async () => {
    await wrapper.find('[data-testid="email-input"]').setValue('test@example.com');
    await wrapper.find('[data-testid="password-input"]').setValue('password123');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')).toBeTruthy();
    expect(wrapper.emitted('submit')[0]).toEqual([
      'test@example.com',
      'password123'
    ]);
  });
});
```

---

### 2. Next.js API 测试生成（新）

支持 Next.js App Router 的 API Routes，包括 Server Components 和 Route Handlers。

#### 示例：用户管理 API 测试

```bash
# 生成 Next.js API 测试
testmind generate examples/nextjs-test/app/api/users/route.ts --framework vitest
```

**生成的测试将包含**:
- ✅ GET 请求测试（查询参数）
- ✅ POST 请求测试（创建资源）
- ✅ DELETE 请求测试（删除资源）
- ✅ 输入验证测试
- ✅ 错误处理测试
- ✅ 状态码验证

**示例输出**:

```typescript
import { describe, it, expect } from 'vitest';
import { GET, POST, DELETE } from './route';
import { NextRequest } from 'next/server';

describe('/api/users', () => {
  describe('GET', () => {
    it('should return all users', async () => {
      const request = new NextRequest('http://localhost:3000/api/users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toBeInstanceOf(Array);
    });

    it('should filter users by query', async () => {
      const request = new NextRequest('http://localhost:3000/api/users?q=alice');
      const response = await GET(request);
      const data = await response.json();

      expect(data.users).toHaveLength(1);
      expect(data.users[0].name).toBe('Alice');
    });
  });

  describe('POST', () => {
    it('should create new user', async () => {
      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Charlie',
          email: 'charlie@example.com'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'Invalid' })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
```

---

### 3. 智能边界条件检测（新）

自动识别 15+ 边界条件类型，生成全面的边界测试。

```bash
# 分析函数并检测边界条件
testmind analyze --detect-boundaries src/utils/validation.ts
```

**检测到的边界条件示例**:

```typescript
// 函数：validateAge(age: number)

// 自动生成的边界测试：
describe('validateAge - Boundary Conditions', () => {
  it('should handle zero', () => {
    expect(validateAge(0)).toBe(false);
  });

  it('should handle negative numbers', () => {
    expect(validateAge(-1)).toBe(false);
  });

  it('should handle positive numbers', () => {
    expect(validateAge(25)).toBe(true);
  });

  it('should handle MAX_SAFE_INTEGER', () => {
    expect(validateAge(Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it('should handle Infinity', () => {
    expect(validateAge(Infinity)).toBe(false);
  });

  it('should handle NaN', () => {
    expect(validateAge(NaN)).toBe(false);
  });
});
```

---

### 4. Flaky Test 预防（新）

自动检测并修复 6 种常见的 Flaky Test 模式。

```bash
# 检测 Flaky 模式
testmind analyze --detect-flaky tests/

# 自动修复
testmind fix --flaky tests/
```

**检测示例**:

```typescript
// ❌ 检测到：时间依赖
const now = new Date(); // Flaky: 每次运行结果不同

// ✅ 自动修复建议
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2021-01-01'));
});

// ❌ 检测到：随机数依赖
const id = Math.random(); // Flaky: 不可预测

// ✅ 自动修复
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});

// ❌ 检测到：未 mock 的网络调用
await fetch('https://api.example.com'); // Flaky: 依赖外部服务

// ✅ 自动修复建议
vi.mock('global.fetch', () => 
  vi.fn(() => Promise.resolve({ json: () => ({}) }))
);
```

---

### 5. 测试可读性优化（新）

自动优化测试代码，强制 AAA 模式，改进命名。

```bash
# 优化测试可读性
testmind optimize tests/my-test.spec.ts
```

**优化示例**:

```typescript
// ❌ 优化前：无结构，命名不清晰
it('test 1', () => {
  const user = { name: 'Alice' };
  const result = processUser(user);
  expect(result.name).toBe('ALICE');
});

// ✅ 优化后：AAA 模式，描述性命名
it('should convert user name to uppercase', () => {
  // Arrange
  const user = { name: 'Alice' };
  
  // Act
  const result = processUser(user);
  
  // Assert
  expect(result.name).toBe('ALICE');
});
```

---

### 6. 跨框架测试迁移（新）

一键迁移测试框架，自动转换 API 调用。

```bash
# Jest → Vitest 迁移
testmind migrate --from jest --to vitest tests/

# Cypress → Playwright 迁移
testmind migrate --from cypress --to playwright e2e/
```

**迁移示例**:

```typescript
// ❌ Jest
import { jest } from '@jest/globals';
const mockFn = jest.fn();
jest.spyOn(Date, 'now');

// ✅ 自动转换为 Vitest
import { vi } from 'vitest';
const mockFn = vi.fn();
vi.spyOn(Date, 'now');
```

---

### 7. 批量测试生成（新）

智能分组，5-10x 加速大规模测试生成。

```bash
# 批量生成整个目录的测试
testmind generate-batch src/services/ --concurrency 5
```

**性能提升**:
- 100 个函数：从 10 分钟 → **2 分钟**
- 1000 个函数：从 1.5 小时 → **15 分钟**
- Token 节省：**30-50%**（通过共享上下文）

---

## 🎯 常见场景

### 场景 1：为 Vue 3 项目生成测试

```bash
# 1. 分析项目
testmind init --framework vitest

# 2. 生成所有组件测试
testmind generate-batch src/components/ --framework vitest

# 3. 质量检查
testmind analyze --detect-flaky tests/
testmind optimize tests/
```

### 场景 2：Next.js 全栈项目测试

```bash
# 1. 生成 Server Components 测试
testmind generate app/components/

# 2. 生成 API Routes 测试
testmind generate app/api/

# 3. 配置 GitHub Actions
testmind ci-cd generate --preset full
```

### 场景 3：迁移现有测试

```bash
# 1. 从 Jest 迁移到 Vitest
testmind migrate --from jest --to vitest tests/

# 2. 检查最佳实践
testmind analyze --best-practices tests/

# 3. 自动修复违规
testmind fix --best-practices tests/
```

---

## 📚 下一步

- 📖 阅读[完整 CHANGELOG](CHANGELOG_v0.8.0.md)
- 🔄 查看[迁移指南](MIGRATION_GUIDE_v0.7_to_v0.8.md)
- 💡 查看[示例代码](../../examples/)
- 🤝 加入[社区讨论](https://github.com/yourusername/testmind/discussions)

---

## ❓ 常见问题

### Q: v0.8.0 是否向后兼容？
A: 是的，100% 向后兼容 v0.7.0，无需修改任何代码。

### Q: 如何启用 Vue 支持？
A: 自动检测。如果项目使用 Vue，TestMind 会自动使用 VueTestSkill。

### Q: 性能优化需要额外配置吗？
A: 不需要。Prompt 压缩、批量生成、三层缓存都是自动启用的。

### Q: 支持哪些 Monorepo 工具？
A: 支持 pnpm workspaces, Yarn workspaces, npm workspaces, Nx, Turborepo。

---

**🎉 开始使用 TestMind v0.8.0 吧！**

有问题？[提交 Issue](https://github.com/yourusername/testmind/issues) 或加入 [Discord](https://discord.gg/testmind)

