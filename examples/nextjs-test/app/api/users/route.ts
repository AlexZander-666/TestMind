/**
 * Next.js App Router API Route Example
 * 示例：用户管理 API
 */

import { NextRequest, NextResponse } from 'next/server';

// 模拟数据库
const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

/**
 * GET /api/users
 * 获取所有用户
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    let filteredUsers = users;
    
    if (query) {
      filteredUsers = users.filter(user => 
        user.name.toLowerCase().includes(query.toLowerCase()) ||
        user.email.toLowerCase().includes(query.toLowerCase())
      );
    }

    return NextResponse.json({
      users: filteredUsers,
      total: filteredUsers.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * 创建新用户
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // 验证
    if (!body.name || !body.email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // 检查邮箱是否已存在
    const existingUser = users.find(u => u.email === body.email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    const newUser = {
      id: String(users.length + 1),
      name: body.name,
      email: body.email,
    };

    users.push(newUser);

    return NextResponse.json(
      { user: newUser },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users
 * 删除用户（通过 query 参数）
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    users.splice(index, 1);

    return NextResponse.json(
      { message: 'User deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

