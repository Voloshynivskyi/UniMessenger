// frontend/src/hooks/useMediaBlob.ts
import { useEffect, useRef, useState } from "react";

interface Options {
  token?: string;
  previewUrl?: string | null;
  realUrl?: string | null; // protected backend url
}

export function useMediaBlob({ token, previewUrl, realUrl }: Options) {
  const [blobUrl, setBlobUrl] = useState<string | null>(previewUrl || null);
  const [loading, setLoading] = useState<boolean>(!previewUrl && !!realUrl);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (previewUrl) {
      setBlobUrl(previewUrl);
      setLoading(false);
      return;
    }

    if (!realUrl) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    // Retry helper — like in Telegram Web
    // 404 → file not ready yet → try again
    const fetchWithRetry = async (
      url: string,
      retries = 5,
      delay = 300
    ): Promise<Response> => {
      try {
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });

        if (res.status === 404 && retries > 0) {
          await new Promise((r) => setTimeout(r, delay));
          return fetchWithRetry(url, retries - 1, delay);
        }

        return res;
      } catch (err) {
        if (controller.signal.aborted) throw err;
        if (retries <= 0) throw err;

        await new Promise((r) => setTimeout(r, delay));
        return fetchWithRetry(url, retries - 1, delay);
      }
    };

    const load = async () => {
      try {
        const res = await fetchWithRetry(realUrl);

        if (!res.ok) throw new Error("Failed to fetch media");

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        urlRef.current = url;
        setBlobUrl(url);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setError(err.message || "Failed to load media");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();

    return () => {
      controller.abort();
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [realUrl, previewUrl, token]);

  return {
    blobUrl,
    loading,
    error,
  };
}
