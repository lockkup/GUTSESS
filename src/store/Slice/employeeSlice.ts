import type { StateCreator } from "zustand";
import { employeeService } from "../../services/employee.Service";

export interface Employee {
  employee_code: string;
  first_name: string;
  last_name: string;
  role_id: number;
  sector_id?: number;
  field_id: number;
  department_id: number;
  division_id: number;
  position_id: number;
  is_active: boolean;
  profile_image_path?: string;
}

export interface EmployeeFilters {
  employee_code?: string;
  sector_id?: number;
  is_active?: boolean;
}

export interface EmployeeSlice {
  employees: Employee[];
  currentEmployee: Employee | null;
  isEmployeeLoading: boolean;
  employeeError: string | null;

  fetchEmployees: (filters?: EmployeeFilters) => Promise<void>;
  fetchEmployeeByCode: (code: string) => Promise<void>;
  createEmployee: (data: any) => Promise<void>;
  updateEmployee: (code: string, data: any) => Promise<void>;
  deleteEmployee: (code: string) => Promise<void>;
  clearEmployee: () => void;
}

export const createEmployeeSlice: StateCreator<EmployeeSlice> = (set) => ({
  employees: [],
  currentEmployee: null,
  isEmployeeLoading: false,
  employeeError: null,

  fetchEmployees: async (filters?: EmployeeFilters) => {
    set({ isEmployeeLoading: true, employeeError: null });
    try {
      const employees = await employeeService.getAll(filters);
      set({ employees, isEmployeeLoading: false });
    } catch (error: any) {
      set({ employeeError: error.message, isEmployeeLoading: false });
    }
  },

  fetchEmployeeByCode: async (code: string) => {
    set({ isEmployeeLoading: true, employeeError: null });
    try {
      const employee = await employeeService.getByCode(code);
      set({ currentEmployee: employee, isEmployeeLoading: false });
    } catch (error: any) {
      set({ employeeError: error.message, isEmployeeLoading: false });
      throw error;
    }
  },

  createEmployee: async (data: any) => {
    set({ isEmployeeLoading: true, employeeError: null });
    try {
      const newEmployee = await employeeService.create(data);
      set((state) => ({
        employees: [newEmployee, ...state.employees],
        isEmployeeLoading: false,
      }));
    } catch (error: any) {
      set({ employeeError: error.message, isEmployeeLoading: false });
    }
  },

  updateEmployee: async (code: string, data: any) => {
    set({ isEmployeeLoading: true, employeeError: null });
    try {
      const updatedEmployee = await employeeService.update(code, data);
      set((state) => ({
        employees: state.employees.map((e) =>
          e.employee_code === code ? updatedEmployee : e,
        ),
        currentEmployee:
          state.currentEmployee?.employee_code === code
            ? updatedEmployee
            : state.currentEmployee,
        isEmployeeLoading: false,
      }));
    } catch (error: any) {
      set({ employeeError: error.message, isEmployeeLoading: false });
    }
  },

  deleteEmployee: async (code: string) => {
    set({ isEmployeeLoading: true, employeeError: null });
    try {
      await employeeService.delete(code);
      set((state) => ({
        employees: state.employees.filter((e) => e.employee_code !== code),
        currentEmployee:
          state.currentEmployee?.employee_code === code
            ? null
            : state.currentEmployee,
        isEmployeeLoading: false,
      }));
    } catch (error: any) {
      set({ employeeError: error.message, isEmployeeLoading: false });
    }
  },

  clearEmployee: () => {
    set({ currentEmployee: null, employeeError: null });
  },
});
