import api from "../lib/api";
import type {
  GetSiteLocationsParams,
  SiteLocation,
  SiteLocationFormValues,
} from "../types/siteLocation";

const BASE_PATH = "/api/site-locations";

export const siteLocationService = {
  async getSiteLocations(
    params?: GetSiteLocationsParams
  ): Promise<SiteLocation[]> {
    return api.get<SiteLocation[]>(BASE_PATH, params);
  },

  async getActiveSiteLocations(): Promise<SiteLocation[]> {
    return api.get<SiteLocation[]>(BASE_PATH, {
      is_active: true,
      include_deleted: false,
      limit: 1000,
    });
  },

  async getSiteLocationById(siteLocationId: number): Promise<SiteLocation> {
    return api.get<SiteLocation>(`${BASE_PATH}/${siteLocationId}`);
  },

  async createSiteLocation(
    payload: SiteLocationFormValues
  ): Promise<SiteLocation> {
    return api.post<SiteLocation>(BASE_PATH, payload);
  },

  async updateSiteLocation(
    siteLocationId: number,
    payload: Partial<SiteLocationFormValues>
  ): Promise<SiteLocation> {
    return api.patch<SiteLocation>(`${BASE_PATH}/${siteLocationId}`, payload);
  },

  async deleteSiteLocation(
    siteLocationId: number,
    updated_by: string
  ): Promise<SiteLocation> {
    return api.delete<SiteLocation>(`${BASE_PATH}/${siteLocationId}`, {
      updated_by,
    });
  },
};