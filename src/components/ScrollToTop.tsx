import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll position on route change.
 * Skips when navigating to a hash anchor (e.g. /#features) so in-page anchors still work.
 * Also resets the dashboard's internal scroll containers (elements with data-scroll-root).
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;
    // Window scroll (landing + most pages)
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    // Any internal scroll containers (dashboard layout uses overflow-y-auto)
    document.querySelectorAll<HTMLElement>("[data-scroll-root]").forEach((el) => {
      el.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;