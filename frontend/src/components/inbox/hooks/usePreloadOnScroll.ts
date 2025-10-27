import { useEffect } from "react";

/**
 * usePreloadOnScroll
 * Observes scroll position and triggers preload callback
 * when scrolled beyond threshold (default: 70%).
 *
 * @param containerRef - ref to scrollable container
 * @param callback - function to trigger preload (e.g. loadMore)
 * @param deps - optional dependency array to rebind listener
 * @param threshold - number between 0-1; scroll ratio to trigger preload (default 0.7)
 */
export function usePreloadOnScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  callback: () => void,
  deps: any[] = [],
  threshold = 0.7
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let triggered = false;

    const handleScroll = () => {
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;

      // Calculate how far user scrolled
      const scrollRatio = (scrollTop + clientHeight) / scrollHeight;

      // If reached threshold -> trigger preload once
      if (scrollRatio >= threshold && !triggered) {
        triggered = true;
        callback();

        // Reset after small delay to allow further preloads later
        setTimeout(() => {
          triggered = false;
        }, 2000);
      }
    };

    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callback, threshold, ...deps]);
}
