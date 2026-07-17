/**
 * MapLibre GL map component with category-colored branded markers,
 * selected-marker pulse, legend, and viewport state preservation.
 *
 * Tiles come from OpenFreeMap (no key, no account). OSM attribution is
 * mandatory — the compact attribution control handles it; never disable it.
 */
import React, { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Venue, BBox } from "@/data/types";
import { Navigation, LocateFixed } from "lucide-react";
import { useMapViewStore } from "@/store/mapState";
import { useLocationStore, geolocationPermission } from "@/store/location";
import { pinGlyph } from "@/lib/venueTraits";
import { toast } from "sonner";

export type PinFriend = { id: string; name: string; avatarUrl: string | null };

export type MapProps = {
  venues: Venue[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  onViewportChanged?: (bbox: BBox) => void;
  /** venueId -> active check-in count; drives pin tiers and badges */
  activity?: Record<string, number>;
  /** venueIds with an ACTIVE happy hour; pins get the amber ring */
  happyHour?: Set<string>;
  /** venueId -> visible friends checked in there; renders avatar faces on the pin */
  friendsByVenue?: Record<string, PinFriend[]>;
};

// Ring COLOR is reserved for live state so a colored ring always means
// "something's happening here." Category is carried by the glyph (🍺/🍸/🪩),
// never the ring — otherwise a red club reads as "Hot", a purple lounge as
// "Selected". Normal venues get a quiet neutral-gray ring.
const NORMAL_RING = "#9CA3AF";   // quiet — no live check-ins
const SELECTED_RING = "#6C45FF"; // ENDZ purple — the pin you tapped
const TRENDING_RING = "#FF8A3D"; // 3–5 people checked in
const HOT_RING = "#FF4D67";      // 6+ people checked in

// Glyphs come from pinGlyph(): 🍺 bars, 🍸 lounges/cocktail spots, 🪩 clubs.
// Happy hour is a clean amber outer ring — no neon glow.
const HH_RING = "0 0 0 2px #F59E0B";

const debounce = (fn: (...args: any[]) => void, ms: number) => {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// A friend's face for a pin: photo when we have one, initial as the fallback
// (and if the photo 404s). 18px, white-ringed — Snap-Map style.
function friendFace(f: { name: string; avatarUrl: string | null }, overlap: boolean): HTMLElement {
  const initial = () => {
    const d = document.createElement("div");
    d.textContent = (f.name.slice(0, 1) || "?").toUpperCase();
    d.style.fontSize = "9px";
    d.style.fontWeight = "700";
    d.style.color = "#6C45FF";
    d.style.background = "#ECE7FF";
    d.style.display = "flex";
    d.style.alignItems = "center";
    d.style.justifyContent = "center";
    return d;
  };
  let el: HTMLElement;
  if (f.avatarUrl) {
    const img = document.createElement("img");
    img.src = f.avatarUrl;
    img.alt = "";
    img.referrerPolicy = "no-referrer"; // googleusercontent 403s without this
    img.style.objectFit = "cover";
    img.addEventListener("error", () => img.replaceWith(decorate(initial())));
    el = img;
  } else {
    el = initial();
  }
  return decorate(el, overlap);
  function decorate(node: HTMLElement, ov = overlap): HTMLElement {
    node.style.width = "18px";
    node.style.height = "18px";
    node.style.borderRadius = "50%";
    node.style.border = "2px solid #ffffff";
    node.style.boxShadow = "0 1px 3px rgba(17,17,17,0.28)";
    node.style.boxSizing = "border-box";
    if (ov) node.style.marginLeft = "-7px";
    return node;
  }
}

// Cluster of up to 2 friend faces + "+N" chip, hanging under the pin.
function friendCluster(friends: { name: string; avatarUrl: string | null }[]): HTMLElement {
  const cluster = document.createElement("div");
  cluster.style.position = "absolute";
  cluster.style.bottom = "-7px";
  cluster.style.left = "50%";
  cluster.style.transform = "translateX(-50%)";
  cluster.style.display = "flex";
  cluster.style.alignItems = "center";
  cluster.style.zIndex = "3";
  const shown = friends.slice(0, 2);
  shown.forEach((f, i) => cluster.appendChild(friendFace(f, i > 0)));
  const extra = friends.length - shown.length;
  if (extra > 0) {
    const chip = document.createElement("div");
    chip.textContent = `+${extra}`;
    chip.style.height = "18px";
    chip.style.minWidth = "18px";
    chip.style.padding = "0 3px";
    chip.style.marginLeft = "-7px";
    chip.style.borderRadius = "9px";
    chip.style.border = "2px solid #ffffff";
    chip.style.background = "#6C45FF";
    chip.style.color = "#ffffff";
    chip.style.fontSize = "9px";
    chip.style.fontWeight = "700";
    chip.style.display = "flex";
    chip.style.alignItems = "center";
    chip.style.justifyContent = "center";
    chip.style.boxSizing = "border-box";
    cluster.appendChild(chip);
  }
  return cluster;
}

const Map: React.FC<MapProps> = ({ venues, selectedId, onSelect, onViewportChanged, activity, happyHour, friendsByVenue }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const requestLocation = useLocationStore((s) => s.request);
  const { center, zoom, setView } = useMapViewStore();
  const happyHourKey = happyHour ? [...happyHour].sort().join(",") : "";
  // Stable string of "which friends are at which venue" so markers rebuild only
  // when that membership changes — same trick as happyHourKey, not on every render.
  const friendsKey = friendsByVenue
    ? Object.entries(friendsByVenue)
        .map(([vid, list]) => `${vid}:${list.map((f) => f.id).sort().join("-")}`)
        .sort()
        .join(",")
    : "";

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  const addMarkers = useCallback(() => {
    if (!map.current) return;
    clearMarkers();
    venues.forEach((v) => {
      const isSelected = v.id === selectedId;
      const count = activity?.[v.id] ?? 0;
      const hh = happyHour?.has(v.id) ?? false;
      // Activity tiers: 0-2 = category ring, 3-5 = trending (orange), 6+ = hot (pink).
      const trending = count >= 3 && count < 6;
      const hot = count >= 6;
      const scale = count >= 3 ? 1.1 : 1;
      // Ring priority: selection > hot > trending > quiet. Active states get a
      // color; quiet venues stay neutral gray.
      const active = isSelected || hot || trending;
      const ring = isSelected
        ? SELECTED_RING
        : hot
        ? HOT_RING
        : trending
        ? TRENDING_RING
        : NORMAL_RING;

      const wrapper = document.createElement("div");
      wrapper.className = "endz-marker";
      // No inline position here — it would override .maplibregl-marker's
      // position:absolute and break geo-anchoring (pins stack in page flow).
      wrapper.style.width = "34px";
      wrapper.style.height = "34px";
      wrapper.style.cursor = "pointer";
      if (isSelected) wrapper.style.zIndex = "10";

      if (isSelected) {
        const pulse = document.createElement("div");
        pulse.style.position = "absolute";
        pulse.style.inset = "-5px";
        pulse.style.borderRadius = "50%";
        pulse.style.background = SELECTED_RING;
        pulse.style.opacity = "0.28";
        pulse.style.animation = "endz-pulse 1.8s ease-out infinite";
        wrapper.appendChild(pulse);
      }

      // White pin, colored ring, soft neutral shadow — no neon.
      const pin = document.createElement("div");
      pin.style.position = "relative";
      pin.style.width = "100%";
      pin.style.height = "100%";
      pin.style.borderRadius = "50%";
      pin.style.background = "#ffffff";
      pin.style.border = `${active ? 3 : 2}px solid ${ring}`;
      const softShadow = isSelected
        ? "0 4px 12px rgba(17,17,17,0.20), 0 0 0 4px rgba(108,69,255,0.14)"
        : "0 2px 6px rgba(17,17,17,0.16)";
      // Amber outer ring marks an active happy hour; sits under the base shadow.
      pin.style.boxShadow = hh ? `${HH_RING}, ${softShadow}` : softShadow;
      pin.style.display = "flex";
      pin.style.alignItems = "center";
      pin.style.justifyContent = "center";
      pin.style.fontSize = "15px";
      pin.style.transition = "transform 0.2s";
      pin.textContent = pinGlyph(v);
      wrapper.appendChild(pin);

      if (scale !== 1) pin.style.transform = `scale(${scale})`;

      if (count > 0) {
        const badge = document.createElement("div");
        badge.textContent = String(count);
        badge.style.position = "absolute";
        badge.style.top = "-5px";
        badge.style.right = "-5px";
        badge.style.minWidth = "17px";
        badge.style.height = "17px";
        badge.style.padding = "0 4px";
        badge.style.borderRadius = "9px";
        // Badge echoes the activity tier so hot/trending read at a glance.
        badge.style.background = hot ? HOT_RING : trending ? TRENDING_RING : SELECTED_RING;
        badge.style.color = "#ffffff";
        badge.style.fontSize = "10px";
        badge.style.fontWeight = "700";
        badge.style.display = "flex";
        badge.style.alignItems = "center";
        badge.style.justifyContent = "center";
        badge.style.border = "2px solid #ffffff";
        badge.style.zIndex = "2";
        wrapper.appendChild(badge);
      }

      // Friend faces: a photo on the pin is the strongest "go here" signal, so
      // these venues float above the rest. The count badge (total check-ins,
      // top-right) and the avatars (your friends, bottom) coexist.
      const friends = friendsByVenue?.[v.id];
      if (friends && friends.length > 0) {
        wrapper.appendChild(friendCluster(friends));
        if (!isSelected) wrapper.style.zIndex = "5";
      }

      wrapper.addEventListener("mouseenter", () => { pin.style.transform = `scale(${scale * 1.12})`; });
      wrapper.addEventListener("mouseleave", () => { pin.style.transform = scale !== 1 ? `scale(${scale})` : "scale(1)"; });

      const marker = new maplibregl.Marker({ element: wrapper, anchor: "center" })
        .setLngLat([v.longitude, v.latitude])
        .addTo(map.current!);

      wrapper.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect?.(v.id);
      });

      markersRef.current.push(marker);
    });
    // happyHourKey / friendsKey (stable strings) stand in for the Set/Record so
    // markers rebuild only when ring or friend membership actually changes —
    // not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, selectedId, onSelect, clearMarkers, activity, happyHourKey, friendsKey]);

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center,
      zoom,
      pitch: 0,
      attributionControl: { compact: true },
    });

    map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    const onMoveEnd = debounce(() => {
      if (!map.current) return;
      const c = map.current.getCenter();
      const z = map.current.getZoom();
      setView([c.lng, c.lat], z);
      const b = map.current.getBounds();
      onViewportChanged?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    }, 250);

    map.current.on("moveend", onMoveEnd);
    map.current.on("load", () => {
      addMarkers();
      onMoveEnd();
    });

    return () => {
      clearMarkers();
      map.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (map.current?.loaded()) addMarkers();
  }, [addMarkers]);

  // Fly to the selected venue (e.g. picked from the search dropdown) so the
  // pin is on screen when its drawer opens.
  useEffect(() => {
    if (!map.current || !selectedId) return;
    const v = venues.find((x) => x.id === selectedId);
    if (!v) return;
    map.current.flyTo({
      center: [v.longitude, v.latitude],
      zoom: Math.max(map.current.getZoom(), 15),
      duration: 900,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Drops (or moves) a "you are here" dot: a solid blue core with a pulsing
  // halo (reuses the endz-pulse keyframe). Only setLngLat is touched on updates
  // so the follow path stays cheap; never set an inline position on the wrapper
  // (that would break MapLibre's anchoring).
  const placeUserDot = useCallback((lng: number, lat: number) => {
    if (!map.current) return;
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.setAttribute("aria-label", "Your location");
      el.style.position = "relative";
      el.style.width = "18px";
      el.style.height = "18px";

      const pulse = document.createElement("div");
      pulse.setAttribute("aria-hidden", "true");
      pulse.style.position = "absolute";
      pulse.style.inset = "0";
      pulse.style.borderRadius = "9999px";
      pulse.style.background = "#3b82f6";
      pulse.style.animation = "endz-pulse 2s ease-out infinite";

      const core = document.createElement("div");
      core.style.position = "absolute";
      core.style.inset = "0";
      core.style.borderRadius = "9999px";
      core.style.background = "#3b82f6";
      core.style.border = "2px solid #ffffff";
      core.style.boxShadow = "0 0 0 1px rgba(59,130,246,0.35)";
      core.style.boxSizing = "border-box";

      el.appendChild(pulse);
      el.appendChild(core);
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([lng, lat])
        .addTo(map.current);
    } else {
      userMarkerRef.current.setLngLat([lng, lat]);
    }
  }, []);

  // Live-follow plumbing. Both the auto-show (already-granted users) and the
  // "Locate me" button funnel through ensureWatching so there's exactly one
  // subscription and one ref-counted watch() to unwind.
  const watchingRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const ensureWatching = useCallback(() => {
    if (watchingRef.current) return;
    watchingRef.current = true;
    useLocationStore.getState().watch();
    unsubRef.current = useLocationStore.subscribe((s) => {
      if (s.coords) placeUserDot(s.coords.lng, s.coords.lat);
    });
  }, [placeUserDot]);

  const stopWatching = useCallback(() => {
    if (!watchingRef.current) return;
    watchingRef.current = false;
    unsubRef.current?.();
    unsubRef.current = null;
    useLocationStore.getState().stopWatch();
  }, []);

  // Auto-show the dot for users who already granted location (never prompts),
  // and pause tracking while the tab is hidden to save battery.
  useEffect(() => {
    geolocationPermission().then((state) => {
      if (state === "granted") ensureWatching();
    });
    const onVisibility = () => {
      if (document.hidden) {
        stopWatching();
      } else {
        geolocationPermission().then((state) => {
          // Re-check visibility: a fast hide→show→hide can resolve after the
          // tab is hidden again — don't start the watcher while hidden.
          if (state === "granted" && !document.hidden) ensureWatching();
        });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopWatching();
    };
  }, [ensureWatching, stopWatching]);

  const handleLocateMe = useCallback(async () => {
    if (!map.current) return;
    const coords = await requestLocation();
    if (coords) {
      placeUserDot(coords.lng, coords.lat);
      map.current.flyTo({ center: [coords.lng, coords.lat], zoom: 15, duration: 1500 });
      ensureWatching(); // follow from now on
      toast.success("Found your location");
    } else {
      toast.info("Location unavailable — showing East Village center");
      map.current.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1500 });
    }
  }, [requestLocation, placeUserDot, ensureWatching]);

  const handleRecenter = useCallback(() => {
    map.current?.flyTo({ center: [-73.9833, 40.7270], zoom: 15, duration: 1200 });
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" aria-label="Nightlife map" />

      {/* Legend — ring colors carry live activity; the glyph carries category. */}
      <div className="absolute top-32 left-3 z-30 glass rounded-xl px-3 py-2 text-[11px] text-foreground space-y-1.5 animate-fade-in">
        <div className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Activity</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-white border-2 border-[#9CA3AF]" /> Quiet</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-white border-2 border-[hsl(var(--trending))]" /> Trending</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-white border-2 border-[hsl(var(--hot))]" /> Hot</div>
        <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-white border-2 border-primary" /> Selected</div>
      </div>

      {/* Floating action buttons */}
      <div className="absolute bottom-44 right-4 z-40 flex flex-col gap-2">
        <button
          onClick={handleRecenter}
          className="p-3 rounded-full glass shadow-xl hover:scale-105 active:scale-95 transition-transform"
          aria-label="Recenter on East Village"
        >
          <LocateFixed className="h-5 w-5 text-primary" />
        </button>
        <button
          onClick={handleLocateMe}
          className="p-3 rounded-full glass shadow-xl hover:scale-105 active:scale-95 transition-transform"
          aria-label="Locate me"
        >
          <Navigation className="h-5 w-5 text-primary" />
        </button>
      </div>
    </div>
  );
};

export default Map;
