import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { alertsApi } from '../services/api';

const AlertDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAlert();
  }, [id]);

  const fetchAlert = async () => {
    try {
      setLoading(true);
      const response = await alertsApi.getById(id);
      setAlert(response.data.data);
    } catch (err) {
      console.error('Failed to fetch alert:', err);
      setError(err.response?.data?.message || 'Failed to load alert');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityConfig = (severity) => {
    const config = {
      extreme: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-500', badge: 'bg-purple-600', icon: '🚨' },
      critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-500', badge: 'bg-red-600', icon: '🔴' },
      warning: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-500', badge: 'bg-orange-500', icon: '🟠' },
      advisory: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-500', badge: 'bg-yellow-500', icon: '🟡' },
      info: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-500', badge: 'bg-blue-500', icon: '🔵' },
    };
    return config[severity] || config.advisory;
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      resolved: 'bg-blue-100 text-blue-800',
    };
    return badges[status] || badges.active;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-r-transparent"></div>
        </div>
      </div>
    );
  }

  if (error || !alert) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Alert Not Found</h2>
          <p className="text-red-600 mb-4">{error || 'This alert could not be found.'}</p>
          <Link
            to="/alerts"
            className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            ← Back to Alerts
          </Link>
        </div>
      </div>
    );
  }

  const severityConfig = getSeverityConfig(alert.severity);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/alerts" className="hover:text-gray-700">Alerts</Link>
        <span>/</span>
        <span className="text-gray-900">{alert.title?.substring(0, 30)}...</span>
      </div>

      {/* Alert Card */}
      <div className={`bg-white rounded-xl shadow-lg overflow-hidden border-l-4 ${severityConfig.border}`}>
        {/* Header */}
        <div className={`${severityConfig.bg} px-6 py-4`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-2xl">{severityConfig.icon}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold text-white ${severityConfig.badge}`}>
                  {alert.severity?.toUpperCase()}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(alert.status)}`}>
                  {alert.status}
                </span>
                {alert.metadata?.communityVerified && !alert.metadata?.adminVerified && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-200 text-purple-800">
                    👥 Verified by Community Voting
                  </span>
                )}
                {alert.metadata?.adminVerified && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-200 text-green-800">
                    🛡️ Verified by Admin
                  </span>
                )}
                {alert.source?.type === 'report' && alert.metadata?.communityVerified && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-200 text-blue-800">
                    📢 From Community Report
                  </span>
                )}
              </div>
              <h1 className={`text-2xl font-bold ${severityConfig.text}`}>
                {alert.title}
              </h1>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{alert.description}</p>
          </div>

          {/* Admin Verification Info */}
          {alert.metadata?.adminVerified && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-800 mb-2">🛡️ Admin Verified Alert</h3>
              <p className="text-green-700 text-sm">
                This alert was verified by an official administrator. Admin-verified alerts are prioritized 
                and confirmed to be accurate by our team.
              </p>
              {alert.source?.reportId && (
                <Link
                  to={`/reports/${alert.source.reportId}`}
                  className="inline-flex items-center mt-3 text-green-600 hover:text-green-800 text-sm font-medium"
                >
                  View Original Report →
                </Link>
              )}
            </div>
          )}

          {/* Community Verification Info */}
          {alert.metadata?.communityVerified && !alert.metadata?.adminVerified && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-800 mb-2">📢 Community Verified Alert</h3>
              <p className="text-purple-700 text-sm">
                This alert was automatically generated when {alert.metadata.verificationCount || 3} community members 
                verified a report about this incident. Community-verified alerts help keep everyone informed about 
                local incidents that have been confirmed by multiple people.
              </p>
              {alert.source?.reportId && (
                <Link
                  to={`/reports/${alert.source.reportId}`}
                  className="inline-flex items-center mt-3 text-purple-600 hover:text-purple-800 text-sm font-medium"
                >
                  View Original Report →
                </Link>
              )}
            </div>
          )}

          {/* Instructions */}
          {alert.instructions?.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Safety Instructions</h2>
              <ul className="space-y-2">
                {alert.instructions.map((instruction, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 bg-gray-50 rounded-lg p-3"
                  >
                    <span className="flex-shrink-0 w-6 h-6 bg-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{instruction.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Type */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Type</p>
              <p className="font-medium text-gray-900 capitalize">{alert.type}</p>
            </div>

            {/* Source */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Source</p>
              <p className="font-medium text-gray-900 capitalize">
                {alert.source?.officialSource || alert.source?.type || 'Official'}
              </p>
            </div>

            {/* Created */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Created</p>
              <p className="font-medium text-gray-900">{formatDate(alert.createdAt)}</p>
            </div>

            {/* Expires */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Expires</p>
              <p className="font-medium text-gray-900">
                {alert.effectiveUntil ? formatDate(alert.effectiveUntil) : 'No expiration'}
              </p>
            </div>

            {/* Affected Area */}
            {alert.targetArea && (
              <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
                <p className="text-sm text-gray-500 mb-1">Affected Area</p>
                <p className="font-medium text-gray-900">
                  {alert.targetArea.address || 
                   (alert.targetArea.radius ? `${alert.targetArea.radius}km radius` : 'Area defined')}
                  {alert.targetArea.city && `, ${alert.targetArea.city}`}
                </p>
              </div>
            )}
          </div>

          {/* Contact Info */}
          {alert.contactInfo && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">📞 Contact Information</h3>
              {alert.contactInfo.phone && (
                <p className="text-blue-700">Phone: {alert.contactInfo.phone}</p>
              )}
              {alert.contactInfo.email && (
                <p className="text-blue-700">Email: {alert.contactInfo.email}</p>
              )}
              {alert.contactInfo.website && (
                <a
                  href={alert.contactInfo.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {alert.contactInfo.website}
                </a>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <Link
              to={`/map?lat=${alert.targetArea?.coordinates?.[1] || ''}&lng=${alert.targetArea?.coordinates?.[0] || ''}&alertId=${alert._id}`}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              🗺️ View on Map
            </Link>
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              ← Go Back
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: alert.title,
                    text: alert.description?.substring(0, 100),
                    url: window.location.href,
                  });
                } else {
                  navigator.clipboard.writeText(window.location.href);
                  // Could add toast notification here
                }
              }}
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              📤 Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertDetailPage;
