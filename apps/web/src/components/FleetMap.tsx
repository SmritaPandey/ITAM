"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface FleetMapProps {
  vehicles: any[];
  selectedVehicle: any;
  onSelect: (v: any) => void;
  selectedTrip?: any;
}

export default function FleetMap({ vehicles, selectedVehicle, onSelect, selectedTrip }: FleetMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const tripMarkersRef = useRef<L.Marker[]>([]);

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

    // Fit bounds only if a trip polyline is NOT drawn (to avoid competing zoom states)
    if (!selectedTrip && vehicles.length > 1) {
      const bounds = L.latLngBounds(vehicles.map(v => [v.latitude, v.longitude]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [vehicles, selectedVehicle, onSelect, selectedTrip]);

  // Pan to selected vehicle (only if not viewing a trip)
  useEffect(() => {
    if (mapInstance.current && selectedVehicle && !selectedTrip) {
      mapInstance.current.setView([selectedVehicle.latitude, selectedVehicle.longitude], 14, { animate: true });
    }
  }, [selectedVehicle, selectedTrip]);

  // Draw selected trip polyline and start/end markers
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;

    // Clear old polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    // Clear old trip markers
    tripMarkersRef.current.forEach(m => m.remove());
    tripMarkersRef.current = [];

    if (!selectedTrip || !selectedTrip.points || selectedTrip.points.length === 0) {
      return;
    }

    const coords = selectedTrip.points.map((p: any) => [p.lat, p.lng] as [number, number]);

    // Draw Polyline
    const polyline = L.polyline(coords, {
      color: "#06b6d4",
      weight: 5,
      opacity: 0.8,
      lineJoin: "round",
    }).addTo(map);

    polylineRef.current = polyline;

    // Draw Start Marker
    const startPt = selectedTrip.points[0];
    const startIcon = L.divIcon({
      className: "trip-start-marker",
      html: `<div style="
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: linear-gradient(135deg, #10b981, #059669);
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(16,185,129,0.5);
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: 700; font-size: 10px; font-family: sans-serif;
      ">A</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const startMarker = L.marker([startPt.lat, startPt.lng], { icon: startIcon })
      .addTo(map)
      .bindPopup(`<strong style="color: #10b981">Start Location</strong><br/>${selectedTrip.startLocation || "Mumbai Terminal"}`);
    tripMarkersRef.current.push(startMarker);

    // Draw End Marker
    const endPt = selectedTrip.points[selectedTrip.points.length - 1];
    const endIcon = L.divIcon({
      className: "trip-end-marker",
      html: `<div style="
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: linear-gradient(135deg, #f43f5e, #e11d48);
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(244,63,94,0.5);
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: 700; font-size: 10px; font-family: sans-serif;
      ">B</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    const endMarker = L.marker([endPt.lat, endPt.lng], { icon: endIcon })
      .addTo(map)
      .bindPopup(`<strong style="color: #f43f5e">End Location</strong><br/>${selectedTrip.endLocation || "Destination"}`);
    tripMarkersRef.current.push(endMarker);

    // Fit bounds to polyline
    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

  }, [selectedTrip]);

  return (
    <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 400, background: "#1a1a2e" }} />
  );
}
