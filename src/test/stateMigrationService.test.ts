import * as assert from "assert";
import { StateMigrationService } from "../services/stateMigrationService";
import { MockMemento } from "./mocks/mockMemento";

describe("State Migration", () => {

  it("runs registered migrations", async () => {
    const state = new MockMemento();
    const service = new StateMigrationService(state as any, console as any);

    service.registerMigration({
      version: 1,
      name: "init",
      up: async s => s.update("done", true),
      down: async () => {}
    });

    await service.runMigrations();

    assert.strictEqual(state.get("done"), true);
  });

});
