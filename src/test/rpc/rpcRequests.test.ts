declare function require(name: string): any;
declare const process: { exitCode?: number };
declare const module: any;

const assert = require("assert");

import { RpcService } from "../../services/rpcService";
import {
  MockRpcServer,
  createSimulationSuccessResponse,
} from "../mocks/mockRpcServer";

// ── Test Environment Setup ─────────────────────────────────────

class RpcRequestTestRunner {
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

// ── RPC Request Tests ───────────────────────────────────────────

async function testBasicRpcRequest() {
  const runner = new RpcRequestTestRunner();

  await runner.runTest(
    "Basic RPC request with valid contract call",
    async () => {
      const service = runner.createService();
      runner.mockServer.setDefaultResponse(
        createSimulationSuccessResponse("basic_success"),
      );

      const result = await service.simulateTransaction("C123456", "hello", [
        "world",
      ]);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, "basic_success");
      assert.ok(result.resourceUsage);

      const request = runner.mockServer.getLastRequest();
      assert.strictEqual(request!.body.method, "simulateTransaction");
      assert.strictEqual(
        request!.body.params.transaction.contractId,
        "C123456",
      );
      assert.strictEqual(
        request!.body.params.transaction.functionName,
        "hello",
      );
      assert.deepStrictEqual(request!.body.params.transaction.args, [
        { value: "world" },
      ]);
    },
  );
}

async function testComplexRpcRequest() {
  const runner = new RpcRequestTestRunner();

  await runner.runTest(
    "Complex RPC request with multiple argument types",
    async () => {
      const service = runner.createService();
      const complexArgs = [
        {
          type: "address",
          value: "GD5DJJCCB7TV5J3IS534G5YJF3KXJHD5JCMZGHKJZM5M3LJAV5K3C5Z",
        },
        { type: "i128", value: "1000000000000000000" },
        { type: "string", value: "complex_operation" },
        { type: "bool", value: true },
        { type: "symbol", value: "USD" },
        { type: "bytes", value: "48656c6c6f20576f726c64" },
      ];

      runner.mockServer.setDefaultResponse(
        createSimulationSuccessResponse("complex_success"),
      );

      const result = await service.simulateTransaction(
        "C789012",
        "complex_function",
        complexArgs,
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, "complex_success");

      const request = runner.mockServer.getLastRequest();
      assert.strictEqual(request!.body.params.transaction.args.length, 6);
      assert.deepStrictEqual(request!.body.params.transaction.args[0], {
        value: complexArgs[0],
      });
      assert.deepStrictEqual(request!.body.params.transaction.args[1], {
        value: complexArgs[1],
      });
      assert.deepStrictEqual(request!.body.params.transaction.args[2], {
        value: complexArgs[2],
      });
      assert.deepStrictEqual(request!.body.params.transaction.args[3], {
        value: complexArgs[3],
      });
      assert.deepStrictEqual(request!.body.params.transaction.args[4], {
        value: complexArgs[4],
      });
      assert.deepStrictEqual(request!.body.params.transaction.args[5], {
        value: complexArgs[5],
      });
    },
  );
}

async function testEmptyArgumentsRequest() {
  const runner = new RpcRequestTestRunner();

  await runner.runTest("RPC request with empty arguments", async () => {
    const service = runner.createService();
    runner.mockServer.setDefaultResponse(
      createSimulationSuccessResponse("empty_args_success"),
    );

    const result = await service.simulateTransaction(
      "CEMPTY",
      "no_args_function",
      [],
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, "empty_args_success");

    const request = runner.mockServer.getLastRequest();
    assert.deepStrictEqual(request!.body.params.transaction.args, []);
  });
}

async function testLargePayloadRequest() {
  const runner = new RpcRequestTestRunner();

  await runner.runTest("RPC request with large payload", async () => {
    const service = runner.createService();
    const largeString = "x".repeat(50000); // 50KB payload
    runner.mockServer.setDefaultResponse(
      createSimulationSuccessResponse("large_payload_success"),
    );

    const result = await service.simulateTransaction(
      "CLARGE",
      "large_payload_function",
      [largeString],
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, "large_payload_success");

    const request = runner.mockServer.getLastRequest();
    assert.ok(request!.body.params.transaction.args[0].value.length > 49000);
  });
}

async function testSpecialCharactersRequest() {
  const runner = new RpcRequestTestRunner();

  await runner.runTest("RPC request with special characters", async () => {
    const service = runner.createService();
    const specialString = "Hello 🌍 World! ñáéíóú 中文 العربية русский";
    runner.mockServer.setDefaultResponse(
      createSimulationSuccessResponse("special_chars_success"),
    );

    const result = await service.simulateTransaction(
      "CSPECIAL",
      "unicode_function",
      [specialString],
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, "special_chars_success");

    const request = runner.mockServer.getLastRequest();
    assert.strictEqual(
      request!.body.params.transaction.args[0].value,
      specialString,
    );
  });
}

async function testNumericArgumentsRequest() {
  const runner = new RpcRequestTestRunner();

  await runner.runTest("RPC request with various numeric types", async () => {
    const service = runner.createService();
    const numericArgs = [
      0,
      -1,
      42,
      3.14159,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      "0",
      "-1",
      "99999999999999999999999999999999999999999999999999",
    ];

    runner.mockServer.setDefaultResponse(
      createSimulationSuccessResponse("numeric_success"),
    );

    const result = await service.simulateTransaction(
      "CNUMERIC",
      "numeric_function",
      numericArgs,
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, "numeric_success");

    const request = runner.mockServer.getLastRequest();
    assert.strictEqual(
      request!.body.params.transaction.args.length,
      numericArgs.length,
    );

    for (let i = 0; i < numericArgs.length; i++) {
      assert.deepStrictEqual(request!.body.params.transaction.args[i], {
        value: numericArgs[i],
      });
    }
  });
}

async function testRequestHeaders() {
  const runner = new RpcRequestTestRunner();

  await runner.runTest("RPC request with proper headers", async () => {
    const service = runner.createService();
    service.setAuthHeaders({
      Authorization: "Bearer test-token",
      "X-API-Key": "test-key",
      "X-Request-ID": "req-123",
    });

    runner.mockServer.setDefaultResponse(
      createSimulationSuccessResponse("headers_success"),
    );

    const result = await service.simulateTransaction(
      "CHEADERS",
      "headers_function",
      [],
    );

    assert.strictEqual(result.success, true);

    const request = runner.mockServer.getLastRequest();
    assert.strictEqual(request!.headers["Content-Type"], "application/json");
    assert.strictEqual(request!.headers["Authorization"], "Bearer test-token");
    assert.strictEqual(request!.headers["X-API-Key"], "test-key");
    assert.strictEqual(request!.headers["X-Request-ID"], "req-123");
  });
}

async function testRequestIdGeneration() {
  const runner = new RpcRequestTestRunner();

  await runner.runTest("RPC request with proper JSON-RPC ID", async () => {
    const service = runner.createService();
    runner.mockServer.setDefaultResponse(
      createSimulationSuccessResponse("id_success"),
    );

    const result = await service.simulateTransaction("CID", "id_function", []);

    assert.strictEqual(result.success, true);

    const request = runner.mockServer.getLastRequest();
    assert.strictEqual(request!.body.jsonrpc, "2.0");
    assert.strictEqual(request!.body.id, 1);
    assert.strictEqual(request!.body.method, "simulateTransaction");
  });
}

async function testMalformedRequestHandling() {
  const runner = new RpcRequestTestRunner();

  await runner.runTest("RPC service handles malformed responses", async () => {
    const service = runner.createService();

    // Test invalid JSON response
    runner.mockServer.setDefaultResponse({
      status: 200,
      body: "invalid json response",
    });

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

async function testConcurrentRequests() {
  const runner = new RpcRequestTestRunner();

  await runner.runTest("Multiple concurrent RPC requests", async () => {
    const service = runner.createService();
    runner.mockServer.setDefaultResponse(
      createSimulationSuccessResponse("concurrent_success"),
    );

    const requests = [
      service.simulateTransaction("C1", "func1", ["arg1"]),
      service.simulateTransaction("C2", "func2", ["arg2"]),
      service.simulateTransaction("C3", "func3", ["arg3"]),
      service.simulateTransaction("C4", "func4", ["arg4"]),
      service.simulateTransaction("C5", "func5", ["arg5"]),
    ];

    const results = await Promise.all(requests);

    assert.strictEqual(results.length, 5);
    for (const result of results) {
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, "concurrent_success");
    }

    assert.strictEqual(runner.mockServer.getRequestCount(), 5);
  });
}

// ── Test Runner ─────────────────────────────────────────────

async function runRpcRequestTests() {
  console.log("\n📡 RPC Request Processing Tests");
  console.log("=".repeat(50));

  const tests = [
    testBasicRpcRequest,
    testComplexRpcRequest,
    testEmptyArgumentsRequest,
    testLargePayloadRequest,
    testSpecialCharactersRequest,
    testNumericArgumentsRequest,
    testRequestHeaders,
    testRequestIdGeneration,
    testMalformedRequestHandling,
    testConcurrentRequests,
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

  console.log(`\n📊 Request Test Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }

  return { passed, failed, total: tests.length };
}

// Export for use in other test files
export { runRpcRequestTests };

// Run tests if this file is executed directly
if (typeof require !== "undefined" && (require as any).main === module) {
  runRpcRequestTests().catch((error) => {
    console.error("RPC request test runner error:", error);
    process.exitCode = 1;
  });
}
