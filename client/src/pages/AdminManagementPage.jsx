import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportsApi, alertsApi } from '../services/api';
import { Navigate, Link } from 'react-router-dom';

const AdminManagementPage = () => {
  const { isAdmin, isResponder, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Filters
  const [reportFilter, setReportFilter] = useState('verified');
  const [alertFilter, setAlertFilter] = useState('active');

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    } else {
      fetchAlerts();
    }
  }, [activeTab, reportFilter, alertFilter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = { limit: 100, includeAll: true };
      if (reportFilter !== 'all') {
        params.status = reportFilter;
      }
      const res = await reportsApi.getAll(params);
      setReports(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      setMessage({ type: 'error', text: 'Failed to load reports' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = { limit: 100, includeAll: true };
      if (alertFilter !== 'all') {
        params.status = alertFilter;
      }
      const res = await alertsApi.getAll(params);
      setAlerts(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      setMessage({ type: 'error', text: 'Failed to load alerts' });
    } finally {
      setLoading(false);
    }
  };

  const handleReportAction = async (reportId, action) => {
    setActionLoading(reportId);
    setMessage({ type: '', text: '' });
    
    try {
      let status;
      switch (action) {
        case 'resolve':
          status = 'resolved';
          break;
        case 'in_progress':
          status = 'in_progress';
          break;
        case 'escalate':
          status = 'escalated';
          break;
        case 'reject':
          status = 'rejected';
          break;
        default:
          status = action;
      }
      
      await reportsApi.moderate(reportId, status);
      setMessage({ type: 'success', text: `Report marked as ${status}` });
      fetchReports();
    } catch (error) {
      console.error('Failed to update report:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update report' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAlertAction = async (alertId, action) => {
    setActionLoading(alertId);
    setMessage({ type: '', text: '' });
    
    try {
      let updateData;
      switch (action) {
        case 'resolve':
          updateData = { status: 'resolved', isActive: false };
          break;
        case 'expire':
          updateData = { status: 'expired', isActive: false };
          break;
        case 'cancel':
          updateData = { status: 'cancelled', isActive: false };
          break;
        case 'reactivate':
          updateData = { status: 'active', isActive: true };
          break;
        default:
          updateData = { status: action };
      }
      
      await alertsApi.update(alertId, updateData);
      setMessage({ type: 'success', text: `Alert ${action}d successfully` });
      fetchAlerts();
    } catch (error) {
      console.error('Failed to update alert:', error);
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update alert' });
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      verified: 'bg-green-100 text-green-800',
      in_progress: 'bg-blue-100 text-blue-800',
      resolved: 'bg-gray-100 text-gray-800',
      rejected: 'bg-red-100 text-red-800',
      escalated: 'bg-purple-100 text-purple-800',
      active: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityBadge = (severity) => {
    const badges = {
      critical: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      warning: 'bg-orange-400 text-white',
      medium: 'bg-yellow-500 text-white',
      advisory: 'bg-yellow-400 text-black',
      low: 'bg-blue-500 text-white',
      info: 'bg-blue-400 text-white',
    };
    return badges[severity] || 'bg-gray-500 text-white';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-r-transparent"></div>
      </div>
    );
  }

  if (!isAdmin && !isResponder) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Management</h1>
          <p className="text-gray-600 mt-1">Manage and resolve reports and alerts</p>
        </div>
        <Link
          to="/admin"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
        >
          ← Back to Admin Panel
        </Link>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
          'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? '✓' : '⚠️'} {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="border-b">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('reports')}
              className={`flex-1 px-6 py-4 text-sm font-medium ${
                activeTab === 'reports'
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              📋 Reports Management
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`flex-1 px-6 py-4 text-sm font-medium ${
                activeTab === 'alerts'
                  ? 'bg-red-50 text-red-700 border-b-2 border-red-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              🚨 Alerts Management
            </button>
          </nav>
        </div>

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="p-6">
            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm font-medium text-gray-700">Filter by status:</label>
              <select
                value={reportFilter}
                onChange={(e) => setReportFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Reports</option>
                <option value="pending">Pending</option>
                <option value="verified">Verified</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
                <option value="rejected">Rejected</option>
              </select>
              <span className="text-sm text-gray-500">
                {reports.length} report{reports.length !== 1 ? 's' : ''} found
              </span>
            </div>

            {/* Reports List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-600 border-r-transparent mx-auto"></div>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No reports found with the selected filter
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report._id}
                    className="border rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(report.status)}`}>
                            {report.status}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadge(report.severity)}`}>
                            {report.severity}
                          </span>
                          {report.adminVerified && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                              🛡️ Admin Verified
                            </span>
                          )}
                          {report.verificationStatus === 'verified' && !report.adminVerified && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              👥 Community Verified
                            </span>
                          )}
                        </div>
                        <Link 
                          to={`/reports/${report._id}`}
                          className="text-lg font-semibold text-gray-900 hover:text-red-600"
                        >
                          {report.title}
                        </Link>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {report.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>📁 {report.category}</span>
                          <span>📍 {report.location?.address || 'Location N/A'}</span>
                          <span>📅 {formatDate(report.createdAt)}</span>
                          <span>👍 {report.votes?.up || 0} votes</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2">
                        {report.status !== 'resolved' && (
                          <button
                            onClick={() => handleReportAction(report._id, 'resolve')}
                            disabled={actionLoading === report._id}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === report._id ? '...' : '✓ Resolve'}
                          </button>
                        )}
                        {report.status === 'pending' && (
                          <button
                            onClick={() => handleReportAction(report._id, 'in_progress')}
                            disabled={actionLoading === report._id}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                          >
                            {actionLoading === report._id ? '...' : '🔄 In Progress'}
                          </button>
                        )}
                        {report.status !== 'escalated' && report.status !== 'resolved' && (
                          <button
                            onClick={() => handleReportAction(report._id, 'escalate')}
                            disabled={actionLoading === report._id}
                            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                          >
                            {actionLoading === report._id ? '...' : '⚡ Escalate'}
                          </button>
                        )}
                        {report.status !== 'rejected' && report.status !== 'resolved' && (
                          <button
                            onClick={() => handleReportAction(report._id, 'reject')}
                            disabled={actionLoading === report._id}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                          >
                            {actionLoading === report._id ? '...' : '✕ Reject'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="p-6">
            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm font-medium text-gray-700">Filter by status:</label>
              <select
                value={alertFilter}
                onChange={(e) => setAlertFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Alerts</option>
                <option value="active">Active</option>
                <option value="resolved">Resolved</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <span className="text-sm text-gray-500">
                {alerts.length} alert{alerts.length !== 1 ? 's' : ''} found
              </span>
            </div>

            {/* Alerts List */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-600 border-r-transparent mx-auto"></div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No alerts found with the selected filter
              </div>
            ) : (
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div
                    key={alert._id}
                    className="border rounded-xl p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(alert.status)}`}>
                            {alert.status}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadge(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          {alert.metadata?.adminVerified && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                              🛡️ Admin Verified
                            </span>
                          )}
                          {alert.metadata?.communityVerified && !alert.metadata?.adminVerified && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              👥 Community Verified
                            </span>
                          )}
                          {alert.isActive && (
                            <span className="px-2 py-1 rounded text-xs font-medium bg-green-500 text-white">
                              🔴 LIVE
                            </span>
                          )}
                        </div>
                        <Link 
                          to={`/alerts/${alert._id}`}
                          className="text-lg font-semibold text-gray-900 hover:text-red-600"
                        >
                          {alert.title}
                        </Link>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>📁 {alert.type}</span>
                          <span>📍 {alert.targetArea?.address || 'Area N/A'}</span>
                          <span>📅 Created: {formatDate(alert.createdAt)}</span>
                          {alert.effectiveUntil && (
                            <span>⏰ Expires: {formatDate(alert.effectiveUntil)}</span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2">
                        {alert.status === 'active' && (
                          <>
                            <button
                              onClick={() => handleAlertAction(alert._id, 'resolve')}
                              disabled={actionLoading === alert._id}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                            >
                              {actionLoading === alert._id ? '...' : '✓ Resolve'}
                            </button>
                            <button
                              onClick={() => handleAlertAction(alert._id, 'expire')}
                              disabled={actionLoading === alert._id}
                              className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                            >
                              {actionLoading === alert._id ? '...' : '⏰ Expire'}
                            </button>
                            <button
                              onClick={() => handleAlertAction(alert._id, 'cancel')}
                              disabled={actionLoading === alert._id}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                            >
                              {actionLoading === alert._id ? '...' : '✕ Cancel'}
                            </button>
                          </>
                        )}
                        {(alert.status === 'resolved' || alert.status === 'expired' || alert.status === 'cancelled') && (
                          <button
                            onClick={() => handleAlertAction(alert._id, 'reactivate')}
                            disabled={actionLoading === alert._id}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                          >
                            {actionLoading === alert._id ? '...' : '🔄 Reactivate'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {reports.filter(r => r.status === 'pending').length}
          </div>
          <div className="text-sm text-gray-500">Pending Reports</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {reports.filter(r => r.status === 'verified').length}
          </div>
          <div className="text-sm text-gray-500">Verified Reports</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {alerts.filter(a => a.isActive).length}
          </div>
          <div className="text-sm text-gray-500">Active Alerts</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-gray-600">
            {alerts.filter(a => a.status === 'resolved').length}
          </div>
          <div className="text-sm text-gray-500">Resolved Alerts</div>
        </div>
      </div>
    </div>
  );
};

export default AdminManagementPage;
