// Sample geo data for the GeoChart component
// Combined hierarchical structure: Country → Province → City

export interface GeoPoint {
  id: string;
  name: string;
  value: number;
  lat: number;
  lng: number;
  country?: string;   // ISO-2 for world view
  province?: string;  // for country-level view
  createAt?: string;  // "YYYY-MM-DD" full date the record was created
  cats?: {
    total?: number;
    leave: number;
    shift: number;
    issues: number;
    wear: number;
    other: number;
  };
}

export interface ProvinceNode extends GeoPoint {
  cities?: GeoPoint[];
}

export interface CountryNode extends GeoPoint {
  provinces?: ProvinceNode[];
}

// ── Single combined data source ─────────────────────────────────────────────
export const geoData: CountryNode[] = [
  // ─── Thailand ───────────────────────────────────────────────────────────
  {
    id: "TH", name: "Thailand", value: 756, lat: 13.7, lng: 100.5, country: "TH",
    createAt: "2023-04-17",
    cats: { total: 1045, leave: 137, shift: 254, issues: 206, wear: 282, other: 166 },
    provinces: [
      {
        id: "TH-10", name: "กรุงเทพมหานคร", value: 139, lat: 13.75, lng: 100.52, province: "กรุงเทพฯ",
        createAt: "2024-03-15", cats: { total: 226, leave: 30, shift: 58, issues: 42, wear: 61, other: 35 },
        cities: [
          { id: "BKK-KL",  name: "พระนคร",     value: 45, lat: 13.76, lng: 100.49, createAt: "2023-03-08", cats: { total: 45, leave: 6, shift: 11, issues: 9, wear: 12, other: 7 } },
          { id: "BKK-WN",  name: "วังทองหลาง",  value: 28, lat: 13.76, lng: 100.60, createAt: "2026-01-22", cats: { total: 28, leave: 4, shift: 7, issues: 5, wear: 8, other: 4 } },
          { id: "BKK-LK",  name: "ลาดกระบัง",   value: 38, lat: 13.73, lng: 100.77, createAt: "2024-07-14", cats: { total: 38, leave: 5, shift: 10, issues: 7, wear: 10, other: 6 } },
          { id: "BKK-MK",  name: "มีนบุรี",      value: 22, lat: 13.81, lng: 100.72, createAt: "2025-11-30", cats: { total: 22, leave: 3, shift: 6, issues: 4, wear: 6, other: 3 } },
          { id: "BKK-DM",  name: "ดอนเมือง",     value: 31, lat: 13.91, lng: 100.59, createAt: "2023-09-11", cats: { total: 31, leave: 4, shift: 8, issues: 6, wear: 8, other: 5 } },
          { id: "BKK-BN",  name: "บางนา",        value: 19, lat: 13.67, lng: 100.61, createAt: "2024-02-03", cats: { total: 19, leave: 3, shift: 5, issues: 3, wear: 5, other: 3 } },
          { id: "BKK-THO", name: "ธนบุรี",       value: 26, lat: 13.73, lng: 100.47, createAt: "2026-02-19", cats: { total: 26, leave: 3, shift: 7, issues: 5, wear: 7, other: 4 } },
          { id: "BKK-KLO", name: "คลองสาน",      value: 17, lat: 13.73, lng: 100.50, createAt: "2025-05-05", cats: { total: 17, leave: 2, shift: 4, issues: 3, wear: 5, other: 3 } },
        ],
      },
      {
        id: "TH-50", name: "เชียงใหม่", value: 102, lat: 18.79, lng: 98.99, province: "ภาคเหนือ",
        createAt: "2023-07-22", cats: { total: 140, leave: 18, shift: 33, issues: 28, wear: 38, other: 23 },
        cities: [
          { id: "CNX-MG", name: "เมืองเชียงใหม่", value: 55, lat: 18.79, lng: 98.99, createAt: "2024-04-07", cats: { total: 55, leave: 7, shift: 13, issues: 11, wear: 15, other: 9 } },
          { id: "CNX-HD", name: "หางดง",          value: 30, lat: 18.69, lng: 98.91, createAt: "2023-12-25", cats: { total: 30, leave: 4, shift: 7, issues: 6, wear: 8, other: 5 } },
          { id: "CNX-SC", name: "สันกำแพง",        value: 22, lat: 18.75, lng: 99.13, createAt: "2026-03-13", cats: { total: 22, leave: 3, shift: 5, issues: 4, wear: 6, other: 4 } },
          { id: "CNX-DK", name: "ดอยสะเก็ด",       value: 18, lat: 18.86, lng: 99.16, createAt: "2025-08-01", cats: { total: 18, leave: 2, shift: 4, issues: 4, wear: 5, other: 3 } },
          { id: "CNX-SP", name: "สันป่าตอง",        value: 15, lat: 18.55, lng: 98.91, createAt: "2023-06-17", cats: { total: 15, leave: 2, shift: 4, issues: 3, wear: 4, other: 2 } },
        ],
      },
      {
        id: "TH-90", name: "สงขลา", value: 88, lat: 7.20, lng: 100.60, province: "ภาคใต้",
        createAt: "2025-11-08", cats: { total: 106, leave: 14, shift: 26, issues: 21, wear: 29, other: 16 },
        cities: [
          { id: "SKA-MG", name: "เมืองสงขลา", value: 32, lat: 7.20, lng: 100.60, createAt: "2024-10-29", cats: { total: 32, leave: 4, shift: 8, issues: 6, wear: 9, other: 5 } },
          { id: "SKA-HY", name: "หาดใหญ่",    value: 44, lat: 7.01, lng: 100.47, createAt: "2023-02-04", cats: { total: 44, leave: 6, shift: 11, issues: 9, wear: 12, other: 6 } },
          { id: "SKA-SP", name: "สะเดา",      value: 18, lat: 6.64, lng: 100.42, createAt: "2026-01-21", cats: { total: 18, leave: 2, shift: 4, issues: 4, wear: 5, other: 3 } },
          { id: "SKA-RN", name: "รัตภูมิ",     value: 12, lat: 7.16, lng: 100.22, createAt: "2025-07-08", cats: { total: 12, leave: 2, shift: 3, issues: 2, wear: 3, other: 2 } },
        ],
      },
      {
        id: "TH-30", name: "นครราชสีมา", value: 113, lat: 14.97, lng: 102.10, province: "ภาคตะวันออก",
        createAt: "2026-01-14", cats: { total: 102, leave: 13, shift: 25, issues: 20, wear: 28, other: 16 },
        cities: [
          { id: "NMA-MG", name: "เมืองนครราชสีมา", value: 48, lat: 14.97, lng: 102.10, createAt: "2024-01-16", cats: { total: 48, leave: 6, shift: 12, issues: 10, wear: 13, other: 7 } },
          { id: "NMA-PK", name: "ปักธงชัย",         value: 22, lat: 14.69, lng: 102.10, createAt: "2023-08-28", cats: { total: 22, leave: 3, shift: 5, issues: 4, wear: 6, other: 4 } },
          { id: "NMA-SH", name: "สูงเนิน",          value: 17, lat: 14.89, lng: 101.85, createAt: "2026-02-09", cats: { total: 17, leave: 2, shift: 4, issues: 3, wear: 5, other: 3 } },
          { id: "NMA-BC", name: "บัวใหญ่",          value: 15, lat: 15.58, lng: 102.43, createAt: "2025-04-02", cats: { total: 15, leave: 2, shift: 4, issues: 3, wear: 4, other: 2 } },
        ],
      },
      {
        id: "TH-20", name: "ชลบุรี", value: 95, lat: 13.36, lng: 101.01, province: "ภาคตะวันออก",
        createAt: "2024-09-30", cats: { total: 113, leave: 15, shift: 27, issues: 23, wear: 30, other: 18 },
        cities: [
          { id: "CBI-MG", name: "เมืองชลบุรี", value: 38, lat: 13.36, lng: 100.99, createAt: "2023-11-20", cats: { total: 38, leave: 5, shift: 9, issues: 8, wear: 10, other: 6 } },
          { id: "CBI-SR", name: "ศรีราชา",     value: 30, lat: 13.17, lng: 100.92, createAt: "2025-03-07", cats: { total: 30, leave: 4, shift: 7, issues: 6, wear: 8, other: 5 } },
          { id: "CBI-PT", name: "พัทยา",       value: 25, lat: 12.93, lng: 100.88, createAt: "2024-06-18", cats: { total: 25, leave: 3, shift: 6, issues: 5, wear: 7, other: 4 } },
          { id: "CBI-BL", name: "บางละมุง",    value: 20, lat: 12.95, lng: 100.89, createAt: "2026-01-31", cats: { total: 20, leave: 3, shift: 5, issues: 4, wear: 5, other: 3 } },
        ],
      },
      {
        id: "TH-76", name: "เพชรบุรี", value: 67, lat: 13.11, lng: 99.93, province: "ภาคกลาง",
        createAt: "2023-04-17", cats: { total: 62, leave: 8, shift: 15, issues: 13, wear: 16, other: 10 },
        cities: [
          { id: "PBI-MG", name: "เมืองเพชรบุรี", value: 24, lat: 13.11, lng: 99.93, createAt: "2024-09-23", cats: { total: 24, leave: 3, shift: 6, issues: 5, wear: 6, other: 4 } },
          { id: "PBI-CP", name: "ชะอำ",          value: 20, lat: 12.79, lng: 99.97, createAt: "2023-04-14", cats: { total: 20, leave: 3, shift: 5, issues: 4, wear: 5, other: 3 } },
          { id: "PBI-HH", name: "หัวหิน",         value: 18, lat: 12.57, lng: 99.96, createAt: "2025-12-27", cats: { total: 18, leave: 2, shift: 4, issues: 4, wear: 5, other: 3 } },
        ],
      },
      {
        id: "TH-40", name: "ขอนแก่น", value: 91, lat: 16.44, lng: 102.83, province: "ภาคตะวันออก",
        createAt: "2025-06-25", cats: { total: 91, leave: 12, shift: 22, issues: 18, wear: 24, other: 15 },
        cities: [
          { id: "KKN-MG", name: "เมืองขอนแก่น", value: 40, lat: 16.44, lng: 102.83, createAt: "2024-03-05", cats: { total: 40, leave: 5, shift: 10, issues: 8, wear: 11, other: 6 } },
          { id: "KKN-NK", name: "น้ำพอง",       value: 22, lat: 16.63, lng: 102.83, createAt: "2023-10-19", cats: { total: 22, leave: 3, shift: 5, issues: 4, wear: 6, other: 4 } },
          { id: "KKN-BF", name: "บ้านฝาง",      value: 16, lat: 16.55, lng: 102.67, createAt: "2026-02-02", cats: { total: 16, leave: 2, shift: 4, issues: 3, wear: 4, other: 3 } },
          { id: "KKN-PY", name: "พล",           value: 13, lat: 16.18, lng: 102.62, createAt: "2025-06-14", cats: { total: 13, leave: 2, shift: 3, issues: 3, wear: 3, other: 2 } },
        ],
      },
      {
        id: "TH-80", name: "นครศรีธรรมราช", value: 75, lat: 8.43, lng: 99.96, province: "ภาคใต้",
        createAt: "2024-12-03", cats: { total: 70, leave: 9, shift: 16, issues: 14, wear: 19, other: 12 },
        cities: [
          { id: "NST-MG", name: "เมืองนครศรีธรรมราช", value: 34, lat: 8.43, lng: 99.96, createAt: "2023-07-28", cats: { total: 34, leave: 4, shift: 8, issues: 7, wear: 9, other: 6 } },
          { id: "NST-TO", name: "ทุ่งสง",              value: 22, lat: 8.16, lng: 99.68, createAt: "2025-01-22", cats: { total: 22, leave: 3, shift: 5, issues: 4, wear: 6, other: 4 } },
          { id: "NST-PK", name: "ปากพนัง",             value: 14, lat: 8.36, lng: 100.20, createAt: "2024-11-10", cats: { total: 14, leave: 2, shift: 3, issues: 3, wear: 4, other: 2 } },
        ],
      },
      {
        id: "TH-57", name: "เชียงราย", value: 83, lat: 19.91, lng: 99.84, province: "ภาคเหนือ",
        createAt: "2023-10-11", cats: { total: 83, leave: 11, shift: 20, issues: 17, wear: 23, other: 12 },
        cities: [
          { id: "CRI-MG", name: "เมืองเชียงราย", value: 36, lat: 19.91, lng: 99.84, createAt: "2026-01-06", cats: { total: 36, leave: 5, shift: 9, issues: 7, wear: 10, other: 5 } },
          { id: "CRI-MD", name: "แม่ดาว",        value: 18, lat: 20.11, lng: 99.90, createAt: "2024-08-31", cats: { total: 18, leave: 2, shift: 4, issues: 4, wear: 5, other: 3 } },
          { id: "CRI-CH", name: "เชียงของ",       value: 15, lat: 20.27, lng: 100.40, createAt: "2023-05-12", cats: { total: 15, leave: 2, shift: 4, issues: 3, wear: 4, other: 2 } },
          { id: "CRI-TN", name: "เทิง",           value: 14, lat: 19.80, lng: 100.07, createAt: "2025-09-24", cats: { total: 14, leave: 2, shift: 3, issues: 3, wear: 4, other: 2 } },
        ],
      },
      {
        id: "TH-60", name: "นครสวรรค์", value: 59, lat: 15.70, lng: 100.13, province: "ภาคกลาง",
        createAt: "2026-02-28", cats: { total: 52, leave: 7, shift: 12, issues: 10, wear: 14, other: 9 },
        cities: [
          { id: "NSW-MG", name: "เมืองนครสวรรค์", value: 26, lat: 15.70, lng: 100.13, createAt: "2024-05-28", cats: { total: 26, leave: 3, shift: 6, issues: 5, wear: 7, other: 5 } },
          { id: "NSW-TK", name: "ตากฟ้า",         value: 14, lat: 15.36, lng: 100.33, createAt: "2023-01-09", cats: { total: 14, leave: 2, shift: 3, issues: 3, wear: 4, other: 2 } },
          { id: "NSW-LP", name: "ลาดยาว",         value: 12, lat: 15.74, lng: 99.80, createAt: "2026-02-15", cats: { total: 12, leave: 2, shift: 3, issues: 2, wear: 3, other: 2 } },
        ],
      },
      {
        id: "TH-LOC", name: "ภาคทั้งหมด", value: 130, lat: 13.00, lng: 101.00, province: "ภาค",
        createAt: "2025-08-19", cats: { total: 1045, leave: 137, shift: 254, issues: 206, wear: 282, other: 166 },
      },
    ],
  },

  // ─── Japan ──────────────────────────────────────────────────────────────
  {
    id: "JP", name: "Japan", value: 430, lat: 35.6, lng: 139.7, country: "JP",
    createAt: "2023-03-30",
    cats: { total: 538, leave: 71, shift: 135, issues: 108, wear: 143, other: 81 },
    provinces: [
      { id: "JP-13", name: "Tokyo",    value: 120, lat: 35.69, lng: 139.69, createAt: "2024-05-16", cats: { total: 120, leave: 16, shift: 30, issues: 24, wear: 32, other: 18 } },
      { id: "JP-27", name: "Osaka",    value:  85, lat: 34.69, lng: 135.50, createAt: "2023-11-29", cats: { total:  85, leave: 11, shift: 21, issues: 17, wear: 23, other: 13 } },
      { id: "JP-14", name: "Kanagawa", value:  75, lat: 35.45, lng: 139.64, createAt: "2025-02-14", cats: { total:  75, leave: 10, shift: 19, issues: 15, wear: 20, other: 11 } },
      { id: "JP-23", name: "Aichi",    value:  60, lat: 35.18, lng: 136.91, createAt: "2026-01-08", cats: { total:  60, leave:  8, shift: 15, issues: 12, wear: 16, other:  9 } },
      { id: "JP-01", name: "Hokkaido", value:  45, lat: 43.06, lng: 141.35, createAt: "2024-08-21", cats: { total:  45, leave:  6, shift: 11, issues:  9, wear: 12, other:  7 } },
      { id: "JP-40", name: "Fukuoka",  value:  50, lat: 33.60, lng: 130.42, createAt: "2023-03-30", cats: { total:  50, leave:  7, shift: 13, issues: 10, wear: 13, other:  7 } },
      { id: "JP-28", name: "Hyogo",    value:  55, lat: 34.69, lng: 135.18, createAt: "2025-10-07", cats: { total:  55, leave:  7, shift: 14, issues: 11, wear: 14, other:  9 } },
      { id: "JP-11", name: "Saitama",  value:  48, lat: 35.86, lng: 139.65, createAt: "2024-01-25", cats: { total:  48, leave:  6, shift: 12, issues: 10, wear: 13, other:  7 } },
    ],
  },

  // ─── China ──────────────────────────────────────────────────────────────
  {
    id: "CN", name: "China", value: 610, lat: 39.9, lng: 116.4, country: "CN",
    createAt: "2023-06-18",
    cats: { total: 913, leave: 118, shift: 230, issues: 183, wear: 247, other: 135 },
    provinces: [
      { id: "CN-GD", name: "Guangdong", value: 155, lat: 23.37, lng: 113.50, createAt: "2023-06-18", cats: { total: 155, leave: 20, shift: 39, issues: 31, wear: 42, other: 23 } },
      { id: "CN-SD", name: "Shandong",  value: 120, lat: 36.67, lng: 117.00, createAt: "2025-04-03", cats: { total: 120, leave: 16, shift: 30, issues: 24, wear: 32, other: 18 } },
      { id: "CN-JS", name: "Jiangsu",   value: 110, lat: 32.97, lng: 119.45, createAt: "2024-10-12", cats: { total: 110, leave: 14, shift: 28, issues: 22, wear: 30, other: 16 } },
      { id: "CN-ZJ", name: "Zhejiang",  value:  95, lat: 29.15, lng: 119.79, createAt: "2026-02-22", cats: { total:  95, leave: 12, shift: 24, issues: 19, wear: 26, other: 14 } },
      { id: "CN-SH", name: "Shanghai",  value: 140, lat: 31.23, lng: 121.47, createAt: "2023-08-09", cats: { total: 140, leave: 18, shift: 35, issues: 28, wear: 38, other: 21 } },
      { id: "CN-BJ", name: "Beijing",   value: 130, lat: 39.90, lng: 116.40, createAt: "2025-12-01", cats: { total: 130, leave: 17, shift: 33, issues: 26, wear: 35, other: 19 } },
      { id: "CN-SC", name: "Sichuan",   value:  85, lat: 30.65, lng: 104.07, createAt: "2024-02-27", cats: { total:  85, leave: 11, shift: 21, issues: 17, wear: 23, other: 13 } },
      { id: "CN-HB", name: "Hubei",     value:  78, lat: 30.97, lng: 112.27, createAt: "2023-09-14", cats: { total:  78, leave: 10, shift: 20, issues: 16, wear: 21, other: 11 } },
    ],
  },

  // ─── India ──────────────────────────────────────────────────────────────
  {
    id: "IN", name: "India", value: 380, lat: 28.6, lng: 77.2, country: "IN",
    createAt: "2023-09-07",
    cats: { total: 483, leave: 63, shift: 122, issues: 97, wear: 130, other: 71 },
    provinces: [
      { id: "IN-MH", name: "Maharashtra",   value: 98, lat: 19.75, lng: 75.71, createAt: "2024-07-08", cats: { total: 98, leave: 13, shift: 25, issues: 20, wear: 26, other: 14 } },
      { id: "IN-UP", name: "Uttar Pradesh", value: 88, lat: 26.85, lng: 80.91, createAt: "2023-12-14", cats: { total: 88, leave: 11, shift: 22, issues: 18, wear: 24, other: 13 } },
      { id: "IN-TN", name: "Tamil Nadu",    value: 75, lat: 11.13, lng: 78.66, createAt: "2025-08-30", cats: { total: 75, leave: 10, shift: 19, issues: 15, wear: 20, other: 11 } },
      { id: "IN-WB", name: "West Bengal",   value: 68, lat: 22.99, lng: 87.85, createAt: "2024-03-22", cats: { total: 68, leave:  9, shift: 17, issues: 14, wear: 18, other: 10 } },
      { id: "IN-KA", name: "Karnataka",     value: 62, lat: 15.32, lng: 75.72, createAt: "2026-01-19", cats: { total: 62, leave:  8, shift: 16, issues: 12, wear: 17, other:  9 } },
      { id: "IN-DL", name: "Delhi",         value: 92, lat: 28.70, lng: 77.10, createAt: "2023-09-07", cats: { total: 92, leave: 12, shift: 23, issues: 18, wear: 25, other: 14 } },
    ],
  },

  // ─── Singapore (no provinces) ───────────────────────────────────────────
  {
    id: "SG", name: "Singapore", value: 210, lat: 1.35, lng: 103.8, country: "SG",
    createAt: "2024-05-12",
    cats: { total: 210, leave: 27, shift: 53, issues: 42, wear: 57, other: 31 },
  },

  // ─── Malaysia ───────────────────────────────────────────────────────────
  {
    id: "MY", name: "Malaysia", value: 195, lat: 3.14, lng: 101.7, country: "MY",
    createAt: "2023-02-28",
    cats: { total: 310, leave: 40, shift: 79, issues: 62, wear: 83, other: 46 },
    provinces: [
      { id: "MY-14", name: "Kuala Lumpur", value: 88, lat: 3.14, lng: 101.69, createAt: "2025-10-16", cats: { total: 88, leave: 11, shift: 22, issues: 18, wear: 24, other: 13 } },
      { id: "MY-10", name: "Selangor",     value: 72, lat: 3.38, lng: 101.51, createAt: "2024-06-13", cats: { total: 72, leave:  9, shift: 18, issues: 14, wear: 20, other: 11 } },
      { id: "MY-07", name: "Johor",        value: 58, lat: 1.86, lng: 103.35, createAt: "2023-02-28", cats: { total: 58, leave:  8, shift: 15, issues: 12, wear: 15, other:  8 } },
      { id: "MY-08", name: "Kedah",        value: 42, lat: 6.12, lng: 100.37, createAt: "2026-02-04", cats: { total: 42, leave:  5, shift: 11, issues:  8, wear: 11, other:  7 } },
      { id: "MY-12", name: "Sabah",        value: 50, lat: 5.98, lng: 116.07, createAt: "2025-03-21", cats: { total: 50, leave:  7, shift: 13, issues: 10, wear: 13, other:  7 } },
    ],
  },

  // ─── USA ────────────────────────────────────────────────────────────────
  {
    id: "US", name: "USA", value: 520, lat: 38.9, lng: -77.0, country: "US",
    createAt: "2023-05-26",
    cats: { total: 580, leave: 74, shift: 146, issues: 116, wear: 158, other: 86 },
    provinces: [
      { id: "US-CA", name: "California",   value:  95, lat: 36.78, lng: -119.42, createAt: "2025-07-19", cats: { total:  95, leave: 12, shift: 24, issues: 19, wear: 26, other: 14 } },
      { id: "US-TX", name: "Texas",        value:  88, lat: 31.97, lng:  -99.90, createAt: "2024-04-06", cats: { total:  88, leave: 11, shift: 22, issues: 18, wear: 24, other: 13 } },
      { id: "US-NY", name: "New York",     value: 110, lat: 43.00, lng:  -75.00, createAt: "2023-12-21", cats: { total: 110, leave: 14, shift: 28, issues: 22, wear: 30, other: 16 } },
      { id: "US-FL", name: "Florida",      value:  72, lat: 27.99, lng:  -81.76, createAt: "2026-01-17", cats: { total:  72, leave:  9, shift: 18, issues: 14, wear: 20, other: 11 } },
      { id: "US-IL", name: "Illinois",     value:  55, lat: 40.35, lng:  -88.99, createAt: "2025-03-08", cats: { total:  55, leave:  7, shift: 14, issues: 11, wear: 15, other:  8 } },
      { id: "US-WA", name: "Washington",   value:  48, lat: 47.75, lng: -120.74, createAt: "2024-07-31", cats: { total:  48, leave:  6, shift: 12, issues: 10, wear: 13, other:  7 } },
      { id: "US-PA", name: "Pennsylvania", value:  60, lat: 41.20, lng:  -77.19, createAt: "2023-05-26", cats: { total:  60, leave:  8, shift: 15, issues: 12, wear: 16, other:  9 } },
      { id: "US-GA", name: "Georgia",      value:  52, lat: 32.16, lng:  -82.90, createAt: "2025-11-13", cats: { total:  52, leave:  7, shift: 13, issues: 10, wear: 14, other:  8 } },
    ],
  },

  // ─── UK ─────────────────────────────────────────────────────────────────
  {
    id: "GB", name: "UK", value: 280, lat: 51.5, lng: -0.12, country: "GB",
    createAt: "2023-06-03",
    cats: { total: 266, leave: 35, shift: 67, issues: 54, wear: 71, other: 39 },
    provinces: [
      { id: "GB-ENG", name: "England",    value: 145, lat: 52.50, lng: -1.50, createAt: "2025-04-20", cats: { total: 145, leave: 19, shift: 36, issues: 29, wear: 39, other: 22 } },
      { id: "GB-SCT", name: "Scotland",   value:  55, lat: 56.80, lng: -4.20, createAt: "2024-08-15", cats: { total:  55, leave:  7, shift: 14, issues: 11, wear: 15, other:  8 } },
      { id: "GB-WLS", name: "Wales",      value:  38, lat: 52.13, lng: -3.78, createAt: "2023-06-03", cats: { total:  38, leave:  5, shift: 10, issues:  8, wear: 10, other:  5 } },
      { id: "GB-NIR", name: "N. Ireland", value:  28, lat: 54.61, lng: -6.72, createAt: "2026-02-07", cats: { total:  28, leave:  4, shift:  7, issues:  6, wear:  7, other:  4 } },
    ],
  },

  // ─── Germany ────────────────────────────────────────────────────────────
  {
    id: "DE", name: "Germany", value: 240, lat: 52.5, lng: 13.4, country: "DE",
    createAt: "2023-03-28",
    cats: { total: 390, leave: 50, shift: 98, issues: 78, wear: 106, other: 58 },
    provinces: [
      { id: "DE-BY", name: "Bavaria",      value: 88, lat: 48.79, lng: 11.50, createAt: "2024-09-19", cats: { total: 88, leave: 11, shift: 22, issues: 18, wear: 24, other: 13 } },
      { id: "DE-NW", name: "N. Rhine-W.",  value: 95, lat: 51.43, lng:  7.66, createAt: "2023-03-28", cats: { total: 95, leave: 12, shift: 24, issues: 19, wear: 26, other: 14 } },
      { id: "DE-BE", name: "Berlin",       value: 75, lat: 52.52, lng: 13.40, createAt: "2025-07-14", cats: { total: 75, leave: 10, shift: 19, issues: 15, wear: 20, other: 11 } },
      { id: "DE-BW", name: "Baden-Württ.", value: 72, lat: 48.66, lng:  9.47, createAt: "2024-01-31", cats: { total: 72, leave:  9, shift: 18, issues: 14, wear: 20, other: 11 } },
      { id: "DE-HH", name: "Hamburg",      value: 60, lat: 53.55, lng:  9.99, createAt: "2026-02-05", cats: { total: 60, leave:  8, shift: 15, issues: 12, wear: 16, other:  9 } },
    ],
  },

  // ─── France ─────────────────────────────────────────────────────────────
  {
    id: "FR", name: "France", value: 195, lat: 48.8, lng: 2.35, country: "FR",
    createAt: "2023-08-22",
    cats: { total: 343, leave: 44, shift: 87, issues: 69, wear: 93, other: 50 },
    provinces: [
      { id: "FR-IDF", name: "Île-de-France",    value: 110, lat: 48.85, lng:  2.35, createAt: "2023-10-23", cats: { total: 110, leave: 14, shift: 28, issues: 22, wear: 30, other: 16 } },
      { id: "FR-ARA", name: "Auvergne-RA",      value:  70, lat: 45.75, lng:  4.85, createAt: "2025-05-17", cats: { total:  70, leave:  9, shift: 18, issues: 14, wear: 19, other: 10 } },
      { id: "FR-NAQ", name: "Nouvelle-Aquit.",   value:  60, lat: 44.84, lng: -0.58, createAt: "2024-03-09", cats: { total:  60, leave:  8, shift: 15, issues: 12, wear: 16, other:  9 } },
      { id: "FR-OCC", name: "Occitanie",        value:  55, lat: 43.60, lng:  1.44, createAt: "2026-01-15", cats: { total:  55, leave:  7, shift: 14, issues: 11, wear: 15, other:  8 } },
      { id: "FR-PDL", name: "Pays de la Loire", value:  48, lat: 47.48, lng: -0.55, createAt: "2023-08-22", cats: { total:  48, leave:  6, shift: 12, issues: 10, wear: 13, other:  7 } },
    ],
  },

  // ─── Australia ──────────────────────────────────────────────────────────
  {
    id: "AU", name: "Australia", value: 170, lat: -33.9, lng: 151.2, country: "AU",
    createAt: "2023-07-15",
    cats: { total: 317, leave: 41, shift: 81, issues: 63, wear: 85, other: 47 },
    provinces: [
      { id: "AU-NSW", name: "New South Wales", value: 88, lat: -32.00, lng: 147.00, createAt: "2023-07-15", cats: { total: 88, leave: 11, shift: 22, issues: 18, wear: 24, other: 13 } },
      { id: "AU-VIC", name: "Victoria",        value: 75, lat: -37.00, lng: 144.00, createAt: "2025-01-29", cats: { total: 75, leave: 10, shift: 19, issues: 15, wear: 20, other: 11 } },
      { id: "AU-QLD", name: "Queensland",      value: 62, lat: -22.00, lng: 144.00, createAt: "2024-05-10", cats: { total: 62, leave:  8, shift: 16, issues: 12, wear: 17, other:  9 } },
      { id: "AU-WA",  name: "W. Australia",    value: 50, lat: -26.00, lng: 121.00, createAt: "2026-01-24", cats: { total: 50, leave:  7, shift: 13, issues: 10, wear: 13, other:  7 } },
      { id: "AU-SA",  name: "S. Australia",    value: 42, lat: -30.00, lng: 135.00, createAt: "2023-11-06", cats: { total: 42, leave:  5, shift: 11, issues:  8, wear: 11, other:  7 } },
    ],
  },

  // ─── Brazil ─────────────────────────────────────────────────────────────
  {
    id: "BR", name: "Brazil", value: 145, lat: -15.8, lng: -47.9, country: "BR",
    createAt: "2023-04-05",
    cats: { total: 365, leave: 47, shift: 91, issues: 73, wear: 99, other: 55 },
    provinces: [
      { id: "BR-SP", name: "São Paulo",      value: 105, lat: -23.55, lng: -46.63, createAt: "2025-06-11", cats: { total: 105, leave: 14, shift: 26, issues: 21, wear: 28, other: 16 } },
      { id: "BR-RJ", name: "Rio de Janeiro", value:  88, lat: -22.91, lng: -43.17, createAt: "2024-10-27", cats: { total:  88, leave: 11, shift: 22, issues: 18, wear: 24, other: 13 } },
      { id: "BR-MG", name: "Minas Gerais",   value:  72, lat: -19.92, lng: -43.94, createAt: "2023-04-05", cats: { total:  72, leave:  9, shift: 18, issues: 14, wear: 20, other: 11 } },
      { id: "BR-BA", name: "Bahia",          value:  60, lat: -12.97, lng: -38.50, createAt: "2026-02-01", cats: { total:  60, leave:  8, shift: 15, issues: 12, wear: 16, other:  9 } },
      { id: "BR-AM", name: "Amazonas",       value:  40, lat:  -3.10, lng: -60.02, createAt: "2025-02-23", cats: { total:  40, leave:  5, shift: 10, issues:  8, wear: 11, other:  6 } },
    ],
  },

  // ─── South Africa (no provinces) ────────────────────────────────────────
  {
    id: "ZA", name: "South Africa", value: 115, lat: -26.2, lng: 28.0, country: "ZA",
    createAt: "2024-08-19",
    cats: { total: 115, leave: 15, shift: 29, issues: 23, wear: 31, other: 17 },
  },

  // ─── Nigeria (no provinces) ─────────────────────────────────────────────
  {
    id: "NG", name: "Nigeria", value: 88, lat: 9.07, lng: 7.40, country: "NG",
    createAt: "2025-01-10",
    cats: { total: 88, leave: 11, shift: 22, issues: 18, wear: 24, other: 13 },
  },

  // ─── South Korea ────────────────────────────────────────────────────────
  {
    id: "KR", name: "South Korea", value: 265, lat: 37.5, lng: 127.0, country: "KR",
    createAt: "2023-02-16",
    cats: { total: 353, leave: 45, shift: 89, issues: 71, wear: 96, other: 52 },
    provinces: [
      { id: "KR-11", name: "Seoul",    value: 98, lat: 37.57, lng: 126.98, createAt: "2024-06-04", cats: { total: 98, leave: 13, shift: 25, issues: 20, wear: 26, other: 14 } },
      { id: "KR-26", name: "Busan",    value: 72, lat: 35.18, lng: 129.08, createAt: "2023-02-16", cats: { total: 72, leave:  9, shift: 18, issues: 14, wear: 20, other: 11 } },
      { id: "KR-27", name: "Daegu",    value: 55, lat: 35.87, lng: 128.60, createAt: "2026-02-11", cats: { total: 55, leave:  7, shift: 14, issues: 11, wear: 15, other:  8 } },
      { id: "KR-41", name: "Gyeonggi", value: 88, lat: 37.41, lng: 127.52, createAt: "2025-09-28", cats: { total: 88, leave: 11, shift: 22, issues: 18, wear: 24, other: 13 } },
      { id: "KR-42", name: "Gangwon",  value: 40, lat: 37.56, lng: 128.21, createAt: "2024-11-07", cats: { total: 40, leave:  5, shift: 10, issues:  8, wear: 11, other:  6 } },
    ],
  },
];

// ── Backward-compatible flat exports ────────────────────────────────────────
// Derived from geoData so the GeoChartSection component still works unchanged.

export const worldData: GeoPoint[] = geoData.map((c) => {
  const { id, name, value, lat, lng, country, createAt, cats } = c;
  return { id, name, value, lat, lng, country, createAt, cats };
});

export const countryData: Record<string, GeoPoint[]> = Object.fromEntries(
  geoData
    .filter((c) => c.provinces)
    .map((c) => [
      c.country!,
      c.provinces!.map((p) => {
        const { id, name, value, lat, lng, province, createAt, cats } = p;
        return { id, name, value, lat, lng, province, createAt, cats } as GeoPoint;
      }),
    ])
);

export const cityData: Record<string, GeoPoint[]> = Object.fromEntries(
  geoData.flatMap((c) =>
    (c.provinces ?? [])
      .filter((p) => p.cities)
      .map((p) => [p.id, p.cities!])
  )
);

export type ZoomLevel = "world" | "country" | "city";
