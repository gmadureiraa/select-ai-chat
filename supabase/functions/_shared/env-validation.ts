/**
 * Centralized environment variable validation for Edge Functions
 * Use these helpers to ensure all required env vars are present before proceeding
 */

export interface EnvValidationResult {
  isValid: boolean;
  missing: string[];
}

/**
 * Validates that all required environment variables are present
 * @param requiredVars Array of environment variable names to check
 * @returns Object with isValid boolean and array of missing variable names
 */
export function validateEnvVars(requiredVars: string[]): EnvValidationResult {
  const missing: string[] = [];
  
  for (const varName of requiredVars) {
    const value = Deno.env.get(varName);
    if (!value || value.trim() === '') {
      missing.push(varName);
    }
  }
  
  return {
    isValid: missing.length === 0,
    missing,
  };
}

/**
 * Gets an environment variable or throws an error if missing
 * @param varName The name of the environment variable
 * @returns The value of the environment variable
 * @throws Error if the variable is missing or empty
 */
export function getRequiredEnv(varName: string): string {
  const value = Deno.env.get(varName);
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
  return value;
}

/**
 * Creates a Response for missing environment variables
 * @param missing Array of missing variable names
 * @param corsHeaders CORS headers to include in response
 * @returns Response object with 500 status
 */
export function createMissingEnvResponse(
  missing: string[], 
  corsHeaders: Record<string, string>
): Response {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  return new Response(
    JSON.stringify({ 
      error: 'Server configuration error',
      details: `Missing environment variables: ${missing.join(', ')}`
    }),
    { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Common environment variable sets for reuse
export const SUPABASE_ENV_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
export const SUPABASE_AUTH_ENV_VARS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'] as const;
export const SUPABASE_FULL_ENV_VARS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
