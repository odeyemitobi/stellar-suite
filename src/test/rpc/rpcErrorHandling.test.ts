declare function require(name: string): any;
declare const process: { exitCode?: number };
declare const module: any;

const assert = require("assert");

import { RpcService } from "../../services/rpcService";
import {
  MockRpcServer,
  createHttpErrorResponse,
  createRateLimitResponse,
  createSimulationErrorResponse,
  createSimulationSuccessResponse,
} from "../mocks/mockRpcServer";

// ── Test Environment Setup ─────────────────────────────────────

class ErrorHandlingTestRunner {
  public mockServer: MockRpcServer;
  private originalFetch: typeof globalThis.fetch;
  private services: RpcService[] = [];

  constructor() {
    this.mockServer = new MockRpcServer();
    this.originalFetch = globalThis.fetch;
  }

  setup(): void {
    globalThis.fetch = this.mockServer.createFetchHandler() as any;
  }

  teardown(): void {
    globalThis.fetch = this.originalFetch;
    for (const service of this.services) {
      try {
        service.getRateLimiter().dispose();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this.services = [];
    this.mockServer.reset();
  }

  createService(url: string = "https://rpc.testnet.stellar.org"): RpcService {
    const service = new RpcService(url);
    this.services.push(service);
    return service;
  }

  async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    try {
      this.setup();
      await testFn();
      console.log(`  [ok] ${testName}`);
    } catch (error) {
      console.error(
        `  [fail] ${testName}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      this.teardown();
    }
  }
}

// ── Error Handling Tests ─────────────────────────────────────

async function testRpcErrorHandling() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle RPC error response", async () => {
    const service = runner.createService();
    runner.mockServer.setDefaultResponse(
      createSimulationErrorResponse("Contract execution failed", -32000),
    );

    const result = await service.simulateTransaction(
      "CERROR",
      "error_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "Contract execution failed");
    assert.strictEqual(result.result, undefined);
  });
}

async function testRpcErrorWithoutMessage() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle RPC error without message", async () => {
    const service = runner.createService();
    const mockResponse = {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: 1,
        error: {
          code: -32600,
          data: "Invalid Request",
        },
      },
    };

    runner.mockServer.setDefaultResponse(mockResponse);

    const result = await service.simulateTransaction(
      "CNO_MSG",
      "no_msg_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "RPC error occurred");
  });
}

async function testHttpErrorHandling() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle HTTP error responses", async () => {
    const service = runner.createService();

    // Test 400 Bad Request
    runner.mockServer.setDefaultResponse(
      createHttpErrorResponse(400, "Bad Request"),
    );
    const result400 = await service.simulateTransaction(
      "C400",
      "bad_request_function",
      [],
    );
    assert.strictEqual(result400.success, false);
    assert.ok(result400.error!.includes("400"));
    assert.ok(result400.error!.includes("Bad Request"));

    // Test 401 Unauthorized
    runner.mockServer.setDefaultResponse(
      createHttpErrorResponse(401, "Unauthorized"),
    );
    const result401 = await service.simulateTransaction(
      "C401",
      "unauthorized_function",
      [],
    );
    assert.strictEqual(result401.success, false);
    assert.ok(result401.error!.includes("401"));
    assert.ok(result401.error!.includes("Unauthorized"));

    // Test 403 Forbidden
    runner.mockServer.setDefaultResponse(
      createHttpErrorResponse(403, "Forbidden"),
    );
    const result403 = await service.simulateTransaction(
      "C403",
      "forbidden_function",
      [],
    );
    assert.strictEqual(result403.success, false);
    assert.ok(result403.error!.includes("403"));
    assert.ok(result403.error!.includes("Forbidden"));

    // Test 404 Not Found
    runner.mockServer.setDefaultResponse(
      createHttpErrorResponse(404, "Not Found"),
    );
    const result404 = await service.simulateTransaction(
      "C404",
      "not_found_function",
      [],
    );
    assert.strictEqual(result404.success, false);
    assert.ok(result404.error!.includes("404"));
    assert.ok(result404.error!.includes("Not Found"));

    // Test 500 Internal Server Error
    runner.mockServer.setDefaultResponse(
      createHttpErrorResponse(500, "Internal Server Error"),
    );
    const result500 = await service.simulateTransaction(
      "C500",
      "server_error_function",
      [],
    );
    assert.strictEqual(result500.success, false);
    assert.ok(result500.error!.includes("500"));
    assert.ok(result500.error!.includes("Internal Server Error"));

    // Test 503 Service Unavailable
    runner.mockServer.setDefaultResponse(
      createHttpErrorResponse(503, "Service Unavailable"),
    );
    const result503 = await service.simulateTransaction(
      "C503",
      "unavailable_function",
      [],
    );
    assert.strictEqual(result503.success, false);
    assert.ok(result503.error!.includes("503"));
    assert.ok(result503.error!.includes("Service Unavailable"));
  });
}

async function testNetworkErrorHandling() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle network errors", async () => {
    const service = runner.createService();

    // Simulate network failure
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed - network unreachable");
    };

    const result = await service.simulateTransaction(
      "CNET",
      "network_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.error!.includes("Network error"));
    assert.ok(result.error!.includes("Unable to reach RPC endpoint"));
  });
}

async function testTimeoutErrorHandling() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle timeout errors", async () => {
    const service = runner.createService();

    // Simulate timeout
    globalThis.fetch = async (_url: any, init?: any) => {
      if (init?.signal) {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 100);
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      throw new Error("timeout");
    };

    const result = await service.simulateTransaction(
      "CTIMEOUT",
      "timeout_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.error!.includes("timed out"));
    assert.ok(
      result.error!.includes("RPC endpoint may be slow or unreachable"),
    );
  });
}

async function testInvalidJsonResponse() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle invalid JSON response", async () => {
    const service = runner.createService();

    const mockResponse = {
      status: 200,
      body: "invalid json response { not valid",
    };

    runner.mockServer.setDefaultResponse(mockResponse);

    const result = await service.simulateTransaction(
      "CINVALID",
      "invalid_json_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.ok(
      result.error!.includes("error") || result.error!.includes("failed"),
    );
  });
}

async function testMalformedRpcResponse() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle malformed RPC response", async () => {
    const service = runner.createService();

    // Missing required fields
    const mockResponse = {
      status: 200,
      body: {
        // Missing jsonrpc, id, and result/error
        someField: "someValue",
      },
    };

    runner.mockServer.setDefaultResponse(mockResponse);

    const result = await service.simulateTransaction(
      "CMALFORMED",
      "malformed_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.ok(
      result.error!.includes("error") || result.error!.includes("failed"),
    );
  });
}

async function testRateLimitErrorHandling() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle rate limit errors", async () => {
    const service = runner.createService();
    runner.mockServer.setDefaultResponse(createRateLimitResponse(60));

    const result = await service.simulateTransaction(
      "CRATE",
      "rate_limit_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.error!.includes("429"));
  });
}

async function testConnectionRefusedError() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle connection refused error", async () => {
    const service = runner.createService();

    globalThis.fetch = async () => {
      throw new Error("ECONNREFUSED: Connection refused");
    };

    const result = await service.simulateTransaction(
      "CCONN",
      "connection_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.error!.includes("Network error"));
  });
}

async function testDnsResolutionError() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle DNS resolution error", async () => {
    const service = runner.createService();

    globalThis.fetch = async () => {
      throw new Error("ENOTFOUND: DNS lookup failed");
    };

    const result = await service.simulateTransaction(
      "CDNS",
      "dns_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.error!.includes("Network error"));
  });
}

async function testSslCertificateError() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle SSL certificate error", async () => {
    const service = runner.createService();

    globalThis.fetch = async () => {
      throw new Error("CERT_HAS_EXPIRED: SSL certificate has expired");
    };

    const result = await service.simulateTransaction(
      "CSSL",
      "ssl_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.error!.includes("Network error"));
  });
}

async function testErrorRecovery() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest(
    "Test error recovery and subsequent success",
    async () => {
      const service = runner.createService();

      // First call fails
      runner.mockServer.setDefaultResponse(
        createSimulationErrorResponse("Temporary failure", -32000),
      );
      const failedResult = await service.simulateTransaction(
        "CRECOVER",
        "recover_function",
        [],
      );
      assert.strictEqual(failedResult.success, false);

      // Second call succeeds
      runner.mockServer.setDefaultResponse(
        createSimulationSuccessResponse("recovery_success"),
      );
      const successResult = await service.simulateTransaction(
        "CRECOVER",
        "recover_function",
        [],
      );
      assert.strictEqual(successResult.success, true);
      assert.strictEqual(successResult.result, "recovery_success");
    },
  );
}

async function testErrorWithCustomHeaders() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Handle errors with custom headers", async () => {
    const service = runner.createService();
    service.setAuthHeaders({
      Authorization: "Bearer test-token",
      "X-Custom-Header": "custom-value",
    });

    runner.mockServer.setDefaultResponse(
      createHttpErrorResponse(401, "Invalid token"),
    );

    const result = await service.simulateTransaction(
      "CHEADERS",
      "header_error_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.ok(result.error!.includes("401"));
    assert.ok(result.error!.includes("Invalid token"));

    // Verify headers were sent despite error
    const request = runner.mockServer.getLastRequest();
    assert.strictEqual(request!.headers["Authorization"], "Bearer test-token");
    assert.strictEqual(request!.headers["X-Custom-Header"], "custom-value");
  });
}

async function testErrorLogging() {
  const runner = new ErrorHandlingTestRunner();

  await runner.runTest("Verify error logging functionality", async () => {
    const loggedErrors: string[] = [];
    const mockLogger = {
      logRequest: () => "req-123",
      logResponse: () => {},
      logError: (reqId: string, method: string, error: string) => {
        loggedErrors.push(`${method}: ${error}`);
      },
    };

    const service = runner.createService();
    service.setLogger(mockLogger);

    runner.mockServer.setDefaultResponse(
      createSimulationErrorResponse("Logged error", -32000),
    );

    const result = await service.simulateTransaction(
      "CLOG",
      "logging_function",
      [],
    );

    assert.strictEqual(result.success, false);
    assert.ok(loggedErrors.length > 0);
    assert.ok(
      loggedErrors.some((error) => error.includes("simulateTransaction")),
    );
    assert.ok(loggedErrors.some((error) => error.includes("Logged error")));
  });
}

// ── Test Runner ─────────────────────────────────────────────

async function runErrorHandlingTests() {
  console.log("\n⚠️  RPC Error Handling Tests");
  console.log("=".repeat(50));

  const tests = [
    testRpcErrorHandling,
    testRpcErrorWithoutMessage,
    testHttpErrorHandling,
    testNetworkErrorHandling,
    testTimeoutErrorHandling,
    testInvalidJsonResponse,
    testMalformedRpcResponse,
    testRateLimitErrorHandling,
    testConnectionRefusedError,
    testDnsResolutionError,
    testSslCertificateError,
    testErrorRecovery,
    testErrorWithCustomHeaders,
    testErrorLogging,
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      failed++;
      console.error(
        `     Error: ${error instanceof Error ? error.stack || error.message : String(error)}`,
      );
    }
  }

  console.log(
    `\n📊 Error Handling Test Results: ${passed} passed, ${failed} failed`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }

  return { passed, failed, total: tests.length };
}

// Export for use in other test files
export { runErrorHandlingTests };

// Run tests if this file is executed directly
if (typeof require !== "undefined" && (require as any).main === module) {
  runErrorHandlingTests().catch((error) => {
    console.error("Error handling test runner error:", error);
    process.exitCode = 1;
  });
}
