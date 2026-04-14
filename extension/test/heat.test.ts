import { describe, it, expect } from "vitest";
import { calculateHeat } from "../src/heat.js";

describe("heat", () => {
  describe("calculateHeat", () => {
    it("returns hot when any source is in projects/", () => {
      expect(calculateHeat(["projects/learn-rust/ch1.md"])).toBe("hot");
    });

    it("returns hot when any source is in areas/", () => {
      expect(calculateHeat(["areas/health/sleep.md"])).toBe("hot");
    });

    it("returns cold when all sources are in archives/", () => {
      expect(calculateHeat(["archives/old/doc.md"])).toBe("cold");
    });

    it("returns hot when mixed sources include active ones", () => {
      expect(calculateHeat(["archives/old/doc.md", "projects/new/doc.md"])).toBe("hot");
    });

    it("returns hot for resources/ (reference material is accessible)", () => {
      expect(calculateHeat(["resources/cooking/bread.md"])).toBe("hot");
    });

    it("returns cold for empty sources", () => {
      expect(calculateHeat([])).toBe("cold");
    });
  });
});
