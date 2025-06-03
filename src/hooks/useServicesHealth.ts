import { useQuery, gql } from '@apollo/client';

const SERVICES_HEALTH_QUERY = gql`
  query ServicesHealth {
    servicesHealth {
      services {
        name
        healthy
        version
        responseTime
        endpoint
        lastChecked
      }
      uptime
    }
  }
`;

export interface ServiceHealth {
  name: string;
  healthy: boolean;
  version: string;
  responseTime: number;
  endpoint?: string;
  lastChecked?: string;
}

export interface ServicesHealthData {
  servicesHealth: {
    services: ServiceHealth[];
    uptime: number;
  };
}

export function useServicesHealth(pollInterval?: number) {
  return useQuery<ServicesHealthData>(SERVICES_HEALTH_QUERY, {
    pollInterval,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });
}