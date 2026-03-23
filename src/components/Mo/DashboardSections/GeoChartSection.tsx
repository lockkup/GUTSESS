import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { MapContainer, TileLayer, Marker as LeafletMarker, Tooltip as LeafletTooltip, GeoJSON as LeafletGeoJSON, useMap } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Feature } from "geojson";
import {
  geoData,
  type GeoPoint,
  type ZoomLevel,
} from "@/temp_data/geo_data";
import "./GeoChartSection.css";

// ── Derive flat views from the combined geoData tree ──────────────────────────
const _worldData: GeoPoint[] = geoData.map((c) => {
  const { id, name, value, lat, lng, country, createAt, cats } = c;
  return { id, name, value, lat, lng, country, createAt, cats };
});

const countryData: Record<string, GeoPoint[]> = Object.fromEntries(
  geoData
    .filter((c) => c.provinces)
    .map((c) => [
      c.country!,
      c.provinces!.map((p) => {
        const { id, name, value, lat, lng, province, createAt, cats } = p;
        return { id, name, value, lat, lng, province, createAt, cats } as GeoPoint;
      }),
    ]),
);

const cityData: Record<string, GeoPoint[]> = Object.fromEntries(
  geoData.flatMap((c) =>
    (c.provinces ?? [])
      .filter((p) => p.cities)
      .map((p) => [p.id, p.cities!]),
  ),
);

// English search names for Thai provinces (Nominatim needs English)
const TH_EN_NAME: Record<string, string> = {
  "TH-10": "Bangkok",
  "TH-50": "Chiang Mai",
  "TH-90": "Songkhla",
  "TH-30": "Nakhon Ratchasima",
  "TH-20": "Chonburi",
  "TH-76": "Phetchaburi",
  "TH-40": "Khon Kaen",
  "TH-80": "Nakhon Si Thammarat",
  "TH-57": "Chiang Rai",
  "TH-60": "Nakhon Sawan",
};

// Module-level cache: "CC-provinceId" → GeoJSON Feature (persists across re-renders)
const boundaryCache = new Map<string, Feature>();

// Category definitions — must match GeoPoint.cats keys
const CAT_COLORS: { key: Exclude<keyof NonNullable<GeoPoint["cats"]>, "total">; label: string; color: string }[] = [
  { key: "leave",  label: "ลา",             color: "#4e9af1" },
  { key: "shift",  label: "เวร",            color: "#f4a34a" },
  { key: "issues", label: "ผิดระเบียบ",     color: "#e06b8b" },
  { key: "wear",   label: "เครื่องแต่งกาย", color: "#6dcf81" },
  { key: "other",  label: "อื่นๆ",          color: "#a78bfa" },
];

/** Build a circular pie-segment HTML string for use in a Leaflet divIcon.
 *  Only slices whose category key is in `activeCats` are rendered.
 */
function buildPieHtml(
  cats: NonNullable<GeoPoint["cats"]>,
  size: number,
  activeCats: Set<string>,
): string {
  const visible = CAT_COLORS.filter((c) => activeCats.has(c.key));
  const total = visible.reduce((s, c) => s + cats[c.key], 0);
  if (total === 0) {
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#555;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`;
  }
  const cx = size / 2, cy = size / 2, r = (size - 5) / 2;
  let angle = -Math.PI / 2;
  const slices = visible.map(({ key, color }) => {
    const frac = cats[key] / total;
    const startAngle = angle;
    angle += frac * 2 * Math.PI;
    return { color, startAngle, endAngle: angle, frac };
  }).filter(s => s.frac > 0);

  const paths = slices.map(({ color, startAngle, endAngle }) => {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    return `<path d="M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${color}" />`;
  }).join("");

  const fontSize = Math.max(8, Math.round(size * 0.28));
  return `<svg width="${size}" height="${size}" style="display:block;filter:drop-shadow(0 1px 3px rgba(0,0,0,.4));border-radius:50%;overflow:hidden">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#33333310"/>
    ${paths}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="2.5"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="700" fill="#fff" style="pointer-events:none">${total}</text>
  </svg>`;
}

const LEAFLET_MIN_ZOOM = 7;

/** Auto-fits the map to show all markers whenever points change. */
function FitBoundsOnPoints({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  useEffect(() => {
    map.setMinZoom(LEAFLET_MIN_ZOOM);
    if (points.length === 0) return;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [48, 48], maxZoom: 14 }
    );
  }, [map, points]);
  return null;
}

// ── City-level Leaflet map ────────────────────────────────────────────────────
function CityLeafletMap({
  points, minVal, maxVal, provinceId, country, provinceName, fallbackCenter, activeCats, showPie,
}: {
  points: GeoPoint[];
  minVal: number;
  maxVal: number;
  provinceId: string | null;
  country: string | null;
  provinceName: string;
  fallbackCenter: [number, number];
  activeCats: Set<string>;
  showPie: boolean;
}) {
  const [boundaryState, setBoundaryState] = useState<{ id: string; feature: Feature } | null>(null);
  // Derive boundary: prefer cache (instant), fall back to async fetch result
  const cacheKey = provinceId && country ? `${country}-${provinceId}` : null;
  const boundary: Feature | null = cacheKey && boundaryCache.has(cacheKey)
    ? boundaryCache.get(cacheKey)!
    : boundaryState?.id === provinceId
      ? boundaryState.feature
      : null;

  useEffect(() => {
    if (!provinceId || !country || !cacheKey) return;
    // Already cached — no fetch needed
    if (boundaryCache.has(cacheKey)) return;
    // For TH use English name map; for others use the province name directly
    const searchName = country === "TH"
      ? (TH_EN_NAME[provinceId] ?? provinceName)
      : provinceName;
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(searchName)}` +
      `&countrycodes=${country.toLowerCase()}` +
      `&polygon_geojson=1&format=geojson&limit=1`;
    let cancelled = false;
    fetch(url, { headers: { "User-Agent": "GUTSESS-Dashboard/1.0" } })
      .then((r) => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((fc: any) => {
        if (cancelled) return;
        const found: Feature | null = fc.features?.[0] ?? null;
        if (found) {
          boundaryCache.set(cacheKey, found);
          setBoundaryState({ id: provinceId, feature: found });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [provinceId, country, provinceName, cacheKey]);

  const center: [number, number] = useMemo(() => {
    if (points.length > 0)
      return [
        points.reduce((s, p) => s + p.lat, 0) / points.length,
        points.reduce((s, p) => s + p.lng, 0) / points.length,
      ];
    return fallbackCenter;
  }, [points, fallbackCenter]);

  return (
    <MapContainer
      key={provinceId ?? center.join(",")}
      center={center}
      zoom={points.length > 0 ? 9 : 8}
      minZoom={LEAFLET_MIN_ZOOM}
      scrollWheelZoom
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        minZoom={LEAFLET_MIN_ZOOM}
      />
      <FitBoundsOnPoints points={points} />
      {boundary && (
        <LeafletGeoJSON
          key={provinceId ?? "none"}
          data={boundary}
          style={{
            color: "#7eb8f7",
            weight: 3,
            fillColor: "#7eb8f7",
            fillOpacity: 0.12,
          }}
        />
      )}
      {points.map((point) => {
        const t = maxVal === minVal ? 0.5 : (point.value - minVal) / (maxVal - minVal);
        const size = Math.round((20 + t * 36));
        const color = valueColor(point.value, minVal, maxVal);
        const fontSize = Math.max(9, Math.round(size * 0.38));

        // Use pie-segment icon when category breakdown is available and showPie is true
        const html = (point.cats && showPie)
          ? buildPieHtml(point.cats, size, activeCats)
          : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${fontSize}px;line-height:1;pointer-events:none">${point.value}</div>`;

        const icon = divIcon({
          className: "",
          html,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        // Tooltip: show category breakdown if available and showPie is true
        const tooltipContent = (point.cats && showPie)
          ? CAT_COLORS.map(c => `${c.label}: ${point.cats![c.key]}`).join(" | ")
          : `${point.name}: ${point.value.toLocaleString()}`;

        return (
          <LeafletMarker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={icon}
          >
            <LeafletTooltip direction="top" offset={[0, -(size / 2) - 4]}>
              <strong>{point.name}</strong><br />{tooltipContent}
            </LeafletTooltip>
          </LeafletMarker>
        );
      })}
    </MapContainer>
  );
}

const WORLD_TOPO = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const COUNTRY_10M  = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json";

// Country-specific detailed TopoJSON (province/state level).
// Only TH is included — apisit/thailand.json uses geographic (lat/lng) coordinates.
// us-atlas states-10m.json is excluded because it uses pre-projected Albers USA coordinates
// which conflict with react-simple-maps' own projection step.
// All other countries fall back to world-atlas countries-10m.json, filtered to the country outline.
const COUNTRY_TOPO: Record<string, string> = {
  TH: "https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json",
};

// ISO-2 → ISO numeric (used to filter world-atlas features by country)
const ISO_NUMERIC: Record<string, string> = {
  TH: "764", JP: "392", CN: "156", IN: "356", SG: "702",
  MY: "458", US: "840", GB: "826", DE: "276", FR: "250",
  AU: "036", BR: "076", ZA: "710", NG: "566", KR: "410",
};

// Per-country projection: { scale, center } — used for both dedicated + 10m maps
const COUNTRY_PROJ: Record<string, { scale: number; center: [number, number] }> = {
  TH: { scale: 1800, center: [101.0, 13.0] },
  JP: { scale: 1400, center: [138.0, 37.0] },
  CN: { scale:  600, center: [105.0, 35.0] },
  IN: { scale:  900, center: [79.0,  22.0] },
  SG: { scale: 28000, center: [103.8, 1.35] },
  MY: { scale: 1800, center: [109.5,  3.5] },
  US: { scale:  420, center: [-98.0, 39.5] },
  GB: { scale: 2500, center: [ -3.0, 54.0] },
  DE: { scale: 2500, center: [ 10.5, 51.2] },
  FR: { scale: 2000, center: [  2.5, 46.5] },
  AU: { scale:  500, center: [134.0,-25.0] },
  BR: { scale:  500, center: [-52.0,-14.0] },
  ZA: { scale: 1200, center: [ 25.0,-29.0] },
  NG: { scale: 1800, center: [  8.5,  9.5] },
  KR: { scale: 3000, center: [128.0, 36.5] },
};

// Fallback for countries without dedicated TopoJSON
const COUNTRY_CENTER: Record<string, [number, number]> = {};
Object.entries(COUNTRY_PROJ).forEach(([k, v]) => { COUNTRY_CENTER[k] = v.center; });
const COUNTRY_ZOOM = 6;

function valueColor(value: number, min: number, max: number): string {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  // red → yellow → green
  if (t < 0.5) {
    const r = 220;
    const g = Math.round(t * 2 * 200);
    return `rgb(${r},${g},30)`;
  } else {
    const r = Math.round((1 - (t - 0.5) * 2) * 200);
    const g = 180;
    return `rgb(${r},${g},30)`;
  }
}

// Returns a radius in SVG units that stays visually proportional after ZoomableGroup scaling.
// Base pixel sizes shrink at deeper levels; dividing by mapZoom cancels the zoom scale-up.
function markerRadius(
  value: number,
  min: number,
  max: number,
  zoomLevel: ZoomLevel,
  mapZoom: number,
): number {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  const [minR, maxR] =
    zoomLevel === "world" ? [5, 22] :
    zoomLevel === "country" ? [3, 12] :
    [2, 7];
  return (minR + t * (maxR - minR)) / mapZoom;
}

/** SVG pie-segment group for use inside react-simple-maps <Marker>.
 *  Centered at (0,0) so it aligns with the marker anchor.
 */
function SvgPieSlices({ cats, r, activeCats, mapZoom }: {
  cats: NonNullable<GeoPoint["cats"]>;
  r: number;
  activeCats: Set<string>;
  mapZoom: number;
}) {
  const visible = CAT_COLORS.filter((c) => activeCats.has(c.key));
  const total = visible.reduce((s, c) => s + cats[c.key], 0);
  if (total === 0)
    return <circle r={r} fill="#555" stroke="#fff" strokeWidth={1.2 / mapZoom} style={{ pointerEvents: "none" }} />;

  const slices = visible.reduce<{ color: string; startAngle: number; endAngle: number }[]>((acc, { key, color }) => {
    const frac = cats[key] / total;
    if (frac <= 0) return acc;
    const startAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : -Math.PI / 2;
    const endAngle = startAngle + frac * 2 * Math.PI;
    acc.push({ color, startAngle, endAngle });
    return acc;
  }, []);

  return (
    <g style={{ pointerEvents: "none" }}>
      {slices.map(({ color, startAngle, endAngle }, i) => {
        const x1 = r * Math.cos(startAngle);
        const y1 = r * Math.sin(startAngle);
        const x2 = r * Math.cos(endAngle);
        const y2 = r * Math.sin(endAngle);
        const large = endAngle - startAngle > Math.PI ? 1 : 0;
        return (
          <path
            key={i}
            d={`M0,0 L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`}
            fill={color}
          />
        );
      })}
      <circle r={r} fill="none" stroke="#fff" strokeWidth={1.2 / mapZoom} />
    </g>
  );
}

export default function GeoChart() {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("world");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [geoLoaded, setGeoLoaded] = useState(true);

  // ── Year / month filter — derived from createAt ("YYYY-MM-DD") ──────────────────
  const [selectedYear, setSelectedYear] = useState<number | "all">("all");
  const [selectedMonth, setSelectedMonth] = useState<number | "all">("all");

  // Unfiltered points for the current zoom level
  const rawPoints: GeoPoint[] = useMemo(() => {
    if (zoomLevel === "city" && selectedProvince) return cityData[selectedProvince] ?? [];
    if (zoomLevel === "country" && selectedCountry) return countryData[selectedCountry] ?? [];
    return _worldData;
  }, [zoomLevel, selectedCountry, selectedProvince]);

  const availableYears = useMemo(() => {
    const yrs = new Set<number>();
    rawPoints.forEach((p) => { if (p.createAt) yrs.add(Number(p.createAt.slice(0, 4))); });
    return Array.from(yrs).sort();
  }, [rawPoints]);

  const availableMonths = useMemo(() => {
    const ms = new Set<number>();
    rawPoints.forEach((p) => {
      if (!p.createAt) return;
      if (selectedYear !== "all" && Number(p.createAt.slice(0, 4)) !== selectedYear) return;
      ms.add(Number(p.createAt.slice(5, 7)));
    });
    return Array.from(ms).sort((a, b) => a - b);
  }, [rawPoints, selectedYear]);

  // ── Active categories (toggleable legend) ──────────────────────────────────
  const [activeCats, setActiveCats] = useState<Set<string>>(
    () => new Set(CAT_COLORS.map((c) => c.key)),
  );

  // ── View mode stepper (sector ↔ categories) ────────────────────────────────
  const DATA_VIEWS = ["sector", "categories"] as const;
  type DataView = typeof DATA_VIEWS[number];
  const [selectedView, setSelectedView] = useState<DataView>("categories");
  const toggleCat = (key: string) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  // Apply year/month filter at every zoom level
  const currentPoints: GeoPoint[] = useMemo(() => {
    return rawPoints.filter((p) => {
      if (!p.createAt) return true;
      if (selectedYear !== "all" && Number(p.createAt.slice(0, 4)) !== selectedYear) return false;
      if (selectedMonth !== "all" && Number(p.createAt.slice(5, 7)) !== selectedMonth) return false;
      return true;
    });
  }, [rawPoints, selectedYear, selectedMonth]);

  const hasCats = currentPoints.some((p) => p.cats);

  const minVal = Math.min(...currentPoints.map((p) => p.value));
  const maxVal = Math.max(...currentPoints.map((p) => p.value));

  const mapCenter: [number, number] = useMemo(() => {
    if (zoomLevel === "country" && selectedCountry)
      return COUNTRY_CENTER[selectedCountry] ?? [0, 20];
    if (zoomLevel === "city" && selectedProvince) {
      const pts = cityData[selectedProvince] ?? [];
      if (pts.length === 0) return [100.5, 13.7];
      const avgLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
      const avgLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
      return [avgLng, avgLat];
    }
    return [30, 15];
  }, [zoomLevel, selectedCountry, selectedProvince]);

  const hasDedicatedMap = !!(selectedCountry && COUNTRY_TOPO[selectedCountry]);
  const hasCountryProj  = !!(selectedCountry && COUNTRY_PROJ[selectedCountry]);

  // When projection handles framing, ZoomableGroup zoom stays at 1
  const mapZoom = zoomLevel === "world" ? 1 : (hasDedicatedMap || hasCountryProj) ? 1 : zoomLevel === "country" ? COUNTRY_ZOOM : 18;

  // TopoJSON source:
  //  - world view  → low-res world atlas
  //  - country with dedicated file (TH) → province-level file
  //  - any other country → high-res 10m world atlas, filtered to that country
  const geoUrl =
    zoomLevel === "world" ? WORLD_TOPO :
    (selectedCountry && COUNTRY_TOPO[selectedCountry]) ? COUNTRY_TOPO[selectedCountry] :
    COUNTRY_10M;

  // Whether to filter geographies to the selected country only (10m path)
  const filterToCountry = zoomLevel !== "world" && !hasDedicatedMap && !!selectedCountry;
  const selectedISO = selectedCountry ? (ISO_NUMERIC[selectedCountry] ?? null) : null;

  const projectionConfig = useMemo<{ scale: number; center?: [number, number] }>(() => {
    if (zoomLevel !== "world" && selectedCountry && COUNTRY_PROJ[selectedCountry]) {
      const cfg = COUNTRY_PROJ[selectedCountry];
      if (zoomLevel === "city" && selectedProvince) {
        const pts = cityData[selectedProvince] ?? [];
        const cx = pts.length ? pts.reduce((s, p) => s + p.lng, 0) / pts.length : cfg.center[0];
        const cy = pts.length ? pts.reduce((s, p) => s + p.lat, 0) / pts.length : cfg.center[1];
        return { scale: cfg.scale * 20, center: [cx, cy] };
      }
      return { scale: cfg.scale, center: cfg.center };
    }
    return { scale: 147 };
  }, [zoomLevel, selectedCountry, selectedProvince]);

  // Center for ZoomableGroup (only used when no projection config available)
  const zgCenter = (hasDedicatedMap || hasCountryProj)
    ? (projectionConfig.center ?? [0, 0] as [number, number])
    : mapCenter;

  const handleMarkerClick = useCallback((point: GeoPoint) => {
    if (zoomLevel === "world" && point.country && COUNTRY_PROJ[point.country]) {
      setGeoLoaded(false);
      setSelectedCountry(point.country);
      setZoomLevel("country");
    } else if (zoomLevel === "country") {
      setSelectedProvince(point.id);
      setZoomLevel("city");
    }
  }, [zoomLevel]);

  const handleBack = () => {
    if (zoomLevel === "city") { setZoomLevel("country"); setSelectedProvince(null); }
    else if (zoomLevel === "country") { setGeoLoaded(false); setZoomLevel("world"); setSelectedCountry(null); }
  };

  const selectedProvinceName = useMemo(() => {
    if (!selectedCountry || !selectedProvince) return "";
    return countryData[selectedCountry]?.find((p) => p.id === selectedProvince)?.name ?? selectedProvince;
  }, [selectedCountry, selectedProvince]);

  const levelLabel = zoomLevel === "world" ? "โลก" : zoomLevel === "country" ? selectedCountry ?? "" : selectedProvinceName;

  const legendMin = minVal;
  const legendMax = maxVal;

  const mapWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = mapWrapRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);

  return (
    <div className="gc-card">
      <div className="gc-header">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {zoomLevel !== "world" && (
            <button className="gc-back-btn" onClick={handleBack} aria-label="Back">‹</button>
          )}
          <h2 className="gc-title">
            การกระจาย — <span className="gc-level">{levelLabel}</span>
          </h2>
        </div>
        <div className="gc-breadcrumb">
          <span
            className={`gc-crumb${zoomLevel === "world" ? " gc-crumb--active" : ""}`}
            onClick={() => { setZoomLevel("world"); setSelectedCountry(null); setSelectedProvince(null); }}
          >โลก</span>
          {selectedCountry && (
            <>
              <span className="gc-sep">›</span>
              <span
                className={`gc-crumb${zoomLevel === "country" ? " gc-crumb--active" : ""}`}
                onClick={() => { setZoomLevel("country"); setSelectedProvince(null); }}
              >{selectedCountry}</span>
            </>
          )}
          {selectedProvince && (
            <>
              <span className="gc-sep">›</span>
              <span className="gc-crumb gc-crumb--active">{selectedProvinceName}</span>
            </>
          )}
        </div>
      </div>

      <div ref={mapWrapRef} className="gc-map-wrap">
        {!geoLoaded && zoomLevel !== "city" && (
          <div className="gc-loading">
            <div className="gc-spinner" />
          </div>
        )}
        {zoomLevel === "city" ? (
          <CityLeafletMap
            points={currentPoints}
            minVal={minVal}
            maxVal={maxVal}
            provinceId={selectedProvince}
            country={selectedCountry}
            provinceName={selectedProvinceName}
            activeCats={activeCats}
            showPie={selectedView === "categories"}
            fallbackCenter={(() => {
              if (!selectedCountry || !selectedProvince) return [13.75, 100.52] as [number, number];
              const prov = countryData[selectedCountry]?.find((p) => p.id === selectedProvince);
              return prov ? [prov.lat, prov.lng] as [number, number] : [13.75, 100.52] as [number, number];
            })()}
          />
        ) : (
        <ComposableMap
          key={`cmap-${zoomLevel}-${selectedCountry ?? ""}-${selectedProvince ?? ""}`}
          projectionConfig={projectionConfig}
          style={{ width: "100%", height: "100%" }}
        >
          <ZoomableGroup
            key={`zg-${zoomLevel}-${selectedCountry ?? ""}-${selectedProvince ?? ""}`}
            center={zgCenter as [number, number]}
            zoom={mapZoom}
            maxZoom={40}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) => {
                if (!geoLoaded) setTimeout(() => setGeoLoaded(true), 0);
                const visibleGeos = filterToCountry
                  ? geographies.filter((g) => String(g.id) === selectedISO)
                  : geographies;
                const sw = (hasDedicatedMap || hasCountryProj) ? 0.5 / (mapZoom || 1) : 0.4;
                return visibleGeos.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={{
                      default: { fill: (hasDedicatedMap || hasCountryProj) ? "#c8dde8" : "#dce8f0", stroke: (hasDedicatedMap || hasCountryProj) ? "#6a9ab0" : "#b0c8d8", strokeWidth: sw, outline: "none" },
                      hover:   { fill: "#b8d0e0", stroke: "#5a8aa0", strokeWidth: sw, outline: "none" },
                      pressed: { fill: "#aac8dc", outline: "none" },
                    }}
                  />
                ));
              }}
            </Geographies>

            {currentPoints.map((point) => {
              const r = markerRadius(point.value, minVal, maxVal, zoomLevel, mapZoom);
              const color = valueColor(point.value, minVal, maxVal);
              const canDrill =
                (zoomLevel === "world" && !!point.country && !!COUNTRY_PROJ[point.country as string]) ||
                (zoomLevel === "country");
              // Minimum hit-area radius in screen px → convert to SVG units
              const hitR = Math.max(r, 14 / mapZoom);
              return (
                <Marker
                  key={point.id}
                  coordinates={[point.lng, point.lat]}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {/* visible bubble — no pointer events so hit circle handles everything */}
                  {(point.cats && selectedView === "categories") ? (
                    <SvgPieSlices cats={point.cats} r={r} activeCats={activeCats} mapZoom={mapZoom} />
                  ) : (
                    <circle
                      r={r}
                      fill={color}
                      fillOpacity={0.82}
                      stroke="#fff"
                      strokeWidth={1.2 / mapZoom}
                      style={{ pointerEvents: "none" }}
                    />
                  )}
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={r * 0.65}
                    fontWeight={700}
                    fill="#fff"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {point.value}
                  </text>
                  {/* transparent hit area — at least 14 screen-px radius regardless of zoom */}
                  <circle
                    r={hitR}
                    fill="transparent"
                    style={{ cursor: canDrill ? "pointer" : "default" }}
                    onClick={() => handleMarkerClick(point)}
                    onMouseEnter={(e: React.MouseEvent) => {
                      const rect = (e.currentTarget as SVGElement).closest(".gc-map-wrap")?.getBoundingClientRect();
                      if (rect) {
                        const tipText = (point.cats && selectedView === "categories")
                          ? `${point.name}: ${CAT_COLORS.map(c => `${c.label} ${point.cats![c.key]}`).join(" | ")}`
                          : `${point.name}: ${point.value.toLocaleString()}`;
                        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top - 10, text: tipText });
                      }
                    }}
                  />
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>
        )}
        {tooltip && zoomLevel !== "city" && (
          <div
            className="gc-tooltip"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            {tooltip.text}
          </div>
        )}
      </div>

      {/* Filters + Legend */}
      {hasCats && (
        <div className="gc-filters-row">
          <div className="gc-filters-left"> 
          <select
            className="gc-pill-select"
            value={String(selectedYear)}
            onChange={(e) => { setSelectedYear(e.target.value === "all" ? "all" : Number(e.target.value)); setSelectedMonth("all"); }}
          >
            <option value="all">ทุกปี</option>
            {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            className="gc-pill-select"
            value={String(selectedMonth)}
            onChange={(e) => setSelectedMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
          >
            <option value="all">ทุกเดือน</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>
                {new Intl.DateTimeFormat("th-TH", { month: "long" }).format(new Date(2020, m - 1, 1))}
              </option>
            ))}
          </select>

          </div>
          <div className="gc-stepper">
            {DATA_VIEWS.indexOf(selectedView) > 0 && (
              <button
                type="button"
                className="gc-stepper-btn"
                onClick={() => {
                  const idx = DATA_VIEWS.indexOf(selectedView);
                  setSelectedView(DATA_VIEWS[idx - 1]);
                }}
              >&#8249;</button>
            )}
            <span className="gc-stepper-label">
              {selectedView === "sector" ? "หน่วยงาน" : "หมวดหมู่"}
            </span>
            {DATA_VIEWS.indexOf(selectedView) < DATA_VIEWS.length - 1 && (
              <button
                type="button"
                className="gc-stepper-btn"
                onClick={() => {
                  const idx = DATA_VIEWS.indexOf(selectedView);
                  setSelectedView(DATA_VIEWS[idx + 1]);
                }}
              >&#8250;</button>
            )}
          </div>
        </div>
      )}
      {hasCats && selectedView === "categories" ? (
        <div className="gc-cat-legend">
          {CAT_COLORS.map((c) => (
            <div
              key={c.key}
              className="gc-cat-item"
            >
              <span
                className="gc-cat-dot"
                style={{
                  background: activeCats.has(c.key) ? c.color : "transparent",
                  boxShadow: `0 0 0 1px ${c.color}`,
                  cursor: "pointer",
                }}
                onClick={() => toggleCat(c.key)}
              />
              {c.label}
            </div>
          ))}
        </div>
      ) : (
      <div className="gc-legend">
        <span className="gc-legend-label">{legendMin.toLocaleString()}</span>
        <div className="gc-legend-bar" />
        <span className="gc-legend-label">{legendMax.toLocaleString()}</span>
      </div>
      )}
    </div>
  );
}

