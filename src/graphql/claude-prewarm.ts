

import { gql } from '@apollo/client';

// Query to check pre-warm status
export const GET_PREWARM_STATUS = gql`
  query GetPreWarmStatus {
    preWarmStatus {
      status
      sessionId
      timestamp
      error
    }
  }
`;

// Mutation to claim a pre-warmed session
export const CLAIM_PREWARMED_SESSION = gql`
  mutation ClaimPreWarmedSession {
    claimPreWarmedSession {
      success
      sessionId
      status
      error
    }
  }
`;

// Subscription for pre-warm status updates
export const PREWARM_STATUS_SUBSCRIPTION = gql`
  subscription OnPreWarmStatus {
    preWarmStatus {
      status
      sessionId
      timestamp
      error
    }
  }
`;