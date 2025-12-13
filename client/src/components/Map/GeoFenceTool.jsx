import { useEffect, useRef, useState, useCallback } from 'react';
import { useMap, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';

// Default draw options
const defaultDrawOptions = {
  rectangle: false,
  polyline: false,
  circlemarker: false,
  marker: false,
};

const GeoFenceTool = ({
  onGeoFenceCreate,
  onGeoFenceEdit,
  onGeoFenceDelete,
  enableCircle = true,
  enablePolygon = true,
  initialGeoFence = null,
  maxRadius = 50000, // 50km max radius
  color = '#EF4444',
}) => {
  const map = useMap();
  const featureGroupRef = useRef(null);
  const [geoFence, setGeoFence] = useState(null);
  const [drawMode, setDrawMode] = useState(null);

  // Load initial geo-fence if provided
  useEffect(() => {
    if (initialGeoFence && featureGroupRef.current) {
      const fg = featureGroupRef.current;
      fg.clearLayers();

      if (initialGeoFence.type === 'circle') {
        const circle = L.circle(
          [initialGeoFence.center.lat, initialGeoFence.center.lng],
          {
            radius: initialGeoFence.radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.2,
          }
        );
        fg.addLayer(circle);
        setGeoFence(initialGeoFence);
      } else if (initialGeoFence.type === 'polygon') {
        const polygon = L.polygon(initialGeoFence.coordinates, {
          color: color,
          fillColor: color,
          fillOpacity: 0.2,
        });
        fg.addLayer(polygon);
        setGeoFence(initialGeoFence);
      }
    }
  }, [initialGeoFence, color]);

  // Handle shape created
  const handleCreated = useCallback(
    (e) => {
      const { layerType, layer } = e;
      let newGeoFence = null;

      if (layerType === 'circle') {
        const center = layer.getLatLng();
        let radius = layer.getRadius();

        // Enforce max radius
        if (radius > maxRadius) {
          radius = maxRadius;
          layer.setRadius(maxRadius);
        }

        newGeoFence = {
          type: 'circle',
          center: { lat: center.lat, lng: center.lng },
          radius: Math.round(radius),
        };
      } else if (layerType === 'polygon') {
        const latlngs = layer.getLatLngs()[0];
        newGeoFence = {
          type: 'polygon',
          coordinates: latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng })),
        };
      }

      if (newGeoFence) {
        setGeoFence(newGeoFence);
        if (onGeoFenceCreate) {
          onGeoFenceCreate(newGeoFence);
        }
      }

      setDrawMode(null);
    },
    [maxRadius, onGeoFenceCreate]
  );

  // Handle shape edited
  const handleEdited = useCallback(
    (e) => {
      const layers = e.layers;
      layers.eachLayer((layer) => {
        let updatedGeoFence = null;

        if (layer instanceof L.Circle) {
          const center = layer.getLatLng();
          let radius = layer.getRadius();

          if (radius > maxRadius) {
            radius = maxRadius;
            layer.setRadius(maxRadius);
          }

          updatedGeoFence = {
            type: 'circle',
            center: { lat: center.lat, lng: center.lng },
            radius: Math.round(radius),
          };
        } else if (layer instanceof L.Polygon) {
          const latlngs = layer.getLatLngs()[0];
          updatedGeoFence = {
            type: 'polygon',
            coordinates: latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng })),
          };
        }

        if (updatedGeoFence) {
          setGeoFence(updatedGeoFence);
          if (onGeoFenceEdit) {
            onGeoFenceEdit(updatedGeoFence);
          }
        }
      });
    },
    [maxRadius, onGeoFenceEdit]
  );

  // Handle shape deleted
  const handleDeleted = useCallback(
    (e) => {
      setGeoFence(null);
      if (onGeoFenceDelete) {
        onGeoFenceDelete();
      }
    },
    [onGeoFenceDelete]
  );

  // Draw options
  const drawOptions = {
    ...defaultDrawOptions,
    circle: enableCircle
      ? {
          shapeOptions: {
            color: color,
            fillColor: color,
            fillOpacity: 0.2,
          },
        }
      : false,
    polygon: enablePolygon
      ? {
          allowIntersection: false,
          shapeOptions: {
            color: color,
            fillColor: color,
            fillOpacity: 0.2,
          },
        }
      : false,
  };

  return (
    <>
      <FeatureGroup ref={featureGroupRef}>
        <EditControl
          position="topright"
          onCreated={handleCreated}
          onEdited={handleEdited}
          onDeleted={handleDeleted}
          onDrawStart={(e) => setDrawMode(e.layerType)}
          onDrawStop={() => setDrawMode(null)}
          draw={drawOptions}
          edit={{
            featureGroup: featureGroupRef.current,
            remove: true,
          }}
        />
      </FeatureGroup>

      {/* Drawing instructions overlay */}
      {drawMode && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-lg z-[1000]">
          <p className="text-sm text-gray-700">
            {drawMode === 'circle'
              ? 'Click and drag to draw a circle. Release to finish.'
              : 'Click to add points. Click first point to close polygon.'}
          </p>
        </div>
      )}

      {/* Geo-fence info */}
      {geoFence && !drawMode && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-lg z-[1000]">
          <div className="text-sm">
            {geoFence.type === 'circle' ? (
              <span>
                📍 Circle: {(geoFence.radius / 1000).toFixed(1)}km radius
              </span>
            ) : (
              <span>📐 Polygon: {geoFence.coordinates.length} points</span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// Standalone component for simple radius selection
export const RadiusSelector = ({ 
  center, 
  radius = 5000, 
  onChange, 
  min = 100, 
  max = 50000,
  color = '#3B82F6' 
}) => {
  const map = useMap();
  const circleRef = useRef(null);

  useEffect(() => {
    if (!center) return;

    // Create or update circle
    if (!circleRef.current) {
      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radius,
        color: color,
        fillColor: color,
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng([center.lat, center.lng]);
      circleRef.current.setRadius(radius);
    }

    return () => {
      if (circleRef.current) {
        map.removeLayer(circleRef.current);
        circleRef.current = null;
      }
    };
  }, [center, radius, color, map]);

  if (!center) return null;

  return (
    <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg z-[1000]">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Radius: {radius >= 1000 ? `${(radius / 1000).toFixed(1)}km` : `${radius}m`}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={100}
        value={radius}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-48 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{min >= 1000 ? `${min / 1000}km` : `${min}m`}</span>
        <span>{max >= 1000 ? `${max / 1000}km` : `${max}m`}</span>
      </div>
    </div>
  );
};

export default GeoFenceTool;
