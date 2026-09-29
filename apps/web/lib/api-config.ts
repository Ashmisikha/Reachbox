/**
 * Resolves the base URL for the API depending on environment and runtime context.
 * 
 * In production browser environments (such as Vercel), same-origin relative URLs ('')
 * are used so all requests route through Vercel rewrites, preserving session and OAuth
 * cookies across client and callback boundaries without cross-domain mismatches.
 */
export function getApiBaseUrl(): string {
  // If running in browser in production, use same-origin relative path
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return '';
  }

  // Vercel server-side service binding
  if (process.env.API_URL) {
    return process.env.API_URL.replace(/\/+$/, '');
  }

  // Explicit public API URL (e.g. local development or explicit config)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  // Default local fallback
  return 'http://localhost:4000';
}
