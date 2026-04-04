(function initEvacuationPage(global) {
  const {
    assessPlaceRisk,
    DEFAULT_LOCATION,
    createBaseMap,
    createCenterMarker,
    createResidentMarker,
    estimateWalkMinutes,
    fetchEvacDataCombined,
    fetchFastEvacPlaces,
    fetchHazardSignalsAround,
    fetchNearbyEvacuationPlaces,
    fitMapToPoints,
    formatDistance,
    formatLatitude,
    formatLongitude,
    haversineKm,
    invalidateMap,
    loadSavedLocation,
    popupContent,
    requestFastLocation,
    reverseGeocode,
    resolveUserLocation,
    startLocationWatch,
  } = global.ResqMaps;


  const CACHE_KEY = 'resq.evacPage';
  const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const ROUTE_CACHE_KEY = 'resq.routeCache';
  const ROUTE_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const MAX_STORED_ROUTES = 30;
  const REGISTERED_CENTER_EVENT = 'arps:registered-centers';
  const REGISTERED_GEOCODE_CACHE_KEY = 'resq.evacPage.registeredGeocodes';
  const FEATURED_ROUTE_OPTION_COUNT = 5;
  const FORWARD_GEOCODE_ENDPOINT =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ph&q=';
  const GEOCODE_TIMEOUT_MS = 7000;
  const MAX_CENTER_RESULTS = 15;
  const NEARBY_SEARCH_RADIUS_METERS = 5000;
  const HAZARD_SEARCH_RADIUS_METERS = 5000;
  const EXTRA_SAFE_PLACE_RADIUS_METERS = 5000;
  const EXTRA_SAFE_PLACE_FETCH_TIMEOUT_MS = 8000;
  const OVERPASS_API_ENDPOINTS = Object.freeze([
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ]);
  const ROUTE_ALTERNATIVE_LIMIT = FEATURED_ROUTE_OPTION_COUNT - 1;
  const supplementalPlaceCache = new Map();
  const verifiedPlaceSearchCache = new Map();
  const registeredGeocodeCache = loadRegisteredGeocodeCache();
  const roadRouteCache = new Map();
  const landmarkRouteCache = new Map();

  function loadStoredRoutes() {
    try {
      const raw = global.localStorage.getItem(ROUTE_CACHE_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return {};
      const now = Date.now();
      const pruned = {};
      for (const [key, entry] of Object.entries(data)) {
        if (entry?.savedAt && (now - entry.savedAt) < ROUTE_CACHE_MAX_AGE_MS) {
          pruned[key] = entry;
        }
      }
      return pruned;
    } catch {
      return {};
    }
  }

  function saveRouteToStorage(cacheKey, coords) {
    try {
      let data = loadStoredRoutes();
      data[cacheKey] = { coords, savedAt: Date.now() };
      const entries = Object.entries(data).sort((a, b) => b[1].savedAt - a[1].savedAt);
      if (entries.length > MAX_STORED_ROUTES) entries.length = MAX_STORED_ROUTES;
      global.localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {

    }
  }

  const state = {
    activeCenter: null,
    bestCenter: null,
    centerLayer: null,
    centerMarkers: new Map(),
    centers: [],
    filteredCenters: [],
    filteredUnresolvedCenters: [],
    fetchAbortController: null,
    hazardSignals: [],
    hazardSignalsUnavailable: false,
    hasLoadedCenters: false,
    isLoadingCenters: false,
    lastFacilityFetchPosition: null,
    locationSource: 'default',
    map: null,
    nearbyPlaces: [],
    originPlaceName: null,
    originPlaceRequestId: 0,
    placesError: null,
    registeredCenters: [],
    registeredCentersLoading: false,
    registeredSyncToken: 0,
    unresolvedRegisteredCenters: [],
    residentMarker: null,
    residentPosition: null,
    routeLayer: null,
    routeMap: null,
    stopWatcher: null,
    supplementalPlaces: [],
    updatedAt: null,
    verifiedSearchPlaces: [],
  };

  const elements = {
    btnCloseRoute: document.getElementById('btnCloseRoute'),
    btnOpenNearestRoute: document.getElementById('btnOpenNearestRoute'),
    btnRefreshOrigin: document.getElementById('btnRefreshOrigin'),
    btnStartRoute: document.getElementById('btnStartRoute'),
    centerList: document.getElementById('centerList'),
    nearestCenterCard: document.getElementById('nearestCenterCard'),
    nearestCenterDistance: document.getElementById('nearestCenterDistance'),
    nearestCenterMeta: document.getElementById('nearestCenterMeta'),
    nearestCenterName: document.getElementById('nearestCenterName'),
    nearestCenterSafety: document.getElementById('nearestCenterSafety'),
    nearestCenterSource: document.getElementById('nearestCenterSource'),
    nearestCenterThreats: document.getElementById('nearestCenterThreats'),
    nearestCenterTime: document.getElementById('nearestCenterTime'),
    noResults: document.getElementById('noResults'),
    retryLoadArea: document.getElementById('retryLoadArea'),
    retryLoadMsg: document.getElementById('retryLoadMsg'),
    btnRetryLoad: document.getElementById('btnRetryLoad'),
    originAddress: document.getElementById('originAddress'),
    originCoords: document.getElementById('originCoords'),
    originNearest: document.getElementById('originNearest'),
    originSourceBadge: document.getElementById('originSourceBadge'),
    originSourceValue: document.getElementById('originSourceValue'),
    originStatusText: document.getElementById('originStatusText'),
    originStatusTitle: document.getElementById('originStatusTitle'),
    originUpdated: document.getElementById('originUpdated'),
    pageRoot: document.querySelector('.evacuation-page'),
    routeAddress: document.getElementById('routeAddress'),
    routeDist: document.getElementById('routeDist'),
    routeHint: document.getElementById('routeHint'),
    routeLandmarks: document.getElementById('routeLandmarks'),
    routeLandmarksSection: document.getElementById('routeLandmarksSection'),
    routeModal: document.getElementById('routeModal'),
    routeOverlay: document.getElementById('routeOverlay'),
    routeRisk: document.getElementById('routeRisk'),
    routeSafetyBadge: document.getElementById('routeSafetyBadge'),
    routeSafetyBanner: document.getElementById('routeSafetyBanner'),
    routeSource: document.getElementById('routeSource'),
    routeSteps: document.getElementById('routeSteps'),
    routeTime: document.getElementById('routeTime'),
    routeThreats: document.getElementById('routeThreats'),
    routeTitle: document.getElementById('routeTitle'),
    routeType: document.getElementById('routeType'),
    searchInput: document.getElementById('searchInput'),
  };





  function saveStateToCache() {
    if (
      !state.residentPosition ||
      (
        state.nearbyPlaces.length === 0 &&
        state.supplementalPlaces.length === 0 &&
        state.verifiedSearchPlaces.length === 0
      )
    ) {
      return;
    }

    try {
      const snapshot = {
        version: 4,
        savedAt: Date.now(),
        residentPosition: state.residentPosition,
        locationSource: state.locationSource,
        updatedAt: state.updatedAt,
        nearbyPlaces: state.nearbyPlaces,
        supplementalPlaces: state.supplementalPlaces,
        verifiedSearchPlaces: state.verifiedSearchPlaces,
        hazardSignals: state.hazardSignals,
        hazardSignalsUnavailable: state.hazardSignalsUnavailable,
        lastFacilityFetchPosition: state.lastFacilityFetchPosition,
        originPlaceName: state.originPlaceName,
      };

      global.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    } catch {

    }
  }

  function loadStateFromCache() {
    try {
      const raw = global.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;

      const snapshot = JSON.parse(raw);
      if (!snapshot || ![3, 4].includes(snapshot.version)) return null;


      if (Date.now() - snapshot.savedAt > CACHE_MAX_AGE_MS) {
        global.localStorage.removeItem(CACHE_KEY);
        return null;
      }


      if (
        !snapshot.residentPosition ||
        !Number.isFinite(snapshot.residentPosition.lat) ||
        !Number.isFinite(snapshot.residentPosition.lng)
      ) {
        return null;
      }


      const cachedCandidates = [
        ...(Array.isArray(snapshot.nearbyPlaces) ? snapshot.nearbyPlaces : []),
        ...(Array.isArray(snapshot.supplementalPlaces) ? snapshot.supplementalPlaces : []),
        ...(Array.isArray(snapshot.verifiedSearchPlaces) ? snapshot.verifiedSearchPlaces : []),
      ];
      if (cachedCandidates.length > 0) {
        const firstPlace = cachedCandidates[0];
        if (firstPlace && typeof firstPlace.lat === 'number') {
          const distKm = haversineKm(snapshot.residentPosition, firstPlace);
          if (distKm > 10) {

            global.localStorage.removeItem(CACHE_KEY);
            return null;
          }
        }
      }

      return snapshot;
    } catch {
      return null;
    }
  }





  function init() {
    state.map = createBaseMap('centersMap', {
      center: DEFAULT_LOCATION,
      scrollWheelZoom: true,
      zoom: 9,
    });

    state.centerLayer = L.layerGroup().addTo(state.map);
    bindEvents();
    bindRegisteredCenterBridge();


    const cached = loadStateFromCache();
    if (cached) {
      restoreFromCache(cached);
    } else {
      paintOrigin({ source: 'default', position: null, reason: null });
    }

    ensureWatcher();
    applyFilter();
    invalidateMap(state.map);


    void fastStartup();
  }

  async function fastStartup() {

    const savedPos = loadSavedLocation({ maxAgeMs: 30 * 60 * 1000 });
    if (savedPos && !state.hasLoadedCenters) {
      void fetchFastEvacPlaces(savedPos).then((fastPlaces) => {
        if (fastPlaces.length > 0 && state.nearbyPlaces.length === 0) {
          state.nearbyPlaces = fastPlaces;
          state.hasLoadedCenters = true;
          state.lastFacilityFetchPosition = savedPos;
          recomputeCenters();
          applyFilter();
          saveStateToCache();
        }
      });
    }

    const fastResult = await requestFastLocation();

    if (fastResult.source === 'live' && fastResult.position) {
      paintOrigin(fastResult, { forcePlacesRefresh: false });


      void fetchFastEvacPlaces(fastResult.position).then((fastPlaces) => {
        if (fastPlaces.length > 0 && state.nearbyPlaces.length === 0) {
          state.nearbyPlaces = fastPlaces;
          state.hasLoadedCenters = true;
          state.lastFacilityFetchPosition = fastResult.position;
          recomputeCenters();
          applyFilter();
          saveStateToCache();
        }
      });

      void refreshNearbyPlaces({ force: true, notify: false });
    }

    void syncOrigin({ notify: false });
  }

  function restoreFromCache(cached) {
    state.residentPosition = cached.residentPosition;
    state.locationSource = cached.locationSource || 'saved';
    state.updatedAt = cached.updatedAt || cached.savedAt;
    state.nearbyPlaces = cached.nearbyPlaces || [];
    state.supplementalPlaces = cached.supplementalPlaces || [];
    state.verifiedSearchPlaces = cached.verifiedSearchPlaces || [];
    state.hazardSignals = cached.hazardSignals || [];
    state.hazardSignalsUnavailable = cached.hazardSignalsUnavailable || false;
    state.lastFacilityFetchPosition = cached.lastFacilityFetchPosition || null;
    state.hasLoadedCenters =
      state.nearbyPlaces.length > 0 ||
      state.supplementalPlaces.length > 0 ||
      state.verifiedSearchPlaces.length > 0;
    state.originPlaceName = sanitizeOriginPlace(cached.originPlaceName || null);
    state.unresolvedRegisteredCenters = [];

    renderResidentMarker();
    recomputeCenters();
    renderOriginStatus({
      source: 'saved',
      position: state.residentPosition,
      reason: null,
      updatedAt: state.updatedAt,
    });


    const originLabel = document.getElementById('originLabel');
    if (state.originPlaceName) {
      const labelName = readOriginPrimaryLabel(state.originPlaceName);
      if (originLabel) originLabel.textContent = labelName;
      elements.originCoords.textContent = formatOriginHeadline(state.originPlaceName);
      elements.originAddress.textContent = formatOriginAddress(state.originPlaceName);
      if (state.residentMarker) {
        state.residentMarker.setPopupContent(
          popupContent(state.originPlaceName.short, state.originPlaceName.full),
        );
      }
    } else if (state.residentPosition) {
      elements.originCoords.textContent = formatShortCoordinates(state.residentPosition);
      elements.originAddress.textContent = '';
    }
  }

  function bindEvents() {
    elements.searchInput.addEventListener('input', () => {
      applyFilter();
    });

    elements.btnRefreshOrigin.addEventListener('click', () => {
      void syncOrigin({ notify: true });
    });

    elements.btnRetryLoad?.addEventListener('click', () => {
      hideRetryArea();
      void refreshNearbyPlaces({ force: true, notify: true });
    });

    elements.btnOpenNearestRoute?.addEventListener('click', () => {
      const centerId = elements.btnOpenNearestRoute.dataset.centerId || state.bestCenter?.id;
      if (centerId) {
        openRoute(centerId);
      }
    });

    elements.centerList.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-center-id]');
      if (!trigger) {
        return;
      }

      openRoute(trigger.dataset.centerId);
    });

    elements.btnCloseRoute.addEventListener('click', closeRouteModal);
    elements.btnStartRoute.addEventListener('click', startNavigationPreview);

    elements.routeOverlay.addEventListener('click', (event) => {
      if (event.target === elements.routeOverlay) {
        closeRouteModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeRouteModal();
      }
    });


    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        saveStateToCache();
      }
    });

    global.addEventListener('beforeunload', () => {
      saveStateToCache();
    });

    global.addEventListener('pagehide', () => {
      saveStateToCache();
    });
  }

  async function syncOrigin(options) {
    const config = options || {};
    const fastResult = await requestFastLocation();

    if (!shouldIgnoreResolvedOrigin(fastResult)) {
      paintOrigin(fastResult, { forcePlacesRefresh: false });
    }

    const result = await resolveUserLocation({ allowSaved: false });

    if (shouldIgnoreResolvedOrigin(result)) {
      if (config.notify !== false && state.locationSource === 'live' && result.source === 'live') {
        showToast('Live route origin is already active', 'success');
      }
      return;
    }

    paintOrigin(result, { forcePlacesRefresh: config.notify === true });

    if (config.notify !== false) {
      showToast(getToastMessage(result), getToastType(result));
    }
  }

  function shouldIgnoreResolvedOrigin(result) {
    if (state.locationSource === 'live' && result.source !== 'live') {
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
        paintOrigin(result);
      },
      onError(result) {
        renderOriginStatus(result);
        if (result.reason === 'denied') {
          stopWatcher();
        }
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

  function paintOrigin(result, options) {
    const config = options || {};

    state.residentPosition = hasUsablePosition(result.position)
      ? {
          lat: result.position.lat,
          lng: result.position.lng,
        }
      : null;
    state.locationSource = result.source;
    state.updatedAt = result.updatedAt || null;

    if (!state.residentPosition) {
      state.hazardSignals = [];
      state.hazardSignalsUnavailable = false;
      state.nearbyPlaces = [];
      state.supplementalPlaces = [];
      state.verifiedSearchPlaces = [];
      state.lastFacilityFetchPosition = null;
      state.originPlaceName = null;
      state.originPlaceRequestId += 1;
      state.placesError = null;
      state.hasLoadedCenters = false;
    }

    renderResidentMarker();
    recomputeCenters();
    applyFilter();
    renderOriginStatus(result);


    if (state.residentPosition) {
      void resolveOriginPlaceName(state.residentPosition.lat, state.residentPosition.lng);
    }

    if (shouldRefreshNearbyPlaces(config.forcePlacesRefresh === true)) {
      void refreshNearbyPlaces({
        force: config.forcePlacesRefresh === true,
        notify: config.forcePlacesRefresh === true,
      });
    }
  }

  function shouldRefreshNearbyPlaces(force) {
    if (!state.residentPosition) {
      return false;
    }

    if (force || !state.hasLoadedCenters || state.placesError) {
      return true;
    }

    if (!state.lastFacilityFetchPosition) {
      return true;
    }

    return haversineKm(state.lastFacilityFetchPosition, state.residentPosition) >= 0.25;
  }

  async function refreshNearbyPlaces(options) {
    const config = options || {};
    if (!state.residentPosition) {
      return;
    }

    if (!config.force && !shouldRefreshNearbyPlaces(false)) {
      return;
    }

    if (state.fetchAbortController) {
      state.fetchAbortController.abort();
    }

    const controller = new AbortController();
    const fetchOrigin = {
      lat: state.residentPosition.lat,
      lng: state.residentPosition.lng,
    };

    state.fetchAbortController = controller;
    state.isLoadingCenters = true;
    state.placesError = null;
    applyFilter();

    try {
      const [placesResult, hazardSignalsResult, supplementalResult, verifiedSearchResult] = await Promise.allSettled([
        fetchNearbyEvacuationPlaces(fetchOrigin, {
          force: config.force,
          radiusMeters: NEARBY_SEARCH_RADIUS_METERS,
          signal: controller.signal,
        }),
        fetchHazardSignalsAround(fetchOrigin, {
          force: config.force,
          radiusMeters: HAZARD_SEARCH_RADIUS_METERS,
          signal: controller.signal,
        }),
        fetchSupplementalSafePlaces(fetchOrigin, {
          force: config.force,
          signal: controller.signal,
        }),
        fetchVerifiedLocalityPlaces(fetchOrigin, state.originPlaceName, {
          force: config.force,
          signal: controller.signal,
        }),
      ]);

      if (controller.signal.aborted) {
        return;
      }

      if (
        placesResult.status !== 'fulfilled' &&
        supplementalResult.status !== 'fulfilled'
      ) {
        throw placesResult.reason || supplementalResult.reason;
      }

      const overpassPlaces =
        placesResult.status === 'fulfilled' ? placesResult.value : [];
      const supplementalPlaces =
        supplementalResult.status === 'fulfilled' ? supplementalResult.value : [];
      const verifiedSearchPlaces =
        verifiedSearchResult.status === 'fulfilled' ? verifiedSearchResult.value : [];
      const hazardSignals =
        hazardSignalsResult.status === 'fulfilled' ? hazardSignalsResult.value : [];

      state.fetchAbortController = null;
      state.hasLoadedCenters = true;
      state.hazardSignals = hazardSignals;
      state.hazardSignalsUnavailable = hazardSignalsResult.status !== 'fulfilled';
      state.isLoadingCenters = false;
      state.lastFacilityFetchPosition = fetchOrigin;
      state.nearbyPlaces = overpassPlaces;
      state.supplementalPlaces = supplementalPlaces;
      state.verifiedSearchPlaces = verifiedSearchPlaces;
      state.placesError = null;

      recomputeCenters();
      applyFilter();


      saveStateToCache();

      if (
        config.notify &&
        overpassPlaces.length === 0 &&
        supplementalPlaces.length === 0 &&
        verifiedSearchPlaces.length === 0
      ) {
        showToast('No verified named nearby evacuation places were found.', 'warning');
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const movedSinceLastFetch = state.lastFacilityFetchPosition
        ? haversineKm(state.lastFacilityFetchPosition, fetchOrigin)
        : Number.POSITIVE_INFINITY;

      state.fetchAbortController = null;
      state.hasLoadedCenters = true;
      state.hazardSignals = [];
      state.hazardSignalsUnavailable = true;
      state.isLoadingCenters = false;
      state.placesError = error;

      if (movedSinceLastFetch >= 0.25 || state.nearbyPlaces.length === 0) {
        state.nearbyPlaces = [];
        state.supplementalPlaces = [];
        state.verifiedSearchPlaces = [];
        state.lastFacilityFetchPosition = null;
      }

      recomputeCenters();
      applyFilter();


      const retryAttempt = typeof config.retryAttempt === 'number' ? config.retryAttempt : 0;
      const retryDelays = [3000, 5000, 10000, 15000];
      const delayMs = retryDelays[Math.min(retryAttempt, retryDelays.length - 1)];
      global.setTimeout(() => {
        if (state.placesError && state.residentPosition) {
          void refreshNearbyPlaces({ force: true, notify: false, retryAttempt: retryAttempt + 1 });
        }
      }, delayMs);
      if (retryAttempt === 0) {
        showToast('No response from map server — retrying automatically…', 'info');
      }
    }
  }

  function renderResidentMarker() {
    if (!state.residentPosition) {
      if (state.residentMarker) {
        state.map.removeLayer(state.residentMarker);
        state.residentMarker = null;
      }
      return;
    }

    if (!state.residentMarker) {
      state.residentMarker = createResidentMarker(state.residentPosition, {
        fillColor: '#0F172A',
      }).addTo(state.map);

      state.residentMarker.bindPopup('', { className: 'resq-popup' });

      state.map.setView([state.residentPosition.lat, state.residentPosition.lng], 14);
    } else {
      state.residentMarker.setLatLng([state.residentPosition.lat, state.residentPosition.lng]);
    }

    state.residentMarker.setPopupContent(
      popupContent(getOriginPopupTitle(), 'Used to calculate nearby evacuation candidates'),
    );
  }

  function recomputeCenters() {
    if (!state.residentPosition) {
      state.centers = [];
      state.filteredUnresolvedCenters = [];
      state.bestCenter = null;
      state.activeCenter = null;
      return;
    }

    const computedCenters = prioritizeCenterVariety(
      dedupeCenters([
      ...state.registeredCenters,
      ...state.nearbyPlaces,
      ...state.supplementalPlaces,
      ...state.verifiedSearchPlaces,
    ])
      .filter(isVerifiedCenterCandidate)
      .map((place) => {
        const distanceKm = haversineKm(state.residentPosition, place);
        const walkMinutes = estimateWalkMinutes(distanceKm);
        const riskScreen = assessPlaceRisk(place, state.hazardSignals, {
          unavailable: state.hazardSignalsUnavailable,
        });
        const safetyMeta = getSafetyMeta(riskScreen.riskLevel);
        const capacityNote = formatCapacityNote(place);
        const directionLabel = getDirectionLabel(state.residentPosition, place);
        const rankScore =
          distanceKm +
          (place.typePriority || 0) * 0.18 +
          safetyMeta.rankPenalty +
          (place.sourcePriority || 0) * 0.12 +
          (place.sortBias || 0) * 0.05;

        return {
          ...place,
          capacityNote,
          distanceKm,
          distanceLabel: formatDistance(distanceKm),
          directionLabel,
          rankScore,
          riskBadgeClass: riskScreen.riskBadgeClass,
          riskBadgeLabel: riskScreen.riskBadgeLabel,
          riskLabel: riskScreen.riskLabel,
          riskLevel: riskScreen.riskLevel,
          safetyBadgeClass: safetyMeta.badgeClass,
          safetyBadgeLabel: safetyMeta.badgeLabel,
          safetySummary: safetyMeta.summary,
          threatLabels: riskScreen.threatLabels,
          threatSummary: riskScreen.threatSummary,
          walkMinutes,
          walkLabel: `${walkMinutes} min`,
        };
      })
      .sort((left, right) => {
        if (left.rankScore !== right.rankScore) {
          return left.rankScore - right.rankScore;
        }

        return left.distanceKm - right.distanceKm;
      }),
      {
        featuredCount: FEATURED_ROUTE_OPTION_COUNT,
        maxCount: MAX_CENTER_RESULTS,
      },
    );

    if (computedCenters.length === 0) {
      state.centers = [];
      state.filteredUnresolvedCenters = [];
      state.bestCenter = null;
      state.activeCenter = null;
      return;
    }

    const recommendedCenterId = computedCenters[0].id;
    const nearestCenterId = computedCenters
      .slice()
      .sort((left, right) => left.distanceKm - right.distanceKm)[0].id;

    state.centers = computedCenters
      .map((center) => ({
        ...center,
        isClosest: center.id === nearestCenterId,
        isNearest: center.id === recommendedCenterId,
      }))
      .sort((left, right) => {
        if (left.isNearest !== right.isNearest) {
          return left.isNearest ? -1 : 1;
        }

        return left.rankScore - right.rankScore;
      });

    state.bestCenter = state.centers.find((center) => center.isNearest) || state.centers[0] || null;

    if (state.activeCenter) {
      state.activeCenter =
        state.centers.find((center) => center.id === state.activeCenter.id) || null;
    }
  }

  function showRetryArea(message) {
    if (!elements.retryLoadArea) return;
    elements.retryLoadMsg.textContent = message;
    elements.retryLoadArea.classList.remove('hidden');
    elements.retryLoadArea.style.display = 'flex';
  }

  function hideRetryArea() {
    if (!elements.retryLoadArea) return;
    elements.retryLoadArea.classList.add('hidden');
    elements.retryLoadArea.style.display = 'none';
  }

  function applyFilter() {
    const normalizedSearch = elements.searchInput.value.trim().toLowerCase();

    if (!state.residentPosition) {
      state.filteredCenters = [];
      state.filteredUnresolvedCenters = [];
      elements.noResults.textContent =
        'Waiting for your current location to build nearby evacuation routes.';
    } else if ((state.isLoadingCenters || state.registeredCentersLoading) && state.centers.length === 0) {
      state.filteredCenters = [];
      state.filteredUnresolvedCenters = [];
      elements.noResults.textContent =
        'Loading nearby evacuation centers, barangay halls, plazas, schools, and safer public spaces.';
    } else if (state.placesError && state.centers.length === 0) {
      state.filteredCenters = [];
      state.filteredUnresolvedCenters = state.unresolvedRegisteredCenters.filter((center) => {
        const haystack = `${center.name} ${center.address} ${center.sourceLabel}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
      if (state.filteredUnresolvedCenters.length > 0) {
        elements.noResults.textContent = 'Verified routes are unavailable right now, but registered centers without exact map pins are listed below.';
        hideRetryArea();
      } else {
        elements.noResults.textContent = '';
        showRetryArea('No internet or the map server did not respond. Your location was found but nearby places could not be loaded.');
      }
    } else {
      state.filteredCenters = state.centers.filter((center) => {
        const haystack = [
          center.name,
          center.address,
          center.typeLabel,
          center.badgeLabel,
          center.sourceLabel,
          center.riskLabel,
          center.safetyBadgeLabel,
          center.threatSummary,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
      state.filteredUnresolvedCenters = state.unresolvedRegisteredCenters.filter((center) => {
        const haystack = `${center.name} ${center.address} ${center.sourceLabel}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });

      elements.noResults.textContent = normalizedSearch
        ? 'No nearby evacuation places match your search.'
        : 'No verified named nearby evacuation centers, halls, plazas, or safe public places were found.';
    }

    const hasResults = state.filteredCenters.length !== 0 || state.filteredUnresolvedCenters.length !== 0;
    elements.noResults.classList.toggle('hidden', hasResults);
    if (hasResults) hideRetryArea();
    renderCenterList();
    renderCenterMarkers();
    syncMapViewport();
    updateNearestSummary();
    refreshActiveRoute();
  }

  function renderCenterList() {
    const verifiedMarkup = state.filteredCenters
      .map((center, index) => {
        const nearestTag = center.isNearest
          ? '<span class="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide">Best Route</span>'
          : '';
        const closestTag = center.isClosest && !center.isNearest
          ? '<span class="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide">Closest</span>'
          : '';
        const iconTone = center.isNearest
          ? 'bg-emerald-500'
          : center.riskLevel === 'high'
            ? 'bg-red-500'
            : center.riskLevel === 'medium'
              ? 'bg-amber-500'
              : 'bg-slate-800';
        const cardTone = center.isNearest
          ? 'border-2 border-emerald-400 shadow-[0_18px_36px_-24px_rgba(16,185,129,0.28)]'
          : center.riskLevel === 'high'
            ? 'border border-red-200 shadow-[0_18px_36px_-26px_rgba(239,68,68,0.18)]'
            : center.riskLevel === 'medium'
              ? 'border border-amber-200 shadow-[0_18px_36px_-26px_rgba(245,158,11,0.18)]'
              : 'border border-white/70 shadow-[0_18px_36px_-26px_rgba(15,23,42,0.2)]';
        const capacityNote = center.capacityNote
          ? `<p class="text-[11px] text-slate-500 mt-2 leading-relaxed">${escapeHtml(center.capacityNote)}</p>`
          : '';
        const safetyNote = center.riskLevel === 'low'
          ? 'No nearby hazard signal was found around this place.'
          : center.riskLevel === 'unknown'
            ? 'Hazard screening is unavailable. Verify the area on the ground.'
            : center.threatSummary;

        return `
          <article
            class="center-card bg-white/94 backdrop-blur-sm rounded-[24px] p-4 ${cardTone} animate-fade cursor-pointer"
            style="animation-delay:${index * 0.04}s"
            data-center-id="${center.id}"
          >
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl ${iconTone} flex items-center justify-center shrink-0 shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16"/><path d="M12 11V7"/><path d="M9 21h6"/></svg>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <h4 class="text-[15px] font-extrabold text-slate-900 leading-snug">${escapeHtml(center.name)}</h4>
                    <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">${escapeHtml(center.address)}</p>
                  </div>
                  <div class="flex flex-col items-end gap-1 shrink-0">
                    ${nearestTag || closestTag}
                    <span class="badge ${center.safetyBadgeClass}" style="font-size:9px;padding:4px 8px;border-radius:10px;">${escapeHtml(center.safetyBadgeLabel)}</span>
                  </div>
                </div>

                <!-- Compact stats -->
                <div class="flex items-center gap-2 mt-3 flex-wrap">
                  <span class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-xl">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                    ${center.distanceLabel}
                  </span>
                  <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                    ${center.walkLabel}
                  </span>
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl">
                    ${escapeHtml(center.sourceLabel)}
                  </span>
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl">
                    ${escapeHtml(center.badgeLabel)}
                  </span>
                </div>
                <p class="text-[11px] text-slate-600 mt-3 leading-relaxed">
                  <span class="font-bold text-slate-700">Safety check:</span>
                  ${escapeHtml(safetyNote)}
                </p>
                <p class="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  <span class="font-bold text-slate-700">Direction:</span>
                  ${escapeHtml(center.directionLabel)} from your current location.
                </p>
                ${capacityNote}
              </div>
            </div>

            <button
              class="mt-4 w-full bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white font-bold text-[12px] py-3 px-3 rounded-2xl flex items-center justify-center gap-1.5 btn-press font-sans cursor-pointer shadow-lg shadow-blue-600/15"
              data-center-id="${center.id}"
              type="button"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
              View Route Details
            </button>
          </article>
        `;
      })
      .join('');

    const unresolvedMarkup = state.filteredUnresolvedCenters
      .map((center, index) => `
        <article
          class="center-card bg-white/94 backdrop-blur-sm rounded-[24px] p-4 border border-amber-200 shadow-[0_18px_36px_-26px_rgba(245,158,11,0.18)] animate-fade"
          style="animation-delay:${(state.filteredCenters.length + index) * 0.04}s"
        >
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow-sm">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16"/><path d="M12 11V7"/><path d="M9 21h6"/></svg>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <h4 class="text-[15px] font-extrabold text-slate-900 leading-snug">${escapeHtml(center.name)}</h4>
                  <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">${escapeHtml(center.address)}</p>
                </div>
                <span class="badge badge-medium" style="font-size:9px;padding:4px 8px;border-radius:10px;">Pin needed</span>
              </div>
              <div class="flex items-center gap-2 mt-3 flex-wrap">
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl">
                  ${escapeHtml(center.sourceLabel)}
                </span>
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl">
                  Registered
                </span>
              </div>
              <p class="text-[11px] text-amber-700 mt-3 leading-relaxed">
                <span class="font-bold">Route unavailable:</span>
                This is a real registered center, but it does not have exact map coordinates yet.
              </p>
            </div>
          </div>
        </article>
      `)
      .join('');

    elements.centerList.innerHTML = verifiedMarkup + unresolvedMarkup;
  }

  function renderCenterMarkers() {
    state.centerLayer.clearLayers();
    state.centerMarkers.clear();

    state.filteredCenters.forEach((center) => {
      const marker = createCenterMarker(center, {
        fillColor: getMarkerFillColor(center),
        radius: center.isNearest ? 10 : center.isOfficial ? 9 : 8,
      }).addTo(state.centerLayer);
      marker.bindPopup(
        popupContent(
          escapeHtml(center.name),
          `${center.safetyBadgeLabel} - ${center.typeLabel} - ${center.distanceLabel} away - ${center.walkLabel} walk`,
        ),
        { className: 'resq-popup' },
      );
      marker.on('click', () => {
        openRoute(center.id);
      });

      state.centerMarkers.set(center.id, marker);
    });
  }

  function syncMapViewport() {
    const points = [state.residentPosition, ...state.filteredCenters];

    if (points.filter(Boolean).length === 0) {
      state.map.setView([DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng], 9);
      return;
    }

    fitMapToPoints(state.map, points, { maxZoom: 15, singleZoom: 15 });
  }

  function updateNearestSummary() {
    const nearestCenter = state.filteredCenters[0] || state.bestCenter || state.centers[0];

    if (!state.originPlaceName && state.residentPosition) {
      elements.originCoords.textContent = formatShortCoordinates(state.residentPosition);
      elements.originAddress.textContent = '';
    }
    elements.originNearest.textContent = nearestCenter
      ? `${nearestCenter.name} - ${nearestCenter.distanceLabel}`
      : 'Waiting for GPS';
    elements.originUpdated.textContent = state.updatedAt ? formatClock(state.updatedAt) : '--';
    renderBestCenterCard(nearestCenter);
  }

  async function resolveOriginPlaceName(lat, lng) {
    const requestId = ++state.originPlaceRequestId;
    elements.originCoords.textContent = 'Resolving location...';
    elements.originAddress.textContent = '';

    const place = sanitizeOriginPlace(await reverseGeocode(lat, lng));
    if (requestId !== state.originPlaceRequestId) {
      return;
    }

    const originLabel = document.getElementById('originLabel');

    if (place) {
      state.originPlaceName = place;
      const labelName = readOriginPrimaryLabel(place);
      if (originLabel) originLabel.textContent = labelName;
      elements.originCoords.textContent = formatOriginHeadline(place);
      elements.originAddress.textContent = formatOriginAddress(place);

      if (state.residentMarker) {
        state.residentMarker.setPopupContent(
          popupContent(place.short, place.full),
        );
      }

      recomputeCenters();
      applyFilter();
      saveStateToCache();
      if (state.residentPosition && state.centers.length === 0 && !state.isLoadingCenters) {
        void refreshNearbyPlaces({ force: false, notify: false });
      }
      if (Array.isArray(global.__ARPS_REGISTERED_CENTERS__) && state.registeredCenters.length === 0) {
        void syncRegisteredCenters(global.__ARPS_REGISTERED_CENTERS__);
      }
    } else {
      state.originPlaceName = null;
      if (originLabel) originLabel.textContent = 'Your Location';
      elements.originCoords.textContent = formatShortCoordinates(state.residentPosition);
      elements.originAddress.textContent = 'Could not resolve place name';
      recomputeCenters();
      applyFilter();
    }
  }

  function formatOriginHeadline(place) {
    if (!place) {
      return '--';
    }

    return (
      joinOriginPlaceParts([
        place.barangay || place.neighbourhood,
        place.city,
        place.province,
      ], 2) ||
      place.short ||
      '--'
    );
  }

  function formatOriginAddress(place) {
    if (!place) {
      return '--';
    }

    return (
      joinOriginPlaceParts([
        place.barangay || place.neighbourhood,
        place.city,
        place.province,
      ]) ||
      place.full ||
      '--'
    );
  }

  function readOriginPrimaryLabel(place) {
    return (
      normalizeText(place?.barangay) ||
      normalizeText(place?.neighbourhood) ||
      normalizeText(place?.city) ||
      normalizeText(place?.province) ||
      normalizeText(place?.short) ||
      'Your Location'
    );
  }

  function sanitizeOriginPlace(place) {
    if (!place || typeof place !== 'object') {
      return null;
    }

    const province = readOriginProvince(place);
    const city = readOriginCity(place, province);
    const barangay = readOriginBarangay(place, city, province);
    const neighbourhood = readOriginNeighbourhood(place, barangay, city, province);
    const short = joinOriginPlaceParts([
      barangay || neighbourhood,
      city,
      province,
    ], 2);
    const full = joinOriginPlaceParts([
      barangay || neighbourhood,
      city,
      province,
    ]);

    return {
      ...place,
      barangay: barangay || null,
      neighbourhood: neighbourhood || null,
      city: city || null,
      province: province || null,
      short: short || normalizeText(place.short) || full || 'Unknown location',
      full: full || normalizeText(place.full) || normalizeText(place.short) || 'Unknown location',
    };
  }

  function readOriginBarangay(place, city, province) {
    const candidate = firstUsableOriginPart([
      place?.barangay,
      place?.neighbourhood,
    ]);

    if (!candidate || isSameOriginPart(candidate, city) || isSameOriginPart(candidate, province)) {
      return '';
    }

    return candidate;
  }

  function readOriginNeighbourhood(place, barangay, city, province) {
    const candidate = firstUsableOriginPart([place?.neighbourhood]);

    if (
      !candidate ||
      isSameOriginPart(candidate, barangay) ||
      isSameOriginPart(candidate, city) ||
      isSameOriginPart(candidate, province)
    ) {
      return '';
    }

    return candidate;
  }

  function readOriginCity(place, province) {
    const candidate = firstUsableOriginPart([place?.city]);
    if (!candidate || isSameOriginPart(candidate, province)) {
      return '';
    }

    return candidate;
  }

  function readOriginProvince(place) {
    const directProvince = normalizeText(place?.province);
    if (isUsableProvinceName(directProvince)) {
      return directProvince;
    }

    return firstUsableOriginPart([
      extractProvinceFromDistrictLabel(place?.province),
      extractProvinceFromDistrictLabel(place?.full),
      extractProvinceFromDistrictLabel(place?.short),
      extractProvinceFromDistrictLabel(place?.neighbourhood),
      extractProvinceFromDistrictLabel(place?.barangay),
    ]);
  }

  function firstUsableOriginPart(values) {
    for (const value of values) {
      const text = normalizeText(value);
      if (text && !looksLikeBroadOriginArea(text)) {
        return text;
      }
    }

    return '';
  }

  function joinOriginPlaceParts(values, limit = Number.POSITIVE_INFINITY) {
    const parts = [];

    values.forEach((value) => {
      const text = normalizeText(value);
      if (!text || looksLikeBroadOriginArea(text)) {
        return;
      }

      if (!parts.some((part) => isSameOriginPart(part, text))) {
        parts.push(text);
      }
    });

    return parts.slice(0, limit).join(', ');
  }

  function isSameOriginPart(left, right) {
    const normalizedLeft = normalizeText(left).toLowerCase();
    const normalizedRight = normalizeText(right).toLowerCase();
    return normalizedLeft !== '' && normalizedLeft === normalizedRight;
  }

  function isUsableProvinceName(value) {
    const text = normalizeText(value);
    return text !== '' && !looksLikeBroadOriginArea(text) && !looksLikeRegionName(text);
  }

  function extractProvinceFromDistrictLabel(value) {
    const text = normalizeText(value);
    if (!text) {
      return '';
    }

    const patterns = [
      /^(.+?)(?:'s)?\s+at-large congressional district$/i,
      /^(.+?)(?:'s)?\s+\d+(?:st|nd|rd|th)?\s+congressional district$/i,
      /^province of\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return normalizeText(match[1]);
      }
    }

    return '';
  }

  function looksLikeBroadOriginArea(value) {
    const text = normalizeText(value);
    if (!text) {
      return false;
    }

    return (
      /\b(congressional district|at-large congressional district|county)\b/i.test(text) ||
      looksLikeRegionName(text) ||
      /\bphilippines(?:\s*\(the\))?\b/i.test(text)
    );
  }

  function looksLikeRegionName(value) {
    const text = normalizeText(value);
    if (!text) {
      return false;
    }

    return /\bregion\b/i.test(text) || /\b(western visayas|central visayas|eastern visayas|metro manila|mimaropa|soccsksargen|caraga|bangsamoro|calabarzon|cagayan valley|bicol region|zamboanga peninsula|ncr|car)\b/i.test(text);
  }

  function renderOriginStatus(result) {
    const statusMeta = getOriginStatusMeta(result);

    elements.originStatusTitle.textContent = statusMeta.title;
    elements.originStatusText.textContent = statusMeta.text;
    elements.originSourceValue.textContent = statusMeta.sourceLabel;
    elements.originSourceBadge.className = `badge ${statusMeta.badgeClass}`;
    elements.originSourceBadge.textContent = statusMeta.badgeLabel;
  }

  function openRoute(centerId) {
    const selectedCenter = state.centers.find((center) => center.id === centerId);
    if (!selectedCenter || !state.residentPosition) {
      return;
    }

    state.activeCenter = selectedCenter;
    renderRouteDetails(selectedCenter);
    elements.routeModal.classList.remove('hidden');
    elements.pageRoot?.classList.add('route-modal-open');
    document.body.classList.add('route-modal-open');

    ensureRouteMap();
    drawRoutePreview(selectedCenter);
  }

  function ensureRouteMap() {
    if (state.routeMap) {
      return;
    }

    state.routeMap = createBaseMap('routeMap', {
      attributionControl: false,
      boxZoom: false,
      center: state.residentPosition || DEFAULT_LOCATION,
      doubleClickZoom: false,
      dragging: false,
      keyboard: false,
      scrollWheelZoom: false,
      showZoomControl: false,
      touchZoom: false,
      zoom: state.residentPosition ? 14 : 2,
    });

    state.routeLayer = L.layerGroup().addTo(state.routeMap);
  }

  async function drawRoutePreview(center) {
    if (!state.routeLayer || !state.residentPosition || !center) {
      return;
    }

    state.routeLayer.clearLayers();

    const routeColor = getMarkerFillColor(center);
    const dashArray = center.riskLevel === 'high' ? '8 7' : center.riskLevel === 'medium' ? '10 8' : '';

    const placeholderLine = L.polyline(
      [
        [state.residentPosition.lat, state.residentPosition.lng],
        [center.lat, center.lng],
      ],
      {
        color: routeColor,
        dashArray: '6 6',
        opacity: 0.35,
        weight: 4,
      },
    );
    state.routeLayer.addLayer(placeholderLine);

    const routeResidentMarker = createResidentMarker(state.residentPosition, {
      fillColor: '#0F172A',
    }).bindPopup(popupContent('Origin', 'Current route starting point'), { className: 'resq-popup' });

    const routeCenterMarker = createCenterMarker(center, {
      fillColor: routeColor,
      radius: 10,
    }).bindPopup(
      popupContent(center.name, `${center.safetyBadgeLabel} - ${center.threatSummary}`),
      { className: 'resq-popup' },
    );

    state.routeLayer.addLayer(routeResidentMarker);
    state.routeLayer.addLayer(routeCenterMarker);

    fitMapToPoints(state.routeMap, [state.residentPosition, center], {
      maxZoom: 15,
      padding: [24, 24],
    });
    invalidateMap(state.routeMap, 420);

    const [routeResult, landmarksResult] = await Promise.allSettled([
      fetchOSRMRoute(state.residentPosition, center),
      fetchLandmarksAlongRoute(state.residentPosition, center),
    ]);

    if (routeResult.status === 'fulfilled' && routeResult.value?.length > 1 && state.routeLayer) {
      state.routeLayer.removeLayer(placeholderLine);
      state.routeLayer.addLayer(L.polyline(routeResult.value, { color: routeColor, dashArray, opacity: 0.9, weight: 5 }));
      fitMapToPoints(state.routeMap, routeResult.value.map(([lat, lng]) => ({ lat, lng })), { maxZoom: 15, padding: [24, 24] });
    } else {
      placeholderLine.setStyle({ dashArray, opacity: 0.9 });
    }

    const landmarks = landmarksResult.status === 'fulfilled' ? landmarksResult.value : [];
    addLandmarkMarkersToRoute(landmarks);
    updateRouteLandmarksList(landmarks);
  }

  async function fetchOSRMRoute(from, to) {
    const cacheKey = `${from.lat.toFixed(4)}:${from.lng.toFixed(4)}-${to.lat.toFixed(4)}:${to.lng.toFixed(4)}`;


    if (roadRouteCache.has(cacheKey)) return roadRouteCache.get(cacheKey);


    const stored = loadStoredRoutes();
    if (stored[cacheKey]) {
      const coords = stored[cacheKey].coords;
      roadRouteCache.set(cacheKey, coords);
      return coords;
    }


    let coords;
    try {
      coords = await fetchValhallaRoute(from, to);
    } catch (_err) {
      coords = await fetchOSRMDrivingRoute(from, to);
    }
    roadRouteCache.set(cacheKey, coords);
    saveRouteToStorage(cacheKey, coords);
    return coords;
  }

  async function fetchValhallaRoute(from, to) {
    const body = JSON.stringify({
      locations: [
        { lon: from.lng, lat: from.lat, type: 'break' },
        { lon: to.lng, lat: to.lat, type: 'break' },
      ],
      costing: 'pedestrian',
    });
    const response = await fetchWithTimeout('https://valhalla1.openstreetmap.de/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      mode: 'cors',
    }, 12000);
    if (!response.ok) throw new Error(`Valhalla ${response.status}`);
    const data = await response.json();
    const shape = data?.trip?.legs?.[0]?.shape;
    if (!shape) throw new Error('No shape in Valhalla response');
    return decodePolyline6(shape);
  }

  async function fetchOSRMDrivingRoute(from, to) {
    const coords = `${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}`;
    const response = await fetchWithTimeout(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
      { mode: 'cors' },
      10000,
    );
    if (!response.ok) throw new Error(`OSRM ${response.status}`);
    const data = await response.json();
    if (!data.routes?.length) throw new Error('No routes');
    return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  }

  function decodePolyline6(encoded) {
    const points = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : (result >> 1);
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      lng += (result & 1) ? ~(result >> 1) : (result >> 1);
      points.push([lat / 1e6, lng / 1e6]);
    }
    return points;
  }

  async function fetchLandmarksAlongRoute(from, to) {
    const cacheKey = `${from.lat.toFixed(3)}:${from.lng.toFixed(3)}-${to.lat.toFixed(3)}:${to.lng.toFixed(3)}`;
    if (landmarkRouteCache.has(cacheKey)) return landmarkRouteCache.get(cacheKey);

    const midLat = (from.lat + to.lat) / 2;
    const midLng = (from.lng + to.lng) / 2;
    const distKm = haversineKm(from, to);
    const radiusMeters = Math.min(Math.max(distKm * 500, 400), 1500);
    const r = radiusMeters.toFixed(0);
    const lat = midLat.toFixed(6);
    const lng = midLng.toFixed(6);

    const body = `data=${encodeURIComponent(`[out:json][timeout:10];
(
  node(around:${r},${lat},${lng})["amenity"~"^(school|college|university|townhall|community_centre)$"];
  node(around:${r},${lat},${lng})["place"="square"];
  node(around:${r},${lat},${lng})["emergency"~"^(evacuation_centre|shelter)$"];
  node(around:${r},${lat},${lng})["government"="barangay"];
  node(around:${r},${lat},${lng})["office"="government"]["name"];
);
out tags;`)}`;

    for (const endpoint of OVERPASS_API_ENDPOINTS) {
      try {
        const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          body,
        }, 10000);
        if (!response.ok) continue;
        const data = await response.json();
        const landmarks = normalizeLandmarks(data.elements || []);
        landmarkRouteCache.set(cacheKey, landmarks);
        return landmarks;
      } catch (_err) {

      }
    }
    return [];
  }

  function normalizeLandmarks(rawElements) {
    const seen = new Set();
    return rawElements
      .filter((el) => el.lat && el.lon && el.tags)
      .map((el) => {
        const tags = el.tags;
        const name = tags.name || tags['name:en'] || tags['name:tl'] || null;
        if (!name) return null;
        const key = `${el.lat.toFixed(4)},${el.lon.toFixed(4)}`;
        if (seen.has(key)) return null;
        seen.add(key);

        let type = 'Landmark';
        let color = '#7C3AED';
        if (tags.amenity === 'school' || tags.amenity === 'college' || tags.amenity === 'university') {
          type = 'School';
          color = '#2563EB';
        } else if (tags.amenity === 'townhall' || tags.government === 'barangay') {
          type = 'Barangay Hall / Gov\'t Office';
          color = '#0F766E';
        } else if (tags.place === 'square') {
          type = 'Plaza / Town Square';
          color = '#B45309';
        } else if (tags.emergency === 'evacuation_centre' || tags.emergency === 'shelter') {
          type = 'Evacuation Center';
          color = '#DC2626';
        } else if (tags.amenity === 'community_centre') {
          type = 'Community Center';
          color = '#7C3AED';
        } else if (tags.office === 'government') {
          type = 'Government Office';
          color = '#0F766E';
        }
        return { name, type, color, lat: el.lat, lng: el.lon };
      })
      .filter(Boolean)
      .slice(0, 10);
  }

  function addLandmarkMarkersToRoute(landmarks) {
    if (!state.routeLayer || !landmarks || landmarks.length === 0) return;
    landmarks.forEach((landmark) => {
      const marker = L.circleMarker([landmark.lat, landmark.lng], {
        color: '#fff',
        fillColor: landmark.color,
        fillOpacity: 0.95,
        radius: 7,
        weight: 2,
      }).bindPopup(
        popupContent(landmark.name, landmark.type),
        { className: 'resq-popup' },
      );
      state.routeLayer.addLayer(marker);
    });
  }

  function updateRouteLandmarksList(landmarks) {
    if (!elements.routeLandmarks || !elements.routeLandmarksSection) return;
    if (!landmarks || landmarks.length === 0) {
      elements.routeLandmarksSection.style.display = 'none';
      return;
    }
    elements.routeLandmarksSection.style.display = '';
    elements.routeLandmarks.innerHTML = landmarks
      .map(
        (l) => `
        <div class="flex items-center gap-2 py-1 border-b border-slate-50 last:border-0">
          <span style="width:10px;height:10px;border-radius:50%;background:${l.color};display:inline-block;flex-shrink:0;"></span>
          <span class="text-[12px] font-semibold text-slate-800">${escapeHtml(l.name)}</span>
          <span class="text-[10px] text-slate-400 ml-auto shrink-0">${escapeHtml(l.type)}</span>
        </div>
      `,
      )
      .join('');
  }

  function closeRouteModal() {
    elements.routeModal.classList.add('hidden');
    elements.pageRoot?.classList.remove('route-modal-open');
    document.body.classList.remove('route-modal-open');
  }

  function startNavigationPreview() {
    if (!state.activeCenter) {
      return;
    }

    closeRouteModal();
    fitMapToPoints(state.map, [state.residentPosition, state.activeCenter], { maxZoom: 15 });
    state.centerMarkers.get(state.activeCenter.id)?.openPopup();
    showToast(`Focused on the route to ${state.activeCenter.name}.`, 'info');
  }

  function refreshActiveRoute() {
    if (!state.activeCenter) {
      return;
    }

    const refreshedCenter = state.centers.find((center) => center.id === state.activeCenter.id);
    if (!refreshedCenter) {
      state.activeCenter = null;
      closeRouteModal();
      return;
    }

    state.activeCenter = refreshedCenter;

    if (elements.routeModal.classList.contains('hidden')) {
      return;
    }

    renderRouteDetails(refreshedCenter);
    ensureRouteMap();
    drawRoutePreview(refreshedCenter);
  }

  function bindRegisteredCenterBridge() {
    global.addEventListener(REGISTERED_CENTER_EVENT, (event) => {
      void syncRegisteredCenters(Array.isArray(event.detail) ? event.detail : []);
    });

    if (Array.isArray(global.__ARPS_REGISTERED_CENTERS__)) {
      void syncRegisteredCenters(global.__ARPS_REGISTERED_CENTERS__);
    }
  }

  async function syncRegisteredCenters(rawCenters) {
    const centers = Array.isArray(rawCenters) ? rawCenters : [];
    const syncToken = ++state.registeredSyncToken;
    const resolvedCenters = [];
    const unresolvedCenters = [];

    centers.forEach((center) => {
      const directCoordinates = readRegisteredCenterCoordinates(center);
      if (directCoordinates) {
        resolvedCenters.push(buildRegisteredCenterCandidate(center, directCoordinates));
      } else {
        unresolvedCenters.push(center);
      }
    });

    state.registeredCenters = dedupeCenters(resolvedCenters);
    state.unresolvedRegisteredCenters = unresolvedCenters.map(normalizeUnresolvedRegisteredCenter);
    state.registeredCentersLoading = unresolvedCenters.length > 0;
    recomputeCenters();
    applyFilter();

    if (unresolvedCenters.length === 0) {
      return;
    }

    const geocodedCenters = (
      await Promise.all(unresolvedCenters.map((center) => geocodeRegisteredCenter(center)))
    ).filter(Boolean);

    if (syncToken !== state.registeredSyncToken) {
      return;
    }

    state.registeredCenters = dedupeCenters([...resolvedCenters, ...geocodedCenters]);
    const resolvedIds = new Set(geocodedCenters.map((center) => center.rawCenterId).filter(Boolean));
    state.unresolvedRegisteredCenters = unresolvedCenters
      .filter((center) => !resolvedIds.has(String(center.id || '')))
      .map(normalizeUnresolvedRegisteredCenter);
    state.registeredCentersLoading = false;
    recomputeCenters();
    applyFilter();
  }

  async function geocodeRegisteredCenter(center) {
    const queries = buildRegisteredCenterQueries(center);
    if (queries.length === 0) {
      return null;
    }

    const idKey = buildGeocodeCacheKey(center.id || queries[0]);
    const cachedById = registeredGeocodeCache[idKey];
    if (hasUsablePosition(cachedById) && isAcceptedRegisteredCenterPosition(cachedById)) {
      return buildRegisteredCenterCandidate(center, cachedById);
    }

    for (const query of queries) {
      const queryKey = buildGeocodeCacheKey(query);
      const cachedQuery = registeredGeocodeCache[queryKey];
      if (hasUsablePosition(cachedQuery) && isAcceptedRegisteredCenterPosition(cachedQuery)) {
        registeredGeocodeCache[idKey] = cachedQuery;
        persistRegisteredGeocodeCache();
        return buildRegisteredCenterCandidate(center, cachedQuery);
      }

      try {
        const resolvedPosition = await requestForwardGeocode(query);
        if (!resolvedPosition) {
          continue;
        }

        registeredGeocodeCache[idKey] = resolvedPosition;
        registeredGeocodeCache[queryKey] = resolvedPosition;
        persistRegisteredGeocodeCache();
        return buildRegisteredCenterCandidate(center, resolvedPosition);
      } catch {

      }
    }

    return null;
  }

  function buildRegisteredCenterQueries(center) {
    const name = normalizeText(center?.name);
    const address = normalizeText(center?.address);
    const locality = [
      normalizeText(state.originPlaceName?.barangay),
      normalizeText(state.originPlaceName?.city),
      normalizeText(state.originPlaceName?.province),
    ]
      .filter(Boolean)
      .join(', ');

    return Array.from(
      new Set([
        [name, address].filter(Boolean).join(', '),
        address,
        name,
        locality ? [name, address, locality].filter(Boolean).join(', ') : '',
        locality ? [address, locality].filter(Boolean).join(', ') : '',
      ]
        .filter(Boolean)
        .flatMap((query) => [query, `${query}, Philippines`])),
    );
  }

  function normalizeUnresolvedRegisteredCenter(center) {
    const name =
      normalizeText(center?.name) ||
      normalizeText(center?.address) ||
      'Unnamed registered center';

    return {
      id: `registered-unresolved-${center?.id || buildGeocodeCacheKey(name)}`,
      address: normalizeText(center?.address) || 'Registered center address unavailable',
      name,
      occupants: toFiniteNumber(center?.occupants),
      capacity: toFiniteNumber(center?.capacity),
      sourceLabel: 'Registered',
    };
  }

  function readRegisteredCenterCoordinates(center) {
    const locationObject =
      center?.location && typeof center.location === 'object' ? center.location : null;
    const coordinatesObject =
      center?.coordinates && typeof center.coordinates === 'object' ? center.coordinates : null;
    const coordsObject =
      center?.coords && typeof center.coords === 'object' ? center.coords : null;
    const geopointObject =
      center?.geopoint && typeof center.geopoint === 'object' ? center.geopoint : null;
    const pointObject =
      center?.point && typeof center.point === 'object' ? center.point : null;
    const coordinateArray = Array.isArray(center?.coordinates)
      ? center.coordinates
      : Array.isArray(center?.coords)
        ? center.coords
        : Array.isArray(center?.location)
          ? center.location
          : Array.isArray(center?.position)
            ? center.position
            : null;
    const latLngPair = parseLatLngPair(
      center?.latlng ??
        center?.latLng ??
        center?.locationText ??
        center?.coordinateText ??
        center?.coordinatesText,
    );
    const lat = toFiniteNumber(
      center?.lat ??
        center?.latitude ??
        center?.position?.lat ??
        center?.position?.latitude ??
        locationObject?.lat ??
        locationObject?.latitude ??
        locationObject?._lat ??
        locationObject?.geopoint?.latitude ??
        locationObject?.geopoint?._lat ??
        coordinatesObject?.lat ??
        coordinatesObject?.latitude ??
        coordinatesObject?._lat ??
        coordsObject?.lat ??
        coordsObject?.latitude ??
        coordsObject?._lat ??
        geopointObject?.lat ??
        geopointObject?.latitude ??
        geopointObject?._lat ??
        pointObject?.lat ??
        pointObject?.latitude ??
        pointObject?._lat ??
        coordinateArray?.[1] ??
        latLngPair?.lat,
    );
    const lng = toFiniteNumber(
      center?.lng ??
        center?.lon ??
        center?.longitude ??
        center?.position?.lng ??
        center?.position?.lon ??
        center?.position?.longitude ??
        locationObject?.lng ??
        locationObject?.lon ??
        locationObject?.longitude ??
        locationObject?._long ??
        locationObject?._lng ??
        locationObject?.geopoint?.longitude ??
        locationObject?.geopoint?._long ??
        coordinatesObject?.lng ??
        coordinatesObject?.lon ??
        coordinatesObject?.longitude ??
        coordinatesObject?._long ??
        coordinatesObject?._lng ??
        coordsObject?.lng ??
        coordsObject?.lon ??
        coordsObject?.longitude ??
        coordsObject?._long ??
        coordsObject?._lng ??
        geopointObject?.lng ??
        geopointObject?.lon ??
        geopointObject?.longitude ??
        geopointObject?._long ??
        geopointObject?._lng ??
        pointObject?.lng ??
        pointObject?.lon ??
        pointObject?.longitude ??
        pointObject?._long ??
        pointObject?._lng ??
        coordinateArray?.[0] ??
        latLngPair?.lng,
    );

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return { lat, lng };
  }

  function buildRegisteredCenterCandidate(center, position) {
    return normalizeCenterCandidate({
      id: `registered-${center.id || buildGeocodeCacheKey(center.name || center.address || `${position.lat}:${position.lng}`)}`,
      address: normalizeText(center.address) || 'Registered center address unavailable',
      badgeClass: 'badge-responding',
      badgeLabel: 'Official',
      capacity: toFiniteNumber(center.capacity),
      facilities: Array.isArray(center.facilities) ? center.facilities : [],
      isOfficial: true,
      lat: position.lat,
      lng: position.lng,
      name: normalizeText(center.name) || normalizeText(center.address) || 'Unnamed registered center',
      occupants: toFiniteNumber(center.occupants),
      rawCenterId: String(center.id || ''),
      sourceLabel: 'Registered',
      sourcePriority: -2,
      typeLabel: 'Registered evacuation center',
      typePriority: -0.2,
    });
  }

  async function requestForwardGeocode(queryText) {
    const response = await fetchWithTimeout(
      `${FORWARD_GEOCODE_ENDPOINT}${encodeURIComponent(queryText)}`,
      {
        headers: {
          Accept: 'application/json',
        },
        mode: 'cors',
      },
      GEOCODE_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Forward geocode failed with ${response.status}`);
    }

    const payload = await response.json();
    const matches = Array.isArray(payload) ? payload : [];
    const resolvedPosition = pickNearestGeocodeMatch(matches);

    if (!resolvedPosition || !isAcceptedRegisteredCenterPosition(resolvedPosition)) {
      return null;
    }

    return resolvedPosition;
  }

  async function fetchVerifiedLocalityPlaces(origin, placeName, options) {
    if (!origin || !placeName) {
      return [];
    }

    const config = options || {};
    const localityQueries = buildVerifiedLocalityQueries(placeName);
    if (localityQueries.length === 0) {
      return [];
    }

    const cacheKey = `${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:named:${buildLocalitySearchKey(placeName)}`;
    if (!config.force && verifiedPlaceSearchCache.has(cacheKey)) {
      return verifiedPlaceSearchCache.get(cacheKey);
    }

    const queryResults = await Promise.allSettled(
      localityQueries.map((query) => requestNamedPlaceSearch(query, origin, config.signal)),
    );

    const verifiedPlaces = dedupeCenters(
      queryResults
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value),
    )
      .filter(isVerifiedCenterCandidate)
      .slice(0, MAX_CENTER_RESULTS);

    verifiedPlaceSearchCache.set(cacheKey, verifiedPlaces);
    return verifiedPlaces;
  }

  function buildVerifiedLocalityQueries(placeName) {
    const barangay = normalizeText(placeName?.barangay) || normalizeText(placeName?.neighbourhood);
    const city = normalizeText(placeName?.city);
    const province = normalizeText(placeName?.province);
    const locality = [barangay, city, province].filter(Boolean).join(', ');
    const cityScope = [city, province].filter(Boolean).join(', ');

    return [
      locality
        ? {
            query: `barangay hall ${locality}`,
            badgeClass: 'badge-critical',
            badgeLabel: 'Gov',
            typeLabel: 'Barangay hall',
            typePriority: 1.2,
          }
        : null,
      cityScope
        ? {
            query: `municipal hall ${cityScope}`,
            badgeClass: 'badge-critical',
            badgeLabel: 'Gov',
            typeLabel: 'Municipal hall',
            typePriority: 1.3,
          }
        : null,
      cityScope
        ? {
            query: `evacuation center ${cityScope}`,
            badgeClass: 'badge-responding',
            badgeLabel: 'Evac',
            typeLabel: 'Evacuation center',
            typePriority: 0.8,
          }
        : null,
      locality
        ? {
            query: `public school ${locality}`,
            badgeClass: 'badge-medium',
            badgeLabel: 'School',
            typeLabel: 'School campus',
            typePriority: 2.1,
          }
        : null,
      locality
        ? {
            query: `elementary school ${locality}`,
            badgeClass: 'badge-medium',
            badgeLabel: 'School',
            typeLabel: 'Elementary school',
            typePriority: 2.15,
          }
        : null,
      locality
        ? {
            query: `high school ${locality}`,
            badgeClass: 'badge-medium',
            badgeLabel: 'School',
            typeLabel: 'High school campus',
            typePriority: 2.18,
          }
        : null,
      locality
        ? {
            query: `covered court ${locality}`,
            badgeClass: 'badge-low',
            badgeLabel: 'Civic',
            typeLabel: 'Covered court or gym',
            typePriority: 2.6,
          }
        : null,
      locality
        ? {
            query: `gymnasium ${locality}`,
            badgeClass: 'badge-low',
            badgeLabel: 'Civic',
            typeLabel: 'Gymnasium or civic hall',
            typePriority: 2.7,
          }
        : null,
      locality
        ? {
            query: `plaza ${locality}`,
            badgeClass: 'badge-low',
            badgeLabel: 'Plaza',
            typeLabel: 'Public plaza',
            typePriority: 3.1,
          }
        : null,
      locality
        ? {
            query: `park ${locality}`,
            badgeClass: 'badge-low',
            badgeLabel: 'Open',
            typeLabel: 'Public park or garden',
            typePriority: 3.35,
          }
        : null,
    ].filter(Boolean);
  }

  async function requestNamedPlaceSearch(queryMeta, origin, signal) {
    const response = await fetchWithTimeout(
      `${FORWARD_GEOCODE_ENDPOINT}${encodeURIComponent(queryMeta.query)}`,
      {
        headers: {
          Accept: 'application/json',
        },
        mode: 'cors',
        signal,
      },
      GEOCODE_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Named place search failed with ${response.status}`);
    }

    const payload = await response.json();
    const localityTokens = getLocalityTokens(state.originPlaceName);

    return (Array.isArray(payload) ? payload : [])
      .map((match) => buildVerifiedSearchCandidate(match, queryMeta, localityTokens))
      .filter(Boolean)
      .filter((candidate) => haversineKm(origin, candidate) <= 12)
      .sort((left, right) => {
        const leftDistance = haversineKm(origin, left);
        const rightDistance = haversineKm(origin, right);
        if (leftDistance !== rightDistance) {
          return leftDistance - rightDistance;
        }

        return left.sortBias - right.sortBias;
      })
      .slice(0, 3);
  }

  function buildVerifiedSearchCandidate(match, queryMeta, localityTokens) {
    const lat = toFiniteNumber(match?.lat);
    const lng = toFiniteNumber(match?.lon);
    const displayName = normalizeText(match?.display_name);
    const rawName = normalizeText(match?.name) || normalizeText(displayName.split(',')[0]);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !displayName || !rawName) {
      return null;
    }

    if (!matchesLocality(displayName, localityTokens)) {
      return null;
    }

    return normalizeCenterCandidate({
      id: `verified-${buildGeocodeCacheKey(`${queryMeta.query}-${match.place_id || displayName}`)}`,
      address: displayName,
      badgeClass: queryMeta.badgeClass,
      badgeLabel: queryMeta.badgeLabel,
      isVerifiedSearch: true,
      lat,
      lng,
      name: rawName,
      sourceLabel: 'Verified search',
      sourcePriority: 1.5,
      sortBias: Number.isFinite(match?.importance) ? 1 - match.importance : 1 + (match?.place_rank || 0) / 100,
      typeLabel: queryMeta.typeLabel,
      typePriority: queryMeta.typePriority,
    });
  }

  function buildLocalitySearchKey(placeName) {
    return [
      normalizeText(placeName?.barangay),
      normalizeText(placeName?.neighbourhood),
      normalizeText(placeName?.city),
      normalizeText(placeName?.province),
    ]
      .filter(Boolean)
      .join('|')
      .toLowerCase();
  }

  function getLocalityTokens(placeName) {
    return [
      normalizeText(placeName?.barangay),
      normalizeText(placeName?.neighbourhood),
      normalizeText(placeName?.city),
      normalizeText(placeName?.province),
    ]
      .filter(Boolean)
      .map((part) => part.toLowerCase());
  }

  function matchesLocality(displayName, localityTokens) {
    if (!Array.isArray(localityTokens) || localityTokens.length === 0) {
      return true;
    }

    const lowerDisplayName = displayName.toLowerCase();
    return localityTokens.some((token) => lowerDisplayName.includes(token));
  }

  function pickNearestGeocodeMatch(matches) {
    const positions = matches
      .map((match) => ({
        lat: toFiniteNumber(match?.lat),
        lng: toFiniteNumber(match?.lon),
      }))
      .filter(hasUsablePosition);

    if (positions.length === 0) {
      return null;
    }

    if (!state.residentPosition) {
      return positions[0];
    }

    return positions
      .slice()
      .sort((left, right) => haversineKm(state.residentPosition, left) - haversineKm(state.residentPosition, right))[0];
  }

  function isAcceptedRegisteredCenterPosition(position) {
    if (!hasUsablePosition(position)) {
      return false;
    }

    if (!state.residentPosition) {
      return true;
    }

    return haversineKm(state.residentPosition, position) <= 15;
  }

  async function fetchSupplementalSafePlaces(origin, options) {
    if (!origin) {
      return [];
    }

    const config = options || {};
    const radiusMeters = EXTRA_SAFE_PLACE_RADIUS_METERS;
    const cacheKey = `${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:safe:${radiusMeters}`;

    if (!config.force && supplementalPlaceCache.has(cacheKey)) {
      return supplementalPlaceCache.get(cacheKey);
    }

    const requestBody = `data=${encodeURIComponent(buildSupplementalSafePlaceQuery(origin, radiusMeters))}`;
    const opts = {
      body: requestBody,
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      method: 'POST',
      mode: 'cors',
      signal: config.signal,
    };

    try {
      const payload = await Promise.any(
        OVERPASS_API_ENDPOINTS.map((endpoint) =>
          fetchWithTimeout(endpoint, opts, EXTRA_SAFE_PLACE_FETCH_TIMEOUT_MS).then((res) => {
            if (!res.ok) throw new Error(`Open-space query ${res.status}`);
            return res.json();
          }),
        ),
      );
      const places = normalizeSupplementalSafePlaces(payload.elements || [], origin, radiusMeters);
      supplementalPlaceCache.set(cacheKey, places);
      return places;
    } catch (error) {
      if (config.signal?.aborted) throw error;
      throw new Error('All open-space queries failed');
    }
  }

  function buildSupplementalSafePlaceQuery(origin, radiusMeters) {
    const lat = origin.lat.toFixed(6);
    const lng = origin.lng.toFixed(6);

    return `[out:json][timeout:12];
(
  node(around:${radiusMeters},${lat},${lng})["place"="square"];
  way(around:${radiusMeters},${lat},${lng})["place"="square"];
  node(around:${radiusMeters},${lat},${lng})["leisure"~"^(park|garden)$"];
  way(around:${radiusMeters},${lat},${lng})["leisure"~"^(park|garden)$"];
  node(around:${radiusMeters},${lat},${lng})["landuse"="recreation_ground"];
  way(around:${radiusMeters},${lat},${lng})["landuse"="recreation_ground"];
);
out center tags;`;
  }

  function normalizeSupplementalSafePlaces(elements, origin, radiusMeters) {
    const maxKm = (radiusMeters / 1000) * 1.5;
    const seenIds = new Set();

    return elements
      .map((element) => {
        const position = readOverpassElementPosition(element);
        const tags = element.tags || {};
        const descriptor = describeSupplementalPlace(tags);
        const id = `safe-${element.type}-${element.id}`;

        if (!position || !descriptor || seenIds.has(id)) {
          return null;
        }

        if (haversineKm(origin, position) > maxKm) {
          return null;
        }

        seenIds.add(id);

        return normalizeCenterCandidate({
          id,
          address: readOverpassAddress(tags),
          badgeClass: descriptor.badgeClass,
          badgeLabel: descriptor.badgeLabel,
          lat: position.lat,
          lng: position.lng,
          name: readSupplementalPlaceName(tags, descriptor.label),
          sourceLabel: 'Open space',
          sourcePriority: 2,
          typeLabel: descriptor.label,
          typePriority: descriptor.priority,
        });
      })
      .filter(Boolean);
  }

  function describeSupplementalPlace(tags) {
    if (tags.place === 'square') {
      return {
        badgeClass: 'badge-low',
        badgeLabel: 'Plaza',
        label: 'Public plaza',
        priority: 3.2,
      };
    }

    if (tags.leisure === 'park' || tags.leisure === 'garden') {
      return {
        badgeClass: 'badge-low',
        badgeLabel: 'Open',
        label: 'Public park or garden',
        priority: 3.4,
      };
    }

    if (tags.landuse === 'recreation_ground') {
      return {
        badgeClass: 'badge-low',
        badgeLabel: 'Open',
        label: 'Open recreation ground',
        priority: 3.5,
      };
    }

    return null;
  }

  function readSupplementalPlaceName(tags, fallbackLabel) {
    return (
      normalizeText(tags.name) ||
      normalizeText(tags['official_name']) ||
      normalizeText(tags['name:en'])
    );
  }

  function renderBestCenterCard(center) {
    if (!elements.nearestCenterCard) {
      return;
    }

    if (!center || !state.residentPosition) {
      elements.nearestCenterCard.classList.add('hidden');
      if (elements.btnOpenNearestRoute) {
        delete elements.btnOpenNearestRoute.dataset.centerId;
      }
      return;
    }

    elements.nearestCenterCard.classList.remove('hidden');
    elements.nearestCenterName.textContent = center.name;
    elements.nearestCenterMeta.textContent = `${center.typeLabel} - ${center.address}`;
    elements.nearestCenterSafety.className =
      `inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm ${getHeroSafetyClasses(center.riskLevel)}`;
    elements.nearestCenterSafety.textContent = center.safetyBadgeLabel;
    elements.nearestCenterDistance.textContent = center.distanceLabel;
    elements.nearestCenterTime.textContent = center.walkLabel;
    elements.nearestCenterSource.textContent = center.badgeLabel;
    elements.nearestCenterThreats.textContent =
      center.riskLevel === 'low'
        ? `${center.directionLabel}. No nearby hazard signal was found around this place.`
        : `${center.directionLabel}. ${center.threatSummary}`;
    if (elements.btnOpenNearestRoute) {
      elements.btnOpenNearestRoute.dataset.centerId = center.id;
    }
  }

  function renderRouteDetails(center) {
    const alternativeCenters = getAlternativeRouteCenters(center);

    elements.routeTitle.textContent = center.name;
    elements.routeAddress.textContent = center.address;
    elements.routeDist.textContent = center.distanceLabel;
    elements.routeRisk.textContent = center.safetyBadgeLabel;
    elements.routeTime.textContent = center.walkLabel;
    elements.routeThreats.textContent = buildRouteThreatText(center);
    elements.routeType.textContent = center.typeLabel;
    elements.routeSource.textContent = center.sourceLabel;
    elements.routeHint.textContent = buildRouteHint(center, alternativeCenters);
    elements.routeSafetyBadge.className = `badge ${center.safetyBadgeClass}`;
    elements.routeSafetyBadge.textContent = center.safetyBadgeLabel;

    if (elements.routeSafetyBanner) {
      if (center.riskLevel === 'low') {
        elements.routeSafetyBanner.className = 'rounded-xl px-3 py-2.5 mb-3 text-center font-bold text-[13px] bg-emerald-100 text-emerald-800';
        elements.routeSafetyBanner.textContent = '✓ This location is SAFE — no nearby hazard signals detected';
      } else if (center.riskLevel === 'medium') {
        elements.routeSafetyBanner.className = 'rounded-xl px-3 py-2.5 mb-3 text-center font-bold text-[13px] bg-amber-100 text-amber-800';
        elements.routeSafetyBanner.textContent = '⚠ SOME RISK — hazard signals detected nearby, proceed with caution';
      } else if (center.riskLevel === 'high') {
        elements.routeSafetyBanner.className = 'rounded-xl px-3 py-2.5 mb-3 text-center font-bold text-[13px] bg-red-100 text-red-800';
        elements.routeSafetyBanner.textContent = '✕ UNSAFE — this area has dangerous hazard signals nearby';
      } else {
        elements.routeSafetyBanner.className = 'rounded-xl px-3 py-2.5 mb-3 text-center font-bold text-[13px] bg-slate-100 text-slate-500';
        elements.routeSafetyBanner.textContent = '? Safety status unknown — verify manually on the ground';
      }
    }

    elements.routeSteps.innerHTML = buildRouteSteps(center, alternativeCenters)
      .map((step, index) => `
        <div class="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2.5">
          <div class="w-7 h-7 rounded-full bg-slate-900 text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
            ${index + 1}
          </div>
          <div class="min-w-0">
            <p class="text-[12px] font-bold text-slate-900">${escapeHtml(step.title)}</p>
            <p class="text-[11px] text-slate-500 mt-1 leading-relaxed">${escapeHtml(step.detail)}</p>
          </div>
        </div>
      `)
      .join('');
  }

  function buildRouteHint(center, alternativeCenters) {
    const checkedCount = 1 + (Array.isArray(alternativeCenters) ? alternativeCenters.length : 0);
    const optionSummary =
      checkedCount > 1
        ? ` ${checkedCount} nearby route options are loaded in this view.`
        : '';

    if (center.riskLevel === 'low') {
      return `${center.name} is the best nearby route right now based on distance and the current hazard screen.${optionSummary}`;
    }

    if (center.riskLevel === 'medium') {
      return `${center.name} is nearby, but hazard signals were detected around it. Use caution and confirm the area on the ground.${optionSummary}`;
    }

    if (center.riskLevel === 'high') {
      return `${center.name} is reachable, but it looks unsafe as a primary stop because of nearby threat signals. Use a safer option if one is available.${optionSummary}`;
    }

    return `${center.name} can be routed from your location, but hazard screening is unavailable right now.${optionSummary}`;
  }

  function buildRouteSteps(center, alternativeCenters) {
    const originLabel = state.originPlaceName?.short || 'your current location';
    const arrivalNote = buildStayIndicatorText(center);
    const steps = [
      {
        title: `Start from ${originLabel}`,
        detail: `Use your current GPS location as the route origin.`,
      },
      {
        title: `Walk ${center.directionLabel}`,
        detail: `Travel about ${center.distanceLabel} for around ${center.walkLabel}. Stay on open roads and avoid flooded or blocked sections if possible.`,
      },
      {
        title: `Arrive at ${center.name}`,
        detail: `${arrivalNote}${center.capacityNote ? ` ${center.capacityNote}` : ''}`,
      },
    ];

    if (center.threatSummary && center.riskLevel !== 'low' && center.riskLevel !== 'unknown') {
      steps.splice(2, 0, {
        title: 'Watch nearby hazards',
        detail: center.threatSummary,
      });
    }

    if (Array.isArray(alternativeCenters) && alternativeCenters.length > 0) {
      alternativeCenters.forEach((alternative) => {
        steps.push({
          title: `Other nearby option: ${alternative.name}`,
          detail: `${alternative.typeLabel} - ${alternative.distanceLabel} away - ${alternative.walkLabel} walk - ${buildStayIndicatorText(alternative)}`,
        });
      });
    }

    return steps;
  }

  function getAlternativeRouteCenters(center) {
    return prioritizeCenterVariety(
      state.centers.filter((candidate) => candidate.id !== center.id),
      {
        featuredCount: ROUTE_ALTERNATIVE_LIMIT,
        maxCount: ROUTE_ALTERNATIVE_LIMIT,
      },
    );
  }

  function buildRouteThreatText(center) {
    if (center.riskLevel === 'low') {
      return 'Good to stay for now. No nearby hazard signal was found around this place.';
    }

    if (center.riskLevel === 'medium') {
      return `Risky nearby conditions. ${center.threatSummary}`;
    }

    if (center.riskLevel === 'high') {
      return `Risky area. ${center.threatSummary}`;
    }

    return 'Risk status could not be verified on the map. Check the area manually before staying.';
  }

  function buildStayIndicatorText(center) {
    if (center.riskLevel === 'low') {
      return 'Good to stay for now based on the current map hazard screen.';
    }

    if (center.riskLevel === 'medium') {
      return 'Use caution before staying here because hazard signals were found nearby.';
    }

    if (center.riskLevel === 'high') {
      return 'Risky area. Avoid this as a primary place to stay if a safer option is available.';
    }

    return 'Safety status needs manual checking before staying here.';
  }

  function prioritizeCenterVariety(candidates, options) {
    const config = options || {};
    const sortedCandidates = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    const maxCount = Number.isFinite(config.maxCount)
      ? Math.max(1, Math.floor(config.maxCount))
      : MAX_CENTER_RESULTS;
    const featuredCount = Number.isFinite(config.featuredCount)
      ? Math.max(1, Math.min(maxCount, Math.floor(config.featuredCount)))
      : FEATURED_ROUTE_OPTION_COUNT;

    if (sortedCandidates.length <= featuredCount) {
      return sortedCandidates.slice(0, maxCount);
    }

    const selected = [];
    const usedIds = new Set();
    const usedGroups = new Set();

    const pushCenter = (center) => {
      if (!center || usedIds.has(center.id)) {
        return false;
      }

      selected.push(center);
      usedIds.add(center.id);
      usedGroups.add(readCenterTypeGroup(center));
      return true;
    };

    pushCenter(sortedCandidates[0]);

    sortedCandidates.forEach((center) => {
      if (selected.length >= featuredCount || usedIds.has(center.id)) {
        return;
      }

      const group = readCenterTypeGroup(center);
      if (!usedGroups.has(group)) {
        pushCenter(center);
      }
    });

    sortedCandidates.forEach((center) => {
      if (selected.length >= maxCount) {
        return;
      }

      pushCenter(center);
    });

    return selected;
  }

  function readCenterTypeGroup(center) {
    const typeText = `${normalizeText(center?.typeLabel)} ${normalizeText(center?.badgeLabel)} ${normalizeText(center?.sourceLabel)}`.toLowerCase();

    if (/(registered evacuation center|evacuation center|shelter)/.test(typeText)) {
      return 'center';
    }

    if (/(school|campus)/.test(typeText)) {
      return 'school';
    }

    if (/(plaza|square)/.test(typeText)) {
      return 'plaza';
    }

    if (/(covered court|gym|sports)/.test(typeText)) {
      return 'court';
    }

    if (/(park|garden|recreation|open)/.test(typeText)) {
      return 'open';
    }

    if (/(civic|community|multipurpose)/.test(typeText)) {
      return 'civic';
    }

    if (/(barangay hall|municipal hall|city hall|government hall|hall)/.test(typeText)) {
      return 'hall';
    }

    return typeText || 'other';
  }

  function dedupeCenters(candidates) {
    const deduped = [];

    candidates
      .filter(Boolean)
      .map(normalizeCenterCandidate)
      .forEach((candidate) => {
        const duplicate = deduped.find((existing) => isSameCenter(existing, candidate));

        if (!duplicate) {
          deduped.push(candidate);
          return;
        }

        mergeCenterCandidates(duplicate, candidate);
      });

    return deduped;
  }

  function isVerifiedCenterCandidate(center) {
    if (!center || !hasUsablePosition(center)) {
      return false;
    }

    if (center.isOfficial || center.isVerifiedSearch) {
      return true;
    }

    const name = normalizeText(center.name);
    if (!name) {
      return false;
    }

    return !looksSyntheticPlaceName(name);
  }

  function looksSyntheticPlaceName(name) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) {
      return true;
    }

    return /^(evacuation center|barangay hall|government hall|community hall|school|sports hall)(,\s*.+)?$/i.test(normalizedName);
  }

  function normalizeCenterCandidate(candidate) {
    return {
      ...candidate,
      address: normalizeText(candidate.address) || 'OpenStreetMap place data',
      badgeClass: candidate.badgeClass || 'badge-pending',
      badgeLabel: normalizeText(candidate.badgeLabel) || 'Public',
      isOfficial: candidate.isOfficial === true,
      isVerifiedSearch: candidate.isVerifiedSearch === true,
      lat: candidate.lat,
      lng: candidate.lng,
      name: normalizeText(candidate.name) || 'Nearby evacuation place',
      sourceLabel: normalizeText(candidate.sourceLabel) || 'Live map',
      sourcePriority: Number.isFinite(candidate.sourcePriority) ? candidate.sourcePriority : 0,
      sortBias: Number.isFinite(candidate.sortBias) ? candidate.sortBias : 1,
      typeLabel: normalizeText(candidate.typeLabel) || 'Public facility',
      typePriority: Number.isFinite(candidate.typePriority) ? candidate.typePriority : 3,
    };
  }

  function isSameCenter(left, right) {
    const leftName = normalizeText(left.name).toLowerCase();
    const rightName = normalizeText(right.name).toLowerCase();

    if (leftName && rightName && leftName === rightName) {
      return haversineKm(left, right) <= 0.15;
    }

    return haversineKm(left, right) <= 0.03;
  }

  function mergeCenterCandidates(target, incoming) {
    if (incoming.isOfficial && !target.isOfficial) {
      Object.assign(target, incoming);
      return;
    }

    if (incoming.isVerifiedSearch) {
      target.isVerifiedSearch = true;
      if (looksSyntheticPlaceName(target.name) && !looksSyntheticPlaceName(incoming.name)) {
        target.name = incoming.name;
      }
      if (!target.address || target.address === 'OpenStreetMap place data') {
        target.address = incoming.address;
      }
    }

    if (!target.address || target.address === 'OpenStreetMap place data') {
      target.address = incoming.address;
    }

    if (!target.sourceLabel || target.sourceLabel === 'Live map') {
      target.sourceLabel = incoming.sourceLabel;
      target.sourcePriority = incoming.sourcePriority;
    }

    target.capacity = target.capacity ?? incoming.capacity;
    target.occupants = target.occupants ?? incoming.occupants;
    target.facilities = target.facilities || incoming.facilities;
  }

  function getSafetyMeta(riskLevel) {
    if (riskLevel === 'low') {
      return {
        badgeClass: 'badge-low',
        badgeLabel: 'Safe now',
        rankPenalty: 0,
        summary: 'No immediate map-based threat signal was found nearby.',
      };
    }

    if (riskLevel === 'medium') {
      return {
        badgeClass: 'badge-medium',
        badgeLabel: 'Use caution',
        rankPenalty: 0.8,
        summary: 'Nearby hazard signals were found. Verify the area before staying.',
      };
    }

    if (riskLevel === 'high') {
      return {
        badgeClass: 'badge-critical',
        badgeLabel: 'Unsafe for now',
        rankPenalty: 2.5,
        summary: 'Nearby hazard signals make this a poor primary evacuation stop.',
      };
    }

    return {
      badgeClass: 'badge-pending',
      badgeLabel: 'Check manually',
      rankPenalty: 1.2,
      summary: 'Hazard screening is unavailable right now.',
    };
  }

  function getMarkerFillColor(center) {
    if (center.isNearest) {
      return '#059669';
    }

    if (center.riskLevel === 'high') {
      return '#DC2626';
    }

    if (center.riskLevel === 'medium') {
      return '#F59E0B';
    }

    return center.isOfficial ? '#2563EB' : '#1D4ED8';
  }

  function getHeroSafetyClasses(riskLevel) {
    if (riskLevel === 'low') {
      return 'bg-emerald-900/25 text-white';
    }

    if (riskLevel === 'medium') {
      return 'bg-amber-900/25 text-white';
    }

    if (riskLevel === 'high') {
      return 'bg-red-900/30 text-white';
    }

    return 'bg-slate-900/25 text-white';
  }

  function formatCapacityNote(center) {
    const capacity = toFiniteNumber(center.capacity);
    const occupants = toFiniteNumber(center.occupants);
    const facilities = Array.isArray(center.facilities) ? center.facilities.filter(Boolean) : [];

    if (!Number.isFinite(capacity) && !Number.isFinite(occupants) && facilities.length === 0) {
      return '';
    }

    const parts = [];
    if (Number.isFinite(capacity)) {
      parts.push(`${Math.max(0, capacity - (occupants || 0))} slots open out of ${capacity}`);
    }
    if (Number.isFinite(occupants)) {
      parts.push(`${occupants} sheltered`);
    }
    if (facilities.length > 0) {
      parts.push(`Facilities: ${facilities.join(', ')}`);
    }

    return parts.join(' | ');
  }

  function getDirectionLabel(start, end) {
    const bearing = computeBearing(start, end);
    const directions = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    return directions[Math.round(bearing / 45) % directions.length];
  }

  function computeBearing(start, end) {
    const toRadians = (value) => (value * Math.PI) / 180;
    const toDegrees = (value) => (value * 180) / Math.PI;
    const startLat = toRadians(start.lat);
    const endLat = toRadians(end.lat);
    const deltaLng = toRadians(end.lng - start.lng);
    const y = Math.sin(deltaLng) * Math.cos(endLat);
    const x =
      Math.cos(startLat) * Math.sin(endLat) -
      Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);
    return (toDegrees(Math.atan2(y, x)) + 360) % 360;
  }

  function readOverpassElementPosition(element) {
    if (typeof element?.lat === 'number' && typeof element?.lon === 'number') {
      return { lat: element.lat, lng: element.lon };
    }

    if (typeof element?.center?.lat === 'number' && typeof element?.center?.lon === 'number') {
      return { lat: element.center.lat, lng: element.center.lon };
    }

    return null;
  }

  function readOverpassAddress(tags) {
    const streetLine = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
    const localityLine = [
      tags['addr:barangay'],
      tags['addr:suburb'],
      tags['addr:city'],
      tags['addr:province'],
    ]
      .filter(Boolean)
      .join(', ');

    return normalizeText([streetLine, localityLine].filter(Boolean).join(', ')) || 'OpenStreetMap place data';
  }

  function buildOverpassFallbackName(tags, fallbackLabel) {
    const areaHint = normalizeText(
      tags['addr:barangay'] ||
        tags['addr:suburb'] ||
        tags['addr:city'] ||
        tags['addr:street'],
    );

    return areaHint ? `${fallbackLabel}, ${areaHint}` : fallbackLabel;
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const externalSignal = options?.signal;

    if (externalSignal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }

    const timer = global.setTimeout(() => controller.abort(), timeoutMs);

    if (externalSignal) {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return global.fetch(url, { ...options, signal: controller.signal }).finally(() => {
      global.clearTimeout(timer);
    });
  }

  function loadRegisteredGeocodeCache() {
    try {
      const raw = global.localStorage.getItem(REGISTERED_GEOCODE_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function persistRegisteredGeocodeCache() {
    try {
      global.localStorage.setItem(
        REGISTERED_GEOCODE_CACHE_KEY,
        JSON.stringify(registeredGeocodeCache),
      );
    } catch {

    }
  }

  function buildGeocodeCacheKey(value) {
    return normalizeText(String(value || '')).toLowerCase();
  }

  function normalizeText(value) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }

  function toFiniteNumber(value) {
    const parsedValue = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  function parseLatLngPair(value) {
    if (typeof value !== 'string') {
      return null;
    }

    const parts = value
      .split(',')
      .map((part) => toFiniteNumber(part.trim()));

    if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) {
      return null;
    }

    return { lat: parts[0], lng: parts[1] };
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getOriginStatusMeta(result) {
    if (result.source === 'live') {
      return {
        title: 'Routing from your live device position',
        text: 'Nearby evacuation centers, barangay halls, plazas, schools, and safer public spaces are loaded around your current device location.',
        badgeClass: 'badge-responding',
        badgeLabel: 'Live',
        sourceLabel: 'Live GPS',
      };
    }

    if (result.source === 'saved') {
      return {
        title: 'Routing from your last known device position',
        text: 'Showing cached nearby evacuation places from your last visit. Refresh GPS for live data.',
        badgeClass: 'badge-medium',
        badgeLabel: 'Saved',
        sourceLabel: 'Saved location',
      };
    }

    if (result.reason === 'denied') {
      return {
        title: 'Location permission is blocked',
        text: 'Allow browser location access to sort nearby evacuation centers, halls, plazas, and safer public spaces from your actual position.',
        badgeClass: 'badge-critical',
        badgeLabel: 'Blocked',
        sourceLabel: 'Permission blocked',
      };
    }

    if (result.reason === 'insecure') {
      return {
        title: 'This browser is blocking live routing',
        text: 'The app can ask for your location, but this browser is refusing geolocation on the current origin.',
        badgeClass: 'badge-critical',
        badgeLabel: 'Origin',
        sourceLabel: 'Origin blocked',
      };
    }

    if (result.reason === 'unsupported') {
      return {
        title: 'Geolocation is not available here',
        text: 'This browser session does not expose device location, so nearby evacuation routes cannot be generated.',
        badgeClass: 'badge-critical',
        badgeLabel: 'Unavailable',
        sourceLabel: 'No geolocation',
      };
    }

    return {
      title: 'Getting your location...',
      text: 'Detecting your GPS position to find nearby evacuation centers, barangay halls, plazas, and safer public places around you.',
      badgeClass: 'badge-pending',
      badgeLabel: 'Loading',
      sourceLabel: 'Getting GPS...',
    };
  }

  function getOriginPopupTitle() {
    if (state.locationSource === 'live') {
      return 'Live route origin';
    }

    if (state.locationSource === 'saved') {
      return 'Saved route origin';
    }

    return 'Waiting for route origin';
  }

  function getToastMessage(result) {
    if (result.source === 'live') {
      return 'Live route origin updated';
    }

    if (result.source === 'saved') {
      return 'Showing nearby places from the last known device position';
    }

    if (result.reason === 'denied') {
      return 'Location permission is blocked in the browser';
    }

    if (result.reason === 'insecure') {
      return 'This browser is blocking live routing on the current app origin';
    }

    if (result.reason === 'unsupported') {
      return 'This browser session does not support geolocation';
    }

    return 'Waiting for live route origin';
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

  function formatShortCoordinates(position) {
    if (!position) {
      return '--';
    }

    return `${formatLatitude(position.lat).replace(/\u00B0\s*/, '')} / ${formatLongitude(position.lng).replace(/\u00B0\s*/, '')}`;
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
