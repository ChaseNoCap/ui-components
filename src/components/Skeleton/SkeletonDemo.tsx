import React, { useState } from 'react';
import { RepositoryCardSkeleton } from './RepositoryCardSkeleton';
import { MetricsOverviewSkeleton } from './MetricsOverviewSkeleton';
import { WorkflowListSkeleton } from './WorkflowListSkeleton';
import { LoadingTimeout } from './LoadingTimeout';

export const SkeletonDemo: React.FC = () => {
  const [showSkeletons, setShowSkeletons] = useState(true);
  const [timeoutDemo, setTimeoutDemo] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Skeleton Loading Components Demo
          </h1>
          <div className="flex space-x-4">
            <button
              onClick={() => setShowSkeletons(!showSkeletons)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showSkeletons ? 'Show Real Content' : 'Show Skeletons'}
            </button>
            <button
              onClick={() => setTimeoutDemo(!timeoutDemo)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              {timeoutDemo ? 'Stop Timeout Demo' : 'Start Timeout Demo (5s)'}
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Metrics Overview */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Metrics Overview
            </h2>
            <LoadingTimeout
              isLoading={timeoutDemo}
              timeout={5000}
              onTimeout={() => console.log('Metrics overview timed out')}
            >
              {showSkeletons ? (
                <MetricsOverviewSkeleton />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-5 w-5 bg-blue-500 rounded"></div>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                          Metric {index + 1}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {Math.floor(Math.random() * 100)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </LoadingTimeout>
          </section>

          {/* Repository Cards */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Repository Cards
            </h2>
            <LoadingTimeout
              isLoading={timeoutDemo}
              timeout={5000}
              onTimeout={() => console.log('Repository cards timed out')}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {showSkeletons ? (
                  <>
                    <RepositoryCardSkeleton />
                    <RepositoryCardSkeleton />
                    <RepositoryCardSkeleton />
                  </>
                ) : (
                  <>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        ui-components
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        React components for metaGOTHIC dashboard
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Version</span>
                          <span className="font-mono">v0.1.0</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Build Status</span>
                          <span className="text-green-600">✓ passing</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        claude-client
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Claude CLI subprocess wrapper with streaming
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Version</span>
                          <span className="font-mono">v1.2.0</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Build Status</span>
                          <span className="text-green-600">✓ passing</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        prompt-toolkit
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        XML template system for structured prompts
                      </p>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Version</span>
                          <span className="font-mono">v1.1.0</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Build Status</span>
                          <span className="text-green-600">✓ passing</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </LoadingTimeout>
          </section>

          {/* Workflow List */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Recent Workflows
            </h2>
            <LoadingTimeout
              isLoading={timeoutDemo}
              timeout={5000}
              onTimeout={() => console.log('Workflow list timed out')}
            >
              {showSkeletons ? (
                <WorkflowListSkeleton />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-4 w-4 text-green-500">✓</div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              Build and Test
                            </div>
                            <div className="text-sm text-gray-500">
                              push • main
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            success
                          </span>
                          <span className="text-sm text-gray-500">2 min ago</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </LoadingTimeout>
          </section>
        </div>
      </div>
    </div>
  );
};