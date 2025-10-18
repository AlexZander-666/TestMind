/**
 * Sample TypeScript file for testing StaticAnalyzer
 */

import { readFile } from 'fs/promises';
import axios from 'axios';

// Simple function with parameters
export function add(a: number, b: number): number {
  return a + b;
}

// Async function with side effects
export async function fetchUserData(userId: string): Promise<User> {
  const response = await axios.get(`/api/users/${userId}`);
  return response.data;
}

// Function with optional parameters and default values
export function greet(name: string, greeting: string = 'Hello', excited?: boolean): string {
  const message = `${greeting}, ${name}`;
  return excited ? message + '!' : message;
}

// Complex function with multiple branches
export function calculateDiscount(price: number, customerType: 'new' | 'regular' | 'vip'): number {
  if (price < 0) {
    throw new Error('Invalid price');
  }

  let discount = 0;
  
  if (customerType === 'new') {
    discount = price * 0.1;
  } else if (customerType === 'regular') {
    discount = price * 0.05;
  } else if (customerType === 'vip') {
    discount = price * 0.2;
  }

  return price - discount;
}

// Class with methods and properties
export class UserService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async getUser(id: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/users/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    return response.json();
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const response = await fetch(`${this.baseUrl}/users/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  static createInstance(config: Config): UserService {
    return new UserService(config.baseUrl, config.apiKey);
  }
}

// Type definitions
export interface User {
  id: string;
  name: string;
  email: string;
}

interface Config {
  baseUrl: string;
  apiKey: string;
}

// Arrow function
export const multiply = (x: number, y: number): number => x * y;

// Function with file system operations
async function loadConfig(filePath: string): Promise<Config> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}



























