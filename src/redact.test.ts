import { describe, expect, it } from "vitest";

import { redactErrorString, redactSecrets } from "./redact.js";

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

  it("does not touch a label-only mention of a secret name", () => {
    expect(redactSecrets({ detail: "Invalid password" })).toEqual({
      detail: "Invalid password",
    });
  });

  it("redacts secret values embedded in error-text strings (detail/message/title/error)", () => {
    expect(
      redactSecrets({
        errors: [
          { title: "Validation failed", detail: "password hunter2 is invalid and token abc123 expired" },
        ],
      }),
    ).toEqual({
      errors: [
        {
          title: "Validation failed",
          detail: "password [REDACTED] is invalid and token [REDACTED] expired",
        },
      ],
    });
  });

  it("applies free-text redaction to top-level message and error fields", () => {
    expect(
      redactSecrets({ message: "api_key=sk-abc123 invalid", error: "token tok-1 expired" }),
    ).toEqual({
      message: "api_key=[REDACTED] invalid",
      error: "token [REDACTED] expired",
    });
  });

  it("returns primitives unchanged", () => {
    expect(redactSecrets("hello")).toBe("hello");
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets(null)).toBeNull();
    expect(redactSecrets(undefined)).toBeUndefined();
  });
});

describe("redactErrorString", () => {
  it("masks free-text password value after the label", () => {
    expect(redactErrorString("password hunter2 is invalid")).toBe(
      "password [REDACTED] is invalid",
    );
  });

  it("masks token value with colon separator", () => {
    expect(redactErrorString("token: tok-456 expired")).toBe("token: [REDACTED] expired");
  });

  it("masks api_key with equals separator", () => {
    expect(redactErrorString("api_key=sk-abc123")).toBe("api_key=[REDACTED]");
  });

  it("masks quoted secret values", () => {
    expect(redactErrorString(`password "hunter2" is invalid`)).toBe(
      `password "[REDACTED]" is invalid`,
    );
    expect(redactErrorString(`token 'tok-1'`)).toBe(`token '[REDACTED]'`);
  });

  it("does not touch label alone with no following value", () => {
    expect(redactErrorString("Invalid password")).toBe("Invalid password");
  });

  it("does not match inside larger words", () => {
    expect(redactErrorString("passwords are required")).toBe("passwords are required");
  });

  it("masks multiple secrets in same string", () => {
    expect(redactErrorString("password p1 and token t1")).toBe(
      "password [REDACTED] and token [REDACTED]",
    );
  });
});
