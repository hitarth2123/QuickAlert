import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, Circle, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLocation as useGeoLocation } from '../../context/LocationContext';
import IncidentMarker from './IncidentMarker';

// Fix default marker icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom hook to handle map events
const MapEvents = ({ onClick, onMoveEnd }) => {
  useMapEvents({
    click: (e) => {
      if (onClick) onClick(e);
    },
    moveend: (e) => {
      if (onMoveEnd) {
        const map = e.target;
        const center = map.getCenter();
        const bounds = map.getBounds();
        onMoveEnd({ center, bounds, zoom: map.getZoom() });
      }
    },
  });
  return null;
};

// Component to fly to a location
const FlyToLocation = ({ position, zoom = 15 }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom, { duration: 1 });
    }
  }, [position, zoom, map]);

  return null;
};

// User location marker
const UserLocationMarker = () => {
  const { location, loading, error } = useGeoLocation();
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (location) {
      setPosition([location.latitude, location.longitude]);
    }
  }, [location]);

  if (!position) return null;

  const userIcon = L.divIcon({
    className: 'user-location-marker',
    html: `
      <div class="relative">
        <div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
        <div class="absolute inset-0 bg-blue-400 rounded-full animate-ping opacity-75"></div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  return (
    <>
      <Marker position={position} icon={userIcon}>
        <Popup>
          <div className="text-center">
            <strong>Your Location</strong>
            {location?.accuracy && (
              <p className="text-xs text-gray-500">
                Accuracy: ±{Math.round(location.accuracy)}m
              </p>
            )}
          </div>
        </Popup>
      </Marker>
      {location?.accuracy && (
        <Circle
          center={position}
          radius={location.accuracy}
          pathOptions={{
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.1,
            weight: 1,
          }}
        />
      )}
    </>
  );
};

// Locate button component
const LocateControl = ({ onLocate }) => {
  const map = useMap();
  const { location, getLocation, loading } = useGeoLocation();

  const handleLocate = async () => {
    try {
      const loc = await getLocation();
      if (loc) {
        map.flyTo([loc.latitude, loc.longitude], 15, { duration: 1 });
        if (onLocate) onLocate(loc);
      }
    } catch (error) {
      console.error('Location error:', error);
    }
  };

  return (
    <div className="leaflet-bottom leaflet-left mb-8 ml-2">
      <div className="leaflet-control">
        <button
          onClick={handleLocate}
          disabled={loading}
          className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-100 disabled:opacity-50"
          title="Go to my location"
        >
          {loading ? (
            <svg className="w-5 h-5 animate-spin text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

// Main MapView component
const MapView = ({
  reports = [],
  alerts = [],
  center = [40.7128, -74.006], // Default to NYC
  zoom = 13,
  onMapClick,
  onMoveEnd,
  onReportClick,
  onAlertClick,
  showUserLocation = true,
  selectedLocation = null,
  enableSelection = false,
  className = '',
  children,
}) => {
  const mapRef = useRef(null);
  const [mapCenter, setMapCenter] = useState(center);
  const { location } = useGeoLocation();

  // Center map on user location when available
  useEffect(() => {
    if (location && !selectedLocation) {
      setMapCenter([location.latitude, location.longitude]);
    }
  }, [location, selectedLocation]);

  // Handle map click for selection mode
  const handleMapClick = useCallback(
    (e) => {
      if (enableSelection && onMapClick) {
        onMapClick({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        });
      }
    },
    [enableSelection, onMapClick]
  );

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        ref={mapRef}
        center={mapCenter}
        zoom={zoom}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        {/* Base map tile layer */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Zoom control in top-right */}
        <ZoomControl position="topright" />

        {/* Map events handler */}
        <MapEvents onClick={handleMapClick} onMoveEnd={onMoveEnd} />

        {/* Locate control */}
        <LocateControl />

        {/* User location marker */}
        {showUserLocation && <UserLocationMarker />}

        {/* Selected location marker */}
        {selectedLocation && (
          <>
            <FlyToLocation position={[selectedLocation.lat, selectedLocation.lng]} />
            <Marker position={[selectedLocation.lat, selectedLocation.lng]}>
              <Popup>
                <div className="text-center">
                  <strong>Selected Location</strong>
                  <p className="text-xs text-gray-500">
                    {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
                  </p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Report markers */}
        {reports.map((report) => (
          <IncidentMarker
            key={report._id}
            incident={report}
            type="report"
            onClick={() => onReportClick && onReportClick(report)}
          />
        ))}

        {/* Alert markers */}
        {alerts.map((alert) => (
          <IncidentMarker
            key={alert._id}
            incident={alert}
            type="alert"
            onClick={() => onAlertClick && onAlertClick(alert)}
          />
        ))}

        {/* Additional children (custom markers, layers, etc.) */}
        {children}
      </MapContainer>

      {/* Map overlay controls */}
      {enableSelection && (
        <div className="absolute top-4 left-4 bg-white px-3 py-2 rounded-lg shadow-lg z-[1000] text-sm">
          <span className="text-gray-600">📍 Click on the map to select a location</span>
        </div>
      )}
    </div>
  );
};

export default MapView;
