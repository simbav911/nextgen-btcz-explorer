import { useEffect, useState } from 'react';

const getMatch = (query) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;

/**
 * Subscribe to a CSS media query. Only re-renders when the match flips,
 * so it is cheap compared to listening to every resize event.
 */
export const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(() => getMatch(query));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
};

/** True on phone-sized screens (below Tailwind's `sm` breakpoint). */
export const useIsMobile = () => useMediaQuery('(max-width: 639px)');

export default useMediaQuery;
