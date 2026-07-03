import { useEffect, useRef } from 'react';

/**
 * useKeepAlive — Production Render Free-Tier Cold Start Mitigator
 *
 * Fires a silent, low-priority background `fetch()` ping to the Render API
 * every 12 minutes to keep the backend Node.js process memory pool warm.
 *
 * Design constraints:
 * - Completely non-blocking: uses `{ priority: 'low', keepalive: true }`
 * - Errors are swallowed silently — ping failures MUST NOT affect the user
 * - Interval fires only when the tab is visible to avoid wasted pings on
 *   backgrounded tabs (uses Page Visibility API)
 * - Cleans up on unmount via `clearInterval`
 */

const KEEP_ALIVE_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes

function getApiRoot(): string {
  return (import.meta.env.VITE_API_URL as string | undefined) ?? '';
}

async function pingBackend(apiRoot: string): Promise<void> {
  if (!apiRoot) return; // No API URL configured — skip
  try {
    // Cast to `any` for the non-standard `priority` field which is valid in
    // modern Chromium browsers but not yet in the TypeScript lib.dom.d.ts spec.
    const options: RequestInit & { priority?: string } = {
      method: 'GET',
      keepalive: true,
      priority: 'low',
      signal: AbortSignal.timeout(10_000), // Abandon after 10 s max
    };
    await fetch(`${apiRoot}/health`, options as RequestInit);
  } catch {
    // Intentionally swallowed — ping failures are non-critical
  }
}

export function useKeepAlive(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const apiRoot = getApiRoot();

    const fire = () => {
      // Only ping when the tab is in the foreground — avoids wasting Render
      // free-tier request quota on idle background tabs.
      if (document.visibilityState === 'visible') {
        pingBackend(apiRoot);
      }
    };

    // Schedule the recurring keep-alive ping
    intervalRef.current = setInterval(fire, KEEP_ALIVE_INTERVAL_MS);

    // Also fire once 3 minutes after mount to warm the instance quickly
    // on initial page load without blocking the critical rendering path.
    const warmupTimer = setTimeout(() => pingBackend(apiRoot), 3 * 60 * 1000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearTimeout(warmupTimer);
    };
  }, []); // Empty deps — interval is stable, API root is read once at mount
}
