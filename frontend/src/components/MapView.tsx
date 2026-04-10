import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import type { CheckinData } from '../lib/api';

interface MapViewProps {
  checkins: CheckinData[];
  onMarkerClick?: (checkinId: string) => void;
  highlightedId?: string | null;
}

export default function MapView({ checkins, onMarkerClick, highlightedId }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLineRef = useRef<L.Polyline | null>(null);
  const routeGlowRef = useRef<L.Polyline | null>(null);

  const updateMap = useCallback((map: L.Map, data: CheckinData[]) => {
    const latlngs: L.LatLngTuple[] = data.map(c => [c.latitude, c.longitude]);

    // Route lines
    if (latlngs.length >= 2) {
      if (routeGlowRef.current) {
        routeGlowRef.current.setLatLngs(latlngs);
      } else {
        routeGlowRef.current = L.polyline(latlngs, {
          color: '#f7a01e',
          weight: 10,
          opacity: 0.15,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
      if (routeLineRef.current) {
        routeLineRef.current.setLatLngs(latlngs);
      } else {
        routeLineRef.current = L.polyline(latlngs, {
          color: '#f7a01e',
          weight: 3,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
      }
    }

    // Markers
    const existingIds = new Set(markersRef.current.keys());
    const newIds = new Set(data.map(c => c.id));

    for (const id of existingIds) {
      if (!newIds.has(id)) {
        markersRef.current.get(id)?.remove();
        markersRef.current.delete(id);
      }
    }

    data.forEach((c, i) => {
      if (markersRef.current.has(c.id)) return;

      const isLatest = i === data.length - 1;
      const size = isLatest ? 36 : 28;
      const html = `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: ${isLatest ? '#f7a01e' : 'rgba(247, 160, 30, 0.3)'};
          border: 2px solid ${isLatest ? '#fff' : 'rgba(247, 160, 30, 0.6)'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${isLatest ? 13 : 11}px;
          font-weight: 600;
          color: ${isLatest ? '#0f172a' : '#f7a01e'};
          cursor: pointer;
          transition: transform 0.15s;
          box-shadow: ${isLatest ? '0 0 20px rgba(247, 160, 30, 0.4)' : 'none'};
          font-family: 'DM Sans', sans-serif;
        ">${i + 1}</div>
      `;

      const icon = L.divIcon({
        html,
        className: 'checkin-marker',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([c.latitude, c.longitude], { icon }).addTo(map);
      marker.getElement()?.addEventListener('click', () => onMarkerClick?.(c.id));
      markersRef.current.set(c.id, marker);
    });

    // Fit / fly
    if (latlngs.length >= 2) {
      map.fitBounds(L.latLngBounds(latlngs), {
        padding: [60, 60],
        maxZoom: 14,
        animate: true,
        duration: 0.8,
      });
    } else if (latlngs.length === 1) {
      map.flyTo(latlngs[0], 13, { duration: 0.8 });
    }
  }, [onMarkerClick]);

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;

    const lastCheckin = checkins[checkins.length - 1];
    const center: L.LatLngExpression = lastCheckin
      ? [lastCheckin.latitude, lastCheckin.longitude]
      : [20, 0];
    const zoom = checkins.length > 0 ? 10 : 2;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    mapRef.current = map;
    updateMap(map, checkins);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Init
  useEffect(() => {
    initMap();
    return () => {
      routeLineRef.current = null;
      routeGlowRef.current = null;
      markersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initMap]);

  // Update on new checkins
  useEffect(() => {
    if (mapRef.current) {
      updateMap(mapRef.current, checkins);
    }
  }, [checkins, updateMap]);

  // Highlight a marker
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement()?.querySelector('div') as HTMLDivElement | null;
      if (el) {
        el.style.transform = id === highlightedId ? 'scale(1.3)' : 'scale(1)';
      }
    });
  }, [highlightedId]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
