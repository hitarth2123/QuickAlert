import { Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

// Category icons and colors
const categoryConfig = {
  accident: { emoji: '🚗', color: '#EF4444', label: 'Accident' },
  fire: { emoji: '🔥', color: '#F97316', label: 'Fire' },
  crime: { emoji: '🚨', color: '#DC2626', label: 'Crime' },
  medical: { emoji: '🏥', color: '#EC4899', label: 'Medical' },
  natural_disaster: { emoji: '🌊', color: '#8B5CF6', label: 'Natural Disaster' },
  infrastructure: { emoji: '🏗️', color: '#6B7280', label: 'Infrastructure' },
  traffic: { emoji: '🚦', color: '#F59E0B', label: 'Traffic' },
  weather: { emoji: '🌧️', color: '#3B82F6', label: 'Weather' },
  other: { emoji: '📋', color: '#6B7280', label: 'Other' },
};

// Severity colors
const severityConfig = {
  critical: { color: '#DC2626', pulse: true, label: 'Critical' },
  high: { color: '#EF4444', pulse: true, label: 'High' },
  medium: { color: '#F59E0B', pulse: false, label: 'Medium' },
  low: { color: '#10B981', pulse: false, label: 'Low' },
};

// Status badges
const statusBadge = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
  verified: { bg: 'bg-green-100', text: 'text-green-800', label: 'Verified' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
  active: { bg: 'bg-red-100', text: 'text-red-800', label: 'Active' },
  resolved: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Resolved' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
};

// Create custom div icon
const createCustomIcon = (type, incident) => {
  if (type === 'alert') {
    const severity = severityConfig[incident.severity] || severityConfig.medium;
    return L.divIcon({
      className: 'custom-alert-marker',
      html: `
        <div class="relative">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shadow-lg border-2 border-white"
               style="background-color: ${severity.color}">
            🚨
          </div>
          ${severity.pulse ? '<div class="absolute inset-0 rounded-full animate-ping opacity-50" style="background-color: ' + severity.color + '"></div>' : ''}
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });
  }

  // Report marker
  const category = categoryConfig[incident.category] || categoryConfig.other;
  const isVerified = incident.status === 'verified';
  
  return L.divIcon({
    className: 'custom-report-marker',
    html: `
      <div class="relative">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-base shadow-lg border-2 ${isVerified ? 'border-green-500' : 'border-white'}"
             style="background-color: ${category.color}">
          ${category.emoji}
        </div>
        ${isVerified ? '<div class="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>' : ''}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Format time ago
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }
  return 'Just now';
};

const IncidentMarker = ({ incident, type = 'report', onClick }) => {
  if (!incident?.location?.coordinates) return null;

  const [lng, lat] = incident.location.coordinates;
  const position = [lat, lng];
  const icon = createCustomIcon(type, incident);

  const category = categoryConfig[incident.category] || categoryConfig.other;
  const status = statusBadge[incident.status] || statusBadge.pending;
  const severity = type === 'alert' ? severityConfig[incident.severity] : null;

  return (
    <>
      <Marker position={position} icon={icon} eventHandlers={{ click: onClick }}>
        <Popup maxWidth={300} minWidth={200}>
          <div className="p-1">
            {/* Header */}
            <div className="flex items-start gap-2 mb-2">
              <span className="text-2xl">{type === 'alert' ? '🚨' : category.emoji}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {incident.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                  {severity && (
                    <span 
                      className="px-2 py-0.5 text-xs rounded-full text-white"
                      style={{ backgroundColor: severity.color }}
                    >
                      {severity.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {incident.description && (
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {incident.description}
              </p>
            )}

            {/* Meta info */}
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-1">
                <span>🏷️</span>
                <span>{category.label}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>🕐</span>
                <span>{timeAgo(incident.createdAt)}</span>
              </div>
              {type === 'report' && incident.verificationCount !== undefined && (
                <div className="flex items-center gap-1">
                  <span>👥</span>
                  <span>{incident.verificationCount} verifications</span>
                </div>
              )}
            </div>

            {/* View details button */}
            {onClick && (
              <button
                onClick={onClick}
                className="mt-3 w-full py-1.5 px-3 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
              >
                View Details
              </button>
            )}
          </div>
        </Popup>
      </Marker>

      {/* Show affected area for alerts */}
      {type === 'alert' && incident.affectedArea?.radius && (
        <Circle
          center={position}
          radius={incident.affectedArea.radius}
          pathOptions={{
            color: severityConfig[incident.severity]?.color || '#EF4444',
            fillColor: severityConfig[incident.severity]?.color || '#EF4444',
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '5, 5',
          }}
        />
      )}
    </>
  );
};

export default IncidentMarker;
