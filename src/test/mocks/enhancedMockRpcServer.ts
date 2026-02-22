import { MockRpcRequest, MockRpcServer } from "./mockRpcServer";

export interface RealisticRpcConfig {
  enableLatency?: boolean;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  errorRate?: number;
  rateLimitConfig?: {
    requestsPerSecond: number;
    burstSize: number;
  };
  circuitBreakerConfig?: {
    failureThreshold: number;
    recoveryTimeMs: number;
  };
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  maxLifetimeMs: number;
}

export interface TestScenario {
  name: string;
  description: string;
  setup: (server: EnhancedMockRpcServer) => void;
  expectations: (requests: MockRpcRequest[]) => void;
}

export class EnhancedMockRpcServer extends MockRpcServer {
  public config: RealisticRpcConfig;
  private connectionPool: Map<string, any> = new Map();
  private circuitBreakerState: {
    isOpen: boolean;
    failureCount: number;
    lastFailureTime: number;
  } = {
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
  };
  private rateLimitState: Map<string, number[]> = new Map();
  private scenarios: TestScenario[] = [];

  constructor(config: RealisticRpcConfig = {}) {
    super();
    this.config = {
      enableLatency: config.enableLatency ?? false,
      minLatencyMs: config.minLatencyMs ?? 50,
      maxLatencyMs: config.maxLatencyMs ?? 500,
      errorRate: config.errorRate ?? 0,
      rateLimitConfig: config.rateLimitConfig ?? {
        requestsPerSecond: 10,
        burstSize: 20,
      },
      circuitBreakerConfig: config.circuitBreakerConfig ?? {
        failureThreshold: 5,
        recoveryTimeMs: 30000,
      },
    };
  }

  // ── Realistic Behavior Simulation ─────────────────────────────

  private async applyRealisticBehavior(): Promise<void> {
    if (this.config.enableLatency) {
      const latency =
        Math.random() *
          (this.config.maxLatencyMs! - this.config.minLatencyMs!) +
        this.config.minLatencyMs!;
      await this.delay(latency);
    }

    if (Math.random() < this.config.errorRate!) {
      throw new Error("Simulated random network error");
    }
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const requests = this.rateLimitState.get(clientId) || [];
    const recentRequests = requests.filter((time) => now - time < 1000); // Last second

    if (
      recentRequests.length >= this.config.rateLimitConfig!.requestsPerSecond
    ) {
      return false; // Rate limited
    }

    recentRequests.push(now);
    this.rateLimitState.set(clientId, recentRequests);
    return true;
  }

  private checkCircuitBreaker(): boolean {
    if (this.circuitBreakerState.isOpen) {
      const timeSinceLastFailure =
        Date.now() - this.circuitBreakerState.lastFailureTime;
      if (
        timeSinceLastFailure > this.config.circuitBreakerConfig!.recoveryTimeMs
      ) {
        this.circuitBreakerState.isOpen = false;
        this.circuitBreakerState.failureCount = 0;
      } else {
        return false; // Circuit breaker still open
      }
    }
    return true;
  }

  private recordFailure(): void {
    this.circuitBreakerState.failureCount++;
    this.circuitBreakerState.lastFailureTime = Date.now();

    if (
      this.circuitBreakerState.failureCount >=
      this.config.circuitBreakerConfig!.failureThreshold
    ) {
      this.circuitBreakerState.isOpen = true;
    }
  }

  // ── Connection Pool Simulation ───────────────────────────────

  public simulateConnectionAcquisition(
    connectionId: string,
    config: ConnectionPoolConfig,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const connection = this.connectionPool.get(connectionId);

      if (connection) {
        const age = Date.now() - connection.created;
        if (age > config.maxLifetimeMs) {
          this.connectionPool.delete(connectionId);
        } else {
          resolve(true);
          return;
        }
      }

      if (this.connectionPool.size >= config.maxConnections) {
        // Simulate timeout
        setTimeout(() => resolve(false), config.acquireTimeoutMs);
        return;
      }

      this.connectionPool.set(connectionId, {
        created: Date.now(),
        lastUsed: Date.now(),
        inUse: true,
      });

      resolve(true);
    });
  }

  public releaseConnection(connectionId: string): void {
    const connection = this.connectionPool.get(connectionId);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
    }
  }

  public getConnectionPoolStats() {
    return {
      totalConnections: this.connectionPool.size,
      activeConnections: Array.from(this.connectionPool.values()).filter(
        (c) => c.inUse,
      ).length,
      idleConnections: Array.from(this.connectionPool.values()).filter(
        (c) => !c.inUse,
      ).length,
    };
  }

  // ── Test Scenarios ───────────────────────────────────────────

  public addScenario(scenario: TestScenario): void {
    this.scenarios.push(scenario);
  }

  public runScenario(scenarioName: string): void {
    const scenario = this.scenarios.find((s) => s.name === scenarioName);
    if (scenario) {
      scenario.setup(this);
    }
  }

  public verifyScenario(
    scenarioName: string,
    requests: MockRpcRequest[],
  ): void {
    const scenario = this.scenarios.find((s) => s.name === scenarioName);
    if (scenario) {
      scenario.expectations(requests);
    }
  }

  // ── Enhanced Fetch Handler ───────────────────────────────────

  public createEnhancedFetchHandler(): (
    url: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response> {
    return async (
      url: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const urlStr = String(url);
      const clientId =
        ((init?.headers as any)?.["X-Client-ID"] as string) || "default";

      // Apply realistic behavior
      await this.applyRealisticBehavior();

      // Check rate limiting
      if (!this.checkRateLimit(clientId)) {
        return new Response(JSON.stringify({ error: "Too Many Requests" }), {
          status: 429,
          statusText: "Too Many Requests",
          headers: { "Content-Type": "application/json", "Retry-After": "1" },
        });
      }

      // Check circuit breaker
      if (!this.checkCircuitBreaker()) {
        return new Response(
          JSON.stringify({
            error: "Service Unavailable - Circuit Breaker Open",
          }),
          {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      try {
        // Call parent fetch handler
        const response = await this.createFetchHandler()(url, init);

        // Record success for circuit breaker
        if (response.ok) {
          this.circuitBreakerState.failureCount = Math.max(
            0,
            this.circuitBreakerState.failureCount - 1,
          );
        } else {
          this.recordFailure();
        }

        return response;
      } catch (error) {
        this.recordFailure();
        throw error;
      }
    };
  }

  // ── Reset and Cleanup ─────────────────────────────────────────

  public reset(): void {
    super.reset();
    this.connectionPool.clear();
    this.circuitBreakerState = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
    };
    this.rateLimitState.clear();
  }

  // ── State Inspection ─────────────────────────────────────────

  public getCircuitBreakerState() {
    return { ...this.circuitBreakerState };
  }

  public getRateLimitStats() {
    const stats: Record<string, number> = {};
    for (const [clientId, requests] of this.rateLimitState) {
      const now = Date.now();
      const recentRequests = requests.filter((time) => now - time < 1000);
      stats[clientId] = recentRequests.length;
    }
    return stats;
  }
}

// ── Predefined Test Scenarios ─────────────────────────────────────

export const predefinedScenarios: TestScenario[] = [
  {
    name: "high-load",
    description: "Simulate high load with rate limiting and latency",
    setup: (server) => {
      server.reset();
      server.config.enableLatency = true;
      server.config.minLatencyMs = 100;
      server.config.maxLatencyMs = 300;
      server.config.rateLimitConfig = {
        requestsPerSecond: 5,
        burstSize: 10,
      };
    },
    expectations: (requests) => {
      // Verify that some requests were rate limited
      const rateLimitedResponses = requests.filter(
        (req) => req.headers["X-Rate-Limited"] === "true",
      );
      console.log(
        `Rate limited requests: ${rateLimitedResponses.length}/${requests.length}`,
      );
    },
  },
  {
    name: "circuit-breaker-test",
    description: "Test circuit breaker behavior under failure",
    setup: (server) => {
      server.reset();
      server.config.errorRate = 0.8; // 80% failure rate
      server.config.circuitBreakerConfig = {
        failureThreshold: 3,
        recoveryTimeMs: 5000,
      };
    },
    expectations: (requests) => {
      // Verify circuit breaker opened after threshold
      console.log(`Total requests made: ${requests.length}`);
    },
  },
  {
    name: "connection-pool-stress",
    description: "Test connection pool under stress",
    setup: (server) => {
      server.reset();
      // Connection pool will be tested via explicit methods
    },
    expectations: (requests) => {
      // Verify connection pool behavior
      console.log(
        `Processed ${requests.length} requests with connection pooling`,
      );
    },
  },
];

// ── Test Data Generators ───────────────────────────────────────

export class TestDataGenerator {
  static createRealisticContractCall() {
    return {
      contractId:
        "C" + Math.random().toString(36).substring(2, 15).toUpperCase(),
      functionName: ["transfer", "balance", "approve", "mint", "burn"][
        Math.floor(Math.random() * 5)
      ],
      args: [
        {
          type: "address",
          value:
            "G" + Math.random().toString(36).substring(2, 15).toUpperCase(),
        },
        { type: "i128", value: Math.floor(Math.random() * 1000000).toString() },
        {
          type: "symbol",
          value: ["USD", "EUR", "BTC", "ETH"][Math.floor(Math.random() * 4)],
        },
      ],
    };
  }

  static createBatchOfCalls(count: number) {
    return Array.from({ length: count }, () =>
      this.createRealisticContractCall(),
    );
  }

  static createStressTestData(requestCount: number) {
    return {
      requests: this.createBatchOfCalls(requestCount),
      concurrency: Math.min(requestCount, 50),
      expectedDuration: requestCount * 100, // Rough estimate
    };
  }
}

// ── Performance Monitoring ─────────────────────────────────────

export class PerformanceMonitor {
  private metrics: {
    requestCount: number;
    totalLatency: number;
    errorCount: number;
    rateLimitHits: number;
    circuitBreakerOpens: number;
  } = {
    requestCount: 0,
    totalLatency: 0,
    errorCount: 0,
    rateLimitHits: 0,
    circuitBreakerOpens: 0,
  };

  public recordRequest(
    latency: number,
    isError: boolean,
    isRateLimited: boolean,
    isCircuitBreakerOpen: boolean,
  ): void {
    this.metrics.requestCount++;
    this.metrics.totalLatency += latency;

    if (isError) this.metrics.errorCount++;
    if (isRateLimited) this.metrics.rateLimitHits++;
    if (isCircuitBreakerOpen) this.metrics.circuitBreakerOpens++;
  }

  public getMetrics() {
    return {
      ...this.metrics,
      averageLatency:
        this.metrics.requestCount > 0
          ? this.metrics.totalLatency / this.metrics.requestCount
          : 0,
      errorRate:
        this.metrics.requestCount > 0
          ? (this.metrics.errorCount / this.metrics.requestCount) * 100
          : 0,
      rateLimitRate:
        this.metrics.requestCount > 0
          ? (this.metrics.rateLimitHits / this.metrics.requestCount) * 100
          : 0,
    };
  }

  public reset(): void {
    this.metrics = {
      requestCount: 0,
      totalLatency: 0,
      errorCount: 0,
      rateLimitHits: 0,
      circuitBreakerOpens: 0,
    };
  }
}
