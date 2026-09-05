"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";
import PageContainer from "@/app/components/ui/layout/PageContainer";
import PageHeader from "@/app/components/ui/layout/PageHeader";
import Section from "@/app/components/ui/layout/Section";
import { api } from "@/services/api";
import { getApiErrorMessage } from "@/services/errors";

type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type ChangePasswordFormErrors = Partial<
  Record<keyof ChangePasswordFormValues, string>
>;

const initialValues: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ChangePasswordPage() {
  const router = useRouter();
  const [values, setValues] =
    useState<ChangePasswordFormValues>(initialValues);
  const [errors, setErrors] = useState<ChangePasswordFormErrors>({});
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function updateValue(field: keyof ChangePasswordFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setApiError("");
    setSuccessMessage("");
  }

  function validateForm() {
    const nextErrors: ChangePasswordFormErrors = {};

    if (!values.currentPassword) {
      nextErrors.currentPassword = "La contraseña actual es obligatoria.";
    }

    if (!values.newPassword) {
      nextErrors.newPassword = "La nueva contraseña es obligatoria.";
    } else if (values.newPassword.length < 8) {
      nextErrors.newPassword =
        "La nueva contraseña debe tener al menos 8 caracteres.";
    }

    if (values.confirmPassword !== values.newPassword) {
      nextErrors.confirmPassword = "Las contraseñas no coinciden.";
    }

    if (
      values.currentPassword &&
      values.newPassword &&
      values.currentPassword === values.newPassword
    ) {
      nextErrors.newPassword =
        "La nueva contraseña debe ser diferente de la actual.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving || !validateForm()) {
      return;
    }

    setSaving(true);
    setApiError("");
    setSuccessMessage("");

    try {
      await api.post("/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      setValues(initialValues);
      setErrors({});
      setSuccessMessage(
        "Tu contraseña se actualizó correctamente. Inicia sesión nuevamente.",
      );
      localStorage.removeItem("token");
      router.replace("/login");
    } catch (error) {
      setApiError(
        getApiErrorMessage(error, "No fue posible cambiar la contraseña."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer size="narrow">
      <PageHeader
        title="Cambiar contraseña"
        description="Actualiza la contraseña que usas para acceder a Zaping."
      />

      <Section>
        <form
          noValidate
          className="space-y-5 rounded-lg border border-border bg-surface p-6"
          onSubmit={handleSubmit}
        >
          <Input
            label="Contraseña actual"
            type="password"
            value={values.currentPassword}
            required
            autoComplete="current-password"
            error={errors.currentPassword}
            disabled={saving}
            onChange={(event) =>
              updateValue("currentPassword", event.target.value)
            }
          />

          <Input
            label="Nueva contraseña"
            type="password"
            value={values.newPassword}
            required
            minLength={8}
            autoComplete="new-password"
            error={errors.newPassword}
            disabled={saving}
            onChange={(event) => updateValue("newPassword", event.target.value)}
          />

          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={values.confirmPassword}
            required
            autoComplete="new-password"
            error={errors.confirmPassword}
            disabled={saving}
            onChange={(event) =>
              updateValue("confirmPassword", event.target.value)
            }
          />

          {successMessage ? (
            <p role="status" className="text-sm text-green-700">
              {successMessage}
            </p>
          ) : null}

          {apiError ? (
            <p role="alert" className="text-sm text-red-700">
              {apiError}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" loading={saving} loadingText="Guardando...">
              Cambiar contraseña
            </Button>
          </div>
        </form>
      </Section>
    </PageContainer>
  );
}
