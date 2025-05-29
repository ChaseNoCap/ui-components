import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Play, Square, RotateCcw, Tag, Send } from 'lucide-react';
import { Repository, WorkflowRun, PublishRequest } from '@/types';
import { fetchRepositories, triggerWorkflow, cancelWorkflow, publishPackage } from '@/services/api';
import { WorkflowCard } from './WorkflowCard';
import { PublishModal } from './PublishModal';
import { QueryErrorBoundary } from '../ErrorBoundary';
import clsx from 'clsx';

export const PipelineControl: React.FC = () => {
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedForPublish, setSelectedForPublish] = useState<Repository | null>(null);

  const { data: repositories } = useQuery({
    queryKey: ['repositories'],
    queryFn: fetchRepositories,
  });

  const triggerMutation = useMutation({
    mutationFn: triggerWorkflow,
    onSuccess: () => {
      // Show success notification
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelWorkflow,
    onSuccess: () => {
      // Show success notification
    },
  });

  const publishMutation = useMutation({
    mutationFn: publishPackage,
    onSuccess: () => {
      setShowPublishModal(false);
      // Show success notification
    },
  });

  const handlePublish = (request: PublishRequest) => {
    publishMutation.mutate(request);
  };

  const filteredRepos = selectedRepo
    ? repositories?.filter(r => r.name === selectedRepo)
    : repositories;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Pipeline Control Center
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage CI/CD workflows and package publishing
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <QueryErrorBoundary>
          {/* Repository Filter */}
          <div className="mb-8">
            <label htmlFor="repo-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Repository
            </label>
            <select
              id="repo-filter"
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">All Repositories</option>
              {repositories?.map(repo => (
                <option key={repo.id} value={repo.name}>{repo.name}</option>
              ))}
            </select>
          </div>

          {/* Quick Actions */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => {
                  if (selectedRepo) {
                    triggerMutation.mutate({
                      repository: selectedRepo,
                      workflow: 'test.yml',
                    });
                  }
                }}
                disabled={!selectedRepo || triggerMutation.isPending}
                className={clsx(
                  'p-4 rounded-lg flex items-center justify-center space-x-2 transition-colors',
                  selectedRepo
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                <Play className="h-5 w-5" />
                <span>Run Tests</span>
              </button>

              <button
                onClick={() => {
                  if (selectedRepo) {
                    triggerMutation.mutate({
                      repository: selectedRepo,
                      workflow: 'build.yml',
                    });
                  }
                }}
                disabled={!selectedRepo || triggerMutation.isPending}
                className={clsx(
                  'p-4 rounded-lg flex items-center justify-center space-x-2 transition-colors',
                  selectedRepo
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                <Send className="h-5 w-5" />
                <span>Deploy</span>
              </button>

              <button
                onClick={() => {
                  if (selectedRepo) {
                    const repo = repositories?.find(r => r.name === selectedRepo);
                    if (repo) {
                      setSelectedForPublish(repo);
                      setShowPublishModal(true);
                    }
                  }
                }}
                disabled={!selectedRepo}
                className={clsx(
                  'p-4 rounded-lg flex items-center justify-center space-x-2 transition-colors',
                  selectedRepo
                    ? 'bg-purple-500 hover:bg-purple-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                <Tag className="h-5 w-5" />
                <span>Publish Package</span>
              </button>
            </div>
          </section>

          {/* Repository Workflows */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Repository Workflows
            </h2>
            <div className="space-y-6">
              {filteredRepos?.map(repo => (
                <WorkflowCard
                  key={repo.id}
                  repository={repo}
                  onTrigger={(workflow) => triggerMutation.mutate({ repository: repo.name, workflow })}
                  onCancel={(runId) => cancelMutation.mutate({ repository: repo.name, runId })}
                />
              ))}
            </div>
          </section>
        </QueryErrorBoundary>
      </main>

      {/* Publish Modal */}
      {showPublishModal && selectedForPublish && (
        <PublishModal
          repository={selectedForPublish}
          onPublish={handlePublish}
          onClose={() => setShowPublishModal(false)}
          isLoading={publishMutation.isPending}
        />
      )}
    </div>
  );
};