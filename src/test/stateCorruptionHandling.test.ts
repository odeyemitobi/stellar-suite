import * as assert from "assert";
import { validateObjectStructure } from "../utils/stateIntegrity";

describe("State Corruption Handling", () => {

  it("detects invalid object structure", () => {
    const result = validateObjectStructure(
      { id: 1 },
      { id: "string" },
      ["id"]
    );

    assert.strictEqual(result.valid, false);
  });

});
