import { StateMigrationService, Migration } from '../../services/stateMigrationService';
import { MockMemento } from '../utils/memento.mock';

function output() {
  return {
    appendLine: () => {},
    dispose: () => {}
  } as any;
}

describe('StateMigrationService engine', () => {
  test('runs migrations in version order', async () => {
    const state = new MockMemento();

    const svc = new StateMigrationService(state as any, output());

    const applied: number[] = [];

    const m1: Migration = {
      version: 1,
      name: 'm1',
      up: () => { applied.push(1); },
      down: () => {},
    };

    const m2: Migration = {
      version: 2,
      name: 'm2',
      up: () => { applied.push(2); },
      down: () => {},
    };

    svc.registerMigrations([m2, m1]);

    const ok = await svc.runMigrations();

    expect(ok).toBe(true);
    expect(applied).toEqual([1, 2]);
    expect(svc.getCurrentVersion()).toBe(2);
  });
});
