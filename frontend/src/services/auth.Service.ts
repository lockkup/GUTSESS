// src/services/auth.Service.ts

import api, { API_BASE_URL } from "@/lib/api";

type AuthContact = {
  team?: string;
  email?: string;
};

type ErrorPayload = {
  error?: string;
  message?: string;
  contacts?: AuthContact[];
};

type ValidationErrorItem = {
  loc?: unknown[];
  msg?: string;
  type?: string;
};

type BackendErrorDetail = string | ErrorPayload | ValidationErrorItem[];

type ApiErrorLike = {
  message?: unknown;
  error?: string;
  contacts?: AuthContact[];
  detail?: BackendErrorDetail;
  data?: {
    detail?: BackendErrorDetail;
  };
  response?: {
    status?: number;
    data?: {
      detail?: BackendErrorDetail;
    };
  };
};

export type AuthAlertIcon = "alert-circle" | "check-circle";

export interface ForgotPasswordRequest {
  employee_code: string;
  send_plain_password: boolean;
}

export interface ForgotPasswordResponse {
  message: string;
  contacts?: AuthContact[];
}

export interface ChangePasswordRequest {
  employee_code: string;
  old_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  message?: string;
  contacts?: AuthContact[];
}

export interface AuthEmployee {
  employee_code: string;
  email: string | null;
  first_name: string;
  last_name: string;
  role_name: string;
  name_prefix: string;
  position_name: string;

  department_id?: number | null;
  position_id?: number | null;
  department_name?: string | null;

  // ใช้สำหรับกรองข้อมูลสายตรวจตามเขต/ฝ่าย/เส้นทาง
  division_id?: number | null;
  division_name?: string | null;

  route_id?: number | null;
  route_name?: string | null;

  zone_id?: number | null;
  zone_name?: string | null;
}

export interface LoginResponse {
  employee: AuthEmployee;
  token?: string;
  access_token?: string;
  message?: string;
}

export interface AuthActionResult {
  success: boolean;
  title?: string;
  message: string;
  error?: string;
  contacts?: AuthContact[];
  icon?: AuthAlertIcon;
}

export interface AuthLoginResult {
  success: boolean;
  data?: LoginResponse;
  title?: string;
  error?: string;
  message?: string;
  contacts?: AuthContact[];
  icon?: AuthAlertIcon;
}

/**
 * สำคัญ:
 * api.ts เติม /api ให้แล้ว
 * ดังนั้นใน service นี้ใช้แค่ /auth เท่านั้น
 *
 * ถูก: /auth/login
 * ผิด: /api/auth/login
 */
const AUTH_BASE = "/auth";

const DEFAULT_ERROR_TITLE = "ข้อผิดพลาดในการเชื่อมต่อ";
const DEFAULT_ERROR_ICON: AuthAlertIcon = "alert-circle";

const DEFAULT_SUCCESS_TITLE = "สำเร็จ";
const DEFAULT_SUCCESS_ICON: AuthAlertIcon = "check-circle";

function mapKnownAuthMessage(errorKey?: string, message?: string): string {
  if (errorKey === "INVALID_CREDENTIALS") {
    return message || "รหัสผ่านไม่ถูกต้อง";
  }

  if (errorKey === "EMPLOYEE_NOT_FOUND") {
    return message || "ไม่พบรหัสพนักงานนี้ในระบบ";
  }

  if (errorKey === "INACTIVE_ACCOUNT") {
    return message || "บัญชีพนักงานนี้ถูกปิดใช้งาน";
  }

  if (errorKey === "INVALID_OLD_PASSWORD") {
    return message || "รหัสผ่านเดิมไม่ถูกต้อง";
  }

  if (errorKey === "PASSWORD_SAME_AS_OLD") {
    return message || "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม";
  }

  if (errorKey === "SAME_PASSWORD") {
    return message || "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม";
  }

  return message || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}

function isErrorPayload(value: unknown): value is ErrorPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      ("error" in value || "message" in value || "contacts" in value),
  );
}

function makeErrorResult(params: {
  message: string;
  error?: string;
  contacts?: AuthContact[];
}): AuthActionResult {
  return {
    success: false,
    title: DEFAULT_ERROR_TITLE,
    message: params.message,
    error: params.error,
    contacts: params.contacts,
    icon: DEFAULT_ERROR_ICON,
  };
}

function toAuthActionResult(
  payload: ErrorPayload,
  fallbackMessage: string,
): AuthActionResult {
  return makeErrorResult({
    message: mapKnownAuthMessage(
      payload.error,
      payload.message || fallbackMessage,
    ),
    error: payload.error,
    contacts: Array.isArray(payload.contacts) ? payload.contacts : undefined,
  });
}

function getThaiFieldName(field: unknown): string {
  const fieldName = String(field || "");

  const fieldMap: Record<string, string> = {
    employee_code: "รหัสพนักงาน",
    old_password: "รหัสผ่านเดิม",
    new_password: "รหัสผ่านใหม่",
    password: "รหัสผ่าน",
    body: "ข้อมูล",
  };

  return fieldMap[fieldName] || fieldName;
}

function normalizeValidationMessage(message?: string): string {
  if (!message) return "ข้อมูลไม่ถูกต้อง";

  if (message === "Field required") {
    return "จำเป็นต้องกรอกข้อมูลนี้";
  }

  if (message.includes("String should have at least")) {
    return "จำนวนตัวอักษรน้อยเกินไป";
  }

  if (message.includes("String should have at most")) {
    return "จำนวนตัวอักษรมากเกินไป";
  }

  return message;
}

function parseValidationErrors(
  detail: ValidationErrorItem[],
  fallbackMessage: string,
): AuthActionResult {
  const validationMessage = detail
    .map((item) => {
      const field = Array.isArray(item.loc)
        ? item.loc[item.loc.length - 1]
        : "";

      const thaiField = getThaiFieldName(field);
      const msg = normalizeValidationMessage(item.msg);

      return thaiField ? `${thaiField}: ${msg}` : msg;
    })
    .filter(Boolean)
    .join("\n");

  return makeErrorResult({
    message: validationMessage || fallbackMessage,
  });
}

function tryParseJsonErrorString(
  value: unknown,
  fallbackMessage: string,
): AuthActionResult | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      return parseValidationErrors(parsed, fallbackMessage);
    }

    if (Array.isArray(parsed?.detail)) {
      return parseValidationErrors(parsed.detail, fallbackMessage);
    }

    if (isErrorPayload(parsed)) {
      return toAuthActionResult(parsed, fallbackMessage);
    }

    if (isErrorPayload(parsed?.detail)) {
      return toAuthActionResult(parsed.detail, fallbackMessage);
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeErrorDetail(
  detail: unknown,
  fallbackMessage: string,
): AuthActionResult | null {
  if (!detail) return null;

  if (Array.isArray(detail)) {
    return parseValidationErrors(detail, fallbackMessage);
  }

  const parsedStringResult = tryParseJsonErrorString(detail, fallbackMessage);
  if (parsedStringResult) return parsedStringResult;

  if (typeof detail === "string") {
    return makeErrorResult({
      message: detail,
    });
  }

  if (isErrorPayload(detail)) {
    return toAuthActionResult(detail, fallbackMessage);
  }

  return null;
}

function parseApiError(
  error: unknown,
  fallbackMessage = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
): AuthActionResult {
  const err = error as ApiErrorLike;

  const detail =
    err?.response?.data?.detail ?? err?.data?.detail ?? err?.detail ?? null;

  const detailResult = normalizeErrorDetail(detail, fallbackMessage);

  if (detailResult) {
    return detailResult;
  }

  const messageJsonResult = tryParseJsonErrorString(
    err?.message,
    fallbackMessage,
  );

  if (messageJsonResult) {
    return messageJsonResult;
  }

  if (isErrorPayload(err)) {
    return toAuthActionResult(err, fallbackMessage);
  }

  return makeErrorResult({
    message:
      typeof err?.message === "string" && err.message.trim()
        ? err.message
        : fallbackMessage,
  });
}

async function parseFetchJson(response: Response): Promise<unknown> {
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

function getMessageFromUnknownData(
  data: unknown,
  fallbackMessage: string,
): string {
  if (
    data &&
    typeof data === "object" &&
    "message" in (data as Record<string, unknown>) &&
    typeof (data as Record<string, unknown>).message === "string"
  ) {
    return String((data as Record<string, unknown>).message);
  }

  return fallbackMessage;
}

export const authService = {
  async login(
    employee_code: string,
    password: string,
  ): Promise<AuthLoginResult> {
    try {
      const data = await api.post<LoginResponse>(`${AUTH_BASE}/login`, {
        employee_code,
        password,
      });

      console.log("auth.login response:", data);

      return {
        success: true,
        data,
      };
    } catch (error) {
      const parsed = parseApiError(error, "ไม่สามารถเข้าสู่ระบบได้");

      if (parsed.error === "INVALID_CREDENTIALS") {
        console.warn("Login failed:", parsed.message);
      } else {
        console.error("Login error:", error);
      }

      return {
        success: false,
        title: parsed.title || DEFAULT_ERROR_TITLE,
        message: parsed.message || "รหัสผ่านไม่ถูกต้อง",
        error: parsed.error,
        contacts: parsed.contacts,
        icon: parsed.icon || DEFAULT_ERROR_ICON,
      };
    }
  },

  async logout(employee_code: string): Promise<void> {
    try {
      const actorCode = String(employee_code || "").trim();

      if (!actorCode) {
        return;
      }

      const logoutUrl = `${API_BASE_URL}${AUTH_BASE}/logout`;

      const response = await fetch(logoutUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Employee-Code": actorCode,
          Authorization: `Bearer ${actorCode}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Logout failed:", response.status, errorText);
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  },

  async forgotPassword(employee_code: string): Promise<AuthActionResult> {
    try {
      const data = await api.post<ForgotPasswordResponse>(
        `${AUTH_BASE}/forgot-password`,
        {
          employee_code,
          send_plain_password: true,
        } satisfies ForgotPasswordRequest,
      );

      return {
        success: true,
        title: DEFAULT_SUCCESS_TITLE,
        message: data.message || "ส่งรหัสผ่านไปยังอีเมลเรียบร้อยแล้ว",
        contacts: data.contacts,
        icon: DEFAULT_SUCCESS_ICON,
      };
    } catch (error) {
      console.error("Forgot password error:", error);

      return parseApiError(
        error,
        "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ กรุณาตรวจสอบอินเทอร์เน็ต",
      );
    }
  },

  async changePassword(
    employee_code: string,
    oldPin: string,
    newPin: string,
  ): Promise<AuthActionResult> {
    try {
      const actorCode = String(employee_code || "").trim();

      if (!actorCode) {
        return makeErrorResult({
          message: "ไม่พบรหัสพนักงาน กรุณาเข้าสู่ระบบใหม่อีกครั้ง",
        });
      }

      const payload: ChangePasswordRequest = {
        employee_code: actorCode,
        old_password: oldPin,
        new_password: newPin,
      };

      console.log("changePassword payload:", {
        employee_code: actorCode,
        old_password_length: oldPin.length,
        new_password_length: newPin.length,
      });

      const response = await fetch(`${API_BASE_URL}${AUTH_BASE}/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",

          // Backend ต้องการ actor identity
          "X-Employee-Code": actorCode,
          Authorization: `Bearer ${actorCode}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await parseFetchJson(response);

      if (!response.ok) {
        const detail =
          data &&
          typeof data === "object" &&
          "detail" in (data as Record<string, unknown>)
            ? (data as Record<string, unknown>).detail
            : data;

        const detailResult = normalizeErrorDetail(
          detail,
          "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาตรวจสอบข้อมูลอีกครั้ง",
        );

        if (detailResult) {
          return detailResult;
        }

        return makeErrorResult({
          message: getMessageFromUnknownData(
            data,
            "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาตรวจสอบข้อมูลอีกครั้ง",
          ),
        });
      }

      return {
        success: true,
        title: DEFAULT_SUCCESS_TITLE,
        message: getMessageFromUnknownData(data, "เปลี่ยนรหัสผ่านสำเร็จ"),
        icon: DEFAULT_SUCCESS_ICON,
      };
    } catch (error) {
      console.error("Change password error:", error);

      return makeErrorResult({
        message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์",
      });
    }
  },
};