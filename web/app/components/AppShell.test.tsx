import { useEffect } from "react";

import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearAuthenticatedSessionCache,
  type AuthenticatedSession,
} from "@/app/auth-session";
import { api } from "@/services/api";

import AppShell from "./AppShell";

const navigationMock = vi.hoisted(() => ({
  pathname: "/products",
  replace: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationMock.pathname,
  useRouter: () => navigationMock,
}));

const adminSession: AuthenticatedSession = {
  id: "admin-1",
  companyId: "company-1",
  email: "admin@test.test",
  firstName: "Admin",
  lastName: "Test",
  role: "ADMIN",
  companyTimezone: "America/Hermosillo",
};

const salesSession: AuthenticatedSession = {
  ...adminSession,
  id: "sales-1",
  email: "sales@test.test",
  firstName: "Sales",
  role: "SALES",
};

function axiosError(status: number) {
  return {
    isAxiosError: true,
    response: {
      status,
      data: { message: `HTTP ${status}` },
    },
  };
}

function mockAuthSuccess(session: AuthenticatedSession = adminSession) {
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (String(url) === "/auth/me") {
      return { data: session } as never;
    }

    throw new Error(`Unexpected endpoint ${String(url)}`);
  });
}

function renderShell(child = <div data-testid="protected-child">Protected child</div>) {
  return render(<AppShell>{child}</AppShell>);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("AppShell session gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAuthenticatedSessionCache();
    window.localStorage.clear();
    navigationMock.pathname = "/products";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    clearAuthenticatedSessionCache();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("redirects without calling auth/me or rendering protected children when no token exists", async () => {
    mockAuthSuccess();

    renderShell();

    await waitFor(() => {
      expect(navigationMock.replace).toHaveBeenCalledWith("/login");
    });

    expect(api.get).not.toHaveBeenCalled();
    expect(screen.queryByTestId("protected-child")).toBeNull();
    expect(screen.queryByRole("link", { name: "Usuarios" })).toBeNull();
  });

  it("withholds the shell and children while auth/me is pending", () => {
    const authRequest = deferred<{ data: AuthenticatedSession }>();
    window.localStorage.setItem("token", "valid-token");
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === "/auth/me") {
        return authRequest.promise as never;
      }

      throw new Error(`Unexpected endpoint ${String(url)}`);
    });

    renderShell();

    expect(screen.getByRole("status").textContent).toContain(
      "Cargando sesión...",
    );
    expect(screen.queryByTestId("protected-child")).toBeNull();
    expect(screen.queryByRole("link", { name: "Usuarios" })).toBeNull();

    authRequest.resolve({ data: adminSession });
  });

  it("renders an ADMIN shell only after auth/me succeeds", async () => {
    window.localStorage.setItem("token", "valid-token");
    mockAuthSuccess();

    renderShell();

    expect(await screen.findByTestId("protected-child")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Usuarios" })).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/auth/me");
  });

  it("renders the role-aware SALES navigation after auth/me succeeds", async () => {
    window.localStorage.setItem("token", "valid-token");
    mockAuthSuccess(salesSession);

    renderShell();

    expect(await screen.findByTestId("protected-child")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ventas" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Usuarios" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Compras" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Equipos" })).toBeNull();
  });

  it("redirects on a structured 401 without rendering the protected child", async () => {
    window.localStorage.setItem("token", "expired-token");
    vi.mocked(api.get).mockRejectedValueOnce(axiosError(401));

    renderShell();

    await waitFor(() => {
      expect(navigationMock.replace).toHaveBeenCalledWith("/login");
    });

    expect(screen.queryByTestId("protected-child")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("preserves the session and does not redirect on a structured 403", async () => {
    window.localStorage.setItem("token", "valid-token");
    vi.mocked(api.get).mockRejectedValueOnce(axiosError(403));

    renderShell();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(navigationMock.replace).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("token")).toBe("valid-token");
    expect(screen.queryByTestId("protected-child")).toBeNull();
  });

  it("preserves the token on a network error and authenticates after an explicit retry", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("token", "valid-token");
    let requestCount = 0;
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) !== "/auth/me") {
        throw new Error(`Unexpected endpoint ${String(url)}`);
      }

      requestCount += 1;
      if (requestCount === 1) {
        throw new Error("Network unavailable");
      }

      return { data: adminSession } as never;
    });

    renderShell();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(window.localStorage.getItem("token")).toBe("valid-token");
    expect(navigationMock.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("protected-child")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByTestId("protected-child")).toBeTruthy();
    expect(requestCount).toBe(2);
    expect(navigationMock.replace).not.toHaveBeenCalled();
  });

  it("preserves the token and blocks the shell on a structured 5xx", async () => {
    window.localStorage.setItem("token", "valid-token");
    vi.mocked(api.get).mockRejectedValueOnce(axiosError(503));

    renderShell();

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(window.localStorage.getItem("token")).toBe("valid-token");
    expect(navigationMock.replace).not.toHaveBeenCalled();
    expect(screen.queryByTestId("protected-child")).toBeNull();
  });

  it("does not fetch protected child data before auth bootstrap completes", async () => {
    const authRequest = deferred<{ data: AuthenticatedSession }>();
    let childRequestCount = 0;
    window.localStorage.setItem("token", "valid-token");
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === "/auth/me") {
        return authRequest.promise as never;
      }

      if (String(url) === "/protected-child-data") {
        childRequestCount += 1;
        return { data: [] } as never;
      }

      throw new Error(`Unexpected endpoint ${String(url)}`);
    });

    function ProtectedChild() {
      useEffect(() => {
        void api.get("/protected-child-data");
      }, []);

      return <div data-testid="protected-child">Protected child</div>;
    }

    renderShell(<ProtectedChild />);

    expect(childRequestCount).toBe(0);
    expect(screen.queryByTestId("protected-child")).toBeNull();

    authRequest.resolve({ data: adminSession });

    expect(await screen.findByTestId("protected-child")).toBeTruthy();
    await waitFor(() => expect(childRequestCount).toBe(1));
  });

  it("does not flash ADMIN navigation while a SALES session is bootstrapping", async () => {
    const authRequest = deferred<{ data: AuthenticatedSession }>();
    window.localStorage.setItem("token", "valid-token");
    vi.mocked(api.get).mockImplementation(async (url) => {
      if (String(url) === "/auth/me") {
        return authRequest.promise as never;
      }

      throw new Error(`Unexpected endpoint ${String(url)}`);
    });

    renderShell();

    expect(screen.queryByRole("link", { name: "Usuarios" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Compras" })).toBeNull();

    authRequest.resolve({ data: salesSession });

    expect(await screen.findByRole("link", { name: "Ventas" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Usuarios" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Compras" })).toBeNull();
  });
});
