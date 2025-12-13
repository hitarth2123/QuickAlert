import { useState, useCallback, useRef, useEffect } from 'react';
import { useMap, FeatureGroup, Polygon, Circle } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet.heat';
import { analyticsApi, reportsApi } from '../../services/api';

// Heatmap Layer Component
const HeatmapLayer = ({ points, options = {} }) => {
  const map = useMap();
  const heatLayerRef = useRef(null);

  useEffect(() => {
    if (!points || points.length === 0) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      return;
    }

    // Convert points to [lat, lng, intensity] format
    const heatData = points.map((p) => [p.lat, p.lng, p.intensity || 1]);

    const defaultOptions = {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      max: Math.max(...points.map((p) => p.intensity || 1)),
      gradient: {
        0.2: '#3B82F6',
        0.4: '#10B981',
        0.6: '#F59E0B',
        0.8: '#EF4444',
        1.0: '#DC2626',
      },
    };

    // Remove existing layer if any
    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
    }

    // Create new heat layer
    heatLayerRef.current = L.heatLayer(heatData, { ...defaultOptions, ...options });
    heatLayerRef.current.addTo(map);

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
      }
    };
  }, [map, points, options]);

  return null;
};

const PopulationEstimator = ({
  onClose,
  isAdmin = false,
  isAlert = false,
}) => {
  const map = useMap();
  const featureGroupRef = useRef(null);
  
  const [drawMode, setDrawMode] = useState(null);
  const [polygon, setPolygon] = useState(null);
  const [loading, setLoading] = useState(false);
  const [estimation, setEstimation] = useState(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapData, setHeatmapData] = useState([]);
  const [recentReporters, setRecentReporters] = useState([]);
  const [error, setError] = useState(null);

  // Clear any existing shapes
  const clearShapes = useCallback(() => {
    if (featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
    }
    setPolygon(null);
    setEstimation(null);
    setRecentReporters([]);
    setError(null);
  }, []);

  // Handle polygon creation
  const handleCreated = useCallback((e) => {
    const { layerType, layer } = e;
    
    if (layerType === 'polygon') {
      const latlngs = layer.getLatLngs()[0];
      const coords = latlngs.map((ll) => [ll.lng, ll.lat]); // [lng, lat] for GeoJSON
      setPolygon({
        type: 'polygon',
        coordinates: coords,
        latlngs: latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng })),
      });
    } else if (layerType === 'circle') {
      const center = layer.getLatLng();
      const radius = layer.getRadius();
      setPolygon({
        type: 'circle',
        center: { lat: center.lat, lng: center.lng },
        radius: Math.round(radius),
      });
    }
    
    setDrawMode(null);
  }, []);

  // Handle shape edited
  const handleEdited = useCallback((e) => {
    const layers = e.layers;
    layers.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0];
        const coords = latlngs.map((ll) => [ll.lng, ll.lat]);
        setPolygon({
          type: 'polygon',
          coordinates: coords,
          latlngs: latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng })),
        });
      } else if (layer instanceof L.Circle) {
        const center = layer.getLatLng();
        const radius = layer.getRadius();
        setPolygon({
          type: 'circle',
          center: { lat: center.lat, lng: center.lng },
          radius: Math.round(radius),
        });
      }
    });
  }, []);

  // Handle shape deleted
  const handleDeleted = useCallback(() => {
    clearShapes();
  }, [clearShapes]);

  // Estimate population in the drawn area
  const estimatePopulation = async () => {
    if (!polygon) {
      setError('Please draw an area first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let params = {};
      
      if (polygon.type === 'polygon') {
        params = { polygon: JSON.stringify(polygon.coordinates) };
      } else if (polygon.type === 'circle') {
        params = {
          lat: polygon.center.lat,
          lng: polygon.center.lng,
          radius: polygon.radius / 1000, // Convert meters to km
        };
      }

      // Fetch population estimate
      const populationRes = await analyticsApi.getPopulation(params);
      
      setEstimation({
        population: populationRes.data.data?.population || 0,
        query: populationRes.data.data?.query,
        timestamp: populationRes.data.data?.timestamp,
      });

      // Fetch recent reports in the area to find reporters
      if (polygon.type === 'circle') {
        const reportsRes = await reportsApi.getNearby(
          polygon.center.lat,
          polygon.center.lng,
          polygon.radius
        );
        
        // Get unique reporters
        const reporters = new Map();
        (reportsRes.data.data || []).forEach((report) => {
          if (report.reporter && !reporters.has(report.reporter._id)) {
            reporters.set(report.reporter._id, {
              ...report.reporter,
              lastReport: report.createdAt,
              reportTitle: report.title,
            });
          }
        });
        
        setRecentReporters(Array.from(reporters.values()).slice(0, 10));
      }

    } catch (err) {
      console.error('Population estimation failed:', err);
      setError(err.response?.data?.message || 'Failed to estimate population');
    } finally {
      setLoading(false);
    }
  };

  // Load heatmap data
  const loadHeatmap = async () => {
    if (!showHeatmap) {
      setShowHeatmap(true);
      setLoading(true);
      
      try {
        const center = map.getCenter();
        const bounds = map.getBounds();
        const radius = center.distanceTo(bounds.getNorthEast()) / 1000;
        
        const res = await analyticsApi.getPopulation({
          lat: center.lat,
          lng: center.lng,
          radius: Math.min(radius * 2, 100), // Cap at 100km
        });

        // The heatmap endpoint should return point data
        const heatmapRes = await fetch(
          `${import.meta.env.VITE_API_URL || '/api'}/analytics/heatmap?` +
          `lat=${center.lat}&lng=${center.lng}&radius=${Math.min(radius * 2, 100)}&type=users`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
        
        const heatmapData = await heatmapRes.json();
        
        if (heatmapData.success && heatmapData.data?.points) {
          setHeatmapData(heatmapData.data.points);
        }
      } catch (err) {
        console.error('Failed to load heatmap:', err);
        // Generate mock heatmap data based on current view
        const mockData = generateMockHeatmapData(map.getCenter(), map.getZoom());
        setHeatmapData(mockData);
      } finally {
        setLoading(false);
      }
    } else {
      setShowHeatmap(false);
      setHeatmapData([]);
    }
  };

  // Generate mock heatmap data for demo purposes
  const generateMockHeatmapData = (center, zoom) => {
    const points = [];
    const spread = 0.1 / (zoom / 10);
    
    for (let i = 0; i < 50; i++) {
      points.push({
        lat: center.lat + (Math.random() - 0.5) * spread,
        lng: center.lng + (Math.random() - 0.5) * spread,
        intensity: Math.random() * 10 + 1,
      });
    }
    
    return points;
  };

  // Draw options
  const drawOptions = {
    rectangle: false,
    polyline: false,
    circlemarker: false,
    marker: false,
    circle: {
      shapeOptions: {
        color: '#8B5CF6',
        fillColor: '#8B5CF6',
        fillOpacity: 0.2,
      },
    },
    polygon: {
      allowIntersection: false,
      shapeOptions: {
        color: '#8B5CF6',
        fillColor: '#8B5CF6',
        fillOpacity: 0.2,
      },
    },
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Drawing feature group */}
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

      {/* Heatmap overlay */}
      {showHeatmap && heatmapData.length > 0 && (
        <HeatmapLayer points={heatmapData} />
      )}

      {/* Control panel */}
      <div className="absolute top-20 left-4 z-[1000] w-80 max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  📊 Population Estimator
                </h3>
                <p className="text-xs text-purple-200 mt-0.5">
                  Draw an area to estimate users
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Instructions */}
          {!polygon && !drawMode && (
            <div className="px-4 py-3 bg-purple-50 border-b">
              <p className="text-sm text-purple-700">
                Use the drawing tools on the right side of the map to define a disaster zone (polygon or circle).
              </p>
            </div>
          )}

          {/* Drawing mode indicator */}
          {drawMode && (
            <div className="px-4 py-3 bg-yellow-50 border-b">
              <p className="text-sm text-yellow-700 flex items-center gap-2">
                <span className="animate-pulse">⏺</span>
                {drawMode === 'circle'
                  ? 'Click and drag to draw a circle'
                  : 'Click to add points, close by clicking the first point'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 space-y-3">
            {/* Estimate button */}
            <button
              onClick={estimatePopulation}
              disabled={!polygon || loading}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Calculating...
                </>
              ) : (
                <>
                  📍 Estimate Population
                </>
              )}
            </button>

            {/* Heatmap toggle */}
            <button
              onClick={loadHeatmap}
              disabled={loading}
              className={`w-full px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                showHeatmap
                  ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔥 {showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
            </button>

            {/* Clear button */}
            {polygon && (
              <button
                onClick={clearShapes}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                🗑️ Clear Selection
              </button>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mx-4 mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Estimation results */}
          {estimation && (
            <div className="border-t">
              <div className="px-4 py-3 bg-gray-50">
                <h4 className="font-semibold text-gray-700">Estimation Results</h4>
              </div>
              <div className="p-4">
                <div className="text-center py-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
                  <p className="text-4xl font-bold text-purple-700">
                    {estimation.population.toLocaleString()}
                  </p>
                  <p className="text-sm text-purple-600 mt-1">
                    Active users in this area
                  </p>
                </div>
                
                <p className="text-xs text-gray-500 text-center mt-2">
                  Estimated at {formatDate(estimation.timestamp)}
                </p>
              </div>
            </div>
          )}

          {/* Recent reporters */}
          {recentReporters.length > 0 && (
            <div className="border-t">
              <div className="px-4 py-3 bg-gray-50">
                <h4 className="font-semibold text-gray-700">
                  Recent Reporters ({recentReporters.length})
                </h4>
              </div>
              <div className="divide-y max-h-48 overflow-y-auto">
                {recentReporters.map((reporter) => (
                  <div key={reporter._id} className="px-4 py-2 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                        {reporter.name?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {reporter.name || 'Anonymous'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {reporter.reportTitle}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400">
                        {formatDate(reporter.lastReport)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Area info */}
          {polygon && (
            <div className="border-t px-4 py-3 bg-gray-50">
              <p className="text-xs text-gray-500">
                {polygon.type === 'circle' ? (
                  <>
                    📍 Circle: {(polygon.radius / 1000).toFixed(1)}km radius
                  </>
                ) : (
                  <>
                    📐 Polygon: {polygon.coordinates.length} points
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PopulationEstimator;
