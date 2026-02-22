import * as vscode from 'vscode';
import { WorkspaceStateSyncService, ConflictResolutionStrategy } from '../../services/workspaceStateSyncService';
import { MockMemento } from '../utils/memento.mock';

function ctx(): vscode.ExtensionContext {
  return {
    globalState: new MockMemento() as any,
    workspaceState: new MockMemento() as any,
    subscriptions: []
  } as any;
}

describe('WorkspaceStateSyncService', () => {
  let service: WorkspaceStateSyncService;

  beforeEach(() => {
    service = new WorkspaceStateSyncService(ctx());
  });

  test('validateState passes valid state', async () => {
    const result = await service.validateState();
    expect(result.valid).toBe(true);
  });

  test('LOCAL_WINS conflict resolution', () => {
    const resolved = service.resolveConflict({
      key: 'x',
      type: 'configuration',
      local: 1,
      remote: 2,
      timestamp: Date.now(),
      strategy: ConflictResolutionStrategy.LOCAL_WINS
    });
    expect(resolved).toBe(1);
  });

  test('REMOTE_WINS conflict resolution', () => {
    const resolved = service.resolveConflict({
      key: 'x',
      type: 'configuration',
      local: 1,
      remote: 2,
      timestamp: Date.now(),
      strategy: ConflictResolutionStrategy.REMOTE_WINS
    });
    expect(resolved).toBe(2);
  });
});