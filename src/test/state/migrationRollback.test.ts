import { StateMigrationService, Migration } from '../../services/stateMigrationService';
import { MockMemento } from '../utils/memento.mock';

function output() {
  return {
    appendLine: () => {},
    dispose: () => {}
  } as any;
}

describe('StateMigrationService rollback', () => {
  test('rolls back when migration fails', async () => {
    const state = new MockMemento();
    const svc = new StateMigrationService(state as any, output());

    let rolledBack = false;

    const failing: Migration = {
      version: 1,
      name: 'fail',
      up: () => { throw new Error('boom'); },
      down: () => { rolledBack = true; }
    };

    svc.registerMigration(failing);

    const ok = await svc.runMigrations();

    expect(ok).toBe(false);
    expect(rolledBack).toBe(true);
    expect(svc.getCurrentVersion()).toBe(0);
  });
});
