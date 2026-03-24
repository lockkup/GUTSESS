import { create } from "zustand";
import { createSectorReportSlice } from "./Slice/sectorReportSlice";
import type { SectorReportSlice } from "./Slice/sectorReportSlice";
import { createSectorSlice } from "./Slice/sectorSlice";
import type { SectorSlice } from "./Slice/sectorSlice";
import { createPositionSlice } from "./Slice/positionSlice";
import type { PositionSlice } from "./Slice/positionSlice";
import { createEmployeeSlice } from "./Slice/employeeSlice";
import type { EmployeeSlice } from "./Slice/employeeSlice";

// Centralize all exports for components to import from a single entry point
export * from "./Slice/sectorReportSlice";
export * from "./Slice/sectorSlice";
export * from "./Slice/positionSlice";
export * from "./Slice/employeeSlice";

// Combine all slices into a single master store
export const useStore = create<
  SectorReportSlice & SectorSlice & PositionSlice & EmployeeSlice
>()((...a) => ({
  ...createSectorReportSlice(...a),
  ...createSectorSlice(...a),
  ...createPositionSlice(...a),
  ...createEmployeeSlice(...a),
}));
