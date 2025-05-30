import { FetchOptions, FetchResult } from './dataFetcher';
import { toolsService, PackageChanges, CommitMessage } from './toolsService';

export interface ToolsOperationResult {
  success: boolean;
  message: string;
  data?: any;
}

class ToolsDataFetcher {
  async scanUncommittedChanges(options: FetchOptions = {}): Promise<FetchResult<PackageChanges[]>> {
    try {
      // First try real git status, fall back to toolsService
      const changes = await toolsService.scanUncommittedChanges();
      
      return {
        data: changes,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to scan changes'),
        isLoading: false,
        isError: true,
        isSuccess: false,
      };
    }
  }

  async generateCommitMessages(
    changes: PackageChanges[],
    options: FetchOptions = {}
  ): Promise<FetchResult<CommitMessage[]>> {
    try {
      const messages = await toolsService.generateCommitMessages(changes);
      
      return {
        data: messages,
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to generate messages'),
        isLoading: false,
        isError: true,
        isSuccess: false,
      };
    }
  }

  async commitChanges(
    messages: CommitMessage[],
    options: FetchOptions = {}
  ): Promise<FetchResult<ToolsOperationResult>> {
    try {
      await toolsService.commitChanges(messages);
      
      return {
        data: {
          success: true,
          message: `Successfully committed changes to ${messages.length} package(s)`,
        },
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to commit changes'),
        isLoading: false,
        isError: true,
        isSuccess: false,
      };
    }
  }

  async commitAndPush(
    messages: CommitMessage[],
    options: FetchOptions = {}
  ): Promise<FetchResult<ToolsOperationResult>> {
    try {
      // Commit first
      await toolsService.commitChanges(messages);
      
      // Then push
      await toolsService.pushAllRepositories();
      
      return {
        data: {
          success: true,
          message: `Successfully committed and pushed changes to ${messages.length} package(s)`,
        },
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to commit and push'),
        isLoading: false,
        isError: true,
        isSuccess: false,
      };
    }
  }

  async tagAndPublish(
    packageName: string,
    version: string,
    options: FetchOptions = {}
  ): Promise<FetchResult<ToolsOperationResult>> {
    try {
      await toolsService.tagAndPublish(packageName, version);
      
      return {
        data: {
          success: true,
          message: `Successfully tagged and published ${packageName} version ${version}`,
        },
        error: null,
        isLoading: false,
        isError: false,
        isSuccess: true,
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Failed to tag and publish'),
        isLoading: false,
        isError: true,
        isSuccess: false,
      };
    }
  }
}

export const toolsDataFetcher = new ToolsDataFetcher();