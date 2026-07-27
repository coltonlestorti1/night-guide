import { describe, it, expect } from "vitest";
import { scoreLabel } from "./labels";

describe("scoreLabel", () => {
  it("maps the spec's bands", () => {
    expect(scoreLabel(0)).toBe("Quiet");
    expect(scoreLabel(29)).toBe("Quiet");
    expect(scoreLabel(30)).toBe("Building");
    expect(scoreLabel(54)).toBe("Building");
    expect(scoreLabel(55)).toBe("Busy");
    expect(scoreLabel(74)).toBe("Busy");
    expect(scoreLabel(75)).toBe("Hot Now");
    expect(scoreLabel(100)).toBe("Hot Now");
  });

  it("never returns Closed — that is the orchestrator's call", () => {
    for (let i = 0; i <= 100; i++) expect(scoreLabel(i)).not.toBe("Closed");
  });
});
