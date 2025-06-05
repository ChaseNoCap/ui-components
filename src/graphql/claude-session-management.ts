import { gql } from '@apollo/client';

// Session Branching & Forking
export const FORK_SESSION = gql`
  mutation ForkSession($input: ForkSessionInput!) {
    forkSession(input: $input) {
      session {
        id
        createdAt
        status
        metadata {
          projectContext
          model
        }
      }
      parentSession {
        id
      }
      forkMetadata {
        forkedAt
        forkPoint
        sharedMessages
      }
    }
  }
`;

// Session Templates
export const CREATE_SESSION_TEMPLATE = gql`
  mutation CreateSessionTemplate($input: CreateSessionTemplateInput!) {
    createSessionTemplate(input: $input) {
      id
      name
      description
      tags
      createdAt
      variables {
        name
        description
        defaultValue
        required
      }
      settings {
        model
        temperature
        maxTokens
        customFlags
      }
    }
  }
`;

export const CREATE_SESSION_FROM_TEMPLATE = gql`
  mutation CreateSessionFromTemplate($templateId: ID!, $name: String) {
    createSessionFromTemplate(templateId: $templateId, name: $name) {
      id
      createdAt
      status
      metadata {
        projectContext
        model
      }
    }
  }
`;

export const GET_SESSION_TEMPLATES = gql`
  query GetSessionTemplates($tags: [String!], $limit: Int) {
    sessionTemplates(tags: $tags, limit: $limit) {
      id
      name
      description
      tags
      createdAt
      lastUsedAt
      usageCount
      variables {
        name
        description
        defaultValue
        required
      }
      initialContext
      settings {
        model
        temperature
        maxTokens
        customFlags
      }
    }
  }
`;

// Batch Operations
export const BATCH_SESSION_OPERATION = gql`
  mutation BatchSessionOperation($input: BatchSessionOperationInput!) {
    batchSessionOperation(input: $input) {
      totalProcessed
      successCount
      failedCount
      results {
        sessionId
        success
        error
        resultData
      }
    }
  }
`;

// Session Analytics
export const GET_SESSION_ANALYTICS = gql`
  query GetSessionAnalytics($sessionId: ID!) {
    sessionAnalytics(sessionId: $sessionId) {
      sessionId
      messageCount
      tokenUsage {
        totalInputTokens
        totalOutputTokens
        averageTokensPerMessage
        usageOverTime {
          timestamp
          inputTokens
          outputTokens
        }
      }
      timeAnalytics {
        totalDuration
        averageResponseTime
        longestPause
        activityByHour {
          hour
          messageCount
        }
      }
      contentAnalytics {
        topTopics {
          name
          count
          relevance
        }
        codeLanguages {
          language
          linesOfCode
          snippetCount
        }
        fileTypes {
          extension
          fileCount
          modificationCount
        }
        complexityScore
      }
      costBreakdown {
        totalCost
        costByModel {
          model
          cost
          tokenCount
        }
        projectedMonthlyCost
        optimizationSuggestions
      }
    }
  }
`;

export const GET_BATCH_SESSION_ANALYTICS = gql`
  query GetBatchSessionAnalytics($sessionIds: [ID!]!) {
    batchSessionAnalytics(sessionIds: $sessionIds) {
      sessionId
      messageCount
      tokenUsage {
        totalInputTokens
        totalOutputTokens
        averageTokensPerMessage
      }
      costBreakdown {
        totalCost
        projectedMonthlyCost
      }
    }
  }
`;

// Session Archiving
export const ARCHIVE_SESSION = gql`
  mutation ArchiveSession($sessionId: ID!) {
    archiveSession(sessionId: $sessionId) {
      archiveId
      archivePath
      sizeBytes
      compressionRatio
    }
  }
`;

// Session Sharing
export const SHARE_SESSION = gql`
  mutation ShareSession($input: ShareSessionInput!) {
    shareSession(input: $input) {
      shareId
      shareUrl
      shareCode
      expiresAt
    }
  }
`;

// Intelligent Resumption
export const GET_SESSION_RESUMPTION = gql`
  query GetSessionResumption($sessionId: ID!) {
    sessionResumption(sessionId: $sessionId) {
      sessionId
      lastActivity
      summary
      priority
      suggestedPrompt
      openTasks
      unresolvedErrors
      currentFiles
      contextOptimization {
        totalMessages
        tokenUsage
        maxTokens
        utilizationPercent
      }
    }
  }
`;

export const GET_RESUMABLE_SESSIONS = gql`
  query GetResumableSessions($limit: Int) {
    resumableSessions(limit: $limit) {
      session {
        id
        createdAt
        lastActivity
        status
        metadata {
          projectContext
          model
        }
      }
      resumptionData {
        summary
        priority
        suggestedPrompt
        openTasks
        unresolvedErrors
        currentFiles
      }
    }
  }
`;