import * as assert from "assert";
import { StateBackupService, BackupEntry } from "../services/stateBackupService";
import { MockMemento } from "./mocks/mockMemento";

function createContext(state: MockMemento) {
  return { workspaceState: state };
}

describe("StateBackupService", () => {

  it("creates a manual backup", async () => {
    const state = new MockMemento();
    await state.update("foo", "bar");

    const service = new StateBackupService(createContext(state));

    const entry = await service.createBackup("manual");

    assert.ok(entry.id);
    assert.strictEqual(entry.trigger, "manual");
    assert.strictEqual(entry.status, "valid");
    assert.strictEqual(entry.snapshot["foo"], "bar");
  });

  it("restores from backup", async () => {
    const state = new MockMemento();
    await state.update("a", 1);

    const service = new StateBackupService(createContext(state));

    const entry = await service.createBackup("manual");

    await state.update("a", 999);

    const result = await service.restoreFromBackup(entry.id);

    assert.strictEqual(result.success, true);
    assert.strictEqual(state.get("a"), 1);
  });

  it("fails restore when backup missing", async () => {
    const state = new MockMemento();
    const service = new StateBackupService(createContext(state));

    const result = await service.restoreFromBackup("missing");

    assert.strictEqual(result.success, false);
  });

  it("detects corrupted backup", async () => {
    const state = new MockMemento();
    await state.update("x", 42);

    const service = new StateBackupService(createContext(state));
    const entry = await service.createBackup("manual");

    // corrupt snapshot
    const corrupted: BackupEntry = {
      ...entry,
      checksum: "deadbeef"
    };

    const integrity = service.validateBackupIntegrity(corrupted);

    assert.strictEqual(integrity.valid, false);
  });

  it("validates all backups and marks corrupted", async () => {
    const state = new MockMemento();
    await state.update("k", "v");

    const service = new StateBackupService(createContext(state));
    const entry = await service.createBackup("manual");

    // manually corrupt stored backup
    const backups = service.getAllBackups();
    backups[0].checksum = "bad";

    await state.update("stellarSuite.stateBackups", backups);

    const stats = await service.validateAllBackups();

    assert.strictEqual(stats.total, 1);
    assert.strictEqual(stats.corrupted, 1);
  });

  it("exports and imports backups", async () => {
    const state = new MockMemento();
    await state.update("data", 123);

    const service = new StateBackupService(createContext(state));

    await service.createBackup("manual");

    const exported = service.exportBackups();

    const newState = new MockMemento();
    const newService = new StateBackupService(createContext(newState));

    const result = await newService.importBackups(exported);

    assert.strictEqual(result.imported, 1);
    assert.strictEqual(newService.getBackupCount(), 1);
  });

});
