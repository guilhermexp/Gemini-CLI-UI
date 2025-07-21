import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, BarChart3 } from 'lucide-react';
import { api } from '../utils/api';

const QuotaMonitor = ({ isOpen, onToggle, isMobile = false }) => {
  const [quotaStatus, setQuotaStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchQuotaStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.quotaStatus();
      if (response.ok) {
        const data = await response.json();
        setQuotaStatus(data);
      } else {
        throw new Error('Failed to fetch quota status');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching quota status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchQuotaStatus();
      // Refresh every 30 seconds when open
      const interval = setInterval(fetchQuotaStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const formatTimeUntilReset = (resetTime) => {
    const now = new Date();
    const reset = new Date(resetTime);
    const diff = reset.getTime() - now.getTime();
    
    if (diff <= 0) return 'Resetting...';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 90) return 'text-red-600 dark:text-red-400';
    if (percentage >= 75) return 'text-orange-600 dark:text-orange-400';
    if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getStatusIcon = (percentage) => {
    if (percentage >= 90) return <AlertTriangle className="w-4 h-4" />;
    return <CheckCircle className="w-4 h-4" />;
  };

  const renderQuotaBar = (used, limit, percentage) => {
    const barColor = percentage >= 90 ? 'bg-red-500' : 
                    percentage >= 75 ? 'bg-orange-500' :
                    percentage >= 50 ? 'bg-yellow-500' : 'bg-green-500';
    
    return (
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    );
  };

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className={`fixed ${isMobile ? 'bottom-20 right-4' : 'bottom-6 right-6'} 
          z-40 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full 
          shadow-lg transition-colors duration-200 group`}
        title="View Quota Status"
      >
        <BarChart3 className="w-5 h-5" />
        <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 
          bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap 
          opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          Quota Monitor
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed ${isMobile ? 'bottom-20 right-4 left-4' : 'bottom-6 right-6 w-96'} 
      z-40 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 
      dark:border-gray-700 max-h-96 overflow-hidden`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Quota Monitor</h3>
        </div>
        <button
          onClick={onToggle}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
            rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <span className="sr-only">Close</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-80 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-800 dark:text-red-400">{error}</span>
            </div>
          </div>
        )}

        {quotaStatus && !loading && (
          <>
            {/* Reset Timer */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-400">Next Reset</span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {formatTimeUntilReset(quotaStatus.nextReset)}
              </p>
            </div>

            {/* Model Quotas */}
            {Object.entries(quotaStatus.models).map(([model, data]) => (
              <div key={model} className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                  {model.replace('-', ' ')}
                </h4>
                
                {/* Daily Quota */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(data.daily.percentage)}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Daily Requests
                      </span>
                    </div>
                    <span className={`text-sm font-mono ${getStatusColor(data.daily.percentage)}`}>
                      {data.daily.used} / {data.daily.limit}
                    </span>
                  </div>
                  {renderQuotaBar(data.daily.used, data.daily.limit, data.daily.percentage)}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {data.daily.remaining} requests remaining ({data.daily.percentage}% used)
                  </p>
                </div>

                {/* Rate Limit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(data.minute.percentage)}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Per Minute Rate
                      </span>
                    </div>
                    <span className={`text-sm font-mono ${getStatusColor(data.minute.percentage)}`}>
                      {data.minute.used} / {data.minute.limit}
                    </span>
                  </div>
                  {renderQuotaBar(data.minute.used, data.minute.limit, data.minute.percentage)}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {data.minute.remaining} requests remaining this minute
                  </p>
                </div>
              </div>
            ))}

            {/* Refresh Button */}
            <button
              onClick={fetchQuotaStatus}
              disabled={loading}
              className="w-full p-2 text-sm bg-gray-100 dark:bg-gray-700 
                hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 
                dark:text-gray-300 rounded-md transition-colors duration-200 
                disabled:opacity-50"
            >
              Refresh Status
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default QuotaMonitor;