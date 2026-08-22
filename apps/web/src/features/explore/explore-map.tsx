import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  GeoJSON,
  Tooltip,
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
};

function FitBounds({ data }: { data?: GeoFeatureCollection }) {
  const map = useMap();
  useEffect(() => {
    if (!data?.features?.length) {
      map.setView([4.2, 109.5], 5.5);
      return;
    }
    const coords: [number, number][] = [];
    for (const f of data.features) {
      if (f.geometry.type === "Point") {
        const [lng, lat] = f.geometry.coordinates as [number, number];
        coords.push([lat, lng]);
      } else if (
        f.geometry.type === "Polygon" ||
        f.geometry.type === "MultiPolygon"
      ) {
        const props = f.properties as { code?: string };
        void props;
        // Approximate from first ring point
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
      { padding: [28, 28], maxZoom: 10 },
    );
  }, [data, map]);
  return null;
}

export function ExploreMap({ data, isLoading }: Props) {
  const selected = useExploreWorkspaceStore((s) => s.selectedConstituencyId);
  const setSelected = useExploreWorkspaceStore(
    (s) => s.setSelectedConstituencyId,
  );
  const mapMode = useExploreWorkspaceStore((s) => s.mapMode);
  const toggleCompare = useExploreWorkspaceStore((s) => s.toggleCompareId);

  const collection = useMemo(() => {
    if (!data) return null;
    return data as unknown as FeatureCollection;
  }, [data]);

  const onFeature = (feature: Feature, layer: Layer) => {
    const props = feature.properties as { code?: string; name?: string };
    layer.on({
      click: () => {
        if (!props.code) return;
        if (mapMode === "compare") {
          toggleCompare(props.code);
        } else {
          setSelected(props.code);
        }
      },
    });
  };

  const style = (feature?: Feature): PathOptions => {
    const color =
      (feature?.properties as { color?: string } | undefined)?.color ||
      "#1f6fb2";
    const code = (feature?.properties as { code?: string } | undefined)?.code;
    const isSelected = code && code === selected;
    return {
      color: isSelected ? "#0b1f33" : color,
      weight: isSelected ? 2.5 : 1,
      fillColor: color,
      fillOpacity: isSelected ? 0.75 : 0.55,
    };
  };

  return (
    <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-[var(--color-line)] bg-[#dce7f0]">
      {isLoading && (
        <div className="absolute inset-0 z-[500] grid place-items-center bg-white/50 text-sm text-[var(--color-ink-muted)] backdrop-blur-sm">
          Loading map…
        </div>
      )}
      <MapContainer
        center={[4.2, 109.5]}
        zoom={5.5}
        className="h-[420px] w-full"
        zoomControl
        dragging={mapMode !== "select" ? true : true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds data={data} />

        {data?.kind === "points" &&
          data.features.map((f) => {
            if (f.geometry.type !== "Point") return null;
            const [lng, lat] = f.geometry.coordinates;
            const p = f.properties;
            const isSelected = p.code === selected;
            return (
              <CircleMarker
                key={p.code}
                center={[lat, lng]}
                radius={isSelected ? 9 : 6}
                pathOptions={{
                  color: isSelected ? "#0b1f33" : p.color,
                  fillColor: p.color,
                  fillOpacity: 0.85,
                  weight: isSelected ? 2 : 1,
                }}
                eventHandlers={{
                  click: () => {
                    if (mapMode === "compare") toggleCompare(p.code);
                    else setSelected(p.code);
                  },
                }}
              >
                <Tooltip>
                  <strong>{p.name}</strong>
                  <br />
                  {p.party} · {p.state}
                </Tooltip>
              </CircleMarker>
            );
          })}

        {data?.kind === "polygons" && collection && (
          <GeoJSON
            key={`${data.state}-${data.features.length}`}
            data={collection}
            style={style}
            onEachFeature={onFeature}
          />
        )}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[11px] text-[var(--color-ink-muted)] shadow">
        {data?.kind === "polygons"
          ? `Polygons · ${data.state}`
          : "National points · pick a state for polygons"}
      </div>
    </div>
  );
}
