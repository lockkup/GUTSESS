export type SiteLocation = {
  location_id?: number;
  site_location_id?: number;

  location_name: string;
  latitude: number | string;
  longitude: number | string;

  radius_meter: number;
  grace_meter: number;

  location_detail?: string | null;
  is_active: boolean;
  mark_flag: boolean | number;

  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type GetSiteLocationsParams = {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  include_deleted?: boolean;
  location_name?: string;
};

export type SiteLocationFormValues = {
  location_name: string;
  latitude: number;
  longitude: number;
  radius_meter: number;
  grace_meter: number;
  location_detail?: string | null;
  is_active: boolean;
  created_by?: string;
  updated_by?: string;
};