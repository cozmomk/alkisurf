/**
 * analytics.js — Thin GA4 wrapper for AlkiSurf
 *
 * All calls are no-ops when:
 *   • GA is blocked by an ad-blocker
 *   • VITE_GA_ID was not set at build time
 *   • The user is on localhost
 *
 * Events fired by the app:
 *   page_view        — after first conditions data loads (with score params)
 *   conditions_loaded — every subsequent data refresh with score params
 *   report_opened    — user taps "Report conditions"
 *   report_submitted — user submits a conditions report (rating + side)
 */

function gtag(...args) {
  if (typeof window.gtag !== 'function') return;
  window.gtag(...args);
}

/**
 * Fire a GA4 custom event. Safe to call even if GA is unavailable.
 * @param {string} name  — GA4 event name (snake_case recommended)
 * @param {object} params — event parameters (all optional)
 */
export function track(name, params = {}) {
  gtag('event', name, params);
}

/**
 * Fire the initial page_view with score context.
 * Called once after the first conditions payload arrives.
 */
export function trackPageView({ northScore, southScore, bestScore }) {
  gtag('event', 'page_view', {
    page_title: 'AlkiSurf',
    page_location: window.location.href,
    north_score: northScore,
    south_score: southScore,
    best_score: bestScore,
  });
}
