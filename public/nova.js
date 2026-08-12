/**
 * Nova Analytics tracker.
 *
 * Design constraints, in rough order of importance:
 *
 *  - It must never throw into the host page. Everything is wrapped; a failure here loses a
 *    pageview, which is always preferable to breaking somebody's site.
 *  - It posts a text/plain Blob via sendBeacon, which qualifies as a CORS *simple request*, so the
 *    browser never issues a preflight. A preflight would double the requests and would fail
 *    outright during page unload.
 *  - The endpoint is resolved against this script's own src, so one snippet works from any host
 *    without configuration.
 *  - It sends no cookies, reads no storage, and collects nothing beyond the path and referrer.
 */
(function () {
  'use strict';

  try {
    var doc = document;
    var loc = location;

    // The currentScript reference is only valid during synchronous execution, so read it first.
    var script =
      doc.currentScript ||
      (function () {
        var all = doc.getElementsByTagName('script');
        for (var i = all.length - 1; i >= 0; i--) {
          if (all[i].src && all[i].src.indexOf('nova.js') !== -1) return all[i];
        }
        return null;
      })();

    if (!script) return;

    var siteKey = script.getAttribute('data-site');
    if (!siteKey) return;

    // Resolve /api/collect against the script's own origin so the snippet is portable.
    var endpoint =
      script.getAttribute('data-endpoint') ||
      new URL('/api/collect', script.src).href;

    // Never report from a developer's machine or a file:// page — it would pollute real numbers.
    var host = loc.hostname;
    if (
      loc.protocol === 'file:' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host === '0.0.0.0' ||
      /\.local$/.test(host)
    ) {
      return;
    }

    // Honour Do Not Track. Nova stores nothing identifying either way, but a visitor who has
    // asked not to be measured should not be measured.
    var dnt =
      navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    if (dnt === '1' || dnt === 'yes') return;

    var lastPath = null;

    function send() {
      try {
        var path = loc.pathname;

        // Guard against duplicate fires for the same path. History APIs are called more than once
        // per navigation by plenty of routers, and replaceState is often used for scroll state.
        if (path === lastPath) return;
        lastPath = path;

        var payload = JSON.stringify({
          siteKey: siteKey,
          path: path,
          // Only the referrer for the first view of a session is meaningful; on in-app
          // navigation the previous page is our own and the collector drops self-referrals.
          referrer: doc.referrer || null
        });

        // text/plain keeps this a CORS simple request: no preflight, ever.
        var blob = new Blob([payload], { type: 'text/plain;charset=UTF-8' });

        if (navigator.sendBeacon && navigator.sendBeacon(endpoint, blob)) return;

        // keepalive so the request survives the page being torn down.
        if (window.fetch) {
          fetch(endpoint, {
            method: 'POST',
            body: payload,
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            keepalive: true,
            credentials: 'omit',
            mode: 'cors'
          }).catch(function () {});
        }
      } catch (e) {
        /* never surface into the host page */
      }
    }

    function track() {
      // A prerendered page has not been seen by anyone yet. Wait until it is actually shown.
      if (doc.visibilityState === 'prerender') {
        doc.addEventListener('visibilitychange', function onShow() {
          if (doc.visibilityState !== 'prerender') {
            doc.removeEventListener('visibilitychange', onShow);
            send();
          }
        });
        return;
      }
      send();
    }

    // Single-page apps navigate without a document load, so patch the history methods. The
    // originals are always called, and called first, so a failure here cannot break routing.
    function patch(name) {
      var original = history[name];
      if (typeof original !== 'function') return;
      history[name] = function () {
        var result = original.apply(this, arguments);
        try {
          track();
        } catch (e) {}
        return result;
      };
    }

    patch('pushState');
    patch('replaceState');
    addEventListener('popstate', track);

    // Back/forward cache restores do not re-run the script but are a real view.
    addEventListener('pageshow', function (event) {
      if (event.persisted) {
        lastPath = null;
        track();
      }
    });

    track();
  } catch (e) {
    /* never surface into the host page */
  }
})();
