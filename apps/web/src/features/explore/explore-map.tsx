import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  GeoJSON,
  useMap,
} from "react-leaflet";
import type { FeatureCollection, Feature } from "geojson";
import type { PathOptions, Layer } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoFeatureCollection } from "@/queries/explore";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";

type Props = {
  data?: GeoFeatureCollection;
  isLoading?: boolean;
  appliedState?: string;
};

function FitBounds({
  data,
  focusCode,
  appliedState,
}: {
  data?: GeoFeatureCollection;
  focusCode?: string | null;
  /** Only fit when payload state matches the selected filter (avoids mid-switch jumps). */
  appliedState: string;
}) {
  const map = useMap();

  // Stable key — do not depend on `data` object identity (rebuilt every render)
  const boundsKey = [
    data?.level ?? "",
    data?.presentation ?? "",
    data?.state ?? "",
    data?.kind ?? "",
    data?.features?.length ?? 0,
    focusCode ?? "",
    appliedState,
  ].join("|");

  useEffect(() => {
    if (!data?.features?.length) return;

    // Wait until fetched geo matches the selected state (or both national)
    const payloadState = (data.state || "").toUpperCase();
    const wanted = (appliedState || "").toUpperCase();
    if (payloadState !== wanted) return;

    const features = focusCode
      ? data.features.filter((f) => f.properties.code === focusCode)
      : data.features;
    if (!features.length) return;

    const coords: [number, number][] = [];
    for (const f of features) {
      if (f.geometry.type === "Point") {
        const [lng, lat] = f.geometry.coordinates as [number, number];
        coords.push([lat, lng]);
      } else if (
        f.geometry.type === "Polygon" ||
        f.geometry.type === "MultiPolygon"
      ) {
        const g = f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
        const first =
          g.type === "Polygon"
            ? g.coordinates[0]?.[0]
            : g.coordinates[0]?.[0]?.[0];
        if (first) coords.push([first[1], first[0]]);
      }
    }
    if (coords.length === 0) return;
    const lats = coords.map((c) => c[0]);
    const lngs = coords.map((c) => c[1]);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      {
        padding: [28, 28],
        maxZoom: focusCode ? 11 : 10,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boundsKey encodes data
  }, [boundsKey, map]);
  return null;
}

const BN_MAP_COLOR = "#00007C"; // rgb(0, 0, 124)

function isBarisanNasional(label?: string) {
  if (!label) return false;
  const key = label.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return key === "BN" || key === "BARISANNASIONAL";
}

function fillColor(
  props: {
    party?: string;
    partyGroup?: string;
    partyColor?: string;
    groupColor?: string;
    color?: string;
  },
  colorMode: "party" | "group",
) {
  if (colorMode === "group") {
    if (isBarisanNasional(props.partyGroup)) return BN_MAP_COLOR;
    return props.groupColor || props.partyColor || props.color || "#1f6fb2";
  }
  if (isBarisanNasional(props.party)) return BN_MAP_COLOR;
  return props.partyColor || props.color || "#1f6fb2";
}

export function ExploreMap({
  data,
  isLoading,
  appliedState = "",
}: Props) {
  const selected = useExploreWorkspaceStore((s) => s.selectedConstituencyId);
  const setSelected = useExploreWorkspaceStore(
    (s) => s.setSelectedConstituencyId,
  );
  const setSelectedElectoralType = useExploreWorkspaceStore(
    (s) => s.setSelectedElectoralType,
  );
  const mapMode = useExploreWorkspaceStore((s) => s.mapMode);
  const colorMode = useExploreWorkspaceStore((s) => s.colorMode);
  const mapLevel = useExploreWorkspaceStore((s) => s.mapLevel);
  const searchSelection = useExploreWorkspaceStore((s) => s.searchSelection);
  const toggleCompare = useExploreWorkspaceStore((s) => s.toggleCompareId);

  const collection = useMemo(() => {
    if (!data) return null;
    return data as unknown as FeatureCollection;
  }, [data]);

  const geoKey = useMemo(() => {
    return [
      data?.level,
      data?.presentation,
      data?.state,
      data?.features?.length,
      colorMode,
      searchSelection?.code || "",
    ].join(":");
  }, [data, colorMode, searchSelection?.code]);

  const onFeature = (feature: Feature, layer: Layer) => {
    const props = feature.properties as {
      code?: string;
      name?: string;
      electoralType?: "parliament" | "dun";
    };
    layer.on({
      click: () => {
        if (!props.code) return;
        if (mapMode === "compare") {
          toggleCompare(props.code);
        } else {
          setSelected(props.code);
          setSelectedElectoralType(props.electoralType || mapLevel);
        }
      },
    });
  };

  const style = (feature?: Feature): PathOptions => {
    const props = feature?.properties as
      | {
          code?: string;
          party?: string;
          partyGroup?: string;
          partyColor?: string;
          groupColor?: string;
          color?: string;
        }
      | undefined;
    const color = fillColor(props || {}, colorMode);
    const code = props?.code;
    const isSelected = code && code === selected;
    // White seat borders, party/group fill
    return {
      color: isSelected ? "#0b1f33" : "#ffffff",
      weight: isSelected ? 2.5 : 1,
      fillColor: color,
      fillOpacity: isSelected ? 0.85 : 0.72,
    };
  };

  const focusCode = searchSelection?.code || null;
  const kind = data?.kind || "points";

  return (
    <div className="relative z-0 isolate min-h-[560px] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[#dce7f0]">
      {isLoading && (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-white/50 text-sm text-[var(--color-ink-muted)] backdrop-blur-sm">
          Loading map…
        </div>
      )}
      <MapContainer
        center={[4.2, 109.5]}
        zoom={5.5}
        className="h-[72vh] max-h-[760px] min-h-[520px] w-full"
        zoomControl={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        dragging
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds
          data={data}
          focusCode={focusCode}
          appliedState={appliedState}
        />

        {kind === "points" &&
          data?.features.map((f) => {
            if (f.geometry.type !== "Point") return null;
            const [lng, lat] = f.geometry.coordinates;
            const p = f.properties;
            const color = fillColor(p, colorMode);
            const isSelected = p.code === selected;
            return (
              <CircleMarker
                key={p.code}
                center={[lat, lng]}
                radius={isSelected ? 9 : 6}
                pathOptions={{
                  color: isSelected ? "#0b1f33" : color,
                  fillColor: color,
                  fillOpacity: 0.85,
                  weight: isSelected ? 2 : 1,
                }}
                eventHandlers={{
                  click: () => {
                    if (mapMode === "compare") toggleCompare(p.code);
                    else {
                      setSelected(p.code);
                      setSelectedElectoralType(p.electoralType || mapLevel);
                    }
                  },
                }}
              />
            );
          })}

        {kind === "polygons" && collection && (
          <GeoJSON
            key={geoKey}
            data={collection}
            style={style}
            onEachFeature={onFeature}
          />
        )}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[11px] text-[var(--color-ink-muted)] shadow">
        {mapLevel === "dun" ? "DUN" : "Parlimen"}
        {data?.presentation === "ops66" ? " · OPS66" : ""}
        {data?.state ? ` · ${data.state}` : " · Nationwide"}
        {" · "}
        {kind === "polygons" ? "Polygons" : "Points"}
        {" · "}
        {data?.features?.length ?? 0} seats
      </div>
    </div>
  );
}
