import { useState, useMemo, useEffect } from 'react';
import { Marker, Popup, Circle } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { useAuth } from '../../context/AuthContext';
import { calculateDistance, formatDistance } from '../../utils/geoLocation';

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

// Severity colors for alerts
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

// Verification threshold (4+ confirmations = community verified)
const VERIFICATION_THRESHOLD = 4;
// Maximum distance in meters to allow verification (2km)
const MAX_VERIFICATION_DISTANCE = 2000;

// Get marker color based on incident type and status
// 🔴 Red = Unverified reports
// 🟢 Green = Verified reports (4+ confirmations or admin verified)
// 🟠 Orange = Official alerts
const getMarkerColor = (type, incident) => {
  if (type === 'alert') {
    return '#F97316'; // Orange for official alerts
  }
  
  // For reports: check verification status
  const confirmCount = incident.votes?.up || 0;
  if (incident.status === 'verified' || confirmCount >= VERIFICATION_THRESHOLD) {
    return '#10B981'; // Green for verified
  }
  
  return '#EF4444'; // Red for unverified
};

// Create custom div icon
const createCustomIcon = (type, incident) => {
  const markerColor = getMarkerColor(type, incident);
  
  if (type === 'alert') {
    const severity = severityConfig[incident.severity] || severityConfig.medium;
    return L.divIcon({
      className: 'custom-alert-marker',
      html: `
        <div class="relative">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shadow-lg border-2 border-white"
               style="background-color: ${markerColor}">
            🚨
          </div>
          ${severity.pulse ? '<div class="absolute inset-0 rounded-full animate-ping opacity-50" style="background-color: ' + markerColor + '"></div>' : ''}
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });
  }

  // Report marker with color coding
  const category = categoryConfig[incident.category] || categoryConfig.other;
  const confirmCount = incident.votes?.up || 0;
  const isVerified = incident.status === 'verified' || confirmCount >= VERIFICATION_THRESHOLD;
  
  return L.divIcon({
    className: 'custom-report-marker',
    html: `
      <div class="relative">
        <div class="w-8 h-8 rounded-full flex items-center justify-center text-base shadow-lg border-2 border-white"
             style="background-color: ${markerColor}">
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

const IncidentMarker = ({ incident, type = 'report', onClick, onVerify, userLocation }) => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(false);
  const [userVote, setUserVote] = useState(null);
  
  // Update userVote when incident or user changes
  useEffect(() => {
    if (user && incident.votes?.voters) {
      const userId = String(user._id || user.id);
      console.log(`[IncidentMarker] Checking vote for user ${userId} on incident ${incident._id}`);
      console.log(`[IncidentMarker] Voters:`, incident.votes.voters);
      
      const existingVote = incident.votes.voters.find(v => {
        const voterId = String(v.user?._id || v.user?.id || v.user);
        console.log(`[IncidentMarker] Comparing voter ${voterId} with user ${userId}`);
        return voterId === userId;
      });
      
      if (existingVote) {
        console.log(`[IncidentMarker] Found existing vote: ${existingVote.vote}`);
        setUserVote(existingVote.vote === 'up' ? 'confirm' : 'deny');
      } else {
        console.log(`[IncidentMarker] No existing vote found`);
        setUserVote(null);
      }
    } else {
      setUserVote(null);
    }
  }, [incident.votes?.voters, user, incident._id]);
  
  if (!incident?.location?.coordinates) return null;

  const [lng, lat] = incident.location.coordinates;
  const position = [lat, lng];
  const icon = createCustomIcon(type, incident);

  // Navigate to detail page
  const handleViewDetails = (e) => {
    e.stopPropagation();
    const path = type === 'report' ? `/reports/${incident._id}` : `/alerts/${incident._id}`;
    navigate(path);
  };

  const category = categoryConfig[incident.category] || categoryConfig.other;
  const status = statusBadge[incident.status] || statusBadge.pending;
  const severity = type === 'alert' ? severityConfig[incident.severity] : null;
  const confirmCount = incident.votes?.up || 0;
  const denyCount = incident.votes?.down || 0;
  const isVerified = incident.status === 'verified' || confirmCount >= VERIFICATION_THRESHOLD;

  // Calculate distance from user to incident
  const distanceToIncident = useMemo(() => {
    if (!userLocation) return null;
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      lat,
      lng
    );
  }, [userLocation, lat, lng]);

  // Check if user can verify (authenticated, within 2km)
  const canVerify = useMemo(() => {
    if (!isAuthenticated) return false;
    if (type === 'alert') return false;
    if (incident.status === 'verified' || incident.status === 'rejected') return false;
    if (distanceToIncident === null) return false;
    if (distanceToIncident > MAX_VERIFICATION_DISTANCE) return false;
    return true;
  }, [isAuthenticated, type, incident, distanceToIncident]);

  const handleVerify = async (vote) => {
    if (!onVerify || !canVerify || verifying || userVote) return;
    
    setVerifying(true);
    try {
      await onVerify(incident._id, vote);
      setUserVote(vote); // Set vote immediately for instant UI feedback
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <Marker position={position} icon={icon} eventHandlers={{ click: onClick }}>
        <Popup maxWidth={320} minWidth={220}>
          <div className="p-1">
            {/* Header */}
            <div className="flex items-start gap-2 mb-2">
              <span className="text-2xl">{type === 'alert' ? '🚨' : category.emoji}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {incident.title}
                </h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                  {type === 'report' && isVerified && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                      ✓ Community Verified
                    </span>
                  )}
                  {type === 'report' && !isVerified && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">
                      ⚠️ Unverified
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

            {/* Photo */}
            {incident.image && (
              <div className="mb-2">
                <img 
                  src={incident.image} 
                  alt="Incident" 
                  className="w-full h-32 object-cover rounded-lg"
                />
              </div>
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
              {type === 'report' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span>👍</span>
                    <span className="text-green-600 font-medium">{incident.votes?.up || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>👎</span>
                    <span className="text-red-600 font-medium">{incident.votes?.down || 0}</span>
                  </div>
                  {!isVerified && (incident.votes?.up || 0) < VERIFICATION_THRESHOLD && (
                    <span className="text-gray-400">
                      (need {VERIFICATION_THRESHOLD - (incident.votes?.up || 0)} more to verify)
                    </span>
                  )}
                </div>
              )}
              {distanceToIncident !== null && (
                <div className="flex items-center gap-1">
                  <span>📍</span>
                  <span>{formatDistance(distanceToIncident)} away</span>
                </div>
              )}
            </div>

            {/* Verification section for reports */}
            {type === 'report' && !isVerified && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                {userVote ? (
                  <div className="text-center text-sm text-gray-600 py-1">
                    <span>{userVote === 'confirm' ? '👍' : '👎'}</span>
                    <span className="ml-1">You {userVote === 'confirm' ? 'confirmed' : 'denied'} this report</span>
                  </div>
                ) : canVerify ? (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">
                      You're within {formatDistance(MAX_VERIFICATION_DISTANCE)}. Can you confirm this incident?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerify('confirm')}
                        disabled={verifying}
                        className="flex-1 py-1.5 px-3 text-sm rounded-md transition-colors disabled:opacity-50 bg-green-600 text-white hover:bg-green-700"
                      >
                        {verifying ? '...' : '✓ Confirm'}
                      </button>
                      <button
                        onClick={() => handleVerify('deny')}
                        disabled={verifying}
                        className="flex-1 py-1.5 px-3 text-sm rounded-md transition-colors disabled:opacity-50 bg-red-600 text-white hover:bg-red-700"
                      >
                        {verifying ? '...' : '✕ Deny'}
                      </button>
                    </div>
                  </div>
                ) : !isAuthenticated ? (
                  <p className="text-xs text-gray-500 text-center">
                    <a href="/login" className="text-red-600 hover:underline">Sign in</a> to verify this report
                  </p>
                ) : distanceToIncident !== null && distanceToIncident > MAX_VERIFICATION_DISTANCE ? (
                  <p className="text-xs text-gray-500 text-center">
                    You need to be within {formatDistance(MAX_VERIFICATION_DISTANCE)} to verify
                  </p>
                ) : null}
              </div>
            )}

            {/* View details button */}
            <button
              onClick={handleViewDetails}
              className="mt-3 w-full py-1.5 px-3 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
            >
              View Details
            </button>
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
