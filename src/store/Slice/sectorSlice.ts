import type { StateCreator } from "zustand";
import { sectorService } from "../../services/sector.Service";

export interface Sector {
  sector_id: number;
  sector_name: string;
  field_id: number;
  department_id: number;
  division_id: number;
  is_active: string;
  created_at?: string;
  updated_at?: string;
  created_by: string;
  updated_by?: string;
}

export interface SectorFilters {
  sector_id?: number;
  field_id?: number;
  department_id?: number;
  division_id?: number;
}

export interface SectorCreate {
  sector_name: string;
  field_id: number;
  department_id: number;
  division_id: number;
  created_by: string;
}

export interface SectorSlice {
  sectors: Sector[];
  currentSector: Sector | null;
  isSectorLoading: boolean;
  sectorError: string | null;

  fetchSectors: (filters?: SectorFilters) => Promise<void>;
  fetchSectorById: (id: number) => Promise<void>;
  createSector: (data: any) => Promise<void>;
  updateSector: (id: number, data: any) => Promise<void>;
  deleteSector: (id: number) => Promise<void>;
}

export const createSectorSlice: StateCreator<SectorSlice> = (set) => ({
  sectors: [],
  currentSector: null,
  isSectorLoading: false,
  sectorError: null,

  fetchSectors: async (filters?: SectorFilters) => {
    set({ isSectorLoading: true, sectorError: null });
    try {
      const sectors = await sectorService.getAll(filters);
      set({ sectors, isSectorLoading: false });
    } catch (error: any) {
      set({ sectorError: error.message, isSectorLoading: false });
    }
  },

  fetchSectorById: async (id: number) => {
    set({ isSectorLoading: true, sectorError: null });
    try {
      const currentSector = await sectorService.getById(id);
      set({ currentSector, isSectorLoading: false });
    } catch (error: any) {
      set({ sectorError: error.message, isSectorLoading: false });
    }
  },

  createSector: async (data: any) => {
    set({ isSectorLoading: true, sectorError: null });
    try {
      const newSector = await sectorService.create(data);
      set((state) => ({
        sectors: [newSector, ...state.sectors],
        isSectorLoading: false,
      }));
    } catch (error: any) {
      set({ sectorError: error.message, isSectorLoading: false });
    }
  },

  updateSector: async (id: number, data: any) => {
    set({ isSectorLoading: true, sectorError: null });
    try {
      const updatedSector = await sectorService.update(id, data);
      set((state) => ({
        sectors: state.sectors.map((s) =>
          s.sector_id === id ? updatedSector : s,
        ),
        currentSector:
          state.currentSector?.sector_id === id
            ? updatedSector
            : state.currentSector,
        isSectorLoading: false,
      }));
    } catch (error: any) {
      set({ sectorError: error.message, isSectorLoading: false });
    }
  },

  deleteSector: async (id: number) => {
    set({ isSectorLoading: true, sectorError: null });
    try {
      await sectorService.delete(id);
      set((state) => ({
        sectors: state.sectors.filter((s) => s.sector_id !== id),
        currentSector:
          state.currentSector?.sector_id === id ? null : state.currentSector,
        isSectorLoading: false,
      }));
    } catch (error: any) {
      set({ sectorError: error.message, isSectorLoading: false });
    }
  },
});
