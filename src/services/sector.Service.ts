import { API_URL, API_CONFIG } from "../config/api.config";
import type { Sector, SectorFilters, SectorCreate } from "../store/Slice/sectorSlice";

export const sectorService = {
  async getAll(filters?: SectorFilters): Promise<Sector[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }
    const queryString = queryParams.toString();
    const url = `${API_URL}/sectors/${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(url, {
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
    });
    if (!response.ok) throw new Error("Failed to fetch sectors");
    return response.json();
  },

  async getById(id: number): Promise<Sector> {
    const response = await fetch(`${API_URL}/sectors/${id}`, {
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
    });
    if (!response.ok) throw new Error("Failed to fetch sector");
    return response.json();
  },

  async create(data: SectorCreate): Promise<Sector> {
    const response = await fetch(`${API_URL}/sectors/`, {
      method: "POST",
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to create sector");
    return response.json();
  },

  async update(id: number, data: Partial<Sector>): Promise<Sector> {
    const response = await fetch(`${API_URL}/sectors/${id}`, {
      method: "PATCH",
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("Failed to update sector");
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_URL}/sectors/${id}`, {
      method: "DELETE",
      ...API_CONFIG,
      headers: {
        ...API_CONFIG.headers,
        ...API_CONFIG.getAuthHeader(),
      },
    });
    if (!response.ok) throw new Error("Failed to delete sector");
  },
};
