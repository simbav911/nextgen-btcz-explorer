# Debugging Summary: Header Blinking Issue

## Problem Description

The application experiences a visual "blinking" or "flickering" effect in the header area when new data (blocks or transactions) arrives via WebSocket updates on the Home page. This occurs despite the header content being relatively static during these updates.

## Initial Errors & Fixes

1.  **Duplicate React Keys:** Warnings about duplicate keys were found in `TransactionList.js` and `Home.js` due to naive prepending of new data from WebSockets without deduplication.
    *   **Fix:** Implemented deduplication logic using `Map` based on `tx.txid` or `block.hash` before updating state in both components.
2.  **Repeated Toast Notifications:** The "New block mined" toast appeared multiple times for the same block.
    *   **Fix:** Added tracking (`useRef` with a `Set`) in `Home.js` to show the toast only once per block height.

## Header Blinking Debugging Steps

Despite fixing the initial errors, the header blinking persisted. The following steps were taken to isolate the cause:

1.  **Memoization:**
    *   Memoized `BlockCard`, `TransactionCard`, `StatCard`, `SyncStatus`, `Home`, `Header`, and the new `DesktopNavigation` and `SearchForm` components using `React.memo`.
    *   Memoized mapped lists in `Home.js` using `useMemo`.
2.  **State Update Optimization:**
    *   Added checks in `Home.js` and `SyncStatus.js` socket handlers to prevent `setState` calls if the list content (hashes/IDs) or block height hadn't actually changed.
3.  **Context Optimization:**
    *   Stabilized `SocketContext` value in `App.js` using `useRef`.
    *   Stabilized `ToastContext` value in `App.js` using `useMemo` and `useCallback`.
4.  **Prop Stabilization:**
    *   Ensured stable props (e.g., icons) were passed to memoized components like `StatCard`.
5.  **CSS Investigation:**
    *   Removed `transition-shadow` from `BlockCard` and `TransactionCard`.
    *   Checked `index.css` for global animations/transitions (none found).
    *   Temporarily removed `sticky` positioning from the header.
6.  **Component Isolation & Simplification:**
    *   Extracted search functionality (`useNavigate`) into a separate `SearchForm` component.
    *   Extracted navigation links into a separate `DesktopNavigation` component.
    *   Temporarily removed search functionality completely.
    *   Temporarily removed mobile menu functionality.
    *   Temporarily reduced the header to only logo and static links.
    *   Temporarily reduced the header to only static text.
    *   Temporarily reduced the header to render `null`.

## Findings

*   The blinking stopped *only* when the `Header` component rendered `null` or just basic static text without any `Link` components or images.
*   Adding back the logo (`img`) and navigation (`Link` components) caused the blinking to return, even when the header and navigation were memoized and not sticky.
*   Removing sticky positioning did not stop the blinking.
*   Removing search functionality did not stop the blinking.
*   Removing mobile menu functionality did not stop the blinking.

## Conclusion

Extensive React-level optimizations were applied. The fact that blinking occurs even with a highly simplified, memoized header containing only static links strongly suggests the root cause is **not** a standard React re-render issue (state, props, context).

The most likely explanation is a **browser rendering artifact**. Rapid DOM updates in the main content area (the lists in `Home.js`) are likely causing layout shifts (reflows), and the browser is struggling to repaint the header area smoothly, even if its own DOM nodes aren't changing according to React. This is often exacerbated by complex layouts or specific CSS properties, although removing `sticky` didn't help here. Further debugging would likely require browser performance profiling tools.