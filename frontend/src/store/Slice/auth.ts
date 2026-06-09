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

function isLoginData(data: unknown): data is LoginData {
  if (!data || typeof data !== "object") return false;

  return "employee" in data;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  authEmployee: null,
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

        const displayName =
          `${emp.first_name} ${emp.last_name}`.trim() || emp.employee_code;

        localStorage.setItem("emp_code", emp.employee_code);
        localStorage.setItem("display_name", displayName);

        set({
          authEmployee: emp,
          authLoading: false,
          authError: null,
          authErrorKey: null,
          authContacts: undefined,
        });

        return true;
      }

      set({
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
      localStorage.removeItem("emp_code");
      localStorage.removeItem("display_name");

      set({
        authEmployee: null,
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