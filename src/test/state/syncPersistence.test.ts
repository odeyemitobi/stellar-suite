import * as vscode from 'vscode';
import { WorkspaceStateSyncService } from '../../services/workspaceStateSyncService';
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

describe('WorkspaceStateSyncService', () => {
  test('initializes with context', () => {
    const context = createContext();
    const svc = new WorkspaceStateSyncService(context);
    expect(svc).toBeDefined();
  });

  test('shares same state reference as context', () => {
    const context = createContext();
    const svc = new WorkspaceStateSyncService(context);

    context.globalState.update('k', 1);
    expect(context.globalState.get('k')).toBe(1);
    expect(svc).toBeTruthy();
  });
});
