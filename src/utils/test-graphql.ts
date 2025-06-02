import { apolloClient } from '../lib/apollo-client';
import { gql } from '@apollo/client';

export async function testGraphQLConnection() {
  console.log('🧪 Testing GraphQL connection...');
  
  // Test 1: Basic health check
  try {
    const healthResponse = await fetch('http://localhost:3000/health');
    const healthData = await healthResponse.json();
    console.log('✅ Gateway health check:', healthData);
  } catch (error) {
    console.error('❌ Gateway health check failed:', error);
  }
  
  // Test 2: GraphQL introspection
  try {
    const introspectionQuery = gql`
      query IntrospectionQuery {
        __schema {
          queryType {
            name
            fields {
              name
            }
          }
        }
      }
    `;
    
    const result = await apolloClient.query({
      query: introspectionQuery,
      fetchPolicy: 'network-only'
    });
    
    console.log('✅ GraphQL introspection successful:', result.data.__schema.queryType.fields.map(f => f.name));
  } catch (error) {
    console.error('❌ GraphQL introspection failed:', error);
  }
  
  // Test 3: Simple query
  try {
    const simpleQuery = gql`
      query TestHealth {
        health {
          status
          claudeAvailable
        }
      }
    `;
    
    const result = await apolloClient.query({
      query: simpleQuery,
      fetchPolicy: 'network-only'
    });
    
    console.log('✅ Simple query successful:', result.data);
  } catch (error) {
    console.error('❌ Simple query failed:', error);
  }
  
  // Test 4: scanAllDetailed query
  try {
    const scanQuery = gql`
      query TestScanAllDetailed {
        scanAllDetailed {
          timestamp
          totalRepositories
          repositoriesWithChanges
        }
      }
    `;
    
    const result = await apolloClient.query({
      query: scanQuery,
      fetchPolicy: 'network-only'
    });
    
    console.log('✅ scanAllDetailed query successful:', result.data);
  } catch (error) {
    console.error('❌ scanAllDetailed query failed:', error);
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testGraphQLConnection = testGraphQLConnection;
}