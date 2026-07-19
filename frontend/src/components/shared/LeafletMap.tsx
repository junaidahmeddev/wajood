"use client";

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Case } from "@/types";

interface MapProps {
  lat?: number;
  lng?: number;
  markerTitle?: string;
  cases?: Case[];
  onReportSighting?: (caseId: string) => void;
}

const CITY_COORDINATES: Record<string, [number, number]> = {
  "karachi": [24.8607, 67.0011],
  "lahore": [31.5204, 74.3587],
  "islamabad": [33.6844, 73.0479],
  "rawalpindi": [33.5651, 73.0169],
  "peshawar": [34.0151, 71.5249],
  "quetta": [30.1798, 66.9750],
  "multan": [30.1575, 71.5249],
  "faisalabad": [31.4504, 73.1350],
  "gujranwala": [32.1877, 74.1945],
  "sialkot": [32.4945, 74.5229],
  "hyderabad": [25.3960, 68.3578],
  "sukkur": [27.7244, 68.8228],
  "larkana": [27.5589, 68.2099],
  "bahawalpur": [29.3544, 71.6911],
  "sargodha": [32.0836, 72.6711],
  "sahiwal": [30.6682, 73.1114],
  "okara": [30.8081, 73.4458],
  "gujrat": [32.5742, 74.0754],
  "jhelum": [32.9405, 73.7276],
  "abbottabad": [34.1688, 73.2215],
  "mardan": [34.1989, 72.0315],
  "mingora": [34.7717, 72.3602],
  "kohat": [33.5869, 71.4414],
  "deraismailkhan": [31.8627, 70.9019],
  "dera ghazi khan": [30.0489, 70.6403],
  "gwadar": [25.1264, 62.3254],
};

export default function LeafletMap({
  lat = 24.8607,
  lng = 67.0011,
  markerTitle = "Last Seen Location",
  cases = [],
  onReportSighting,
}: MapProps) {
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

    const redIcon = L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    if (cases && cases.length > 0) {
      cases.forEach((c) => {
        const city = c.last_seen_city?.toLowerCase() || "";
        let caseLat = lat;
        let caseLng = lng;
        if (CITY_COORDINATES[city]) {
          // Add small jitter to avoid exact overlapping
          caseLat = CITY_COORDINATES[city][0] + (Math.random() - 0.5) * 0.05;
          caseLng = CITY_COORDINATES[city][1] + (Math.random() - 0.5) * 0.05;
        } else {
          caseLat = lat + (Math.random() - 0.5) * 0.2;
          caseLng = lng + (Math.random() - 0.5) * 0.2;
        }

        const name = c.person?.full_name || "Unknown";
        const age = c.person?.age_min || c.person?.age || "?";
        const location = c.last_seen_location || c.last_seen_city || "Unknown Location";

        const popupContent = `
          <div class="p-2 min-w-[150px] text-slate-800">
            <h4 class="font-bold text-sm text-violet-700">${name}</h4>
            <p class="text-xs my-1"><strong>Age:</strong> ${age} yrs</p>
            <p class="text-xs my-1"><strong>Location:</strong> ${location}</p>
            <button class="report-sighting-btn mt-2 w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-1.5 px-2 rounded text-[11px] transition cursor-pointer" data-case-id="${c.id}">
              Report Sighting
            </button>
          </div>
        `;

        L.marker([caseLat, caseLng], { icon: redIcon })
          .addTo(map)
          .bindPopup(popupContent);
      });
    } else {
      L.marker([lat, lng]).addTo(map).bindPopup(markerTitle).openPopup();
    }

    const handleContainerClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("report-sighting-btn")) {
        const caseId = target.getAttribute("data-case-id");
        if (caseId && onReportSighting) {
          onReportSighting(caseId);
        }
      }
    };

    container.addEventListener("click", handleContainerClick);

    return () => {
      container.removeEventListener("click", handleContainerClick);
      map.remove();
    };
  }, [lat, lng, markerTitle, cases, onReportSighting]);

  return (
    <div id="leaflet-map-container" style={{ width: "100%", height: "350px", borderRadius: "12px", zIndex: 10 }} />
  );
}
