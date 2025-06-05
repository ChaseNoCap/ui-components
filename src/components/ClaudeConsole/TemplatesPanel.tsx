import React, { useState } from 'react';
import { FileText, Tag, Clock, Hash } from 'lucide-react';

interface TemplatesPanelProps {
  templatesData: any;
  loading: boolean;
  onClose: () => void;
  onCreateFromTemplate: (templateId: string) => void;
}

export const TemplatesPanel: React.FC<TemplatesPanelProps> = ({ 
  templatesData, 
  loading, 
  onClose, 
  onCreateFromTemplate 
}) => {
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  if (loading) {
    return (
      <div className="absolute top-0 left-0 w-80 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Session Templates
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const templates = templatesData?.sessionTemplates || [];
  
  // Get all unique tags
  const allTags = new Set<string>();
  templates.forEach((template: any) => {
    template.tags?.forEach((tag: string) => allTags.add(tag));
  });

  // Filter templates by selected tags
  const filteredTemplates = selectedTags.size === 0 
    ? templates 
    : templates.filter((template: any) => 
        template.tags?.some((tag: string) => selectedTags.has(tag))
      );

  return (
    <div className="absolute top-0 left-0 w-80 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Session Templates
        </h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
      </div>

      {/* Tag Filter */}
      {allTags.size > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Filter by Tags:</p>
          <div className="flex flex-wrap gap-2">
            {Array.from(allTags).map(tag => (
              <button
                key={tag}
                onClick={() => {
                  const newTags = new Set(selectedTags);
                  if (newTags.has(tag)) {
                    newTags.delete(tag);
                  } else {
                    newTags.add(tag);
                  }
                  setSelectedTags(newTags);
                }}
                className={`px-2 py-1 text-xs rounded flex items-center ${
                  selectedTags.has(tag)
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-3">
        {filteredTemplates.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
            No templates found
          </p>
        ) : (
          filteredTemplates.map((template: any) => (
            <div
              key={template.id}
              className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onCreateFromTemplate(template.id)}
            >
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">{template.name}</h4>
              {template.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{template.description}</p>
              )}
              
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Used {template.usageCount}x
                </div>
                <div className="flex items-center">
                  <Hash className="h-3 w-3 mr-1" />
                  {template.variables?.length || 0} vars
                </div>
              </div>

              {template.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {template.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Settings Preview */}
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Model:</span>
                  <span className="font-mono">{template.settings.model}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Temperature:</span>
                  <span className="font-mono">{template.settings.temperature}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};