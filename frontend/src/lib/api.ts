const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

type QueryParams = Record<string, string | number | boolean | undefined | null>;

type RequestOptions = Omit<RequestInit, "body"> & {
  params?: QueryParams;
  body?: unknown;
};

const IS_DEV = import.meta.env.DEV;

function buildUrl(path: string, params?: QueryParams) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);

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
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;

        if (item && typeof item === "object") {
          const obj = item as { loc?: unknown; msg?: unknown };
          const loc = Array.isArray(obj.loc) ? obj.loc.join(" > ") : "";
          const msg = typeof obj.msg === "string" ? obj.msg : JSON.stringify(item);
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

  const contentType = response.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || undefined;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, body, ...rest } = options;

  const url = buildUrl(path, params);
  const requestHeaders = new Headers(headers);

  const isFormData = body instanceof FormData;
  const hasBody = body !== undefined && body !== null;

  if (hasBody && !isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  requestHeaders.set("ngrok-skip-browser-warning", "1");

  if (IS_DEV) {
    console.log("[API REQUEST]", {
      method: rest.method ?? "GET",
      url,
      params,
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

  if (!response.ok) {
    const errorMessage = toErrorMessage(
      responseData &&
        typeof responseData === "object" &&
        "detail" in (responseData as Record<string, unknown>)
        ? (responseData as Record<string, unknown>).detail
        : responseData
    );

    throw new Error(errorMessage || `HTTP ${response.status}`);
  }

  return responseData as T;
}

const api = {
  get: <T>(path: string, params?: QueryParams) =>
    request<T>(path, { method: "GET", params }),

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
export { api, API_BASE_URL };