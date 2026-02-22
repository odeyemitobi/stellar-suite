import * as assert from "assert";
import * as vscode from "vscode";
import { WorkspaceStateEncryptionService } from "../services/workspaceStateEncryptionService";
import { MockMemento } from "./mocks/mockMemento";

/**
 * Mock VS Code OutputChannel
 */
class MockOutputChannel implements vscode.OutputChannel {
  name = "mock";
  append() {}
  appendLine() {}
  clear() {}
  replace() {}
  show() {}
  hide() {}
  dispose() {}
}

/**
 * Create mock VS Code context
 */
function createMockContext() {
  const secretsStore: Record<string, string> = {};

  return {
    globalState: new MockMemento(),
    secrets: {
      store: async (key: string, value: string) => {
        secretsStore[key] = value;
      },
      get: async (key: string) => secretsStore[key],
      delete: async (key: string) => {
        delete secretsStore[key];
      },
    },
  } as unknown as vscode.ExtensionContext;
}

/**
 * Patch vscode.window.createOutputChannel
 */
(vscode.window as any).createOutputChannel = () => new MockOutputChannel();

describe("WorkspaceStateEncryptionService", () => {

  it("encrypts and decrypts values", async () => {
    const service = new WorkspaceStateEncryptionService(createMockContext());

    await service.enableEncryption();
    await service.initialize();

    const encrypted = service.encrypt("secret");
    const decrypted = service.decrypt(encrypted);

    assert.strictEqual(decrypted, "secret");
  });

  it("throws if encrypt called before initialization", () => {
    const service = new WorkspaceStateEncryptionService(createMockContext());

    assert.throws(() => service.encrypt("x"));
  });

  it("returns original object when encryption disabled", () => {
    const service = new WorkspaceStateEncryptionService(createMockContext());

    const obj = { a: 1 };
    const result = service.encryptObject(obj, ["a"]);

    assert.deepStrictEqual(result, obj);
  });

  it("encrypts selected object fields", async () => {
    const service = new WorkspaceStateEncryptionService(createMockContext());

    await service.enableEncryption();
    await service.initialize();

    const obj = { secret: "x", normal: 1 };

    const encrypted = service.encryptObject(obj, ["secret"]);

    assert.notStrictEqual(encrypted.secret, "x");
    assert.strictEqual(encrypted.normal, 1);
  });

  it("decrypts encrypted object fields", async () => {
    const service = new WorkspaceStateEncryptionService(createMockContext());

    await service.enableEncryption();
    await service.initialize();

    const obj = { secret: "x" };
    const encrypted = service.encryptObject(obj, ["secret"]);

    const decrypted = service.decryptObject(encrypted, ["secret"]);

    assert.strictEqual(decrypted.secret, "x");
  });

  it("reports encryption status", async () => {
    const service = new WorkspaceStateEncryptionService(createMockContext());

    await service.enableEncryption();
    await service.initialize();

    const status = service.getStatus();

    assert.strictEqual(status.enabled, true);
    assert.ok(status.keyId);
    assert.strictEqual(status.algorithm.includes("aes"), true);
  });

  it("exports encrypted state", async () => {
    const service = new WorkspaceStateEncryptionService(createMockContext());

    await service.enableEncryption();
    await service.initialize();

    const exported = service.exportEncryptedState({ a: 1 });

    const parsed = JSON.parse(exported);

    assert.strictEqual(parsed.encryptionEnabled, true);
    assert.deepStrictEqual(parsed.state, { a: 1 });
  });

  it("rotates encryption key", async () => {
    const service = new WorkspaceStateEncryptionService(createMockContext());

    await service.enableEncryption();
    await service.initialize();

    const oldStatus = service.getStatus();

    const newKeyId = await service.rotateKey();

    const newStatus = service.getStatus();

    assert.notStrictEqual(newKeyId, oldStatus.keyId);
    assert.strictEqual(newStatus.rotatedKeysCount, 1);
  });

  it("clears encryption keys", async () => {
    const service = new WorkspaceStateEncryptionService(createMockContext());

    await service.enableEncryption();
    await service.initialize();

    await service.clearEncryptionKeys();

    const status = service.getStatus();

    assert.strictEqual(status.enabled, false);
    assert.strictEqual(status.keyId, null);
  });

  it("dispose wipes sensitive data", async () => {
    const service = new WorkspaceStateEncryptionService(createMockContext());

    await service.enableEncryption();
    await service.initialize();

    service.dispose();

    const status = service.getStatus();

    assert.strictEqual(status.keyId, null);
  });

});
