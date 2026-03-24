import type { StateCreator } from "zustand";
import { positionService } from "../../services/position.Service";
import type { Position } from "../../services/position.Service";

export interface PositionSlice {
  positions: Position[];
  currentPosition: Position | null;
  isPositionLoading: boolean;
  positionError: string | null;

  fetchPositions: () => Promise<void>;
  fetchPositionById: (id: number) => Promise<void>;
  createPosition: (data: any) => Promise<void>;
  updatePosition: (id: number, data: any) => Promise<void>;
  deletePosition: (id: number) => Promise<void>;
}

export const createPositionSlice: StateCreator<PositionSlice> = (set) => ({
  positions: [],
  currentPosition: null,
  isPositionLoading: false,
  positionError: null,

  fetchPositions: async () => {
    set({ isPositionLoading: true, positionError: null });
    try {
      const positions = await positionService.getAll();
      set({ positions, isPositionLoading: false });
    } catch (error: any) {
      set({ positionError: error.message, isPositionLoading: false });
    }
  },

  fetchPositionById: async (id: number) => {
    set({ isPositionLoading: true, positionError: null });
    try {
      const currentPosition = await positionService.getById(id);
      set({ currentPosition, isPositionLoading: false });
    } catch (error: any) {
      set({ positionError: error.message, isPositionLoading: false });
    }
  },

  createPosition: async (data: any) => {
    set({ isPositionLoading: true, positionError: null });
    try {
      const newPosition = await positionService.create(data);
      set((state) => ({
        positions: [newPosition, ...state.positions],
        isPositionLoading: false,
      }));
    } catch (error: any) {
      set({ positionError: error.message, isPositionLoading: false });
    }
  },

  updatePosition: async (id: number, data: any) => {
    set({ isPositionLoading: true, positionError: null });
    try {
      const updatedPosition = await positionService.update(id, data);
      set((state) => ({
        positions: state.positions.map((p) =>
          p.position_id === id ? updatedPosition : p,
        ),
        currentPosition:
          state.currentPosition?.position_id === id
            ? updatedPosition
            : state.currentPosition,
        isPositionLoading: false,
      }));
    } catch (error: any) {
      set({ positionError: error.message, isPositionLoading: false });
    }
  },

  deletePosition: async (id: number) => {
    set({ isPositionLoading: true, positionError: null });
    try {
      await positionService.delete(id);
      set((state) => ({
        positions: state.positions.filter((p) => p.position_id !== id),
        currentPosition:
          state.currentPosition?.position_id === id
            ? null
            : state.currentPosition,
        isPositionLoading: false,
      }));
    } catch (error: any) {
      set({ positionError: error.message, isPositionLoading: false });
    }
  },
});
