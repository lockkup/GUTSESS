import type { StateCreator } from "zustand";
import { sectorReportService } from "../../services/sectorReport.Service";

export interface SectorReport {
  id: number;
  sector_id: number;
  report_date: string;
  status: string;
  approved_status?: "PENDING" | "APPROVED" | "REJECT";
  approved_by?: string;
  approved_at?: string;
  approved_remark?: string;
  updated_by?: string;
  updated_at?: string;
  leave_sick_count: number;
  leave_business_count: number;
  leave_other_count: number;
  absent_count: number;
  shift_18_count: number;
  shift_24_count: number;
  shift_36_count: number;
  warning?: string;
  wear_hat_count: number;
  wear_shirt_count: number;
  wear_pant_count: number;
  wear_shoe_count: number;
  other_Job?: string;
  other_Job_count?: number;
  created_at?: string;
  created_by: string;
}

export interface SectorReportFilters {
  sector_id?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
}

export interface SectorReportSlice {
  reports: SectorReport[];
  currentReport: SectorReport | null;
  isLoading: boolean;
  error: string | null;

  fetchReports: (filters?: SectorReportFilters) => Promise<void>;
  fetchReportById: (id: number) => Promise<void>;
  createReport: (data: any) => Promise<void>;
  updateReport: (id: number, data: any) => Promise<void>;
  deleteReport: (id: number) => Promise<void>;
}

export const createSectorReportSlice: StateCreator<SectorReportSlice> = (
  set,
) => ({
  reports: [],
  currentReport: null,
  isLoading: false,
  error: null,

  fetchReports: async (filters?: SectorReportFilters) => {
    set({ isLoading: true, error: null });
    try {
      const reports = await sectorReportService.getAll(filters);
      set({ reports, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchReportById: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      const currentReport = await sectorReportService.getById(id);
      set({ currentReport, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createReport: async (data: any) => {
    set({ isLoading: true, error: null });
    try {
      const newReport = await sectorReportService.create(data);
      set((state) => ({
        reports: [newReport, ...state.reports],
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateReport: async (id: number, data: any) => {
    set({ isLoading: true, error: null });
    try {
      const updatedReport = await sectorReportService.update(id, data);
      set((state) => ({
        reports: state.reports.map((r) => (r.id === id ? updatedReport : r)),
        currentReport:
          state.currentReport?.id === id ? updatedReport : state.currentReport,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  deleteReport: async (id: number) => {
    set({ isLoading: true, error: null });
    try {
      await sectorReportService.delete(id);
      set((state) => ({
        reports: state.reports.filter((r) => r.id !== id),
        currentReport:
          state.currentReport?.id === id ? null : state.currentReport,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
});
