// src/lib/api.ts

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();

/**
 * VITE_API_BASE_URL options:
 *
 * - "same-origin", "sameorigin", "same_origin" หรือเว้นว่าง
 *   = ใช้ domain ปัจจุบัน + /api เช่น
 *   https://xxxxx.trycloudflare.com/api
 *   http://localhost:8090/api
 *
 * - URL เต็ม
 *   = ใช้ URL นั้นตรง ๆ เช่น
 *   http://127.0.0.1:10000
 *   https://xxxxx.trycloudflare.com/api
 */
const sameOriginValues = ["same-origin", "sameorigin", "same_origin"];

const normalizedRawApiBaseUrl = rawApiBaseUrl.toLowerCase();

export const API_ORIGIN =
  !rawApiBaseUrl || sameOriginValues.includes(normalizedRawApiBaseUrl)
    ? `${window.location.origin}/api`
    : rawApiBaseUrl.replace(/\/+$/, "");

// คงชื่อ API_BASE_URL ไว้ เพื่อไม่ให้ service เดิมที่ import ชื่อนี้พัง
export const API_BASE_URL = API_ORIGIN;

export type QueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

export type RequestOptions = Omit<RequestInit, "body"> & {
  params?: QueryParams;
  body?: unknown;
};

const IS_DEV = import.meta.env.DEV;

const AUTH_TOKEN_KEY = "auth_token";
const ACCESS_TOKEN_KEY = "access_token";

function getStoredAuthToken(): string | null {
  return (
    localStorage.getItem(AUTH_TOKEN_KEY) ||
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    null
  );
}

function normalizePath(path: string) {
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;

  /**
   * กันปัญหา URL ซ้ำเป็น /api/api/...
   *
   * เช่น:
   * API_ORIGIN = https://domain.com/api
   * path       = /api/patrol-report
   *
   * ถ้าไม่ตัด จะกลายเป็น:
   * https://domain.com/api/api/patrol-report
   */
  if (
    API_ORIGIN.endsWith("/api") &&
    (normalizedPath === "/api" || normalizedPath.startsWith("/api/"))
  ) {
    normalizedPath = normalizedPath.replace(/^\/api(?=\/|$)/, "");
  }

  return normalizedPath;
}

function isPublicAuthPath(path: string) {
  const normalizedPath = normalizePath(path);

  return (
    normalizedPath === "/auth/login" ||
    normalizedPath.startsWith("/auth/login") ||
    normalizedPath === "/auth/forgot-password" ||
    normalizedPath.startsWith("/auth/forgot-password")
  );
}

function buildUrl(path: string, params?: QueryParams) {
  const normalizedPath = normalizePath(path);

  const url = new URL(`${API_ORIGIN}${normalizedPath}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

function toErrorMessage(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        if (item && typeof item === "object") {
          const obj = item as { loc?: unknown; msg?: unknown };
          const loc = Array.isArray(obj.loc) ? obj.loc.join(" > ") : "";
          const msg =
            typeof obj.msg === "string" ? obj.msg : JSON.stringify(item);

          return loc ? `${loc}: ${msg}` : msg;
        }

        return String(item);
      })
      .join("\n");
  }

  if (detail && typeof detail === "object") {
    return JSON.stringify(detail, null, 2);
  }

  return String(detail);
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const raw = await response.text();

  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { params, headers, body, ...rest } = options;

  const url = buildUrl(path, params);
  const requestHeaders = new Headers(headers);

  const isFormData = body instanceof FormData;
  const hasBody = body !== undefined && body !== null;

  if (!requestHeaders.has("Accept")) {
    requestHeaders.set("Accept", "application/json");
  }

  if (hasBody && !isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  /**
   * แนบ token ให้ API หลัง login
   * ช่วยให้ refresh หน้าแล้วเรียก API ที่ต้อง login ได้ต่อ
   */
  const token = getStoredAuthToken();

  if (token && !isPublicAuthPath(path) && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  // สำหรับ LocalTunnel เท่านั้น
  if (API_ORIGIN.includes(".loca.lt")) {
    requestHeaders.set("bypass-tunnel-reminder", "1");
  }

  if (IS_DEV) {
    console.log("[API REQUEST]", {
      method: rest.method ?? "GET",
      url,
      params,
      hasToken: Boolean(token),
      body: isFormData ? "[FormData]" : body,
    });
  }

  const response = await fetch(url, {
    ...rest,
    headers: requestHeaders,
    body: isFormData ? body : hasBody ? JSON.stringify(body) : undefined,
  });

  const responseData = await parseResponseBody(response);

  if (IS_DEV) {
    console.log("[API RESPONSE]", {
      method: rest.method ?? "GET",
      url,
      status: response.status,
      ok: response.ok,
      data: responseData,
    });
  }

  if (typeof responseData === "string" && responseData.trim().startsWith("<")) {
    throw new Error(
      "API returned HTML instead of JSON. ตรวจสอบ backend, tunnel หรือ VITE_API_BASE_URL",
    );
  }

  if (!response.ok) {
    const errorMessage = toErrorMessage(
      responseData &&
        typeof responseData === "object" &&
        "detail" in (responseData as Record<string, unknown>)
        ? (responseData as Record<string, unknown>).detail
        : responseData,
    );

    if (response.status === 401) {
      throw new Error(errorMessage || "Unauthorized หรือ session หมดอายุ");
    }

    throw new Error(errorMessage || `HTTP ${response.status}`);
  }

  return responseData as T;
}

const api = {
  get: <T>(path: string, params?: QueryParams) =>
    request<T>(path, {
      method: "GET",
      params,
    }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body,
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body,
    }),

  delete: <T = void>(path: string, params?: QueryParams) =>
    request<T>(path, {
      method: "DELETE",
      params,
    }),
};

export default api;
export { api };