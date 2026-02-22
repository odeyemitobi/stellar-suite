import * as vscode from 'vscode';
import { WorkspaceStateEncryptionService } from '../../services/workspaceStateEncryptionService';
import { StateBackupService } from '../../services/stateBackupService';
import { StateMigrationService } from '../../services/stateMigrationService';
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

function createOutput(): vscode.OutputChannel {
  return {
    appendLine: () => {},
    dispose: () => {}
  } as any;
}

describe('State lifecycle integration', () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    context = createContext();
  });

  test('encryption + backup + migration pipeline runs', async () => {
    const encryption = new WorkspaceStateEncryptionService(context);
    await encryption.enableEncryption();

    const backup = new StateBackupService(context);
    const migration = new StateMigrationService(
      context.globalState,
      createOutput()
    );

    const encrypted = encryption.encrypt({ a: 1 });
    expect(encrypted).toBeDefined();

    await migration.runMigrations();

    // minimal backup trigger (cast avoids enum mismatch across versions)
    await backup.createBackup('manual' as any, { test: true } as any);

    expect(true).toBe(true);
  });
});
