import { describe, expect, it } from "vitest";

import { redactSecrets } from "./redact.js";

describe("redactSecrets", () => {
  it("redacts top-level secret keys", () => {
    const result = redactSecrets({ name: "Acme", password: "hunter2" });
    expect(result).toEqual({ name: "Acme", password: "[REDACTED]" });
  });

  it("redacts every common secret-key alias", () => {
    const result = redactSecrets({
      password: "p",
      passwd: "p",
      secret: "s",
      token: "t",
      api_key: "a",
      "api-key": "a",
      x_api_key: "x",
      "x-api-key": "x",
      otp: "o",
      private_key: "pk",
      "private-key": "pk",
    }) as Record<string, string>;
    for (const v of Object.values(result)) expect(v).toBe("[REDACTED]");
  });

  it("is case-insensitive on keys", () => {
    expect(redactSecrets({ Password: "p", TOKEN: "t" })).toEqual({
      Password: "[REDACTED]",
      TOKEN: "[REDACTED]",
    });
  });

  it("does not redact innocent keys", () => {
    expect(redactSecrets({ name: "ok", count: 42, archived: false })).toEqual({
      name: "ok",
      count: 42,
      archived: false,
    });
  });

  it("recurses into nested objects", () => {
    const input = { outer: { inner: { token: "tok" } } };
    expect(redactSecrets(input)).toEqual({ outer: { inner: { token: "[REDACTED]" } } });
  });

  it("recurses into arrays", () => {
    const input = { errors: [{ source: { pointer: "/data" }, secret: "s" }] };
    expect(redactSecrets(input)).toEqual({
      errors: [{ source: { pointer: "/data" }, secret: "[REDACTED]" }],
    });
  });

  it("does not touch values whose key is innocent even if value contains the word password", () => {
    expect(redactSecrets({ detail: "Invalid password" })).toEqual({
      detail: "Invalid password",
    });
  });

  it("returns primitives unchanged", () => {
    expect(redactSecrets("hello")).toBe("hello");
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets(null)).toBeNull();
    expect(redactSecrets(undefined)).toBeUndefined();
  });
});
