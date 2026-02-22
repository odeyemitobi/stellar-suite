import { StateBackupService, BackupEntry } from "../services/stateBackupService";

/**
 * In-memory mock of VS Code workspaceState
 */
function createMockWorkspaceState(initial: Record<string, any> = {}) {
  const store = { ...initial };

  return {
    get: jest.fn((key: string, def: any) =>
      key in store ? store[key] : def
    ),
    update: jest.fn(async (key: string, value: any) => {
      store[key] = value;
    }),
    keys: jest.fn(() => Object.keys(store)),
    _store: store,
  };
}

function createService(initialState: Record<string, any> = {}) {
  const workspaceState = createMockWorkspaceState(initialState);

  const context = {
    workspaceState,
  };

  const service = new StateBackupService(context as any);

  return { service, workspaceState };
}

describe("StateBackupService", () => {
  test("creates a manual backup", async () => {
    const { service } = createService({
      key1: "value1",
      key2: 42,
    });

    const backup = await service.createBackup("manual");

    expect(backup.id).toBeDefined();
    expect(backup.trigger).toBe("manual");
    expect(backup.snapshot.key1).toBe("value1");
    expect(backup.status).toBe("valid");
    expect(backup.sizeBytes).toBeGreaterThan(0);
  });

  test("captures workspace state snapshot", async () => {
    const { service } = createService({
      a: 1,
      b: 2,
    });

    const backup = await service.createBackup("manual");

    expect(backup.snapshot).toEqual({ a: 1, b: 2 });
  });

  test("restores from backup", async () => {
    const { service, workspaceState } = createService({
      a: 1,
    });

    const backup = await service.createBackup("manual");

    workspaceState.update.mockClear();

    const result = await service.restoreFromBackup(backup.id);

    expect(result.success).toBe(true);
    expect(result.restoredKeys).toContain("a");
    expect(workspaceState.update).toHaveBeenCalled();
  });

  test("fails restore if backup not found", async () => {
    const { service } = createService();

    const result = await service.restoreFromBackup("missing");

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("validates backup integrity", async () => {
    const { service } = createService({ x: 10 });

    const backup = await service.createBackup("manual");

    const validation = service.validateBackupIntegrity(backup);

    expect(validation.valid).toBe(true);
  });

  test("detects corrupted backup", async () => {
    const { service } = createService({ x: 10 });

    const backup = await service.createBackup("manual");

    // corrupt snapshot
    backup.snapshot["x"] = 999;

    const validation = service.validateBackupIntegrity(backup);

    expect(validation.valid).toBe(false);
  });

  test("stores and retrieves backups", async () => {
    const { service } = createService();

    await service.createBackup("manual");
    await service.createBackup("auto");

    const backups = service.getAllBackups();

    expect(backups.length).toBe(2);
  });

  test("filters backups by trigger", async () => {
    const { service } = createService();

    await service.createBackup("manual");
    await service.createBackup("auto");

    const manual = service.getBackupsByTrigger("manual");

    expect(manual.length).toBe(1);
  });

  test("deletes backup", async () => {
    const { service } = createService();

    const backup = await service.createBackup("manual");

    const deleted = await service.deleteBackup(backup.id);

    expect(deleted).toBe(true);
    expect(service.getBackupCount()).toBe(0);
  });

  test("clears all backups", async () => {
    const { service } = createService();

    await service.createBackup("manual");
    await service.clearAllBackups();

    expect(service.getBackupCount()).toBe(0);
  });

  test("labels backup", async () => {
    const { service } = createService();

    const backup = await service.createBackup("manual");

    const labeled = await service.labelBackup(backup.id, "Important");

    expect(labeled).toBe(true);

    const updated = service.getBackup(backup.id) as BackupEntry;

    expect(updated.label).toBe("Important");
  });

  test("exports and imports backups", async () => {
    const { service } = createService({ x: 1 });

    await service.createBackup("manual");

    const exported = service.exportBackups();

    const { service: newService } = createService();

    const result = await newService.importBackups(exported);

    expect(result.imported).toBe(1);
    expect(newService.getBackupCount()).toBe(1);
  });

  test("skips duplicate imports", async () => {
    const { service } = createService();

    await service.createBackup("manual");

    const data = service.exportBackups();

    const result = await service.importBackups(data);

    expect(result.skipped).toBeGreaterThan(0);
  });

  test("validates all backups", async () => {
    const { service } = createService({ a: 1 });

    await service.createBackup("manual");

    const stats = await service.validateAllBackups();

    expect(stats.valid).toBe(1);
    expect(stats.corrupted).toBe(0);
  });

  test("returns backup statistics", async () => {
    const { service } = createService();

    await service.createBackup("manual");
    await service.createBackup("auto");
    await service.createBackup("pre-operation");

    const stats = service.getStatistics();

    expect(stats.totalBackups).toBe(3);
    expect(stats.manualCount).toBe(1);
    expect(stats.autoCount).toBe(1);
    expect(stats.preOperationCount).toBe(1);
  });

  test("handles invalid import JSON", async () => {
    const { service } = createService();

    await expect(service.importBackups("invalid-json"))
      .rejects
      .toThrow();
  });
});
