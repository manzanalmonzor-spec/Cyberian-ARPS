(function () {
  const isTouchDevice =
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) ||
    (navigator.maxTouchPoints || 0) > 0;

  if (!isTouchDevice) {
    return;
  }

  const viewport = document.querySelector('meta[name="viewport"]');

  if (viewport) {
    const viewportSettings = {
      width: "device-width",
      "initial-scale": "1.0",
      "maximum-scale": "1.0",
      "user-scalable": "no",
    };

    const currentContent = viewport.getAttribute("content") || "";

    currentContent
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((part) => {
        const [key, ...valueParts] = part.split("=");
        if (!key) {
          return;
        }

        const normalizedKey = key.trim();
        const normalizedValue = valueParts.join("=").trim();

        if (!(normalizedKey in viewportSettings) && normalizedValue) {
          viewportSettings[normalizedKey] = normalizedValue;
        }
      });

    viewport.setAttribute(
      "content",
      Object.entries(viewportSettings)
        .map(([key, value]) => `${key}=${value}`)
        .join(", ")
    );
  }

  const allowsZoom = (target) =>
    !!(
      target &&
      target.closest &&
      target.closest(".leaflet-container, [data-allow-pinch-zoom]")
    );

  document.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length > 1 && !allowsZoom(event.target)) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  let lastTouchEnd = 0;

  document.addEventListener(
    "touchend",
    (event) => {
      const now = Date.now();
      const isQuickDoubleTap = now - lastTouchEnd <= 300;
      lastTouchEnd = now;

      if (isQuickDoubleTap && !allowsZoom(event.target)) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
    document.addEventListener(
      eventName,
      (event) => {
        if (!allowsZoom(event.target)) {
          event.preventDefault();
        }
      },
      { passive: false }
    );
  });
})();

function getArpsBasePath(pathname) {
  var markers = ["/admin/", "/user/"];

  for (var i = 0; i < markers.length; i += 1) {
    var marker = markers[i];
    var index = pathname.indexOf(marker);
    if (index !== -1) {
      return pathname.slice(0, index + 1);
    }
  }

  if (pathname.endsWith("/")) {
    return pathname;
  }

  var lastSlash = pathname.lastIndexOf("/");
  var lastSegment = lastSlash >= 0 ? pathname.slice(lastSlash + 1) : pathname;
  var looksLikeFile = lastSegment.indexOf(".") !== -1;

  if (looksLikeFile) {
    return pathname.slice(0, lastSlash + 1);
  }

  return pathname + "/";
}

function getArpsAppPath(relativePath) {
  var cleanPath = String(relativePath || "").replace(/^\/+/, "");
  return new URL(cleanPath, window.location.origin + ARPS_BASE_PATH).pathname;
}

var ARPS_BASE_PATH = getArpsBasePath(window.location.pathname);
var ARPS_IS_ADMIN_PAGE = window.location.pathname.indexOf("/admin/") !== -1;
var ARPS_LOGO_PATH = getArpsAppPath("Images/ARPLOGO.png");

function normalizeArpsApiBaseUrl(value) {
  var normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.replace(/\/+$/, "");
}

function readArpsApiBaseUrl() {
  var sources = [];

  if (window.ARPS_CONFIG && window.ARPS_CONFIG.apiBaseUrl) {
    sources.push(window.ARPS_CONFIG.apiBaseUrl);
  }

  if (window.ARPS_API_BASE_URL) {
    sources.push(window.ARPS_API_BASE_URL);
  }

  var meta = document.querySelector('meta[name="arps-api-base"]');
  if (meta && meta.content) {
    sources.push(meta.content);
  }

  try {
    var stored = window.localStorage.getItem("arps_api_base_url");
    if (stored) {
      sources.push(stored);
    }
  } catch (_) {}

  for (var i = 0; i < sources.length; i += 1) {
    var normalized = normalizeArpsApiBaseUrl(sources[i]);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

var ARPS_API_BASE_URL = readArpsApiBaseUrl();

function getArpsApiUrl(relativePath) {
  var cleanPath = "/" + String(relativePath || "").replace(/^\/+/, "");
  if (ARPS_API_BASE_URL) {
    return ARPS_API_BASE_URL + cleanPath;
  }
  return cleanPath;
}

window.ARPS_API_BASE_URL = ARPS_API_BASE_URL;
window.getArpsApiUrl = getArpsApiUrl;

if (!ARPS_API_BASE_URL && window.location.hostname.indexOf("github.io") !== -1) {
  console.warn('ARPS API base URL is not configured. Set it in runtime-config.js or localStorage key "arps_api_base_url".');
}


if (!ARPS_IS_ADMIN_PAGE) {
  (function checkReportBadge() {
    function addBadge() {
      var update = localStorage.getItem('arps_report_update');
      if (!update) return;
      if (window.location.pathname.indexOf('report.html') !== -1) return;

      var tryAttach = function() {
        var navLinks = document.querySelectorAll('.bottom-nav a, nav a');
        for (var i = 0; i < navLinks.length; i++) {
          var link = navLinks[i];
          if (link.href && link.href.indexOf('report.html') !== -1) {
            if (link.querySelector('.report-notif-badge')) return;
            link.style.position = 'relative';
            var dot = document.createElement('span');
            dot.className = 'report-notif-badge';
            dot.style.cssText = 'position:absolute;top:2px;right:50%;transform:translateX(12px);width:8px;height:8px;border-radius:50%;background:#EF4444;border:2px solid #fff;z-index:10;';
            link.appendChild(dot);
            break;
          }
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', tryAttach);
      } else {
        tryAttach();
      }
    }
    addBadge();

    window.addEventListener('storage', function(e) {
      if (e.key === 'arps_report_update') {
        if (!e.newValue) {
          var dot = document.querySelector('.report-notif-badge');
          if (dot) dot.remove();
        } else {
          addBadge();
        }
      }
    });
  })();
}


if (!ARPS_IS_ADMIN_PAGE) {


  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(getArpsAppPath('service-worker.js')).catch(function () {});
    });
  }


  (function () {
    if (!document.querySelector('link[rel="manifest"]')) {
      var link = document.createElement('link');
      link.rel = 'manifest';
      link.href = getArpsAppPath('manifest.json');
      document.head.appendChild(link);
    }

    var iosMetas = [
      ['apple-mobile-web-app-capable',          'yes'],
      ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
      ['apple-mobile-web-app-title',            'ARPS'],
    ];
    iosMetas.forEach(function (pair) {
      if (!document.querySelector('meta[name="' + pair[0] + '"]')) {
        var m = document.createElement('meta');
        m.name    = pair[0];
        m.content = pair[1];
        document.head.appendChild(m);
      }
    });

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      var icon = document.createElement('link');
      icon.rel  = 'apple-touch-icon';
      icon.href = ARPS_LOGO_PATH;
      document.head.appendChild(icon);
    }

    if (!document.querySelector('link[rel="apple-touch-startup-image"]')) {
      var splash = document.createElement('link');
      splash.rel  = 'apple-touch-startup-image';
      splash.href = ARPS_LOGO_PATH;
      document.head.appendChild(splash);
    }
  })();


  (function () {
    var deferredPrompt = null;
    var PROMPT_ID      = 'arps-install-prompt';

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      showInstallBanner();
    });

    window.addEventListener('appinstalled', function () {
      removeInstallBanner();
      deferredPrompt = null;
    });

    function showInstallBanner() {
      if (document.getElementById(PROMPT_ID)) return;

      var banner = document.createElement('div');
      banner.id = PROMPT_ID;
      banner.style.cssText = [
        'position:fixed',
        'top:0', 'left:0', 'right:0',
        'z-index:9998',
        'background:#ffffff',
        'color:#0f172a',
        'border-radius:0 0 16px 16px',
        'padding:14px 16px',
        'display:flex',
        'align-items:center',
        'gap:12px',
        'box-shadow:0 4px 24px rgba(0,0,0,0.12)',
        'font-family:DM Sans,system-ui,sans-serif',
        'animation:slideDown .4s cubic-bezier(0.16,1,0.3,1)',
      ].join(';');

      banner.innerHTML =
        '<img src="' + ARPS_LOGO_PATH + '" style="width:40px;height:40px;border-radius:10px;object-fit:contain;background:#f1f5f9;padding:4px;" />' +
        '<div style="flex:1;min-width:0;">' +
          '<p style="font-size:13px;font-weight:700;margin:0;line-height:1.3;color:#0f172a;">Install ARPS</p>' +
          '<p style="font-size:11px;color:#64748b;margin:2px 0 0;line-height:1.3;">Add to home screen for offline access</p>' +
        '</div>' +
        '<button id="arps-install-btn" style="background:#DC2626;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;font-family:inherit;width:auto;margin-top:0;letter-spacing:normal;text-transform:none;box-shadow:none;">Install</button>' +
        '<button id="arps-install-close" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;padding:4px;line-height:1;font-size:18px;font-family:inherit;width:auto;margin-top:0;letter-spacing:normal;text-transform:none;box-shadow:none;">\u00D7</button>';

      document.body.appendChild(banner);

      document.getElementById('arps-install-btn').addEventListener('click', function () {
        if (!deferredPrompt) return;
        clearTimeout(autoHideTimer);
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          removeInstallBanner();
          deferredPrompt = null;
        });
      });

      document.getElementById('arps-install-close').addEventListener('click', function () {
        clearTimeout(autoHideTimer);
        removeInstallBanner();
      });

      var autoHideTimer = setTimeout(removeInstallBanner, 10000);
    }

    function removeInstallBanner() {
      var banner = document.getElementById(PROMPT_ID);
      if (banner) banner.remove();
    }
  })();


  (function () {
    var BANNER_ID = 'arps-offline-banner';

    function createBanner() {
      if (document.getElementById(BANNER_ID)) return document.getElementById(BANNER_ID);
      var banner = document.createElement('div');
      banner.id = BANNER_ID;
      banner.style.cssText = [
        'position:fixed',
        'top:0', 'left:0', 'right:0',
        'z-index:9999',
        'background:#1e293b',
        'color:#f1f5f9',
        'font-family:DM Sans,system-ui,sans-serif',
        'font-size:13px',
        'font-weight:600',
        'text-align:center',
        'padding:10px 16px',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'gap:8px',
        'transform:translateY(-100%)',
        'transition:transform 0.3s ease',
        'box-shadow:0 2px 12px rgba(0,0,0,0.3)',
      ].join(';');
      banner.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
        '<line x1="1" y1="1" x2="23" y2="23"/>' +
        '<path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>' +
        '</svg>' +
        '<span>You\'re offline \u2014 SOS and GPS still work. Other features need a connection.</span>';
      document.body.appendChild(banner);
      return banner;
    }

    function showBanner() {
      var banner = createBanner();
      if (banner) banner.style.transform = 'translateY(0)';
    }

    function hideBanner() {
      var banner = document.getElementById(BANNER_ID);
      if (banner) banner.style.transform = 'translateY(-100%)';
    }

    function syncBanner() {
      if (navigator.onLine) { hideBanner(); } else { showBanner(); }
    }

    window.addEventListener('online', hideBanner);
    window.addEventListener('offline', showBanner);

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncBanner);
    } else {
      syncBanner();
    }
  })();

}
