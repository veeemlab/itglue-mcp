import { describe, expect, it } from "vitest";

import { isRetryable } from "./client.js";

describe("isRetryable", () => {
  it("retries 429 on every method", () => {
    for (const method of ["GET", "POST", "PATCH", "DELETE", "PUT"]) {
      expect(isRetryable(method, 429)).toBe(true);
    }
  });

  it("retries 408 and 5xx only on idempotent methods", () => {
    for (const status of [408, 500, 502, 503, 504]) {
      expect(isRetryable("GET", status)).toBe(true);
      expect(isRetryable("DELETE", status)).toBe(true);
      expect(isRetryable("HEAD", status)).toBe(true);
      expect(isRetryable("OPTIONS", status)).toBe(true);
      expect(isRetryable("POST", status)).toBe(false);
      expect(isRetryable("PATCH", status)).toBe(false);
      expect(isRetryable("PUT", status)).toBe(false);
    }
  });

  it("does not retry 2xx, 3xx, 4xx (other than 408/429)", () => {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      expect(isRetryable(method, 200)).toBe(false);
      expect(isRetryable(method, 301)).toBe(false);
      expect(isRetryable(method, 400)).toBe(false);
      expect(isRetryable(method, 401)).toBe(false);
      expect(isRetryable(method, 403)).toBe(false);
      expect(isRetryable(method, 404)).toBe(false);
      expect(isRetryable(method, 422)).toBe(false);
    }
  });
});
