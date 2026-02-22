import * as vscode from 'vscode';
import { WorkspaceStateEncryptionService } from '../../services/workspaceStateEncryptionService';
import { MockMemento } from '../utils/memento.mock';

class MockSecrets {
  private map = new Map<string, string>();

  async get(k: string) { return this.map.get(k); }
  async store(k: string, v: string) { this.map.set(k, v); }
  async delete(k: string) { this.map.delete(k); }
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
  let service: WorkspaceStateEncryptionService;

  beforeEach(async () => {
    service = new WorkspaceStateEncryptionService(createContext());
    await service.enableEncryption();
  });

  test('encrypt → decrypt roundtrip', () => {
    const data = { foo: 'bar' };

    const encrypted = service.encrypt(data);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toEqual(data);
  });

  test('fails with tampered ciphertext', () => {
    const encrypted = service.encrypt({ foo: 'bar' });

    encrypted.ciphertext =
      encrypted.ciphertext.slice(0, -4) + 'AAAA';

    expect(() => service.decrypt(encrypted)).toThrow();
  });

  test('fails with wrong key', async () => {
    const encrypted = service.encrypt({ foo: 'bar' });

    const other = new WorkspaceStateEncryptionService(createContext());
    await other.enableEncryption();

    (other as any).key = Buffer.from('badkeybadkeybadkeybadkey');

    expect(() => other.decrypt(encrypted)).toThrow();
  });

  test('includes metadata', () => {
    const encrypted = service.encrypt({ test: true });

    expect(encrypted.version).toBeDefined();
    expect(encrypted.algorithm).toBeDefined();
    expect(encrypted.timestamp).toBeDefined();
  });
});
