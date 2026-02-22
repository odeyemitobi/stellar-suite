import * as assert from "assert";
import { validateStateIntegrity } from "../utils/stateIntegrity";

suite("State Validation", () => {
  test("valid state passes integrity check", () => {
    const valid = { version: 1, items: [] };
    assert.strictEqual(validateStateIntegrity(valid), true);
  });

  test("missing required fields fails", () => {
    const invalid = {};
    assert.strictEqual(validateStateIntegrity(invalid), false);
  });

  test("detects corrupted JSON structure", () => {
    const corrupted = { version: "invalid" };
    assert.strictEqual(validateStateIntegrity(corrupted), false);
  });
});
