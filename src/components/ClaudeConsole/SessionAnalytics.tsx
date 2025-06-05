import React from 'react';
import { BarChart3, DollarSign, Brain, Clock, FileCode, TrendingUp } from 'lucide-react';

interface SessionAnalyticsProps {
  analyticsData: any;
  loading: boolean;
  onClose: () => void;
}

export const SessionAnalytics: React.FC<SessionAnalyticsProps> = ({ analyticsData, loading, onClose }) => {
  if (loading) {
    return (
      <div className="absolute top-0 right-0 w-96 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            Session Analytics
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!analyticsData?.sessionAnalytics) return null;

  const analytics = analyticsData.sessionAnalytics;

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Session Analytics
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
      </div>

      {/* Token Usage */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
          <Brain className="h-4 w-4 mr-1" />
          Token Usage
        </h4>
        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
          <div className="flex justify-between text-sm mb-1">
            <span>Input Tokens:</span>
            <span className="font-mono">{analytics.tokenUsage.totalInputTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm mb-1">
            <span>Output Tokens:</span>
            <span className="font-mono">{analytics.tokenUsage.totalOutputTokens.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Avg per Message:</span>
            <span className="font-mono">{Math.round(analytics.tokenUsage.averageTokensPerMessage)}</span>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
          <DollarSign className="h-4 w-4 mr-1" />
          Cost Analysis
        </h4>
        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
          <div className="flex justify-between text-sm mb-1">
            <span>Total Cost:</span>
            <span className="font-mono text-green-600 dark:text-green-400">
              ${analytics.costBreakdown.totalCost.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Projected Monthly:</span>
            <span className="font-mono text-yellow-600 dark:text-yellow-400">
              ${analytics.costBreakdown.projectedMonthlyCost.toFixed(2)}
            </span>
          </div>
        </div>
        {analytics.costBreakdown.optimizationSuggestions.length > 0 && (
          <div className="mt-2">
            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Optimization Tips:</p>
            <ul className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1">
              {analytics.costBreakdown.optimizationSuggestions.map((tip: string, i: number) => (
                <li key={i} className="flex items-start">
                  <TrendingUp className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Time Analytics */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
          <Clock className="h-4 w-4 mr-1" />
          Time Analytics
        </h4>
        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
          <div className="flex justify-between text-sm mb-1">
            <span>Total Duration:</span>
            <span className="font-mono">{Math.round(analytics.timeAnalytics.totalDuration / 60)}m</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Avg Response Time:</span>
            <span className="font-mono">{(analytics.timeAnalytics.averageResponseTime / 1000).toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* Content Analytics */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
          <FileCode className="h-4 w-4 mr-1" />
          Content Analytics
        </h4>
        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Top Topics:</p>
          <div className="space-y-1">
            {analytics.contentAnalytics.topTopics.slice(0, 3).map((topic: any) => (
              <div key={topic.name} className="flex justify-between text-xs">
                <span>{topic.name}</span>
                <span className="text-gray-500">{topic.count}x</span>
              </div>
            ))}
          </div>
          
          {analytics.contentAnalytics.codeLanguages.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-3 mb-1">Languages Used:</p>
              <div className="space-y-1">
                {analytics.contentAnalytics.codeLanguages.map((lang: any) => (
                  <div key={lang.language} className="flex justify-between text-xs">
                    <span>{lang.language}</span>
                    <span className="text-gray-500">{lang.linesOfCode} lines</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Activity by Hour</h4>
        <div className="grid grid-cols-12 gap-1">
          {Array.from({ length: 24 }, (_, hour) => {
            const activity = analytics.timeAnalytics.activityByHour.find((a: any) => a.hour === hour);
            const count = activity?.messageCount || 0;
            const maxCount = Math.max(...analytics.timeAnalytics.activityByHour.map((a: any) => a.messageCount));
            const intensity = maxCount > 0 ? count / maxCount : 0;
            
            return (
              <div
                key={hour}
                className="h-8 rounded text-xs flex items-center justify-center"
                style={{
                  backgroundColor: intensity > 0 
                    ? `rgba(59, 130, 246, ${intensity * 0.8})`
                    : 'rgba(156, 163, 175, 0.1)'
                }}
                title={`${hour}:00 - ${count} messages`}
              >
                {count > 0 && count}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>12AM</span>
          <span>12PM</span>
          <span>11PM</span>
        </div>
      </div>
    </div>
  );
};