import { describe, expect, it } from "vitest";
import { computeConfidence } from "../confidence";

describe("computeConfidence", () => {
  it("returns high when sample is large and the metric is well past noise", () => {
    expect(computeConfidence(15, 1.8, 1.0)).toBe("high"); // 1.8 > 1.5 * 1.0
  });

  it("returns moderate when sample is large enough but the metric is close to threshold", () => {
    expect(computeConfidence(12, 1.0, 1.0)).toBe("moderate"); // not > 1.5 * noise
    expect(computeConfidence(12, 0.5, 1.0)).toBe("moderate"); // exactly at 0.5 * noise (not under)
  });

  it("returns emerging when the sample is small", () => {
    expect(computeConfidence(7, 5, 0.1)).toBe("emerging");
  });

  it("returns emerging when the metric barely beats noise", () => {
    expect(computeConfidence(20, 0.4, 1.0)).toBe("emerging"); // 0.4 < 0.5 * noise
  });

  it("treats the sample-size boundary correctly (12 → not emerging, 11 → emerging)", () => {
    expect(computeConfidence(12, 0.6, 1.0)).toBe("moderate");
    expect(computeConfidence(11, 0.6, 1.0)).toBe("moderate"); // 11 < 12 but distance not under noise
    expect(computeConfidence(7, 0.6, 1.0)).toBe("emerging");
  });

  it("clamps zero noise without dividing by zero", () => {
    expect(computeConfidence(20, 1, 0)).toBe("high");
  });
});
