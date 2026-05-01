"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface FleetMapProps {
  vehicles: any[];
  selectedVehicle: any;
  onSelect: (v: any) => void;
}

export default function FleetMap({ vehicles, selectedVehicle, onSelect }: FleetMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Default center: India (Mumbai)
    const center: [number, number] = vehicles.length > 0
      ? [vehicles[0].latitude, vehicles[0].longitude]
      : [19.076, 72.8777];

    const map = L.map(mapRef.current, {
      center,
      zoom: 12,
      zoomControl: true,
    });

    // Dark tile layer
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    vehicles.forEach(v => {
      const isSelected = selectedVehicle?.id === v.id;

      const icon = L.divIcon({
        className: "fleet-marker",
        html: `<div style="
          width: ${isSelected ? 36 : 28}px;
          height: ${isSelected ? 36 : 28}px;
          border-radius: 50%;
          background: ${isSelected ? "var(--brand-400, #06b6d4)" : "rgba(6,182,212,0.7)"};
          border: 3px solid ${isSelected ? "white" : "rgba(255,255,255,0.3)"};
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 12px ${isSelected ? "rgba(6,182,212,0.5)" : "rgba(0,0,0,0.3)"};
          transition: all 0.2s;
          font-size: ${isSelected ? 14 : 11}px;
          color: white;
        ">🚗</div>`,
        iconSize: [isSelected ? 36 : 28, isSelected ? 36 : 28],
        iconAnchor: [isSelected ? 18 : 14, isSelected ? 18 : 14],
      });

      const marker = L.marker([v.latitude, v.longitude], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui; min-width: 160px;">
            <strong style="font-size: 13px;">${v.name}</strong><br/>
            <span style="font-size: 11px; color: #888;">${v.assetTag || ""} • ${v.customFields?.registrationNumber || ""}</span><br/>
            <span style="font-size: 11px;">📍 ${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}</span>
          </div>
        `);

      marker.on("click", () => onSelect(v));
      markersRef.current.push(marker);
    });

    // Fit bounds
    if (vehicles.length > 1) {
      const bounds = L.latLngBounds(vehicles.map(v => [v.latitude, v.longitude]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [vehicles, selectedVehicle, onSelect]);

  // Pan to selected vehicle
  useEffect(() => {
    if (mapInstance.current && selectedVehicle) {
      mapInstance.current.setView([selectedVehicle.latitude, selectedVehicle.longitude], 14, { animate: true });
    }
  }, [selectedVehicle]);

  return (
    <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 400, background: "#1a1a2e" }} />
  );
}
