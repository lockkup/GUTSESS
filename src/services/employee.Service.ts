import { API_URL, API_CONFIG } from "../config/api.config";
import type { Employee, EmployeeFilters } from "../store/Slice/employeeSlice";


export const employeeService = {
  async getAll(filters?: EmployeeFilters): Promise<Employee[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, String(value));
            }
        });
    }
    const queryString = queryParams.toString();
    const url = `${API_URL}/employees/${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(url, {
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
    });
    if (!response.ok) throw new Error("Failed to fetch employees");
    return response.json();
  },


  async getByCode(employeeCode: string): Promise<Employee> {
    const response = await fetch(`${API_URL}/employees/${employeeCode}`, {
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
    });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Employee not found");
      }
      throw new Error("Failed to fetch employee details");
    }
    return response.json();
  },

  async create(data: any): Promise<Employee> {
    const response = await fetch(`${API_URL}/employees/`, {
      method: "POST",
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create employee");
    return response.json();
  },

  async update(employeeCode: string, data: any): Promise<Employee> {
    const response = await fetch(`${API_URL}/employees/${employeeCode}`, {
      method: "PATCH",
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update employee");
    return response.json();
  },

  async delete(employeeCode: string): Promise<void> {
    const response = await fetch(`${API_URL}/employees/${employeeCode}`, {
      method: "DELETE",
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
    });
    if (!response.ok) throw new Error("Failed to delete employee");
  },
};
