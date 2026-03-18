import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { CheckinData } from '../lib/api';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface MapViewProps {
  checkins: CheckinData[];
  onMarkerClick?: (checkinId: string) => void;
  highlightedId?: string | null;
}

export default function MapView({ checkins, onMarkerClick, highlightedId }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: checkins.length > 0
        ? [checkins[checkins.length - 1].longitude, checkins[checkins.length - 1].latitude]
        : [0, 20],
      zoom: checkins.length > 0 ? 10 : 2,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      updateMap(map, checkins);
    });

    mapRef.current = map;
  }, []);

  const updateMap = useCallback((map: mapboxgl.Map, checkins: CheckinData[]) => {
    if (!map.isStyleLoaded()) return;

    // Route line
    const coords = checkins.map(c => [c.longitude, c.latitude] as [number, number]);

    if (map.getSource('route')) {
      (map.getSource('route') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      });
    } else if (coords.length >= 2) {
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#f7a01e',
          'line-width': 3,
          'line-opacity': 0.8,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
      // Glow layer
      map.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        paint: {
          'line-color': '#f7a01e',
          'line-width': 8,
          'line-opacity': 0.15,
          'line-blur': 6,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      }, 'route-line');
    }

    // Update markers
    const existingIds = new Set(markersRef.current.keys());
    const newIds = new Set(checkins.map(c => c.id));

    // Remove old markers
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        markersRef.current.get(id)?.remove();
        markersRef.current.delete(id);
      }
    }

    // Add/update markers
    checkins.forEach((c, i) => {
      if (markersRef.current.has(c.id)) return;

      const isLatest = i === checkins.length - 1;
      const el = document.createElement('div');
      el.className = 'checkin-marker';
      el.innerHTML = `
        <div style="
          width: ${isLatest ? 36 : 28}px;
          height: ${isLatest ? 36 : 28}px;
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
      el.addEventListener('click', () => onMarkerClick?.(c.id));

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([c.longitude, c.latitude])
        .addTo(map);
      markersRef.current.set(c.id, marker);
    });

    // Fit bounds
    if (coords.length >= 2) {
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach(c => bounds.extend(c));
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
    } else if (coords.length === 1) {
      map.flyTo({ center: coords[0], zoom: 13, duration: 800 });
    }
  }, [onMarkerClick]);

  // Init
  useEffect(() => {
    initMap();
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [initMap]);

  // Update on new checkins
  useEffect(() => {
    if (mapRef.current?.isStyleLoaded()) {
      updateMap(mapRef.current, checkins);
    }
  }, [checkins, updateMap]);

  // Highlight a marker
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const el = marker.getElement().querySelector('div') as HTMLDivElement | null;
      if (el) {
        el.style.transform = id === highlightedId ? 'scale(1.3)' : 'scale(1)';
      }
    });
  }, [highlightedId]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
