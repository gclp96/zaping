import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ChangePasswordPage from "./page";
import { api } from "@/services/api";

vi.mock("@/services/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

function apiError(message: string) {
  return {
    isAxiosError: true,
    response: {
      data: {
        message,
      },
    },
  };
}

function getCurrentPasswordInput() {
  return screen.getByLabelText(/Contraseña actual/) as HTMLInputElement;
}

function getNewPasswordInput() {
  return screen.getByLabelText(/^Nueva contraseña/) as HTMLInputElement;
}

function getConfirmPasswordInput() {
  return screen.getByLabelText(/Confirmar nueva contraseña/) as HTMLInputElement;
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(getCurrentPasswordInput(), "current-password");
  await user.type(getNewPasswordInput(), "new-secure-password");
  await user.type(getConfirmPasswordInput(), "new-secure-password");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.post).mockResolvedValue({
    data: {
      success: true,
      message: "Contraseña actualizada",
    },
  } as never);
});

afterEach(() => {
  cleanup();
});

describe("ChangePasswordPage", () => {
  it("renders the three password fields with password-manager semantics", () => {
    render(<ChangePasswordPage />);

    expect(screen.getByRole("heading", { name: "Cambiar contraseña" })).toBeTruthy();
    expect(getCurrentPasswordInput().type).toBe("password");
    expect(getNewPasswordInput().type).toBe("password");
    expect(getConfirmPasswordInput().type).toBe("password");
    expect(getCurrentPasswordInput().autocomplete).toBe("current-password");
    expect(getNewPasswordInput().autocomplete).toBe("new-password");
    expect(getConfirmPasswordInput().autocomplete).toBe("new-password");
  });

  it("validates required fields before submitting", async () => {
    const user = userEvent.setup();

    render(<ChangePasswordPage />);
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(screen.getByText("La contraseña actual es obligatoria.")).toBeTruthy();
    expect(screen.getByText("La nueva contraseña es obligatoria.")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("validates minimum length, confirmation mismatch, and same password", async () => {
    const user = userEvent.setup();

    render(<ChangePasswordPage />);
    await user.type(getCurrentPasswordInput(), "current-password");
    await user.type(getNewPasswordInput(), "1234567");
    await user.type(getConfirmPasswordInput(), "7654321");
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(
      screen.getByText("La nueva contraseña debe tener al menos 8 caracteres."),
    ).toBeTruthy();
    expect(screen.getByText("Las contraseñas no coinciden.")).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(getNewPasswordInput(), {
      target: { value: "current-password" },
    });
    fireEvent.change(getConfirmPasswordInput(), {
      target: { value: "current-password" },
    });
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(
      screen.getByText("La nueva contraseña debe ser diferente de la actual."),
    ).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("sends only currentPassword and newPassword to the API", async () => {
    const user = userEvent.setup();

    render(<ChangePasswordPage />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/change-password", {
        currentPassword: "current-password",
        newPassword: "new-secure-password",
      });
    });
    expect(Object.keys(vi.mocked(api.post).mock.calls[0][1] as object)).toEqual([
      "currentPassword",
      "newPassword",
    ]);
  });

  it("clears password fields and shows success after update", async () => {
    const user = userEvent.setup();

    render(<ChangePasswordPage />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(
      await screen.findByText("Tu contraseña se actualizó correctamente."),
    ).toBeTruthy();
    expect(getCurrentPasswordInput().value).toBe("");
    expect(getNewPasswordInput().value).toBe("");
    expect(getConfirmPasswordInput().value).toBe("");
  });

  it("displays safe API errors", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(
      apiError("La contraseña actual no es correcta."),
    );

    render(<ChangePasswordPage />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(
      await screen.findByText("La contraseña actual no es correcta."),
    ).toBeTruthy();
  });

  it("prevents double submission while the request is pending", async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: unknown) => void = () => undefined;
    vi.mocked(api.post).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as never,
    );

    render(<ChangePasswordPage />);
    await fillValidForm(user);
    const submitButton = screen.getByRole("button", {
      name: "Cambiar contraseña",
    });

    await user.click(submitButton);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    await user.click(submitButton);
    expect(api.post).toHaveBeenCalledTimes(1);

    resolveRequest({ data: { success: true } });
    await screen.findByText("Tu contraseña se actualizó correctamente.");
  });
});
