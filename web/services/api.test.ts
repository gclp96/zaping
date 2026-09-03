import { afterEach, describe, expect, it, vi } from "vitest";

import { api, resolveApiBaseUrl } from "./api";

type AxiosRejectedHandler = (error: unknown) => Promise<never>;

function getResponseRejectedHandler() {
  const interceptors = api.interceptors.response as unknown as {
    handlers: Array<{
      rejected?: AxiosRejectedHandler;
    }>;
  };

  const rejected = interceptors.handlers[0]?.rejected;

  if (!rejected) {
    throw new Error("Missing response rejected interceptor");
  }

  return rejected;
}

function axiosError(status: number) {
  return {
    isAxiosError: true,
    response: {
      status,
      data: {
        message: "Error",
      },
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.pushState(null, "", "/");
});

describe("api response interceptor", () => {
  it("does not clear the current session for form-level 400 errors", async () => {
    const rejected = getResponseRejectedHandler();
    localStorage.setItem("token", "valid-token");
    window.history.pushState(null, "", "/change-password");

    await expect(rejected(axiosError(400))).rejects.toMatchObject({
      response: {
        status: 400,
      },
    });

    expect(localStorage.getItem("token")).toBe("valid-token");
    expect(window.location.pathname).toBe("/change-password");
  });

  it("clears the current session for 401 authentication errors", async () => {
    const rejected = getResponseRejectedHandler();
    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");
    localStorage.setItem("token", "expired-token");
    window.history.pushState(null, "", "/login");

    await expect(rejected(axiosError(401))).rejects.toMatchObject({
      response: {
        status: 401,
      },
    });

    expect(removeItemSpy).toHaveBeenCalledWith("token");
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("preserves the current session and route for 403 authorization errors", async () => {
    const rejected = getResponseRejectedHandler();
    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");
    localStorage.setItem("token", "valid-token");
    window.history.pushState(null, "", "/sales");

    await expect(rejected(axiosError(403))).rejects.toMatchObject({
      response: {
        status: 403,
      },
    });

    expect(removeItemSpy).not.toHaveBeenCalledWith("token");
    expect(localStorage.getItem("token")).toBe("valid-token");
    expect(window.location.pathname).toBe("/sales");
  });
});

describe("api base URL", () => {
  it("uses a configured public API URL", () => {
    expect(
      resolveApiBaseUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "https://api.example.test/",
      }),
    ).toBe("https://api.example.test");
  });

  it("uses the localhost API fallback outside production", () => {
    expect(
      resolveApiBaseUrl({
        NODE_ENV: "development",
        NEXT_PUBLIC_API_URL: undefined,
      }),
    ).toBe("http://localhost:3001");
  });

  it("fails explicitly when production has no public API URL", () => {
    expect(() =>
      resolveApiBaseUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: undefined,
      }),
    ).toThrow("NEXT_PUBLIC_API_URL must be defined in production");
  });

  it("rejects a configured non-HTTP API URL", () => {
    expect(() =>
      resolveApiBaseUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "javascript:alert(1)",
      }),
    ).toThrow("NEXT_PUBLIC_API_URL must be a valid HTTP(S) URL");
  });

  it("rejects an HTTP API URL in production", () => {
    expect(() =>
      resolveApiBaseUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "http://api.example.test",
      }),
    ).toThrow("NEXT_PUBLIC_API_URL must use HTTPS in production");
  });
});
