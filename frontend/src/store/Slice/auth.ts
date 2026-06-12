// src/store/Slice/auth.ts
import type { StateCreator } from "zustand";
import { authService } from "@/services/auth.Service";

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
}

type AuthContact = {
  team?: string;
  email?: string;
};

type AuthActionResult = {
  success: boolean;
  message: string;
  error?: string;
  contacts?: AuthContact[];
};

type LoginData = {
  employee: AuthEmployee;
  token?: string;
  access_token?: string;
};

type LoginResult = {
  success: boolean;
  message?: string;
  error?: string | null;
  contacts?: AuthContact[];
  data?: LoginData | null;
};

export interface AuthSlice {
  // State
  authEmployee: AuthEmployee | null;
  authToken: string | null;
  authLoading: boolean;
  authError: string | null;
  authErrorKey: string | null;
  authContacts: AuthContact[] | undefined;

  // Actions
  login: (employee_code: string, password: string) => Promise<boolean>;
  logout: (employee_code: string) => Promise<void>;
  clearAuthError: () => void;

  changePassword: (
    employee_code: string,
    oldPin: string,
    newPin: string,
  ) => Promise<AuthActionResult>;

  forgotPassword: (employee_code: string) => Promise<AuthActionResult>;
}

const AUTH_EMPLOYEE_KEY = "auth_employee";
const AUTH_TOKEN_KEY = "auth_token";
const ACCESS_TOKEN_KEY = "access_token";
const AUTH_EXPIRES_AT_KEY = "auth_expires_at";
const EMP_CODE_KEY = "emp_code";
const DISPLAY_NAME_KEY = "display_name";

// 12 ชั่วโมง เหมาะกับกะงาน 08:00-20:00 / 20:00-08:00
const SESSION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

function isLoginData(data: unknown): data is LoginData {
  if (!data || typeof data !== "object") return false;

  return "employee" in data;
}

function getDisplayName(emp: AuthEmployee): string {
  return `${emp.first_name} ${emp.last_name}`.trim() || emp.employee_code;
}

function hasStoredAuthPayload(): boolean {
  // ใช้ auth_employee เป็นหลัก เพราะหน้าเว็บต้องใช้ข้อมูลพนักงานตอน refresh
  return Boolean(localStorage.getItem(AUTH_EMPLOYEE_KEY));
}

function touchAuthSession() {
  const expiresAt = Date.now() + SESSION_TIMEOUT_MS;
  localStorage.setItem(AUTH_EXPIRES_AT_KEY, String(expiresAt));
}

function isAuthSessionExpired(): boolean {
  const rawExpiresAt = localStorage.getItem(AUTH_EXPIRES_AT_KEY);

  // รองรับ session เก่าที่ login ไว้ก่อนมี auth_expires_at
  // ถ้ามี auth_employee อยู่ ให้ต่ออายุ session แทนการเด้งกลับหน้า login
  if (!rawExpiresAt) {
    if (hasStoredAuthPayload()) {
      touchAuthSession();
      return false;
    }

    return true;
  }

  const expiresAt = Number(rawExpiresAt);

  if (!Number.isFinite(expiresAt)) {
    return true;
  }

  return Date.now() > expiresAt;
}

function saveAuthSession(emp: AuthEmployee, token: string | null) {
  const displayName = getDisplayName(emp);

  localStorage.setItem(AUTH_EMPLOYEE_KEY, JSON.stringify(emp));
  localStorage.setItem(EMP_CODE_KEY, emp.employee_code);
  localStorage.setItem(DISPLAY_NAME_KEY, displayName);

  touchAuthSession();

  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

function clearAuthSession() {
  localStorage.removeItem(AUTH_EMPLOYEE_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
  localStorage.removeItem(DISPLAY_NAME_KEY);

  // ตั้งใจไม่ลบ emp_code เพื่อให้ช่องรหัสพนักงานยังจำค่าเดิมได้
  // ถ้าต้องการลบด้วย ให้เปิดบรรทัดนี้
  // localStorage.removeItem(EMP_CODE_KEY);
}

function loadStoredEmployee(): AuthEmployee | null {
  try {
    if (isAuthSessionExpired()) {
      clearAuthSession();
      return null;
    }

    const raw = localStorage.getItem(AUTH_EMPLOYEE_KEY);

    if (!raw) {
      clearAuthSession();
      return null;
    }

    const parsed = JSON.parse(raw) as AuthEmployee;

    if (!parsed.employee_code) {
      clearAuthSession();
      return null;
    }

    // refresh หน้าเว็บแล้วให้ต่ออายุ session
    touchAuthSession();

    return parsed;
  } catch (error) {
    console.error("load auth employee error:", error);
    clearAuthSession();
    return null;
  }
}

function loadStoredToken(): string | null {
  if (isAuthSessionExpired()) {
    clearAuthSession();
    return null;
  }

  const token =
    localStorage.getItem(AUTH_TOKEN_KEY) ||
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    null;

  if (token) {
    // refresh หน้าเว็บแล้วให้ต่ออายุ session
    touchAuthSession();
  }

  return token;
}

const storedEmployee = loadStoredEmployee();
const storedToken = loadStoredToken();

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  authEmployee: storedEmployee,
  authToken: storedToken,
  authLoading: false,
  authError: null,
  authErrorKey: null,
  authContacts: undefined,

  login: async (employee_code, password) => {
    set({
      authLoading: true,
      authError: null,
      authErrorKey: null,
      authContacts: undefined,
    });

    try {
      const result = (await authService.login(
        employee_code,
        password,
      )) as LoginResult;

      if (result.success && isLoginData(result.data)) {
        const emp = result.data.employee;
        const token = result.data.access_token || result.data.token || null;

        saveAuthSession(emp, token);

        set({
          authEmployee: emp,
          authToken: token,
          authLoading: false,
          authError: null,
          authErrorKey: null,
          authContacts: undefined,
        });

        return true;
      }

      clearAuthSession();

      set({
        authEmployee: null,
        authToken: null,
        authLoading: false,
        authError: result.message || "เข้าสู่ระบบไม่สำเร็จ",
        authErrorKey: result.error || null,
        authContacts: result.contacts,
      });

      return false;
    } catch (error) {
      console.error("login error:", error);

      set({
        authLoading: false,
        authError: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์",
        authErrorKey: null,
        authContacts: undefined,
      });

      return false;
    }
  },

  logout: async (employee_code) => {
    try {
      await authService.logout(employee_code);
    } catch (error) {
      console.error("logout error:", error);
    } finally {
      clearAuthSession();

      set({
        authEmployee: null,
        authToken: null,
        authLoading: false,
        authError: null,
        authErrorKey: null,
        authContacts: undefined,
      });
    }
  },

  clearAuthError: () =>
    set({
      authError: null,
      authErrorKey: null,
      authContacts: undefined,
    }),

  changePassword: async (employee_code, oldPin, newPin) => {
    set({
      authLoading: true,
      authError: null,
      authErrorKey: null,
      authContacts: undefined,
    });

    try {
      const result = (await authService.changePassword(
        employee_code,
        oldPin,
        newPin,
      )) as AuthActionResult;

      set({
        authLoading: false,
      });

      return result;
    } catch (error) {
      console.error("changePassword error:", error);

      const fallback: AuthActionResult = {
        success: false,
        message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์",
      };

      set({
        authLoading: false,
        authError: fallback.message,
        authErrorKey: null,
        authContacts: undefined,
      });

      return fallback;
    }
  },

  forgotPassword: async (employee_code) => {
    set({
      authLoading: true,
      authError: null,
      authErrorKey: null,
      authContacts: undefined,
    });

    try {
      const result = (await authService.forgotPassword(
        employee_code,
      )) as AuthActionResult;

      set({
        authLoading: false,
      });

      return result;
    } catch (error) {
      console.error("forgotPassword error:", error);

      const fallback: AuthActionResult = {
        success: false,
        message: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์",
      };

      set({
        authLoading: false,
        authError: fallback.message,
        authErrorKey: null,
        authContacts: undefined,
      });

      return fallback;
    }
  },
});