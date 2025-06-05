import React from 'react';
import { ChangeReviewReport as ReportType, RepositoryChangeData } from '../services/changeReviewService';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  FileText, 
  GitCommit, 
  Code2, 
  FileCode,
  FilePlus,
  FileMinus,
  FileEdit,
  Download,
  Copy
} from 'lucide-react';
import { toast } from '../lib/toast';

interface ChangeReviewReportProps {
  report: ReportType;
  onCommit?: (repo: RepositoryChangeData) => void;
  onCommitAll?: () => void;
  onExport?: () => void;
}

export const ChangeReviewReport: React.FC<ChangeReviewReportProps> = ({
  report,
  onCommit,
  onCommitAll,
  onExport
}) => {
  // Copy report to clipboard
  const copyToClipboard = async () => {
    try {
      const reportText = generateMarkdownReport(report);
      await navigator.clipboard.writeText(reportText);
      toast.success('Report copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy report');
    }
  };

  // Generate markdown report
  const generateMarkdownReport = (report: ReportType): string => {
    const lines = [
      '# Change Review Report',
      `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
      '',
      '## Statistics',
      `- Total Files: ${report.statistics?.totalFiles || 0}`,
      `- Additions: ${report.statistics?.totalAdditions || 0}`,
      `- Modifications: ${report.statistics?.totalModifications || 0}`,
      `- Deletions: ${report.statistics?.totalDeletions || 0}`,
      `- Affected Packages: ${report.statistics?.affectedPackages?.join(', ') || 'None'}`,
      '',
      '## Repository Details',
      ''
    ];

    report.repositories.forEach(repo => {
      if (repo.hasChanges) {
        lines.push(`### ${repo.name}`);
        lines.push(`Branch: ${repo.branch?.current || 'unknown'}`);
        lines.push(`Files Changed: ${repo.statistics?.totalFiles || 0}`);
        lines.push('');
        
        if (repo.generatedCommitMessage) {
          lines.push('**Commit Message:**');
          lines.push('```');
          lines.push(repo.generatedCommitMessage);
          lines.push('```');
          lines.push('');
        }

        lines.push('**Changes:**');
        repo.changes.forEach(change => {
          lines.push(`- ${change.status} ${change.file}`);
        });
        lines.push('');
      }
    });

    return lines.join('\n');
  };

  // Get icon for file status
  const getFileIcon = (status: string) => {
    switch (status) {
      case 'M':
      case 'MM':
        return <FileEdit className="h-4 w-4 text-orange-500" />;
      case 'A':
      case '??':
        return <FilePlus className="h-4 w-4 text-green-500" />;
      case 'D':
        return <FileMinus className="h-4 w-4 text-red-500" />;
      default:
        return <FileCode className="h-4 w-4 text-gray-500" />;
    }
  };

  // Calculate percentage for each change type
  const getChangeTypePercentage = (type: 'additions' | 'modifications' | 'deletions') => {
    const total = report.statistics?.totalFiles || 0;
    if (total === 0) return 0;
    
    const key = `total${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof typeof report.statistics;
    const value = report.statistics?.[key] || 0;
    return Math.round((value / total) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-600">
          Generated at {new Date(report.generatedAt).toLocaleString()}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Copy className="h-4 w-4 mr-1" />
            Copy Report
          </Button>
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Statistics Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Change Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Additions */}
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-700 font-medium">Additions</span>
                <FilePlus className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-800">
                {report.statistics?.totalAdditions || 0}
              </div>
              <div className="text-sm text-green-600">
                {getChangeTypePercentage('additions')}% of changes
              </div>
            </div>

            {/* Modifications */}
            <div className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-orange-700 font-medium">Modifications</span>
                <FileEdit className="h-5 w-5 text-orange-600" />
              </div>
              <div className="text-2xl font-bold text-orange-800">
                {report.statistics?.totalModifications || 0}
              </div>
              <div className="text-sm text-orange-600">
                {getChangeTypePercentage('modifications')}% of changes
              </div>
            </div>

            {/* Deletions */}
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-red-700 font-medium">Deletions</span>
                <FileMinus className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-2xl font-bold text-red-800">
                {report.statistics?.totalDeletions || 0}
              </div>
              <div className="text-sm text-red-600">
                {getChangeTypePercentage('deletions')}% of changes
              </div>
            </div>
          </div>

          {/* Affected Packages */}
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Affected Packages</h4>
            <div className="flex flex-wrap gap-2">
              {(report.statistics?.affectedPackages || []).map(pkg => (
                <Badge key={pkg} variant="secondary">
                  <Code2 className="h-3 w-3 mr-1" />
                  {pkg}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Repository Summary Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Repository Changes</CardTitle>
            {onCommitAll && report.repositories.some(r => r.hasChanges) && (
              <Button onClick={onCommitAll} size="sm">
                <GitCommit className="h-4 w-4 mr-1" />
                Commit All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Repository</th>
                  <th className="text-left py-2">Branch</th>
                  <th className="text-center py-2">Files</th>
                  <th className="text-center py-2">Status</th>
                  <th className="text-right py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {report.repositories.map(repo => (
                  <tr key={repo.name} className="border-b">
                    <td className="py-3">
                      <div className="font-medium">{repo.name}</div>
                      {repo.error && (
                        <div className="text-sm text-red-600">{repo.error}</div>
                      )}
                    </td>
                    <td className="py-3">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {repo.branch?.current || 'unknown'}
                      </code>
                    </td>
                    <td className="text-center py-3">
                      {repo.hasChanges ? (
                        <Badge variant="outline">{repo.statistics?.totalFiles || 0}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-center py-3">
                      {repo.hasChanges ? (
                        <div className="flex items-center justify-center gap-1">
                          {(repo.statistics?.additions || 0) > 0 && (
                            <FilePlus className="h-4 w-4 text-green-500" />
                          )}
                          {(repo.statistics?.modifications || 0) > 0 && (
                            <FileEdit className="h-4 w-4 text-orange-500" />
                          )}
                          {(repo.statistics?.deletions || 0) > 0 && (
                            <FileMinus className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Clean</Badge>
                      )}
                    </td>
                    <td className="text-right py-3">
                      {repo.hasChanges && onCommit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onCommit(repo)}
                          disabled={!repo.generatedCommitMessage}
                        >
                          <GitCommit className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Change Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Change Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {report.repositories
              .filter(r => r.hasChanges)
              .map(repo => {
                const maxChanges = Math.max(
                  ...report.repositories
                    .filter(r => r.hasChanges)
                    .map(r => r.statistics?.totalFiles || 0)
                );
                const percentage = ((repo.statistics?.totalFiles || 0) / maxChanges) * 100;

                return (
                  <div key={repo.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{repo.name}</span>
                      <span className="text-sm text-gray-600">
                        {repo.statistics?.totalFiles || 0} files
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};