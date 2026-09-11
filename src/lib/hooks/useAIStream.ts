'use client';

/**
 * Consume a Server-Sent Events endpoint that streams JSON chunks shaped
 * as `data: {"text": "..."}` and terminates with `data: {"done": true}`.
 *
 * Returns an object with a `stream` function that posts the given body and
 * calls the provided callbacks as chunks arrive.
 */

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
}

export function useAIStream() {
  const stream = async (
    url: string,
    body: Record<string, unknown>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        // Error responses from DRF are plain JSON, not SSE.
        const data = await response.json().catch(() => ({}));
        const msg = data?.message || `Request failed (${response.status})`;
        callbacks.onError?.(msg);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        callbacks.onError?.('Stream unavailable.');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const payload = JSON.parse(raw);
            if (payload.text) callbacks.onChunk(payload.text);
            if (payload.error) callbacks.onError?.(payload.error);
            if (payload.done) callbacks.onDone?.();
          } catch {
            // Ignore malformed chunk.
          }
        }
      }
      callbacks.onDone?.();
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        callbacks.onError?.(err?.message || 'Stream failed.');
      }
    }
  };

  return { stream };
}