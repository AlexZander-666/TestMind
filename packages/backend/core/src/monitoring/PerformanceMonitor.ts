/**
 * PerformanceMonitor - 企业级性能监控系统
 * 
 * 功能特性：
 * 1. 实时性能指标采集
 * 2. 资源使用监控
 * 3. API响应时间追踪
 * 4. 错误率统计
 * 5. 自定义指标
 * 6. 告警系统
 * 7. 性能报告生成
 */

import { EventEmitter } from 'events';
import * as os from 'os';

import { generateUUID } from '@testmind/shared';

import { DatabaseService } from '../db/Database';
import { createComponentLogger } from '../utils/logger';

const logger = createComponentLogger('PerformanceMonitor');

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
  };
}

export interface ApplicationMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  tests: {
    executed: number;
    passed: number;
    failed: number;
    skipped: number;
    averageDuration: number;
    coveragePercentage: number;
  };
  database: {
    queries: number;
    averageQueryTime: number;
    connections: number;
    errors: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'above' | 'below' | 'equals';
  threshold: number;
  duration: number; // seconds
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  actions: AlertAction[];
}

export interface AlertAction {
  type: 'email' | 'webhook' | 'log' | 'function';
  config: Record<string, any>;
}

export interface PerformanceReport {
  id: string;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    uptime: number;
    availability: number;
    averageResponseTime: number;
    errorRate: number;
    testExecutions: number;
    testSuccessRate: number;
  };
  systemMetrics: SystemMetrics[];
  applicationMetrics: ApplicationMetrics[];
  alerts: Alert[];
  recommendations: string[];
}

export class PerformanceMonitor extends EventEmitter {
  private readonly db: DatabaseService;
  private readonly metrics: Map<string, PerformanceMetric[]> = new Map();
  private readonly alertRules: Map<string, AlertRule> = new Map();
  private readonly activeAlerts: Map<string, Alert> = new Map();
  private readonly collectors: Map<string, NodeJS.Timeout> = new Map();
  private readonly startTime: Date;
  private requestMetrics: number[] = [];
  private testMetrics: any[] = [];

  constructor(db: DatabaseService) {
    super();
    this.db = db;
    this.startTime = new Date();
    this.initializeCollectors();
    this.setupDefaultAlertRules();
    logger.info('PerformanceMonitor initialized');
  }

  /**
   * 初始化数据收集器
   */
  private initializeCollectors(): void {
    // System metrics collector (every 10 seconds)
    const systemCollector = setInterval(() => {
      this.collectSystemMetrics();
    }, 10000);
    this.collectors.set('system', systemCollector);

    // Application metrics collector (every 30 seconds)
    const appCollector = setInterval(() => {
      this.collectApplicationMetrics();
    }, 30000);
    this.collectors.set('application', appCollector);

    // Cleanup old metrics (every hour)
    const cleanupCollector = setInterval(() => {
      this.cleanupOldMetrics();
    }, 3600000);
    this.collectors.set('cleanup', cleanupCollector);
  }

  /**
   * 设置默认告警规则
   */
  private setupDefaultAlertRules(): void {
    // CPU usage alert
    this.addAlertRule({
      id: 'cpu-high',
      name: 'High CPU Usage',
      metric: 'system.cpu.usage',
      condition: 'above',
      threshold: 80,
      duration: 300, // 5 minutes
      severity: 'warning',
      enabled: true,
      actions: [
        { type: 'log', config: {} },
        { type: 'email', config: { to: 'admin@testmind.com' } },
      ],
    });

    // Memory usage alert
    this.addAlertRule({
      id: 'memory-high',
      name: 'High Memory Usage',
      metric: 'system.memory.percentage',
      condition: 'above',
      threshold: 90,
      duration: 300,
      severity: 'critical',
      enabled: true,
      actions: [
        { type: 'log', config: {} },
        { type: 'webhook', config: { url: 'https://alerts.testmind.com/webhook' } },
      ],
    });

    // Error rate alert
    this.addAlertRule({
      id: 'error-rate-high',
      name: 'High Error Rate',
      metric: 'app.requests.errorRate',
      condition: 'above',
      threshold: 5, // 5%
      duration: 60,
      severity: 'critical',
      enabled: true,
      actions: [
        { type: 'log', config: {} },
        { type: 'function', config: { handler: 'notifyOncall' } },
      ],
    });

    // Response time alert
    this.addAlertRule({
      id: 'response-time-slow',
      name: 'Slow Response Time',
      metric: 'app.requests.p95',
      condition: 'above',
      threshold: 1000, // 1 second
      duration: 180,
      severity: 'warning',
      enabled: true,
      actions: [
        { type: 'log', config: {} },
      ],
    });
  }

  /**
   * 收集系统指标
   */
  private collectSystemMetrics(): void {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const systemMetrics: SystemMetrics = {
      cpu: {
        usage: this.calculateCPUUsage(),
        cores: cpus.length,
        loadAverage: os.loadavg(),
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentage: (usedMem / totalMem) * 100,
      },
      disk: {
        total: 0, // Would need fs stats
        used: 0,
        free: 0,
        percentage: 0,
      },
      network: {
        bytesReceived: 0, // Would need network stats
        bytesSent: 0,
        packetsReceived: 0,
        packetsSent: 0,
      },
    };

    // Record metrics
    this.recordMetric('system.cpu.usage', systemMetrics.cpu.usage, '%');
    this.recordMetric('system.memory.percentage', systemMetrics.memory.percentage, '%');
    this.recordMetric('system.memory.used', systemMetrics.memory.used, 'bytes');

    // Check alerts
    this.checkAlerts();
  }

  /**
   * 收集应用程序指标
   */
  private collectApplicationMetrics(): void {
    const appMetrics: ApplicationMetrics = {
      requests: {
        total: this.requestMetrics.length,
        successful: this.requestMetrics.filter(t => t < 500).length,
        failed: this.requestMetrics.filter(t => t >= 500).length,
        averageResponseTime: this.calculateAverage(this.requestMetrics),
        p95ResponseTime: this.calculatePercentile(this.requestMetrics, 95),
        p99ResponseTime: this.calculatePercentile(this.requestMetrics, 99),
      },
      tests: {
        executed: this.testMetrics.length,
        passed: this.testMetrics.filter(t => t.status === 'passed').length,
        failed: this.testMetrics.filter(t => t.status === 'failed').length,
        skipped: this.testMetrics.filter(t => t.status === 'skipped').length,
        averageDuration: this.calculateAverage(this.testMetrics.map(t => t.duration)),
        coveragePercentage: this.calculateAverage(this.testMetrics.map(t => t.coverage || 0)),
      },
      database: {
        queries: 0, // Would be tracked by DB service
        averageQueryTime: 0,
        connections: 0,
        errors: 0,
      },
      cache: {
        hits: 0, // Would be tracked by cache service
        misses: 0,
        hitRate: 0,
        size: 0,
      },
    };

    // Record metrics
    this.recordMetric('app.requests.total', appMetrics.requests.total, 'count');
    this.recordMetric('app.requests.errorRate', 
      appMetrics.requests.total > 0 
        ? (appMetrics.requests.failed / appMetrics.requests.total) * 100 
        : 0, 
      '%',
    );
    this.recordMetric('app.requests.p95', appMetrics.requests.p95ResponseTime, 'ms');
    this.recordMetric('app.tests.successRate',
      appMetrics.tests.executed > 0
        ? (appMetrics.tests.passed / appMetrics.tests.executed) * 100
        : 100,
      '%',
    );

    // Clear old request metrics (keep last 5 minutes)
    this.requestMetrics = this.requestMetrics.slice(-300);
    this.testMetrics = this.testMetrics.slice(-100);
  }

  /**
   * 记录指标
   */
  recordMetric(name: string, value: number, unit: string, tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      id: generateUUID(),
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricList = this.metrics.get(name)!;
    metricList.push(metric);

    // Keep only last 1000 metrics per name
    if (metricList.length > 1000) {
      metricList.shift();
    }

    // Emit metric event
    this.emit('metric', metric);
  }

  /**
   * 记录API请求
   */
  recordRequest(duration: number, status: number, endpoint: string): void {
    this.requestMetrics.push(duration);
    
    this.recordMetric('app.request.duration', duration, 'ms', {
      endpoint,
      status: status.toString(),
    });

    if (status >= 500) {
      this.recordMetric('app.request.error', 1, 'count', { endpoint });
    }
  }

  /**
   * 记录测试执行
   */
  recordTestExecution(test: {
    name: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    coverage?: number;
  }): void {
    this.testMetrics.push(test);
    
    this.recordMetric('app.test.execution', 1, 'count', {
      status: test.status,
    });
    
    this.recordMetric('app.test.duration', test.duration, 'ms', {
      name: test.name,
      status: test.status,
    });

    if (test.coverage !== undefined) {
      this.recordMetric('app.test.coverage', test.coverage, '%', {
        name: test.name,
      });
    }
  }

  /**
   * 添加告警规则
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info('Alert rule added', { ruleId: rule.id, name: rule.name });
  }

  /**
   * 检查告警
   */
  private checkAlerts(): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      const metrics = this.metrics.get(rule.metric);
      if (!metrics || metrics.length === 0) continue;

      // Get recent metrics within duration window
      const now = Date.now();
      const windowStart = now - (rule.duration * 1000);
      const recentMetrics = metrics.filter(m => 
        m.timestamp.getTime() >= windowStart,
      );

      if (recentMetrics.length === 0) continue;

      // Check if condition is met
      const avgValue = this.calculateAverage(recentMetrics.map(m => m.value));
      let conditionMet = false;

      switch (rule.condition) {
        case 'above':
          conditionMet = avgValue > rule.threshold;
          break;
        case 'below':
          conditionMet = avgValue < rule.threshold;
          break;
        case 'equals':
          conditionMet = Math.abs(avgValue - rule.threshold) < 0.01;
          break;
      }

      if (conditionMet) {
        this.triggerAlert(rule, avgValue);
      } else {
        // Clear alert if condition is no longer met
        this.clearAlert(rule.id);
      }
    }
  }

  /**
   * 触发告警
   */
  private triggerAlert(rule: AlertRule, currentValue: number): void {
    const alertKey = `alert-${rule.id}`;
    
    // Check if alert already exists
    if (this.activeAlerts.has(alertKey)) {
      return; // Alert already active
    }

    const alert: Alert = {
      id: generateUUID(),
      type: rule.severity,
      metric: rule.metric,
      threshold: rule.threshold,
      currentValue,
      message: `${rule.name}: ${rule.metric} is ${rule.condition} ${rule.threshold} (current: ${currentValue.toFixed(2)})`,
      timestamp: new Date(),
      acknowledged: false,
    };

    this.activeAlerts.set(alertKey, alert);

    // Execute alert actions
    for (const action of rule.actions) {
      this.executeAlertAction(action, alert);
    }

    // Emit alert event
    this.emit('alert', alert);
    
    logger.warn('Alert triggered', {
      rule: rule.name,
      metric: rule.metric,
      value: currentValue,
      threshold: rule.threshold,
    });
  }

  /**
   * 执行告警动作
   */
  private executeAlertAction(action: AlertAction, alert: Alert): void {
    const config = action.config ?? {};
    switch (action.type) {
      case 'log':
        logger.error('Alert triggered', { alert });
        break;
        
      case 'email':
        // In production, send actual email
        logger.info('Email alert sent', { to: config.to ?? 'unknown' });
        break;
        
      case 'webhook':
        // In production, make HTTP request
        logger.info('Webhook alert sent', { url: config.url ?? 'unknown' });
        break;
        
      case 'function':
        // In production, execute custom function
        logger.info('Custom alert handler executed', { handler: config.handler ?? 'inline' });
        break;
    }
  }

  /**
   * 清除告警
   */
  private clearAlert(ruleId: string): void {
    const alertKey = `alert-${ruleId}`;
    if (this.activeAlerts.has(alertKey)) {
      this.activeAlerts.delete(alertKey);
      logger.info('Alert cleared', { ruleId });
      this.emit('alert-cleared', ruleId);
    }
  }

  /**
   * 生成性能报告
   */
  async generateReport(period: { start: Date; end: Date }): Promise<PerformanceReport> {
    const uptime = Date.now() - this.startTime.getTime();
    const availability = this.calculateAvailability();
    
    // Collect metrics for period
    const systemMetrics: SystemMetrics[] = [];
    const applicationMetrics: ApplicationMetrics[] = [];
    const alerts: Alert[] = Array.from(this.activeAlerts.values())
      .filter(a => a.timestamp >= period.start && a.timestamp <= period.end);

    // Generate recommendations
    const recommendations = this.generateRecommendations(systemMetrics, applicationMetrics, alerts);

    const report: PerformanceReport = {
      id: generateUUID(),
      period,
      summary: {
        uptime,
        availability,
        averageResponseTime: this.calculateAverage(this.requestMetrics),
        errorRate: this.calculateErrorRate(),
        testExecutions: this.testMetrics.length,
        testSuccessRate: this.calculateTestSuccessRate(),
      },
      systemMetrics,
      applicationMetrics,
      alerts,
      recommendations,
    };

    logger.info('Performance report generated', {
      reportId: report.id,
      period: `${period.start.toISOString()} - ${period.end.toISOString()}`,
    });

    return report;
  }

  /**
   * Helper methods
   */
  private calculateCPUUsage(): number {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    });

    return 100 - ~~(100 * totalIdle / totalTick);
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * (percentile / 100)) - 1;
    const clampedIndex = Math.min(sorted.length - 1, Math.max(0, index));
    
    return sorted[clampedIndex] ?? 0;
  }

  private calculateAvailability(): number {
    // Simple availability calculation based on error rate
    const errorRate = this.calculateErrorRate();
    return Math.max(0, 100 - errorRate);
  }

  private calculateErrorRate(): number {
    if (this.requestMetrics.length === 0) return 0;
    const errors = this.requestMetrics.filter(t => t >= 500).length;
    return (errors / this.requestMetrics.length) * 100;
  }

  private calculateTestSuccessRate(): number {
    if (this.testMetrics.length === 0) return 100;
    const passed = this.testMetrics.filter(t => t.status === 'passed').length;
    return (passed / this.testMetrics.length) * 100;
  }

  private generateRecommendations(
    systemMetrics: SystemMetrics[],
    applicationMetrics: ApplicationMetrics[],
    alerts: Alert[],
  ): string[] {
    const recommendations: string[] = [];

    // Check for high CPU usage
    const cpuAlerts = alerts.filter(a => a.metric === 'system.cpu.usage');
    if (cpuAlerts.length > 0) {
      recommendations.push('Consider scaling horizontally or optimizing CPU-intensive operations');
    }

    // Check for high memory usage
    const memoryAlerts = alerts.filter(a => a.metric === 'system.memory.percentage');
    if (memoryAlerts.length > 0) {
      recommendations.push('Review memory usage patterns and consider increasing available memory');
    }

    // Check for high error rate
    const errorRate = this.calculateErrorRate();
    if (errorRate > 5) {
      recommendations.push('High error rate detected. Review error logs and implement error recovery strategies');
    }

    // Check for slow response times
    const avgResponseTime = this.calculateAverage(this.requestMetrics);
    if (avgResponseTime > 500) {
      recommendations.push('Response times are above optimal levels. Consider implementing caching or query optimization');
    }

    // Check test success rate
    const testSuccessRate = this.calculateTestSuccessRate();
    if (testSuccessRate < 90) {
      recommendations.push('Test success rate is below target. Review failing tests and improve test stability');
    }

    return recommendations;
  }

  private cleanupOldMetrics(): void {
    const oneHourAgo = Date.now() - 3600000;
    
    for (const [name, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp.getTime() > oneHourAgo);
      this.metrics.set(name, filtered);
    }

    logger.debug('Old metrics cleaned up');
  }

  /**
   * 停止监控
   */
  stop(): void {
    for (const [name, timer] of this.collectors) {
      clearInterval(timer);
    }
    this.collectors.clear();
    logger.info('PerformanceMonitor stopped');
  }
}
