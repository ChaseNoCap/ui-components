import React from 'react';
import { HealthMetrics } from '@/types';
import { Activity, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface MetricsOverviewProps {
  metrics: HealthMetrics[];
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({ metrics }) => {
  const totalPackages = metrics.length;
  const healthyPackages = metrics.filter(m => m.status === 'healthy').length;
  const warningPackages = metrics.filter(m => m.status === 'warning').length;
  const criticalPackages = metrics.filter(m => m.status === 'critical').length;
  
  const passingBuilds = metrics.filter(m => m.metrics.buildStatus === 'passing').length;
  const avgCoverage = metrics.reduce((acc, m) => acc + (m.metrics.testCoverage || 0), 0) / totalPackages;
  const totalIssues = metrics.reduce((acc, m) => acc + (m.metrics.openIssues || 0), 0);

  const cards = [
    {
      title: 'Total Packages',
      value: totalPackages,
      icon: Package,
      color: 'blue',
    },
    {
      title: 'Healthy',
      value: healthyPackages,
      icon: CheckCircle,
      color: 'green',
    },
    {
      title: 'Warnings',
      value: warningPackages,
      icon: AlertTriangle,
      color: 'yellow',
    },
    {
      title: 'Critical',
      value: criticalPackages,
      icon: AlertTriangle,
      color: 'red',
    },
    {
      title: 'Passing Builds',
      value: `${passingBuilds}/${totalPackages}`,
      icon: Activity,
      color: passingBuilds === totalPackages ? 'green' : 'yellow',
    },
    {
      title: 'Avg Coverage',
      value: `${avgCoverage.toFixed(1)}%`,
      icon: Activity,
      color: avgCoverage >= 80 ? 'green' : avgCoverage >= 60 ? 'yellow' : 'red',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className={clsx('h-5 w-5', colorClasses[card.color].split(' ')[1])} />
              <span className={clsx(
                'text-xs font-medium px-2 py-1 rounded-full',
                colorClasses[card.color]
              )}>
                {card.title}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {card.value}
            </p>
          </div>
        );
      })}
    </div>
  );
};