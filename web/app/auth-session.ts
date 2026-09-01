"use client";

import { useEffect, useState } from "react";

import { api } from "@/services/api";

export type UserRole = "ADMIN" | "MANAGER" | "SALES" | "WAREHOUSE";

export type AuthenticatedSession = {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyTimezone: string;
};

export type AuthenticatedSessionState =
  | { status: "loading" }
  | { status: "success"; user: AuthenticatedSession }
  | { status: "error"; message: string };

let cachedSession: AuthenticatedSession | null = null;
let sessionRequest: Promise<AuthenticatedSession> | null = null;

export async function loadAuthenticatedSession() {
  if (cachedSession) {
    return cachedSession;
  }

  sessionRequest ??= api
    .get<AuthenticatedSession>("/auth/me")
    .then((response) => {
      cachedSession = response.data;
      return response.data;
    })
    .finally(() => {
      sessionRequest = null;
    });

  return sessionRequest;
}

export function clearAuthenticatedSessionCache() {
  cachedSession = null;
  sessionRequest = null;
}

export function useAuthenticatedSession(): AuthenticatedSessionState {
  const [state, setState] = useState<AuthenticatedSessionState>(() =>
    cachedSession
      ? { status: "success", user: cachedSession }
      : { status: "loading" },
  );

  useEffect(() => {
    let mounted = true;

    loadAuthenticatedSession()
      .then((user) => {
        if (mounted) {
          setState({ status: "success", user });
        }
      })
      .catch((error: unknown) => {
        console.error(error);

        if (mounted) {
          setState({
            status: "error",
            message: "No fue posible cargar la sesión.",
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
