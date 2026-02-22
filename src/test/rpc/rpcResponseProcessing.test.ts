declare function require(name: string): any;
declare const process: { exitCode?: number };
declare const module: any;

const assert = require("assert");

import { RpcService } from "../../services/rpcService";
import { MockRpcServer } from "../mocks/mockRpcServer";

// ── Test Environment Setup ─────────────────────────────────────

class ResponseProcessingTestRunner {
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

// ── Response Processing Tests ───────────────────────────────────

async function testSuccessfulResponseProcessing() {
  const runner = new ResponseProcessingTestRunner();

  await runner.runTest("Process successful RPC response", async () => {
    const service = runner.createService();
    const mockResponse = {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: 1,
        result: {
          returnValue: "success_value",
          resourceUsage: {
            cpuInstructions: 15000,
            memoryBytes: 8192,
          },
          events: [
            { type: "contract_event", topics: ["transfer"], data: "0x1234" },
          ],
        },
      },
    };

    runner.mockServer.setDefaultResponse(mockResponse);

    const result = await service.simulateTransaction(
      "CSUCCESS",
      "success_function",
      [],
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, "success_value");
    assert.ok(result.resourceUsage);
    assert.strictEqual(result.resourceUsage!.cpuInstructions, 15000);
    assert.strictEqual(result.resourceUsage!.memoryBytes, 8192);
    assert.ok(result.rawResult);
    assert.deepStrictEqual(
      (result.rawResult as any).events,
      mockResponse.body.result.events,
    );
  });
}

async function testNestedResultResponse() {
  const runner = new ResponseProcessingTestRunner();

  await runner.runTest(
    "Process response with nested result field",
    async () => {
      const service = runner.createService();
      const mockResponse = {
        status: 200,
        body: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            result: "nested_success_value",
            resource_usage: {
              cpu_instructions: 12000,
              memory_bytes: 4096,
            },
          },
        },
      };

      runner.mockServer.setDefaultResponse(mockResponse);

      const result = await service.simulateTransaction(
        "CNESTED",
        "nested_function",
        [],
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, "nested_success_value");
      assert.ok(result.resourceUsage);
      assert.strictEqual(result.resourceUsage!.cpuInstructions, 12000);
      assert.strictEqual(result.resourceUsage!.memoryBytes, 4096);
    },
  );
}

async function testMinimalResponseProcessing() {
  const runner = new ResponseProcessingTestRunner();

  await runner.runTest("Process minimal RPC response", async () => {
    const service = runner.createService();
    const mockResponse = {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: 1,
        result: {
          returnValue: "minimal_value",
        },
      },
    };

    runner.mockServer.setDefaultResponse(mockResponse);

    const result = await service.simulateTransaction(
      "CMINIMAL",
      "minimal_function",
      [],
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, "minimal_value");
    assert.strictEqual(result.resourceUsage, undefined);
    assert.ok(result.rawResult);
  });
}

async function testComplexReturnValueResponse() {
  const runner = new ResponseProcessingTestRunner();

  await runner.runTest(
    "Process response with complex return value",
    async () => {
      const service = runner.createService();
      const complexReturnValue = {
        type: "i128",
        value: "9999999999999999999",
        metadata: {
          precision: 18,
          symbol: "TOKEN",
          decimals: 7,
        },
      };

      const mockResponse = {
        status: 200,
        body: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            returnValue: complexReturnValue,
            resourceUsage: {
              cpuInstructions: 25000,
              memoryBytes: 16384,
            },
          },
        },
      };

      runner.mockServer.setDefaultResponse(mockResponse);

      const result = await service.simulateTransaction(
        "CCOMPLEX",
        "complex_return_function",
        [],
      );

      assert.strictEqual(result.success, true);
      assert.deepStrictEqual(result.result, complexReturnValue);
      assert.ok(result.resourceUsage);
      assert.strictEqual(result.resourceUsage!.cpuInstructions, 25000);
      assert.strictEqual(result.resourceUsage!.memoryBytes, 16384);
    },
  );
}

async function testArrayReturnValueResponse() {
  const runner = new ResponseProcessingTestRunner();

  await runner.runTest("Process response with array return value", async () => {
    const service = runner.createService();
    const arrayReturnValue = [
      { address: "G1", balance: "1000" },
      { address: "G2", balance: "2000" },
      { address: "G3", balance: "3000" },
    ];

    const mockResponse = {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: 1,
        result: {
          returnValue: arrayReturnValue,
          resourceUsage: {
            cpuInstructions: 18000,
            memoryBytes: 6144,
          },
        },
      },
    };

    runner.mockServer.setDefaultResponse(mockResponse);

    const result = await service.simulateTransaction(
      "CARRAY",
      "array_return_function",
      [],
    );

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.result, arrayReturnValue);
    assert.ok(result.resourceUsage);
    assert.strictEqual(result.resourceUsage!.cpuInstructions, 18000);
    assert.strictEqual(result.resourceUsage!.memoryBytes, 6144);
  });
}

async function testNullReturnValueResponse() {
  const runner = new ResponseProcessingTestRunner();

  await runner.runTest("Process response with null return value", async () => {
    const service = runner.createService();
    const mockResponse = {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: 1,
        result: {
          returnValue: null,
          resourceUsage: {
            cpuInstructions: 8000,
            memoryBytes: 2048,
          },
        },
      },
    };

    runner.mockServer.setDefaultResponse(mockResponse);

    const result = await service.simulateTransaction(
      "CNULL",
      "null_return_function",
      [],
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, null);
    assert.ok(result.resourceUsage);
    assert.strictEqual(result.resourceUsage!.cpuInstructions, 8000);
    assert.strictEqual(result.resourceUsage!.memoryBytes, 2048);
  });
}

async function testStringReturnValueResponse() {
  const runner = new ResponseProcessingTestRunner();

  await runner.runTest(
    "Process response with string return value",
    async () => {
      const service = runner.createService();
      const stringValue = "Hello, Stellar World! 🌟";

      const mockResponse = {
        status: 200,
        body: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            returnValue: stringValue,
            resourceUsage: {
              cpuInstructions: 5000,
              memoryBytes: 1024,
            },
          },
        },
      };

      runner.mockServer.setDefaultResponse(mockResponse);

      const result = await service.simulateTransaction(
        "CSTRING",
        "string_return_function",
        [],
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, stringValue);
      assert.ok(result.resourceUsage);
      assert.strictEqual(result.resourceUsage!.cpuInstructions, 5000);
      assert.strictEqual(result.resourceUsage!.memoryBytes, 1024);
    },
  );
}

async function testNumericReturnValueResponse() {
  const runner = new ResponseProcessingTestRunner();

  await runner.runTest(
    "Process response with numeric return value",
    async () => {
      const service = runner.createService();
      const numericValue = 42;

      const mockResponse = {
        status: 200,
        body: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            returnValue: numericValue,
            resourceUsage: {
              cpuInstructions: 3000,
              memoryBytes: 512,
            },
          },
        },
      };

      runner.mockServer.setDefaultResponse(mockResponse);

      const result = await service.simulateTransaction(
        "CNUMERIC",
        "numeric_return_function",
        [],
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, numericValue);
      assert.ok(result.resourceUsage);
      assert.strictEqual(result.resourceUsage!.cpuInstructions, 3000);
      assert.strictEqual(result.resourceUsage!.memoryBytes, 512);
    },
  );
}

async function testBooleanReturnValueResponse() {
  const runner = new ResponseProcessingTestRunner();

  await runner.runTest(
    "Process response with boolean return value",
    async () => {
      const service = runner.createService();
      const booleanValue = true;

      const mockResponse = {
        status: 200,
        body: {
          jsonrpc: "2.0",
          id: 1,
          result: {
            returnValue: booleanValue,
            resourceUsage: {
              cpuInstructions: 2000,
              memoryBytes: 256,
            },
          },
        },
      };

      runner.mockServer.setDefaultResponse(mockResponse);

      const result = await service.simulateTransaction(
        "CBOOLEAN",
        "boolean_return_function",
        [],
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.result, booleanValue);
      assert.ok(result.resourceUsage);
      assert.strictEqual(result.resourceUsage!.cpuInstructions, 2000);
      assert.strictEqual(result.resourceUsage!.memoryBytes, 256);
    },
  );
}

async function testRawResultPreservation() {
  const runner = new ResponseProcessingTestRunner();

  await runner.runTest("Preserve raw result in response", async () => {
    const service = runner.createService();
    const rawResult = {
      returnValue: "preserved_value",
      resourceUsage: {
        cpuInstructions: 10000,
        memoryBytes: 4096,
      },
      metadata: {
        contractVersion: "1.0.0",
        executionTime: 150,
        gasUsed: "50000",
      },
      events: [],
      diagnostics: {
        warnings: [],
        errors: [],
      },
    };

    const mockResponse = {
      status: 200,
      body: {
        jsonrpc: "2.0",
        id: 1,
        result: rawResult,
      },
    };

    runner.mockServer.setDefaultResponse(mockResponse);

    const result = await service.simulateTransaction(
      "CRAW",
      "raw_result_function",
      [],
    );

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.result, "preserved_value");
    assert.deepStrictEqual(result.rawResult, rawResult);
    assert.strictEqual(
      (result.rawResult as any).metadata.contractVersion,
      "1.0.0",
    );
    assert.strictEqual((result.rawResult as any).metadata.gasUsed, "50000");
  });
}

// ── Test Runner ─────────────────────────────────────────────

async function runResponseProcessingTests() {
  console.log("\n📥 RPC Response Processing Tests");
  console.log("=".repeat(50));

  const tests = [
    testSuccessfulResponseProcessing,
    testNestedResultResponse,
    testMinimalResponseProcessing,
    testComplexReturnValueResponse,
    testArrayReturnValueResponse,
    testNullReturnValueResponse,
    testStringReturnValueResponse,
    testNumericReturnValueResponse,
    testBooleanReturnValueResponse,
    testRawResultPreservation,
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
    `\n📊 Response Processing Test Results: ${passed} passed, ${failed} failed`,
  );

  if (failed > 0) {
    process.exitCode = 1;
  }

  return { passed, failed, total: tests.length };
}

// Export for use in other test files
export { runResponseProcessingTests };

// Run tests if this file is executed directly
if (typeof require !== "undefined" && (require as any).main === module) {
  runResponseProcessingTests().catch((error) => {
    console.error("Response processing test runner error:", error);
    process.exitCode = 1;
  });
}
