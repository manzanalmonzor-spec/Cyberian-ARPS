(function initGpsPage(global) {
  const {
    DEFAULT_LOCATION,
    createAccuracyCircle,
    createBaseMap,
    createResidentMarker,
    fitMapToPoints,
    formatAccuracy,
    formatLatitude,
    formatLongitude,
    invalidateMap,
    loadSavedLocation,
    popupContent,
    requestFastLocation,
    resolveUserLocation,
    reverseGeocode,
    startLocationWatch,
    toShareUrl,
  } = global.ResqMaps;

  const state = {
    accuracyCircle: null,
    accuracyMeters: null,
    followMode: true,
    locationNameRequestId: 0,
    map: null,
    marker: null,
    position: null,
    source: 'default',
    stopWatcher: null,
    updatedAt: null,
  };

  const elements = {
    acc: document.getElementById('acc'),
    btnCloseShare: document.getElementById('btnCloseShare'),
    btnCopy: document.getElementById('btnCopy'),
    btnFollow: document.getElementById('btnFollow'),
    btnRefresh: document.getElementById('btnRefresh'),
    btnShare: document.getElementById('btnShare'),
    followLabel: document.getElementById('followLabel'),
    locationNameCard: document.getElementById('locationNameCard'),
    locationNameShort: document.getElementById('locationNameShort'),
    locationNameFull: document.getElementById('locationNameFull'),
    placeName: document.getElementById('placeName'),
    lat: document.getElementById('lat'),
    lastUpdate: document.getElementById('lastUpdate'),
    lng: document.getElementById('lng'),
    locationModeValue: document.getElementById('locationModeValue'),
    locationSourceBadge: document.getElementById('locationSourceBadge'),
    locationSourceValue: document.getElementById('locationSourceValue'),
    locationStatusText: document.getElementById('locationStatusText'),
    locationStatusTitle: document.getElementById('locationStatusTitle'),
    locationUpdatedValue: document.getElementById('locationUpdatedValue'),
    refreshIcon: document.getElementById('refreshIcon'),
    shareModal: document.getElementById('shareModal'),
    shareOptions: document.getElementById('shareOptions'),
    shareOverlay: document.getElementById('shareOverlay'),
  };

  function init() {

    const saved = loadSavedLocation();
    const initialCenter = saved && saved.position ? saved.position : DEFAULT_LOCATION;
    const initialZoom = saved && saved.position ? 16 : 2;

    state.map = createBaseMap('gpsMap', {
      center: initialCenter,
      scrollWheelZoom: true,
      zoom: initialZoom,
    });

    bindEvents();
    renderFollowMode();

    if (saved && saved.position) {
      paintLocation(saved);

      void updateLocationName(saved.position.lat, saved.position.lng);
    } else {
      paintLocation({ source: 'default', position: null, reason: null });
    }

    ensureWatcher();
    invalidateMap(state.map);


    void fastThenAccurate();
  }

  async function fastThenAccurate() {
    const fast = await requestFastLocation();
    if (fast.source === 'live') {
      paintLocation(fast);
      void updateLocationName(fast.position.lat, fast.position.lng);
    }

    const accurate = await resolveUserLocation({ allowSaved: false });
    if (accurate.source === 'live') {
      paintLocation(accurate);
      void updateLocationName(accurate.position.lat, accurate.position.lng);
    }
  }

  async function updateLocationName(lat, lng) {
    const requestId = ++state.locationNameRequestId;
    elements.locationNameCard.classList.remove('hidden');
    elements.locationNameShort.textContent = 'Resolving location...';
    elements.locationNameFull.textContent = '';

    const place = await reverseGeocode(lat, lng);
    if (requestId !== state.locationNameRequestId) {
      return;
    }

    if (place) {
      const headline = formatLocationHeadline(place);
      elements.locationNameShort.textContent = headline;
      elements.locationNameFull.textContent = place.full;
      elements.placeName.textContent = place.neighbourhood || place.barangay || headline;

      if (state.marker) {
        state.marker.setPopupContent(
          popupContent(place.short, place.full),
        );
      }
    } else {
      const fallback = `${Math.abs(lat).toFixed(4)}\u00B0${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}\u00B0${lng >= 0 ? 'E' : 'W'}`;
      elements.locationNameShort.textContent = fallback;
      elements.locationNameFull.textContent = 'Could not resolve place name';
      elements.placeName.textContent = fallback;
    }
  }

  function formatLocationHeadline(place) {
    if (!place) {
      return '--';
    }

    const norm = (s) => (s || '').trim().toLowerCase();
    const adminNames = new Set(
      [place.neighbourhood, place.barangay, place.city].map(norm).filter(Boolean),
    );

    const parts = [];


    if (place.street && !adminNames.has(norm(place.street))) {
      parts.push(place.street);
    }



    const specificPlace = place.neighbourhood || place.barangay;
    if (specificPlace && !parts.some((p) => norm(p) === norm(specificPlace))) {
      parts.push(specificPlace);
    }

    if (parts.length === 0 && place.short) {
      return place.short;
    }
    if (parts.length < 2 && place.city && !parts.some((p) => norm(p) === norm(place.city))) {
      parts.push(place.city);
    }

    return parts.slice(0, 2).join(', ');
  }

  function bindEvents() {
    elements.btnRefresh.addEventListener('click', () => {
      void syncLocation({ notify: true });
    });

    elements.btnFollow.addEventListener('click', () => {
      state.followMode = !state.followMode;
      renderFollowMode();

      if (state.followMode) {
        centerOnCurrentPosition(true);
      }
    });

    elements.btnShare.addEventListener('click', () => {
      void handleShare();
    });

    elements.btnCopy.addEventListener('click', () => {
      void copyCoordinates();
    });

    elements.btnCloseShare.addEventListener('click', () => {
      setShareModalVisible(false);
    });

    elements.shareOverlay.addEventListener('click', (event) => {
      if (event.target === elements.shareOverlay) {
        setShareModalVisible(false);
      }
    });

    elements.shareOptions.addEventListener('click', (event) => {
      const button = event.target.closest('[data-share-channel]');
      if (!button) {
        return;
      }

      setShareModalVisible(false);
      void shareVia(button.dataset.shareChannel);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setShareModalVisible(false);
      }
    });
  }

  async function syncLocation(options) {
    const config = options || {};

    spinRefreshIcon();

    const result = await resolveUserLocation({ allowSaved: true });

    if (shouldIgnoreResolvedLocation(result)) {
      if (config.notify !== false && state.source === 'live') {
        showToast('Live GPS is already active', 'success');
      }
      return;
    }

    paintLocation(result);

    if (result.position) {
      void updateLocationName(result.position.lat, result.position.lng);
    }

    if (config.notify !== false) {
      showToast(getToastMessage(result), getToastType(result));
    }
  }

  function shouldIgnoreResolvedLocation(result) {
    if (state.source === 'live' && result.source !== 'live') {
      return true;
    }

    if (
      typeof state.updatedAt === 'number' &&
      typeof result.updatedAt === 'number' &&
      result.updatedAt < state.updatedAt
    ) {
      return true;
    }

    return false;
  }

  function ensureWatcher() {
    if (state.stopWatcher) {
      return;
    }

    state.stopWatcher = startLocationWatch({
      onUpdate(result) {
        paintLocation(result, true);
      },
      onError(result) {
        if (result.reason === 'denied') {
          stopWatcher();
        }

        renderStatus(result);
      },
    });
  }

  function stopWatcher() {
    if (!state.stopWatcher) {
      return;
    }

    state.stopWatcher();
    state.stopWatcher = null;
  }

  function paintLocation(result, fromWatcher) {
    state.position = hasUsablePosition(result.position)
      ? {
          lat: result.position.lat,
          lng: result.position.lng,
        }
      : null;
    state.accuracyMeters = result.accuracyMeters;
    state.source = result.source;
    state.updatedAt = result.updatedAt || null;

    elements.lat.textContent = state.position ? formatLatitude(state.position.lat) : '--';
    elements.lng.textContent = state.position ? formatLongitude(state.position.lng) : '--';
    elements.acc.textContent = formatAccuracy(state.accuracyMeters);
    elements.lastUpdate.textContent = state.updatedAt ? formatClock(state.updatedAt) : '--';

    if (!state.position) {
      clearLocationLayers();
      renderStatus(result);
      state.map.setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], 2);
      return;
    }

    if (!state.marker) {
      state.marker = createResidentMarker(state.position).addTo(state.map);
      state.marker.bindPopup('', { className: 'resq-popup' });
    } else {
      state.marker.setLatLng([state.position.lat, state.position.lng]);
    }

    state.marker.setPopupContent(
      popupContent(getPopupTitle(result.source), `Accuracy ${formatAccuracy(state.accuracyMeters)}`),
    );


    if (fromWatcher && state.position) {
      void updateLocationName(state.position.lat, state.position.lng);
    }

    if (state.accuracyCircle) {
      state.accuracyCircle.remove();
      state.accuracyCircle = null;
    }

    if (typeof state.accuracyMeters === 'number') {
      state.accuracyCircle = createAccuracyCircle(state.position, state.accuracyMeters).addTo(
        state.map,
      );
    }

    renderStatus(result);

    if (fromWatcher && !state.followMode) {
      return;
    }

    centerOnCurrentPosition(result.source === 'live');
  }

  function clearLocationLayers() {
    if (state.marker) {
      state.map.removeLayer(state.marker);
      state.marker = null;
    }

    if (state.accuracyCircle) {
      state.map.removeLayer(state.accuracyCircle);
      state.accuracyCircle = null;
    }
  }

  function centerOnCurrentPosition(animate) {
    if (!state.position) {
      return;
    }

    if (animate) {
      state.map.flyTo([state.position.lat, state.position.lng], 16, { duration: 1 });
      return;
    }

    fitMapToPoints(state.map, [state.position], { singleZoom: 16 });
  }

  function renderStatus(result) {
    const statusMeta = getStatusMeta(result);

    elements.locationStatusTitle.textContent = statusMeta.title;
    elements.locationStatusText.textContent = statusMeta.text;
    elements.locationSourceValue.textContent = statusMeta.sourceLabel;
    elements.locationUpdatedValue.textContent = state.updatedAt ? formatClock(state.updatedAt) : '--';

    elements.locationSourceBadge.className = `badge ${statusMeta.badgeClass}`;
    elements.locationSourceBadge.textContent = statusMeta.badgeLabel;
  }

  function renderFollowMode() {
    elements.locationModeValue.textContent = state.followMode ? 'Follow on' : 'Manual pan';
    elements.followLabel.textContent = state.followMode ? 'Follow On' : 'Follow Off';

    elements.btnFollow.className = state.followMode
      ? 'flex-1 bg-slate-900 text-white font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2 btn-press font-sans border-none'
      : 'flex-1 bg-white border-[1.5px] border-slate-200 text-slate-900 font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2 btn-press hover:bg-slate-50 font-sans';
  }

  async function handleShare() {
    const shareData = buildShareData();
    if (!shareData) {
      showToast('Current location is still loading', 'warning');
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        showToast('Location shared', 'success');
        return;
      } catch (error) {
        if (error && error.name === 'AbortError') {
          return;
        }
      }
    }

    setShareModalVisible(true);
  }

  async function shareVia(channel) {
    const shareData = buildShareData();
    if (!shareData) {
      showToast('Current location is still loading', 'warning');
      return;
    }

    const message = `${shareData.text}\n${shareData.url}`;

    if (channel === 'clipboard') {
      try {
        await navigator.clipboard.writeText(message);
        showToast('Location link copied to clipboard', 'success');
      } catch {
        showToast(message, 'info');
      }
      return;
    }

    if (channel === 'sms') {
      showToast('Opening the SMS app', 'info');
      global.location.href = `sms:?body=${encodeURIComponent(message)}`;
      return;
    }

    if (channel === 'whatsapp') {
      global.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
      showToast('Opening WhatsApp', 'info');
    }
  }

  async function copyCoordinates() {
    if (!state.position) {
      showToast('Current location is still loading', 'warning');
      return;
    }

    const coordinates = `${state.position.lat.toFixed(5)}, ${state.position.lng.toFixed(5)}`;

    try {
      await navigator.clipboard.writeText(coordinates);
      showToast('Coordinates copied to clipboard', 'success');
    } catch {
      showToast(coordinates, 'info');
    }
  }

  function buildShareData() {
    if (!state.position) {
      return null;
    }

    const coordinateLabel = `${state.position.lat.toFixed(5)}, ${state.position.lng.toFixed(5)}`;

    return {
      title: 'ARPS location',
      text: `My current ARPS location: ${coordinateLabel}`,
      url: toShareUrl(state.position),
    };
  }

  function setShareModalVisible(isVisible) {
    elements.shareModal.classList.toggle('hidden', !isVisible);
  }

  function spinRefreshIcon() {
    elements.refreshIcon.style.animation = 'spin 0.6s linear';
    global.setTimeout(() => {
      elements.refreshIcon.style.animation = '';
    }, 600);
  }

  function getStatusMeta(result) {
    if (result.source === 'live') {
      return {
        title: 'Locked on your current location',
        text: 'The map is using live GPS from this device and will keep updating while this page is open.',
        badgeClass: 'badge-responding',
        badgeLabel: 'Live',
        sourceLabel: 'Live GPS',
      };
    }

    if (result.source === 'saved') {
      return {
        title: 'Using your last known device position',
        text: 'The app is still trying to lock onto live GPS, but the map is temporarily using the most recent real position saved on this device.',
        badgeClass: 'badge-medium',
        badgeLabel: 'Saved',
        sourceLabel: 'Saved fallback',
      };
    }

    if (result.reason === 'denied') {
      return {
        title: 'Location permission is blocked',
        text: 'Allow location access in the browser so this page can lock onto your current position.',
        badgeClass: 'badge-critical',
        badgeLabel: 'Blocked',
        sourceLabel: 'Permission blocked',
      };
    }

    if (result.reason === 'insecure') {
      return {
        title: 'This browser is blocking live GPS',
        text: 'The app can ask for your location, but this browser is refusing geolocation on the current origin.',
        badgeClass: 'badge-critical',
        badgeLabel: 'Origin',
        sourceLabel: 'Origin blocked',
      };
    }

    if (result.reason === 'unsupported') {
      return {
        title: 'Geolocation is not available here',
        text: 'This browser session does not expose device location, so the map cannot lock onto your current position.',
        badgeClass: 'badge-critical',
        badgeLabel: 'Unavailable',
        sourceLabel: 'No geolocation',
      };
    }

    return {
      title: 'Waiting for your current GPS position',
      text: 'This page requests your live location automatically and will switch to it as soon as the browser returns a device fix.',
      badgeClass: 'badge-pending',
      badgeLabel: 'Waiting',
      sourceLabel: 'Waiting for GPS',
    };
  }

  function getPopupTitle(source) {
    if (source === 'live') {
      return 'Live device location';
    }

    if (source === 'saved') {
      return 'Saved checkpoint';
    }

    return 'City reference view';
  }

  function getToastMessage(result) {
    if (result.source === 'live') {
      return 'Live location connected';
    }

    if (result.source === 'saved') {
      return 'Showing the last known device location until live GPS locks in';
    }

    if (result.reason === 'denied') {
      return 'Location permission is blocked in the browser';
    }

    if (result.reason === 'insecure') {
      return 'This browser is blocking live GPS on the current app origin';
    }

    if (result.reason === 'unsupported') {
      return 'This browser session does not support geolocation';
    }

    return 'Waiting for live GPS';
  }

  function getToastType(result) {
    if (result.source === 'live') {
      return 'success';
    }

    if (result.source === 'saved') {
      return 'info';
    }

    return 'warning';
  }

  function formatClock(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function showToast(message, type) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type || 'info'}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    global.setTimeout(() => {
      toast.classList.add('out');
      global.setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2500);
  }

  function hasUsablePosition(position) {
    return Boolean(
      position &&
        Number.isFinite(position.lat) &&
        Number.isFinite(position.lng),
    );
  }

  init();
})(window);
