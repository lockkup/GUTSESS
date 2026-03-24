import { API_URL, API_CONFIG } from "../config/api.config";

export interface Position {
  position_id: number;
  position_name: string;
  field_id: number;
  department_id: number;
  division_id: number;
  sector_id: number;
  zone_id: number;
  route_id: number;
  is_active: string;
  position_detail?: string;
  created_at?: string;
  updated_at?: string;
  created_by: string;
  updated_by?: string;
}

export interface PositionCreate {
  position_name: string;
  field_id: number;
  department_id: number;
  division_id: number;
  sector_id: number;
  zone_id: number;
  route_id: number;
  created_by: string;
  position_detail?: string;
}

export const positionService = {
  async getAll(): Promise<Position[]> {
    const response = await fetch(`${API_URL}/positions/`, {
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
    });
    if (!response.ok) throw new Error("Failed to fetch positions");
    return response.json();
  },

  async getById(id: number): Promise<Position> {
    const response = await fetch(`${API_URL}/positions/${id}`, {
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
    });
    if (!response.ok) throw new Error("Failed to fetch position");
    return response.json();
  },

  async create(data: PositionCreate): Promise<Position> {
    const response = await fetch(`${API_URL}/positions/`, {
      method: "POST",
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create position");
    return response.json();
  },

  async update(id: number, data: Partial<Position>): Promise<Position> {
    const response = await fetch(`${API_URL}/positions/${id}`, {
      method: "PATCH",
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update position");
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/positions/${id}`, {
      method: "DELETE",
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
    });
    if (!response.ok) throw new Error("Failed to delete position");
  },
};
