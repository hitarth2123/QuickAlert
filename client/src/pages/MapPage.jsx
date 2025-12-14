import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import MapView from '../components/Map/MapView';
import PopulationEstimator from '../components/Map/PopulationEstimator';
import { reportsApi, alertsApi } from '../services/api';
import { useLocation as useGeoLocation } from '../context/LocationContext';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socket';
import ReportForm from '../components/Forms/ReportForm';
import { notify } from '../components/Shared/Notification';
import {
  requestNotificationPermission,
  showAlertNotification,
  getNotificationPermission,
} from '../utils/notificationHelper';

const MapPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const routeLocation = useLocation();
  const { location: userLocation } = useGeoLocation();
  const { isAuthenticated, isAdmin, isResponder, user } = useAuth();
  const lastPathRef = useRef(routeLocation.pathname);
  
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [showPopulationTool, setShowPopulationTool] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission());
  
  const [filters, setFilters] = useState({
    showReports: true,
    showAlerts: true,
    categories: [],
    severity: [],
    radius: 10000,
  });

  // Request notification permission on first visit
  useEffect(() => {
    if (notificationPermission === 'default') {
      // Show permission request after a short delay
      const timer = setTimeout(() => {
        requestNotificationPermission().then(setNotificationPermission);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notificationPermission]);

  // Load data based on map bounds or user location
  const loadData = useCallback(async () => {
    if (!userLocation) return;
    
    setLoading(true);
    try {
      const [reportsRes, alertsRes] = await Promise.all([
        reportsApi.getNearby(userLocation.latitude, userLocation.longitude, filters.radius),
        alertsApi.getNearby(userLocation.latitude, userLocation.longitude, filters.radius),
      ]);

      let filteredReports = reportsRes.data.data || [];
      let filteredAlerts = alertsRes.data.data || [];
      
      // Debug logging
      console.log('[MapPage] Reports loaded:', filteredReports.length);
      if (filteredReports.length > 0) {
        console.log('[MapPage] First report votes:', filteredReports[0].votes);
        console.log('[MapPage] First report voters:', filteredReports[0].votes?.voters);
      }

      // Apply category filter
      if (filters.categories.length > 0) {
        filteredReports = filteredReports.filter((r) => filters.categories.includes(r.category));
        filteredAlerts = filteredAlerts.filter((a) => filters.categories.includes(a.category));
      }

      // Apply severity filter
      if (filters.severity.length > 0) {
        filteredAlerts = filteredAlerts.filter((a) => filters.severity.includes(a.severity));
      }

      setReports(filters.showReports ? filteredReports : []);
      setAlerts(filters.showAlerts ? filteredAlerts : []);
    } catch (error) {
      console.error('Failed to load map data:', error);
    } finally {
      setLoading(false);
    }
  }, [userLocation, filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refetch data when returning to this page from another route (e.g., from report detail)
  useEffect(() => {
    // Check if we're coming back to map from another page
    if (lastPathRef.current !== routeLocation.pathname) {
      lastPathRef.current = routeLocation.pathname;
      if (routeLocation.pathname === '/map') {
        loadData();
      }
    }
  }, [routeLocation.pathname, loadData]);

  // Refetch data when page becomes visible (e.g., returning from another tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData]);

  // Real-time updates
  useEffect(() => {
    if (!userLocation) return;

    // Connect socket with auth token if available
    const token = localStorage.getItem('token');
    socketService.connect(token);
    
    // Join location room for real-time updates
    socketService.joinLocation(userLocation.latitude, userLocation.longitude);

    const unsubscribeReport = socketService.onNewReport((report) => {
      setReports((prev) => [report, ...prev]);
      notify.info(`New report: ${report.title}`, 'New Incident');
    });

    const unsubscribeAlert = socketService.onNewAlert((alert) => {
      setAlerts((prev) => [alert, ...prev]);
      // Show prominent alert notification
      notify.alert(alert.title, `🚨 ${alert.severity?.toUpperCase()} Alert`);
      // Show browser push notification
      if (notificationPermission === 'granted') {
        showAlertNotification(alert);
      }
    });
    
    // Subscribe to report verification updates
    const unsubscribeVerified = socketService.onReportVerified(({ reportId, verificationCount, status }) => {
      setReports((prev) =>
        prev.map((r) =>
          r._id === reportId
            ? { ...r, verificationCount, status: status || r.status, votes: { ...r.votes, up: verificationCount } }
            : r
        )
      );
    });

    // Subscribe to report moderation updates - remove resolved/rejected reports from map
    const unsubscribeModerated = socketService.on('reportModerated', ({ reportId, action, newStatus }) => {
      console.log('[MapPage] Report moderated:', reportId, action, newStatus);
      // Remove resolved, rejected reports from map view
      if (['resolved', 'rejected'].includes(newStatus) || ['resolve', 'reject'].includes(action)) {
        setReports((prev) => prev.filter((r) => r._id !== reportId));
        notify.info('A report has been resolved and removed from the map');
      }
    });

    // Subscribe to alert resolution/cancellation - remove from map
    const unsubscribeAlertResolved = socketService.onAlertResolved(({ alertId }) => {
      console.log('[MapPage] Alert resolved:', alertId);
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
      notify.info('An alert has been resolved and removed from the map');
    });

    const unsubscribeAlertCancelled = socketService.onAlertCancelled(({ alertId }) => {
      console.log('[MapPage] Alert cancelled:', alertId);
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
      notify.info('An alert has been cancelled and removed from the map');
    });

    return () => {
      unsubscribeReport();
      unsubscribeAlert();
      unsubscribeVerified();
      unsubscribeModerated();
      unsubscribeAlertResolved();
      unsubscribeAlertCancelled();
      socketService.leaveLocation();
    };
  }, [userLocation, notificationPermission]);

  // Handle report verification
  const handleVerifyReport = useCallback(async (reportId, vote) => {
    if (!isAuthenticated) {
      notify.warning('Please sign in to verify reports');
      return;
    }
    
    try {
      const response = await reportsApi.verify(reportId, {
        vote,
        userLat: userLocation?.latitude,
        userLng: userLocation?.longitude
      });
      
      // Update local state with new verification count and add user's vote to voters array
      setReports((prev) =>
        prev.map((r) => {
          if (r._id !== reportId) return r;
          
          const voteType = vote === 'confirm' ? 'up' : 'down';
          const userId = user?._id || user?.id;
          
          // Create updated voters array
          let updatedVoters = [...(r.votes?.voters || [])];
          const existingVoteIndex = updatedVoters.findIndex(v => v.user === userId);
          
          if (existingVoteIndex !== -1) {
            // Update existing vote
            updatedVoters[existingVoteIndex] = { ...updatedVoters[existingVoteIndex], vote: voteType };
          } else {
            // Add new vote
            updatedVoters.push({ user: userId, vote: voteType, votedAt: new Date() });
          }
          
          return { 
            ...r, 
            verificationCount: response.data.data?.confirms || r.verificationCount + 1,
            status: response.data.data?.verificationStatus === 'verified' ? 'verified' : r.status,
            votes: {
              ...r.votes,
              up: response.data.data?.confirms || r.votes?.up || 0,
              down: response.data.data?.denies || r.votes?.down || 0,
              voters: updatedVoters
            }
          };
        })
      );
      
      notify.success(vote === 'confirm' ? 'Report confirmed!' : 'Report marked as false');
    } catch (error) {
      console.error('Verification failed:', error);
      notify.error(error.response?.data?.message || 'Failed to verify report');
      throw error;
    }
  }, [isAuthenticated, userLocation, user]);

  const handleMapClick = (location) => {
    setSelectedLocation(location);
    setShowReportForm(true);
  };

  const handleReportClick = (report) => {
    setSelectedItem({ type: 'report', data: report });
  };

  const handleAlertClick = (alert) => {
    setSelectedItem({ type: 'alert', data: alert });
  };

  const handleReportSuccess = () => {
    setShowReportForm(false);
    setSelectedLocation(null);
    loadData();
  };

  const toggleFilter = (type, value) => {
    setFilters((prev) => {
      const current = prev[type];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  const categories = [
    'accident', 'fire', 'crime', 'medical', 'natural_disaster',
    'infrastructure', 'traffic', 'weather', 'other',
  ];

  const severityLevels = ['critical', 'high', 'medium', 'low'];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar - Mobile responsive */}
      <div className="bg-white border-b px-2 sm:px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-semibold whitespace-nowrap">Live Map</h1>
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
              {reports.length} Reports
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              {alerts.length} Alerts
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Population Estimator button - Admin/Alert only */}
          {(isAdmin || isResponder) && (
            <button
              onClick={() => setShowPopulationTool(!showPopulationTool)}
              className={`p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
                showPopulationTool ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Population Estimator"
            >
              <span className="sm:hidden">📊</span>
              <span className="hidden sm:inline">📊 Population</span>
            </button>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 sm:px-3 sm:py-1.5 rounded-lg text-sm font-medium transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
              showFilters ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <span className="sm:hidden">🎛️</span>
            <span className="hidden sm:inline">🎛️ Filters</span>
          </button>
          <button
            onClick={() => {
              setSelectedLocation(null);
              setShowReportForm(true);
            }}
            className="p-2 sm:px-3 sm:py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <span className="sm:hidden">+</span>
            <span className="hidden sm:inline">+ Report</span>
          </button>
        </div>
      </div>

      {/* Mobile stats bar */}
      <div className="sm:hidden bg-gray-50 border-b px-4 py-1.5 flex items-center justify-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          {reports.length} Reports
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          {alerts.length} Alerts
        </span>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white border-b px-4 py-3">
          <div className="flex flex-wrap gap-4">
            {/* Show/Hide toggles */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showReports}
                  onChange={() => setFilters((prev) => ({ ...prev, showReports: !prev.showReports }))}
                  className="rounded text-red-600"
                />
                <span className="text-sm">Reports</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showAlerts}
                  onChange={() => setFilters((prev) => ({ ...prev, showAlerts: !prev.showAlerts }))}
                  className="rounded text-red-600"
                />
                <span className="text-sm">Alerts</span>
              </label>
            </div>

            {/* Radius */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Radius:</span>
              <select
                value={filters.radius}
                onChange={(e) => setFilters((prev) => ({ ...prev, radius: parseInt(e.target.value) }))}
                className="px-2 py-1 border rounded text-sm"
              >
                <option value={1000}>1 km</option>
                <option value={5000}>5 km</option>
                <option value={10000}>10 km</option>
                <option value={25000}>25 km</option>
                <option value={50000}>50 km</option>
              </select>
            </div>

            {/* Categories */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">Categories:</span>
              {categories.slice(0, 5).map((cat) => (
                <button
                  key={cat}
                  onClick={() => toggleFilter('categories', cat)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    filters.categories.includes(cat)
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Severity */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Severity:</span>
              {severityLevels.map((level) => (
                <button
                  key={level}
                  onClick={() => toggleFilter('severity', level)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${
                    filters.severity.includes(level)
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Map container */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-r-transparent"></div>
          </div>
        )}

        <MapView
          reports={reports}
          alerts={alerts}
          onMapClick={handleMapClick}
          onReportClick={handleReportClick}
          onAlertClick={handleAlertClick}
          onVerifyReport={handleVerifyReport}
          enableSelection={showReportForm}
          selectedLocation={selectedLocation}
          enableClustering={true}
          className="h-full"
        >
          {/* Population Estimator Tool - Admin/Alert only */}
          {showPopulationTool && (isAdmin || isResponder) && (
            <PopulationEstimator
              onClose={() => setShowPopulationTool(false)}
              isAdmin={isAdmin}
              isAlert={isResponder}
            />
          )}
        </MapView>

        {/* Detail panel - Responsive: bottom sheet on mobile */}
        {selectedItem && (
          <div className="absolute bottom-0 left-0 right-0 sm:bottom-auto sm:top-4 sm:right-4 sm:left-auto sm:w-80 bg-white rounded-t-xl sm:rounded-xl shadow-xl z-20 overflow-hidden max-h-[60vh] sm:max-h-none">
            <div className={`px-4 py-3 ${selectedItem.type === 'alert' ? 'bg-red-600' : 'bg-blue-600'} text-white`}>
              <div className="flex justify-between items-start">
                <h3 className="font-semibold">
                  {selectedItem.type === 'alert' ? '🚨 Alert' : '📝 Report'}
                </h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-white/80 hover:text-white p-1 min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto">
              <h4 className="font-semibold text-gray-900">{selectedItem.data.title}</h4>
              <p className="text-sm text-gray-600 mt-1">{selectedItem.data.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                  {selectedItem.data.category}
                </span>
                {selectedItem.data.severity && (
                  <span className={`px-2 py-0.5 rounded text-xs text-white ${
                    selectedItem.data.severity === 'critical' ? 'bg-red-600' :
                    selectedItem.data.severity === 'high' ? 'bg-orange-500' :
                    selectedItem.data.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}>
                    {selectedItem.data.severity}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Report form modal - Bottom sheet on mobile */}
        {showReportForm && (
          <div className="absolute inset-0 bg-black/50 z-30 flex items-end sm:items-center justify-center sm:p-4">
            <div className="w-full sm:max-w-2xl max-h-[90vh] sm:max-h-none sm:my-8 overflow-y-auto bg-white rounded-t-xl sm:rounded-xl">
              <ReportForm
                initialLocation={selectedLocation}
                onSuccess={handleReportSuccess}
                onCancel={() => {
                  setShowReportForm(false);
                  setSelectedLocation(null);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPage;
