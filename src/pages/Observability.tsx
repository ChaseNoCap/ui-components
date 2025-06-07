import React, { useState, useEffect } from 'react';
import { useQuery, useSubscription } from '@apollo/client';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { LoadingOverlay } from '../components/LoadingStates';
import { ErrorMessage } from '../components/ErrorDisplay';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  PERFORMANCE_METRICS_QUERY, 
  SESSION_ANALYTICS_QUERY,
  ACTIVE_OPERATIONS_SUBSCRIPTION 
} from '../graphql/observability-operations';

export const Observability: React.FC = () => {
  const [selectedService, setSelectedService] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('1h');
  
  // Convert time range to minutes
  const timeRangeMinutes = {
    '1h': 60,
    '24h': 1440,
    '7d': 10080,
    '30d': 43200
  };

  // Queries
  const { data: perfData, loading: perfLoading, error: perfError } = useQuery(PERFORMANCE_METRICS_QUERY, {
    variables: { 
      operation: selectedService === 'all' ? null : selectedService, 
      lastMinutes: timeRangeMinutes[timeRange] 
    },
    pollInterval: 5000 // Poll every 5 seconds
  });

  const { data: aiData, loading: aiLoading } = useQuery(SESSION_ANALYTICS_QUERY, {
    variables: { 
      startDate: new Date(Date.now() - timeRangeMinutes[timeRange] * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    },
    pollInterval: 10000
  });

  // For now, we'll mock cache data since it's not in the schema yet
  const cacheData = {
    cacheMetrics: {
      hitRate: 85,
      missRate: 15,
      totalHits: 1250,
      totalMisses: 220,
      cacheSize: 45.2,
      evictions: 50
    }
  };
  const cacheLoading = false;

  // Mock active operations for now
  const activeOpsData = {
    activeOperations: []
  };

  if (perfLoading || aiLoading || cacheLoading) {
    return <LoadingOverlay />;
  }

  if (perfError) {
    return <ErrorMessage message={perfError.message} />;
  }

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Observability Dashboard</h1>
        
        <div className="flex gap-4">
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All Services</option>
            <option value="claude-service">Claude Service</option>
            <option value="git-service">Git Service</option>
            <option value="github-adapter">GitHub Adapter</option>
            <option value="gothic-gateway">Gateway</option>
          </select>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <h3 className="text-sm text-gray-500">Total Operations</h3>
          <p className="text-2xl font-bold">
            {perfData?.performanceMetrics?.totalOperations || 0}
          </p>
        </Card>
        
        <Card className="p-4">
          <h3 className="text-sm text-gray-500">Total Sessions</h3>
          <p className="text-2xl font-bold">
            {aiData?.sessionAnalytics?.totalSessions || 0}
          </p>
        </Card>
        
        <Card className="p-4">
          <h3 className="text-sm text-gray-500">Cache Hit Rate</h3>
          <p className="text-2xl font-bold">
            {cacheData?.cacheMetrics?.hitRate || 0}%
          </p>
        </Card>
        
        <Card className="p-4">
          <h3 className="text-sm text-gray-500">Active Operations</h3>
          <p className="text-2xl font-bold">
            {activeOpsData?.activeOperations?.length || 0}
          </p>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="ai-usage">AI Usage</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Operations Overview</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={perfData?.performanceMetrics?.operations || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="operation" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" name="Count" />
                <Bar dataKey="errors" fill="#ff7c7c" name="Errors" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Operation Durations</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={perfData?.performanceMetrics?.operations || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="operation" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avgDuration" fill="#82ca9d" name="Avg Duration (ms)" />
                <Bar dataKey="maxDuration" fill="#ffc658" name="Max Duration (ms)" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Operation Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Operation</th>
                    <th className="text-right p-2">Count</th>
                    <th className="text-right p-2">Avg Duration</th>
                    <th className="text-right p-2">P95</th>
                    <th className="text-right p-2">P99</th>
                    <th className="text-right p-2">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {perfData?.performanceMetrics?.operations?.map((op: any) => (
                    <tr key={op.operation} className="border-b hover:bg-gray-50">
                      <td className="p-2">{op.operation}</td>
                      <td className="text-right p-2">{op.count}</td>
                      <td className="text-right p-2">{op.avgDuration}ms</td>
                      <td className="text-right p-2">{op.maxDuration}ms</td>
                      <td className="text-right p-2">-</td>
                      <td className="text-right p-2">
                        <Badge variant={op.errors > 0 ? 'destructive' : 'default'}>
                          {op.errors}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Active Operations</h2>
            <div className="space-y-2">
              {activeOpsData?.activeOperations?.map((op: any) => (
                <div key={op.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{op.operationName}</span>
                    <span className="text-sm text-gray-500 ml-2">({op.service})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{op.duration}ms</span>
                    <Badge variant={op.status === 'running' ? 'default' : 'secondary'}>
                      {op.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {!activeOpsData?.activeOperations?.length && (
                <p className="text-gray-500 text-center py-4">No active operations</p>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="ai-usage" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <h3 className="text-sm text-gray-500">Total Sessions</h3>
              <p className="text-2xl font-bold">{aiData?.sessionAnalytics?.totalSessions || 0}</p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm text-gray-500">Total Tokens</h3>
              <p className="text-2xl font-bold">
                {(aiData?.sessionAnalytics?.totalTokensUsed || 0).toLocaleString()}
              </p>
            </Card>
            <Card className="p-4">
              <h3 className="text-sm text-gray-500">Total Cost</h3>
              <p className="text-2xl font-bold">
                ${(aiData?.sessionAnalytics?.totalCost || 0).toFixed(2)}
              </p>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Token Usage by Model</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={aiData?.sessionAnalytics?.sessionsByModel || []}
                  dataKey="tokensUsed"
                  nameKey="model"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {aiData?.sessionAnalytics?.sessionsByModel?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">CPU Usage</h3>
              <div className="text-3xl font-bold">
                {(perfData?.performanceMetrics?.resources?.cpuUsage || 0).toFixed(1)}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${perfData?.performanceMetrics?.resources?.cpuUsage || 0}%` }}
                />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">Memory Usage</h3>
              <div className="text-3xl font-bold">
                {(perfData?.performanceMetrics?.resources?.memoryUsage || 0).toFixed(1)}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${perfData?.performanceMetrics?.resources?.memoryUsage || 0}%` }}
                />
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-2">Active Connections</h3>
              <div className="text-3xl font-bold">
                {perfData?.performanceMetrics?.resources?.activeConnections || 0}
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Cache Hit Rate</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Hits', value: cacheData?.cacheMetrics?.hitRate || 0 },
                      { name: 'Misses', value: cacheData?.cacheMetrics?.missRate || 0 }
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    <Cell fill="#82ca9d" />
                    <Cell fill="#ff7c7c" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Cache Statistics</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Hits</span>
                  <span className="font-semibold">{cacheData?.cacheMetrics?.totalHits || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Misses</span>
                  <span className="font-semibold">{cacheData?.cacheMetrics?.totalMisses || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cache Size</span>
                  <span className="font-semibold">{cacheData?.cacheMetrics?.cacheSize || 0} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Evictions</span>
                  <span className="font-semibold">{cacheData?.cacheMetrics?.evictions || 0}</span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};