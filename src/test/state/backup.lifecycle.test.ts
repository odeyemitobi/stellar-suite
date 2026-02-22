import { StateBackupService } from '../../services/stateBackupService';
import { MockMemento } from '../utils/memento.mock';

function createContext() {
  return { workspaceState: new MockMemento() };
}

describe('StateBackupService', () => {
  let ctx: any;
  let service: StateBackupService;

  beforeEach(() => {
    ctx = createContext();
    ctx.workspaceState.update('a', 1);
    ctx.workspaceState.update('b', 2);
    service = new StateBackupService(ctx);
  });

  test('creates backup with snapshot', async () => {
    const backup = await service.createBackup('manual');
    expect(backup.snapshot.a).toBe(1);
    expect(backup.status).toBe('valid');
  });

  test('restore restores keys', async () => {
    const backup = await service.createBackup('manual');
    await ctx.workspaceState.update('a', 999);

    const result = await service.restoreFromBackup(backup.id);

    expect(result.success).toBe(true);
    expect(ctx.workspaceState.get('a', 0)).toBe(1);
  });

  test('detects checksum corruption', async () => {
    const backup = await service.createBackup('manual');
    backup.snapshot['a'] = 999;

    const result = service.validateBackupIntegrity(backup);
    expect(result.valid).toBe(false);
  });

  test('export and import backups', async () => {
    await service.createBackup('manual');
    const exported = service.exportBackups();

    const other = new StateBackupService(createContext());
    const res = await other.importBackups(exported);

    expect(res.imported).toBe(1);
  });
});