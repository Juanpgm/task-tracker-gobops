import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiClient } from "./api-client";

describe("ApiClient base URL normalization", () => {
  afterEach(() => vi.restoreAllMocks());

  async function urlFor(base: string, path: string) {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await new ApiClient(base).get(path);
    return String(spy.mock.calls[0][0]);
  }

  it.each([
    ["https://h.app/", "https://h.app/avanzadas"],
    ["https://h.app//", "https://h.app/avanzadas"],
    ["https://h.app", "https://h.app/avanzadas"],
    ["/api/auth/", "/api/auth/avanzadas"],
    ["/api/auth", "/api/auth/avanzadas"],
  ])("base %s never yields a double slash", async (base, expected) => {
    expect(await urlFor(base, "/avanzadas")).toBe(expected);
  });
});
