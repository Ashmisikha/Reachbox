/**
 * Resolves the base URL for the API depending on environment and runtime context.
 * 
 * Priority:
 * 1. process.env.API_URL (injected at runtime by Vercel Service binding when calling api from web)
 * 2. process.env.NEXT_PUBLIC_API_URL (configured explicitly in environment or Vercel / Railway)
 * 3. Browser environment: empty string '' (same-origin relative paths routing through Vercel rewrites)
 * 4. Node / SSR / Local fallback: 'http://localhost:4000'
 */
export function getApiBaseUrl(): string {
  if (process.env.API_URL) {
    return process.env.API_URL.replace(/\/+$/, '');
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    return '';
  }

  return 'http://localhost:4000';
}
