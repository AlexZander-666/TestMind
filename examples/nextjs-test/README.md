# Next.js API Route Testing Example

这个示例展示了如何使用 TestMind 为 Next.js App Router 的 API Route 生成测试。

## API Route: `/api/users/route.ts`

一个完整的 RESTful API endpoint，支持用户的增删查改操作。

### 特性

- ✅ GET - 获取用户列表（支持搜索）
- ✅ POST - 创建新用户
- ✅ DELETE - 删除用户
- ✅ 输入验证
- ✅ 错误处理
- ✅ 状态码管理

### 生成测试

使用 TestMind 自动生成测试：

```bash
testmind generate examples/nextjs-test/app/api/users/route.ts --framework vitest
```

### 预期测试内容

生成的测试应该覆盖：

1. **GET /api/users**
   - 返回所有用户
   - 支持查询参数搜索
   - 返回正确的数据格式

2. **POST /api/users**
   - 成功创建用户
   - 验证必填字段
   - 检测重复邮箱
   - 返回正确的状态码（201, 400, 409）

3. **DELETE /api/users**
   - 成功删除用户
   - 处理不存在的用户
   - 验证 ID 参数

4. **错误处理**
   - 捕获异常
   - 返回友好的错误消息
   - 返回正确的错误状态码

### 预期测试代码示例

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
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
      expect(data.total).toBeGreaterThan(0);
    });

    it('should filter users by query', async () => {
      const request = new NextRequest('http://localhost:3000/api/users?q=alice');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users.length).toBe(1);
      expect(data.users[0].name).toBe('Alice');
    });

    it('should return empty array when no users match', async () => {
      const request = new NextRequest('http://localhost:3000/api/users?q=nonexistent');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(0);
    });
  });

  describe('POST', () => {
    it('should create a new user', async () => {
      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Charlie',
          email: 'charlie@example.com'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user).toMatchObject({
        name: 'Charlie',
        email: 'charlie@example.com'
      });
      expect(data.user.id).toBeDefined();
    });

    it('should return 400 when name is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Name and email are required');
    });

    it('should return 409 when email already exists', async () => {
      const request = new NextRequest('http://localhost:3000/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Duplicate',
          email: 'alice@example.com' // 已存在
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Email already exists');
    });
  });

  describe('DELETE', () => {
    it('should delete a user', async () => {
      const request = new NextRequest('http://localhost:3000/api/users?id=1');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('User deleted successfully');
    });

    it('should return 404 when user not found', async () => {
      const request = new NextRequest('http://localhost:3000/api/users?id=999');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('User not found');
    });

    it('should return 400 when ID is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/users');
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('User ID is required');
    });
  });
});
```

## 运行测试

```bash
npm test examples/nextjs-test/app/api/users/__tests__/route.test.ts
```

## 学习要点

1. **NextRequest/NextResponse**：正确 mock Next.js 的 Request/Response 对象
2. **HTTP 方法测试**：分别测试 GET、POST、DELETE 等方法
3. **查询参数**：测试 searchParams 的使用
4. **请求体解析**：测试 request.json() 的数据
5. **状态码验证**：确保返回正确的 HTTP 状态码
6. **错误场景**：全面测试各种错误情况

