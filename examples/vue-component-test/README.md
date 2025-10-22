# Vue Component Testing Example

这个示例展示了如何使用 TestMind 为 Vue 3 组件生成测试。

## 组件：LoginForm.vue

一个完整的登录表单组件，使用 Composition API 编写。

### 特性

- ✅ Props with defaults
- ✅ Custom events (submit, success, error)
- ✅ Reactive state (email, password, loading)
- ✅ Computed properties (isFormValid)
- ✅ Form validation
- ✅ User interactions
- ✅ Async operations

### 生成测试

使用 TestMind 自动生成测试：

```bash
# 使用 AI 生成（推荐）
testmind generate examples/vue-component-test/LoginForm.vue --framework vitest

# 使用模板生成（快速）
testmind generate examples/vue-component-test/LoginForm.vue --framework vitest --template
```

### 预期测试内容

生成的测试应该覆盖：

1. **组件渲染**
   - 正确渲染标题
   - 显示表单元素
   - 初始状态正确

2. **Props 测试**
   - 默认 title 为 "Login"
   - 自定义 title 正确显示
   - onSuccess 回调被调用

3. **事件测试**
   - 提交表单触发 submit 事件
   - 成功登录触发 success 事件
   - 失败触发 error 事件

4. **表单验证**
   - Email 格式验证
   - 密码长度验证
   - 空值验证

5. **用户交互**
   - 输入邮箱和密码
   - 点击提交按钮
   - Loading 状态禁用表单

6. **计算属性**
   - isFormValid 根据输入正确计算

7. **异步操作**
   - Loading 状态管理
   - API 调用模拟

### 预期测试代码示例

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import LoginForm from './LoginForm.vue';

describe('LoginForm', () => {
  let wrapper: any;

  beforeEach(() => {
    wrapper = mount(LoginForm);
  });

  describe('Rendering', () => {
    it('should render with default title', () => {
      expect(wrapper.find('h2').text()).toBe('Login');
    });

    it('should render with custom title', async () => {
      await wrapper.setProps({ title: 'Sign In' });
      expect(wrapper.find('h2').text()).toBe('Sign In');
    });

    it('should render email and password inputs', () => {
      expect(wrapper.find('[data-testid="email-input"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="password-input"]').exists()).toBe(true);
    });

    it('should render submit button', () => {
      expect(wrapper.find('[data-testid="submit-button"]').exists()).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should show error for invalid email', async () => {
      const emailInput = wrapper.find('[data-testid="email-input"]');
      await emailInput.setValue('invalid-email');
      await emailInput.trigger('blur');
      await nextTick();

      expect(wrapper.find('.error').text()).toContain('Invalid email format');
    });

    it('should show error for empty email', async () => {
      const emailInput = wrapper.find('[data-testid="email-input"]');
      await emailInput.setValue('');
      await emailInput.trigger('blur');
      await nextTick();

      expect(wrapper.find('.error').text()).toContain('Email is required');
    });

    it('should disable submit button when form is invalid', () => {
      const submitButton = wrapper.find('[data-testid="submit-button"]');
      expect(submitButton.attributes('disabled')).toBeDefined();
    });

    it('should enable submit button when form is valid', async () => {
      await wrapper.find('[data-testid="email-input"]').setValue('test@example.com');
      await wrapper.find('[data-testid="password-input"]').setValue('password123');
      await nextTick();

      const submitButton = wrapper.find('[data-testid="submit-button"]');
      expect(submitButton.attributes('disabled')).toBeUndefined();
    });
  });

  describe('Events', () => {
    it('should emit submit event when form is submitted', async () => {
      await wrapper.find('[data-testid="email-input"]').setValue('test@example.com');
      await wrapper.find('[data-testid="password-input"]').setValue('password123');
      await wrapper.find('form').trigger('submit');

      expect(wrapper.emitted('submit')).toBeTruthy();
      expect(wrapper.emitted('submit')[0]).toEqual(['test@example.com', 'password123']);
    });

    it('should emit success event on successful login', async () => {
      await wrapper.find('[data-testid="email-input"]').setValue('test@example.com');
      await wrapper.find('[data-testid="password-input"]').setValue('password123');
      await wrapper.find('form').trigger('submit');
      
      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 1100));
      await nextTick();

      expect(wrapper.emitted('success')).toBeTruthy();
      expect(wrapper.emitted('success')[0][0]).toEqual({
        email: 'test@example.com',
        id: '123'
      });
    });

    it('should call onSuccess callback prop', async () => {
      const onSuccess = vi.fn();
      wrapper = mount(LoginForm, {
        props: { onSuccess }
      });

      await wrapper.find('[data-testid="email-input"]').setValue('test@example.com');
      await wrapper.find('[data-testid="password-input"]').setValue('password123');
      await wrapper.find('form').trigger('submit');
      
      await new Promise(resolve => setTimeout(resolve, 1100));
      await nextTick();

      expect(onSuccess).toHaveBeenCalledWith({
        email: 'test@example.com',
        id: '123'
      });
    });
  });

  describe('Loading State', () => {
    it('should disable inputs when loading', async () => {
      await wrapper.find('[data-testid="email-input"]').setValue('test@example.com');
      await wrapper.find('[data-testid="password-input"]').setValue('password123');
      await wrapper.find('form').trigger('submit');

      // Should be loading immediately
      expect(wrapper.find('[data-testid="email-input"]').attributes('disabled')).toBeDefined();
      expect(wrapper.find('[data-testid="password-input"]').attributes('disabled')).toBeDefined();
      expect(wrapper.find('[data-testid="submit-button"]').text()).toBe('Logging in...');
    });
  });

  describe('Computed Properties', () => {
    it('should compute isFormValid correctly', async () => {
      // Invalid: empty fields
      await nextTick();
      expect(wrapper.vm.isFormValid).toBe(false);

      // Invalid: short password
      await wrapper.find('[data-testid="email-input"]').setValue('test@example.com');
      await wrapper.find('[data-testid="password-input"]').setValue('12345');
      await nextTick();
      expect(wrapper.vm.isFormValid).toBe(false);

      // Valid
      await wrapper.find('[data-testid="password-input"]').setValue('123456');
      await nextTick();
      expect(wrapper.vm.isFormValid).toBe(true);
    });
  });
});
```

## 运行测试

```bash
# 运行生成的测试
npm test examples/vue-component-test/LoginForm.test.ts

# 或使用 Vitest
vitest examples/vue-component-test/LoginForm.test.ts
```

## 学习要点

1. **组件分析**：TestMind 自动分析 props、emits、computed 等
2. **智能生成**：理解业务逻辑，生成有意义的测试用例
3. **最佳实践**：使用 data-testid、await nextTick()、合理的断言
4. **完整覆盖**：渲染、交互、验证、事件、异步操作全覆盖

