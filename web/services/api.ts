import axios from "axios";

const LOCAL_API_URL = "http://localhost:3001";

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl(
  env: Partial<
    Pick<NodeJS.ProcessEnv, "NODE_ENV" | "NEXT_PUBLIC_API_URL">
  > = {
    // NEXT_PUBLIC_* must use a direct process.env property access so Next.js
    // replaces it in client bundles. Passing process.env through an alias
    // leaves the browser using LOCAL_API_URL even when .env.local is set.
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
) {
  const configuredApiUrl = env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredApiUrl) {
    if (!isHttpUrl(configuredApiUrl)) {
      throw new Error("NEXT_PUBLIC_API_URL must be a valid HTTP(S) URL");
    }

    if (
      env.NODE_ENV === "production" &&
      !configuredApiUrl.startsWith("https://")
    ) {
      throw new Error("NEXT_PUBLIC_API_URL must use HTTPS in production");
    }

    return configuredApiUrl.replace(/\/+$/, "");
  }

  if (env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_API_URL must be defined in production");
  }

  return LOCAL_API_URL;
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      typeof window !== "undefined" &&
      axios.isAxiosError(error) &&
      error.response?.status === 401
    ) {
      localStorage.removeItem("token");

      const requestUrl = error.config?.url;
      const isSessionBootstrapRequest =
        requestUrl === "/auth/me" || requestUrl?.endsWith("/auth/me");

      if (
        !isSessionBootstrapRequest &&
        window.location.pathname !== "/login"
      ) {
        window.location.assign(
          new URL("/login", window.location.origin).toString(),
        );
      }
    }

    return Promise.reject(error);
  },
);
