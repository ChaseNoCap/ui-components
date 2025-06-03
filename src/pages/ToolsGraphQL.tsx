import React, { useState } from 'react';
import { GitCommit, Tag, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ClaudeConsole } from '../components/ClaudeConsole';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  isReady: boolean;
  path?: string;
}

export const ToolsGraphQL: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const tools: Tool[] = [
    {
      id: 'claude-console',
      title: 'Claude Console',
      description: 'Interactive Claude terminal with session management and real-time streaming',
      icon: <Terminal className="h-6 w-6" />,
      isReady: true
    },
    {
      id: 'change-review',
      title: 'Change Review',
      description: 'Review uncommitted changes and generate commit messages with AI assistance',
      icon: <GitCommit className="h-6 w-6" />,
      isReady: true,
      path: '/tools/change-review'
    },
    {
      id: 'tag-publish',
      title: 'Tag & Release',
      description: 'Create version tags and trigger package publishing workflows',
      icon: <Tag className="h-6 w-6" />,
      isReady: false
    }
  ];

  const handleToolSelect = (toolId: string) => {
    const tool = tools.find(t => t.id === toolId);
    if (tool?.path) {
      navigate(tool.path);
    } else {
      setSelectedTool(toolId);
    }
  };

  const getToolStatus = (tool: Tool) => {
    if (!tool.isReady) return 'coming-soon';
    return 'ready';
  };

  const getStatusBadge = (tool: Tool) => {
    const status = getToolStatus(tool);
    if (status === 'coming-soon') {
      return <Badge variant="secondary">Coming Soon</Badge>;
    }
    return null;
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Development Tools
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          AI-powered tools for repository management and development workflows
        </p>
      </div>

      {/* Tool Cards */}
      {!selectedTool && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Card 
              key={tool.id}
              className={`cursor-pointer transition-all ${
                tool.isReady 
                  ? 'hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400' 
                  : 'opacity-60 cursor-not-allowed'
              }`}
              onClick={() => tool.isReady && handleToolSelect(tool.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-lg ${
                    tool.isReady 
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                  }`}>
                    {tool.icon}
                  </div>
                  {getStatusBadge(tool)}
                </div>
                <CardTitle className="mt-4">{tool.title}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              {tool.isReady && (
                <CardContent>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToolSelect(tool.id);
                    }}
                  >
                    Open Tool
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Claude Console */}
      {selectedTool === 'claude-console' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Claude Console</h2>
            <Button 
              variant="outline" 
              onClick={() => setSelectedTool(null)}
            >
              Back to Tools
            </Button>
          </div>
          <ClaudeConsole />
        </div>
      )}
    </div>
  );
};