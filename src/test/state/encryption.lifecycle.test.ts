import * as vscode from 'vscode';
import { WorkspaceStateEncryptionService } from '../../services/workspaceStateEncryptionService';
import { MockMemento } from '../utils/memento.mock';

class MockSecrets {
  private storeMap = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.storeMap.get(key);
  }

  async store(key: string, value: string): Promise<void> {
    this.storeMap.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.storeMap.delete(key);
  }
}

function createContext(): vscode.ExtensionContext {
  return {
    globalState: new MockMemento() as any,
    workspaceState: new MockMemento() as any,
    secrets: new MockSecrets() as any,
    subscriptions: []
  } as any;
}

describe('WorkspaceStateEncryptionService', () => {
  let context: vscode.ExtensionContext;
  let service: WorkspaceStateEncryptionService;

  beforeEach(async () => {
    context = createContext();
    service = new WorkspaceStateEncryptionService(context);
    await service.enableEncryption();
  });

  test('encrypt → decrypt roundtrip', () => {
    const value = { hello: 'world', n: 42 };
    const encrypted = service.encrypt(value);
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toEqual(value);
  });

  test('encryptObject only encrypts selected fields', () => {
    const obj = { a: 1, secret: 'x' };
    const result = service.encryptObject(obj, ['secret']);
    expect(result.a).toBe(1);
    expect(result.secret).not.toBe('x');
  });

  test('decryptObject restores encrypted fields', () => {
    const encrypted = service.encryptObject({ secret: 'abc' }, ['secret']);
    const decrypted = service.decryptObject(encrypted, ['secret']);
    expect(decrypted.secret).toBe('abc');
  });

  test('key rotation updates metadata', async () => {
    const before = service.getStatus().keyId;
    const after = await service.rotateKey();
    expect(after).not.toBe(before);
    expect(service.getStatus().rotatedKeysCount).toBeGreaterThanOrEqual(1);
  });

  test('exportEncryptedState returns JSON', () => {
    const json = service.exportEncryptedState({ foo: 'bar' });
    expect(typeof json).toBe('string');
    expect(JSON.parse(json).state.foo).toBe('bar');
  });

  test('clearEncryptionKeys disables encryption', async () => {
    await service.clearEncryptionKeys();
    expect(service.isEncryptionEnabled()).toBe(false);
  });
});
