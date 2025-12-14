import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { reportsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLocation as useGeoLocation } from '../context/LocationContext';
import { notify } from '../components/Shared/Notification';
import { getHighAccuracyPosition } from '../utils/geoLocation';

const ReportDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { location: userLocation } = useGeoLocation();
  
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [userVote, setUserVote] = useState(null);

  useEffect(() => {
    fetchReport();
  }, [id]);

  // Check if user has already voted when report or user changes
  useEffect(() => {
    if (report && user && report.votes?.voters && report.votes.voters.length > 0) {
      const userId = user._id || user.id;
      const existingVote = report.votes.voters.find(v => {
        const odId = v.user?.toString() || v.user;
        return odId === userId;
      });
      if (existingVote) {
        setUserVote(existingVote.vote === 'up' ? 'confirm' : 'deny');
      } else {
        setUserVote(null);
      }
    }
  }, [report, user]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await reportsApi.getById(id);
      setReport(response.data.data);
    } catch (err) {
      console.error('Failed to fetch report:', err);
      setError(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (vote) => {
    if (!isAuthenticated) {
      notify.error('Please login to verify reports');
      navigate('/login');
      return;
    }

    try {
      setVerifying(true);
      
      // Get fresh high-accuracy location for verification
      let currentLat = userLocation?.latitude;
      let currentLng = userLocation?.longitude;
      
      try {
        notify.info('Getting your location for verification...');
        const position = await getHighAccuracyPosition();
        currentLat = position.coords.latitude;
        currentLng = position.coords.longitude;
      } catch (locError) {
        console.error('Failed to get fresh location:', locError);
        // Fall back to cached location
        if (!currentLat || !currentLng) {
          notify.error('Unable to get your location. Please enable location services.');
          setVerifying(false);
          return;
        }
      }
      
      await reportsApi.verify(id, {
        vote,
        userLat: currentLat,
        userLng: currentLng,
      });
      setUserVote(vote); // Update local state to hide buttons
      notify.success(`Report ${vote === 'confirm' ? 'confirmed' : 'denied'} successfully`);
      fetchReport(); // Refresh report data
    } catch (err) {
      notify.error(err.response?.data?.message || 'Failed to verify report');
    } finally {
      setVerifying(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      high: 'bg-orange-100 text-orange-800 border-orange-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      low: 'bg-green-100 text-green-800 border-green-200',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      verified: 'bg-green-100 text-green-800',
      investigating: 'bg-blue-100 text-blue-800',
      resolved: 'bg-gray-100 text-gray-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-600 border-r-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <span className="text-4xl">❌</span>
          <h2 className="text-xl font-semibold text-red-800 mt-4">{error}</h2>
          <Link
            to="/dashboard"
            className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
      >
        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Report Card */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSeverityColor(report.severity)}`}>
              {report.severity?.toUpperCase()}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(report.status)}`}>
              {report.status}
            </span>
            {report.adminVerified && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-200 text-green-800">
                🛡️ Admin Verified
              </span>
            )}
            {(report.communityVerified || (report.verificationStatus === 'verified' && !report.adminVerified)) && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-200 text-purple-800">
                👥 Community Verified {report.communityVerificationCount ? `(${report.communityVerificationCount} votes)` : ''}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mt-3">{report.title}</h1>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Meta info */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <span>📅</span>
              <span>{formatDate(report.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>📍</span>
              <span>{report.location?.address || 'Location not specified'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>📁</span>
              <span>{report.category}</span>
              {report.subcategory && <span className="text-gray-400">/ {report.subcategory}</span>}
            </div>
          </div>

          {/* Location Map Preview */}
          {report.location?.coordinates && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Report Location</h3>
              <div className="rounded-lg overflow-hidden border border-gray-200">
                <Link 
                  to={`/map?lat=${report.location.coordinates[1]}&lng=${report.location.coordinates[0]}&zoom=16`}
                  className="block relative bg-gray-100"
                >
                  {/* Use OpenStreetMap iframe for reliable map display */}
                  <iframe
                    title="Report Location Map"
                    width="100%"
                    height="200"
                    frameBorder="0"
                    scrolling="no"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${report.location.coordinates[0] - 0.01},${report.location.coordinates[1] - 0.005},${report.location.coordinates[0] + 0.01},${report.location.coordinates[1] + 0.005}&layer=mapnik&marker=${report.location.coordinates[1]},${report.location.coordinates[0]}`}
                    style={{ border: 0 }}
                    className="w-full"
                  />
                  <div className="absolute inset-0 bg-transparent cursor-pointer" />
                </Link>
                <div className="p-3 bg-gray-50 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">
                      📍 {report.location.coordinates[1].toFixed(6)}, {report.location.coordinates[0].toFixed(6)}
                    </span>
                    <Link
                      to={`/map?lat=${report.location.coordinates[1]}&lng=${report.location.coordinates[0]}&zoom=16`}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      Open in Map →
                    </Link>
                  </div>
                  {(report.location.address || report.location.city) && (
                    <p className="text-gray-500 mt-1">
                      {report.location.address || [report.location.city, report.location.state, report.location.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{report.description}</p>
          </div>

          {/* Media */}
          {report.media && report.media.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Attachments</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {report.media.map((item, index) => (
                  <a
                    key={index}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-80 transition-opacity"
                  >
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={`Attachment ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl">📎</span>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Reporter */}
          {report.reporter && !report.isAnonymous && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                {report.reporter.avatar ? (
                  <img src={report.reporter.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-red-600 font-semibold">
                    {report.reporter.firstName?.[0] || '?'}
                  </span>
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {report.reporter.firstName} {report.reporter.lastName}
                </p>
                <p className="text-sm text-gray-500">Reporter</p>
              </div>
            </div>
          )}

          {report.isAnonymous && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-gray-500">👤</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Anonymous</p>
                <p className="text-sm text-gray-500">Reporter identity hidden</p>
              </div>
            </div>
          )}

          {/* Verification stats */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Community Verification</h3>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👍</span>
                <div>
                  <p className="text-2xl font-bold text-green-600">{report.votes?.up || 0}</p>
                  <p className="text-sm text-gray-500">Confirmed</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">👎</span>
                <div>
                  <p className="text-2xl font-bold text-red-600">{report.votes?.down || 0}</p>
                  <p className="text-sm text-gray-500">Denied</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">👁️</span>
                <div>
                  <p className="text-2xl font-bold text-gray-600">{report.viewCount || 0}</p>
                  <p className="text-sm text-gray-500">Views</p>
                </div>
              </div>
            </div>

            {/* Verify buttons */}
            {isAuthenticated && report.status !== 'resolved' && report.status !== 'rejected' && (
              userVote ? (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-600">
                    You {userVote === 'confirm' ? '👍 confirmed' : '👎 denied'} this report
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Thank you for your verification!</p>
                </div>
              ) : (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => handleVerify('confirm')}
                    disabled={verifying}
                    className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {verifying ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <>
                        <span>👍</span> Confirm Report
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleVerify('deny')}
                    disabled={verifying}
                    className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {verifying ? (
                      <span className="animate-spin">⏳</span>
                    ) : (
                      <>
                        <span>👎</span> Deny Report
                      </>
                    )}
                  </button>
                </div>
              )
            )}

            {!isAuthenticated && (
              <p className="mt-4 text-sm text-gray-500 text-center">
                <Link to="/login" className="text-red-600 hover:underline">Login</Link> to verify this report
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDetailPage;
