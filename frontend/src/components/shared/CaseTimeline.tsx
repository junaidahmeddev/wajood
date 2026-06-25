"use client";

import { formatDateTime } from "@/lib/utils";

interface TimelineEvent {
  timestamp: string;
  event_type: string;
  title: string;
  description: string;
}

interface CaseTimelineProps {
  events: TimelineEvent[];
}

export default function CaseTimeline({ events }: CaseTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-slate-500 font-medium">
        📂 No history updates logged for this case.
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case "CREATION":
        return "📝";
      case "STATUS_UPDATE":
        return "🔄";
      case "SIGHTING":
        return "📍";
      case "MATCH":
        return "🤝";
      default:
        return "🔹";
    }
  };

  const getEventBorderColor = (type: string) => {
    switch (type.toUpperCase()) {
      case "CREATION":
        return "border-indigo-500 bg-indigo-500/10 text-indigo-400";
      case "STATUS_UPDATE":
        return "border-purple-500 bg-purple-500/10 text-purple-400";
      case "SIGHTING":
        return "border-amber-500 bg-amber-500/10 text-amber-400";
      case "MATCH":
        return "border-emerald-500 bg-emerald-500/10 text-emerald-400";
      default:
        return "border-slate-500 bg-slate-500/10 text-slate-400";
    }
  };

  return (
    <div className="relative pl-6 border-l border-white/10 space-y-8 py-2">
      {events.map((event, idx) => {
        const borderClass = getEventBorderColor(event.event_type);
        const icon = getEventIcon(event.event_type);

        return (
          <div key={idx} className="relative group">
            {/* Timeline Circle Marker */}
            <div className={`absolute -left-[35px] top-1 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs shadow-md transition-all ${borderClass}`}>
              <span>{icon}</span>
            </div>

            {/* Event Content */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 transition duration-300 hover:bg-white/[0.04]">
              <span className="text-[10px] font-semibold font-mono text-slate-500 tracking-wider">
                {formatDateTime(event.timestamp)}
              </span>
              <h4 className="text-sm font-bold text-slate-200 mt-1">{event.title}</h4>
              {event.description && (
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
