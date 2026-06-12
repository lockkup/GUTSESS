import api from "../lib/api";
import type { GetShiftsParams, Shift, ShiftFormValues } from "../types/shift";

const BASE_PATH = "/shifts";

export const shiftService = {
  async getShifts(params?: GetShiftsParams): Promise<Shift[]> {
    return api.get<Shift[]>(BASE_PATH, params);
  },

  async getShiftById(shiftId: number): Promise<Shift> {
    return api.get<Shift>(`${BASE_PATH}/${shiftId}`);
  },

  async createShift(payload: ShiftFormValues): Promise<Shift> {
    return api.post<Shift>(BASE_PATH, payload);
  },

  async updateShift(
    shiftId: number,
    payload: Partial<ShiftFormValues>,
  ): Promise<Shift> {
    return api.patch<Shift>(`${BASE_PATH}/${shiftId}`, payload);
  },

  async deleteShift(shiftId: number, updated_by: string): Promise<Shift> {
    return api.delete<Shift>(`${BASE_PATH}/${shiftId}`, { updated_by });
  },
};