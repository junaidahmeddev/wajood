"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapProps {
  lat?: number;
  lng?: number;
  markerTitle?: string;
}

export default function LeafletMap({ lat = 30.3753, lng = 69.3451, markerTitle = "Last Seen Location" }: MapProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const container = document.getElementById("leaflet-map-container");
    if (!container) return;

    // Check if map already initialized on this DOM element
    if ((container as any)._leaflet_id) {
      return;
    }

    const map = L.map("leaflet-map-container").setView([lat, lng], 6);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Fix default marker icon asset paths
    const DefaultIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });
    L.Marker.prototype.options.icon = DefaultIcon;

    L.marker([lat, lng]).addTo(map).bindPopup(markerTitle).openPopup();

    return () => {
      map.remove();
    };
  }, [lat, lng, markerTitle]);

  return (
    <div id="leaflet-map-container" style={{ width: "100%", height: "260px", borderRadius: "12px", zIndex: 10 }} />
  );
}
