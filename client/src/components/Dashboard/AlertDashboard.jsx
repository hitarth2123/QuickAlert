import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { alertsApi } from '../../services/api';
import { useLocation as useGeoLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socket';
import { showAlertNotification } from '../../utils/notificationHelper';

const AlertDashboard = () => {
  const { location } = useGeoLocation();
  const { isResponder, isAdmin } = useAuth();
  const canCreateAlerts = isResponder || isAdmin;
  
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState({
    status: 'active',
    severity: '',
    category: '',
  });
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });

  useEffect(() => {
    fetchAlerts();
  }, [filter, pagination.page]);

  // Subscribe to real-time alerts
  useEffect(() => {
    const unsubscribeNew = socketService.onNewAlert((alert) => {
      setAlerts((prev) => [alert, ...prev]);
      showAlertNotification(alert);
    });

    const unsubscribeUpdate = socketService.onAlertUpdated((alert) => {
      setAlerts((prev) =>
        prev.map((a) => (a._id === alert._id ? alert : a))
      );
    });

    const unsubscribeCancelled = socketService.onAlertCancelled(({ alertId }) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a._id === alertId ? { ...a, status: 'cancelled' } : a
        )
      );
    });

    const unsubscribeResolved = socketService.onAlertResolved(({ alertId }) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a._id === alertId ? { ...a, status: 'resolved' } : a
        )
      );
    });

    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
      unsubscribeCancelled();
      unsubscribeResolved();
    };
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filter).filter(([_, v]) => v)
        ),
      };

      const response = await alertsApi.getAll(params);
      setAlerts(response.data.data || []);
      setPagination((prev) => ({
        ...prev,
        total: response.data.pagination?.total || 0,
      }));
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getSeverityConfig = (severity) => {
    const config = {
      critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', badge: 'bg-red-600' },
      high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500', badge: 'bg-orange-500' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', badge: 'bg-yellow-500' },
      low: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-500', badge: 'bg-green-500' },
    };
    return config[severity] || config.medium;
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-red-100 text-red-800',
      resolved: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-600',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const categories = [
    { value: '', label: 'All Categories' },
    { value: 'accident', label: '🚗 Accident' },
    { value: 'fire', label: '🔥 Fire' },
    { value: 'crime', label: '🚨 Crime' },
    { value: 'medical', label: '🏥 Medical' },
    { value: 'natural_disaster', label: '🌊 Natural Disaster' },
    { value: 'infrastructure', label: '🏗️ Infrastructure' },
    { value: 'traffic', label: '🚦 Traffic' },
    { value: 'weather', label: '🌧️ Weather' },
  ];

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emergency Alerts</h1>
          <p className="text-gray-500">Official emergency alerts and notifications</p>
        </div>
        <div className="flex gap-3">
          {canCreateAlerts && (
            <Link
              to="/alerts/create"
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              + Create Alert
            </Link>
          )}
          <Link
            to="/map"
            className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            🗺️ View on Map
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-4">
          {/* Status filter */}
          <div className="flex rounded-lg overflow-hidden border">
            {['active', 'resolved', 'cancelled', ''].map((status) => (
              <button
                key={status || 'all'}
                onClick={() => handleFilterChange('status', status)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter.status === status
                    ? 'bg-red-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {status || 'All'}
              </button>
            ))}
          </div>

          {/* Severity filter */}
          <select
            value={filter.severity}
            onChange={(e) => handleFilterChange('severity', e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="">All Severities</option>
            <option value="critical">🔴 Critical</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>

          {/* Category filter */}
          <select
            value={filter.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alerts list */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-r-transparent"></div>
        </div>
      ) : alerts.length > 0 ? (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const severityConfig = getSeverityConfig(alert.severity);
            return (
              <Link
                key={alert._id}
                to={`/alerts/${alert._id}`}
                className={`block bg-white rounded-xl shadow-sm overflow-hidden border-l-4 ${severityConfig.border} hover:shadow-md transition-shadow`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold text-white ${severityConfig.badge}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(alert.status)}`}>
                          {alert.status}
                        </span>
                        <span className="text-sm text-gray-500">
                          {alert.category}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mt-2">
                        {alert.title}
                      </h3>
                      
                      {alert.description && (
                        <p className="text-gray-600 mt-1 line-clamp-2">
                          {alert.description}
                        </p>
                      )}

                      {/* Instructions preview */}
                      {alert.instructions?.length > 0 && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                          <span>📋</span>
                          <span>{alert.instructions.length} safety instruction(s)</span>
                        </div>
                      )}

                      {/* Affected area */}
                      {alert.affectedArea?.radius && (
                        <div className="mt-2 text-sm text-gray-500">
                          <span>📍 Affected area: {(alert.affectedArea.radius / 1000).toFixed(1)}km radius</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right text-sm text-gray-500">
                      <p>{formatDate(alert.createdAt)}</p>
                      {alert.expiresAt && (
                        <p className="text-orange-600">
                          Expires: {formatDate(alert.expiresAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-600">
                Page {pagination.page} of {totalPages}
              </span>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= totalPages}
                className="px-4 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <span className="text-6xl">🎉</span>
          <h3 className="text-xl font-semibold text-gray-900 mt-4">No alerts found</h3>
          <p className="text-gray-500 mt-2">
            {filter.status === 'active'
              ? 'Great news! There are no active alerts in your area.'
              : 'No alerts match your current filters.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AlertDashboard;
