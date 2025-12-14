import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const SessionsPage = () => {
  const { getSessions, revokeSession } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSessions();
      setSessions(data || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError('Failed to load sessions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    if (!confirm('Are you sure you want to revoke this session? The device will be logged out.')) return;

    try {
      await revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s._id !== sessionId));
    } catch (err) {
      console.error('Failed to revoke session:', err);
      alert('Failed to revoke session');
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('Are you sure you want to revoke all other sessions? All other devices will be logged out.')) return;

    try {
      const otherSessions = sessions.filter(s => !s.isCurrent);
      for (const session of otherSessions) {
        await revokeSession(session._id);
      }
      setSessions((prev) => prev.filter((s) => s.isCurrent));
    } catch (err) {
      console.error('Failed to revoke sessions:', err);
      alert('Failed to revoke some sessions');
    }
  };

  const getDeviceIcon = (platform) => {
    const p = (platform || '').toLowerCase();
    if (p.includes('mobile') || p.includes('android') || p.includes('iphone')) return '📱';
    if (p.includes('tablet') || p.includes('ipad')) return '📱';
    if (p.includes('mac') || p.includes('windows') || p.includes('linux')) return '💻';
    return '🖥️';
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Active Sessions</h1>
          <p className="text-gray-600 mt-1">
            Manage your active sessions across all devices
          </p>
        </div>
        <Link
          to="/profile"
          className="text-red-600 hover:text-red-700 text-sm font-medium"
        >
          ← Back to Profile
        </Link>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={loadSessions}
            className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Info Banner */}
        <div className="bg-blue-50 border-b border-blue-100 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h3 className="font-medium text-blue-900">Session Security</h3>
              <p className="text-sm text-blue-700 mt-1">
                If you see a session you don't recognize, revoke it immediately and change your password.
              </p>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="p-6">
          {sessions.length > 0 ? (
            <>
              {/* Revoke All Button */}
              {sessions.filter(s => !s.isCurrent).length > 0 && (
                <div className="mb-4 flex justify-end">
                  <button
                    onClick={handleRevokeAll}
                    className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg font-medium"
                  >
                    Revoke All Other Sessions
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session._id}
                    className={`flex items-center justify-between p-4 border rounded-xl transition-colors ${
                      session.isCurrent 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">
                        {getDeviceIcon(session.deviceInfo?.platform)}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {session.deviceInfo?.platform || 'Unknown Device'}
                          </p>
                          {session.isCurrent && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                              Current Session
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {session.deviceInfo?.browser || 'Unknown Browser'}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                          <span>Last active: {formatDate(session.lastActivity)}</span>
                          {session.ip && <span>IP: {session.ip}</span>}
                        </div>
                        {session.createdAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Signed in: {formatDate(session.createdAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {!session.isCurrent && (
                      <button
                        onClick={() => handleRevokeSession(session._id)}
                        className="px-4 py-2 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <span className="text-4xl">📱</span>
              <h3 className="mt-4 font-medium text-gray-900">No Sessions Found</h3>
              <p className="mt-2 text-gray-500">
                Your active sessions will appear here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Security Tips */}
      <div className="mt-6 bg-gray-50 rounded-xl p-6">
        <h3 className="font-medium text-gray-900 mb-3">🛡️ Security Tips</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Regularly review your active sessions for suspicious activity</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Always log out from shared or public devices</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Use a strong, unique password for your account</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500">✓</span>
            <span>Enable two-factor authentication when available</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default SessionsPage;
