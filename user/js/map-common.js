(function attachResqMaps(global) {
  const { L } = global;

  if (!L) {
    throw new Error('Leaflet must be loaded before the ARPS user map scripts.');
  }

  const DEFAULT_LOCATION = Object.freeze({
    lat: 11.0,
    lng: 122.5,
    label: 'Panay Island',
  });

  const LOCATION_STORAGE_KEY = 'resq.lastKnownLocation';
  const LOCATION_SNAPSHOT_MAX_AGE_MS = 10 * 60 * 1000;
  const OVERPASS_API_ENDPOINTS = Object.freeze([
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ]);
  const OVERPASS_TIMEOUT_SECONDS = 15;
  const FETCH_TIMEOUT_MS = 20000;
  const REVERSE_GEOCODE_TIMEOUT_MS = 7000;
  const REAL_CENTER_RADIUS_METERS = 2500;
  const HAZARD_SIGNAL_RADIUS_METERS = 3000;
  const nearbyFacilityCache = new Map();
  const hazardSignalCache = new Map();

  const GEOLOCATION_OPTIONS = Object.freeze({
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 60000,
  });

  const FAST_GEOLOCATION_OPTIONS = Object.freeze({
    enableHighAccuracy: false,
    timeout: 2000,
    maximumAge: 120000,
  });

  const reverseGeocodeCache = new Map();

  async function reverseGeocode(lat, lng) {
    const cacheKey = `${lat.toFixed(4)}:${lng.toFixed(4)}`;
    if (reverseGeocodeCache.has(cacheKey)) {
      return reverseGeocodeCache.get(cacheKey);
    }

    const resolvers = [
      () => requestNominatimReverseGeocode(lat, lng),
      () => requestBigDataCloudReverseGeocode(lat, lng),
    ];

    for (const resolvePlace of resolvers) {
      try {
        const placeName = await resolvePlace();
        if (placeName) {
          reverseGeocodeCache.set(cacheKey, placeName);
          return placeName;
        }
      } catch {
        
      }
    }

    return null;
  }

  async function requestNominatimReverseGeocode(lat, lng) {
    const response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
      {
        headers: {
          Accept: 'application/json',
        },
        mode: 'cors',
      },
      REVERSE_GEOCODE_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Nominatim reverse geocode failed with ${response.status}`);
    }

    const data = await response.json();

    return buildPlaceName({
      displayName: data.display_name,
      neighbourhood: pickFirstText(
        data.address?.neighbourhood,
        data.address?.quarter,
        data.address?.residential,
        data.address?.city_district,
        data.address?.district,
      ),
      barangay: pickFirstText(
        data.address?.village,
        data.address?.suburb,
        data.address?.hamlet,
        data.address?.borough,
        data.address?.town,
      ),
      road: pickFirstText(
        data.address?.road,
        data.address?.pedestrian,
        data.address?.footway,
        data.address?.path,
        data.address?.residential,
      ),
      houseNumber: data.address?.house_number,
      city: pickFirstText(
        data.address?.city,
        data.address?.municipality,
        data.address?.town,
        data.address?.city_district,
        data.address?.county,
      ),
      province: pickFirstText(
        data.address?.state,
        data.address?.province,
        data.address?.region,
        data.address?.state_district,
      ),
      postcode: data.address?.postcode,
      country: data.address?.country,
    });
  }

  async function requestBigDataCloudReverseGeocode(lat, lng) {
    const response = await fetchWithTimeout(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      {
        headers: {
          Accept: 'application/json',
        },
        mode: 'cors',
      },
      REVERSE_GEOCODE_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`BigDataCloud reverse geocode failed with ${response.status}`);
    }

    const data = await response.json();

    return buildPlaceName({
      displayName: [data.locality, data.city, data.principalSubdivision, data.countryName]
        .filter(Boolean)
        .join(', '),
      neighbourhood: pickFirstText(
        readLocalityInfoName(data.localityInfo?.informative, ['neighbourhood', 'neighborhood']),
        readLocalityInfoName(data.localityInfo?.informative, ['suburb', 'quarter', 'district']),
      ),
      barangay: pickFirstText(
        readLocalityInfoName(data.localityInfo?.administrative, ['barangay']),
        data.locality,
      ),
      city: pickFirstText(data.city, data.locality),
      province: data.principalSubdivision,
      postcode: data.postcode,
      country: data.countryName,
    });
  }

  function buildPlaceName(fields) {
    const displayName = normalizePlaceText(fields.displayName);
    const neighbourhood = normalizePlaceText(fields.neighbourhood);
    const barangay = normalizePlaceText(fields.barangay);
    const road = normalizePlaceText(fields.road);
    const street = buildStreetLine(fields.houseNumber, road);
    const city = normalizePlaceText(fields.city);
    const province = normalizePlaceText(fields.province);
    const postcode = normalizePlaceText(fields.postcode);
    const country = normalizePlaceText(fields.country);

    const shortParts = [];
    appendUniquePlacePart(shortParts, neighbourhood);
    appendUniquePlacePart(shortParts, barangay);
    appendUniquePlacePart(shortParts, street);
    appendUniquePlacePart(shortParts, city);

    const fullParts = [];
    appendUniquePlacePart(fullParts, street);
    appendUniquePlacePart(fullParts, neighbourhood);
    appendUniquePlacePart(fullParts, barangay);
    appendUniquePlacePart(fullParts, city);
    appendUniquePlacePart(fullParts, province);
    appendUniquePlacePart(fullParts, postcode);
    appendUniquePlacePart(fullParts, country);

    return {
      short:
        shortParts.slice(0, 3).join(', ') ||
        (displayName
          ? displayName
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean)
              .slice(0, 3)
              .join(', ')
          : 'Unknown location'),
      full: fullParts.join(', ') || displayName || 'Unknown location',
      barangay: barangay || null,
      neighbourhood: neighbourhood || null,
      road: road || null,
      street: street || null,
      city: city || null,
      province: province || null,
      postcode: postcode || null,
      country: country || null,
    };
  }

  function normalizePlaceText(value) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  }

  function appendUniquePlacePart(parts, value) {
    const text = normalizePlaceText(value);
    if (!text) {
      return;
    }

    const normalized = text.toLowerCase();
    if (parts.some((part) => part.toLowerCase() === normalized)) {
      return;
    }

    parts.push(text);
  }

  function pickFirstText(...values) {
    for (const value of values) {
      const text = normalizePlaceText(value);
      if (text) {
        return text;
      }
    }

    return '';
  }

  function buildStreetLine(houseNumber, road) {
    const streetParts = [];
    appendUniquePlacePart(streetParts, houseNumber);
    appendUniquePlacePart(streetParts, road);
    return streetParts.join(' ');
  }

  function readLocalityInfoName(entries, keywords) {
    if (!Array.isArray(entries)) {
      return '';
    }

    const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
    const match = entries.find((entry) => {
      const description = normalizePlaceText(entry?.description).toLowerCase();
      return lowerKeywords.some((keyword) => description.includes(keyword));
    });

    return normalizePlaceText(match?.name);
  }

  const TILE_LAYER_OPTIONS = Object.freeze({
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });

  const BASE_MAP_OPTIONS = Object.freeze({
    preferCanvas: true,
    zoomControl: false,
  });

  function createBaseMap(elementId, options) {
    const config = options || {};
    const center = config.center || DEFAULT_LOCATION;
    const zoom = config.zoom || 14;
    const showZoomControl = config.showZoomControl !== false;
    const mapOptions = { ...BASE_MAP_OPTIONS, ...config };

    delete mapOptions.center;
    delete mapOptions.zoom;
    delete mapOptions.showZoomControl;

    const map = L.map(elementId, mapOptions).setView([center.lat, center.lng], zoom);

    if (showZoomControl) {
      L.control.zoom({ position: 'bottomright' }).addTo(map);
    }

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', TILE_LAYER_OPTIONS).addTo(map);

    return map;
  }

  function createResidentMarker(position, options) {
    return L.circleMarker([position.lat, position.lng], {
      radius: 8,
      weight: 3,
      color: '#FFFFFF',
      fillColor: '#2563EB',
      fillOpacity: 1,
      ...(options || {}),
    });
  }

  function createCenterMarker(center, options) {
    return L.circleMarker([center.lat, center.lng], {
      radius: center.isNearest ? 10 : 8,
      weight: 3,
      color: '#FFFFFF',
      fillColor: center.isNearest ? '#059669' : '#1D4ED8',
      fillOpacity: 1,
      ...(options || {}),
    });
  }

  function createAccuracyCircle(position, accuracyMeters) {
    return L.circle([position.lat, position.lng], {
      radius: accuracyMeters,
      stroke: false,
      fillColor: '#60A5FA',
      fillOpacity: 0.18,
    });
  }

  function saveLocationSnapshot(snapshot) {
    if (!snapshot || !snapshot.position || snapshot.source === 'default') {
      return;
    }

    try {
      global.localStorage.setItem(
        LOCATION_STORAGE_KEY,
        JSON.stringify({
          accuracyMeters: snapshot.accuracyMeters,
          lat: snapshot.position.lat,
          lng: snapshot.position.lng,
          source: snapshot.source,
          updatedAt: snapshot.updatedAt || Date.now(),
        }),
      );
    } catch {
      // Ignore storage write failures so live location still works.
    }
  }

  function loadSavedLocation(options) {
    const config = options || {};
    const maxAgeMs =
      typeof config.maxAgeMs === 'number' ? config.maxAgeMs : LOCATION_SNAPSHOT_MAX_AGE_MS;

    try {
      const rawValue = global.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (!rawValue) {
        return null;
      }

      const parsedValue = JSON.parse(rawValue);
      if (
        typeof parsedValue.lat !== 'number' ||
        typeof parsedValue.lng !== 'number' ||
        !Number.isFinite(parsedValue.lat) ||
        !Number.isFinite(parsedValue.lng)
      ) {
        return null;
      }

      const updatedAt =
        typeof parsedValue.updatedAt === 'number' ? parsedValue.updatedAt : null;

      if (
        typeof maxAgeMs === 'number' &&
        Number.isFinite(maxAgeMs) &&
        maxAgeMs >= 0 &&
        (
          typeof updatedAt !== 'number' ||
          Date.now() - updatedAt > maxAgeMs
        )
      ) {
        return null;
      }

      return {
        source: 'saved',
        position: {
          lat: parsedValue.lat,
          lng: parsedValue.lng,
        },
        accuracyMeters:
          typeof parsedValue.accuracyMeters === 'number' ? parsedValue.accuracyMeters : null,
        updatedAt: updatedAt || Date.now(),
        reason: null,
      };
    } catch {
      return null;
    }
  }

  function requestFastLocation() {
    if (!navigator.geolocation) {
      return Promise.resolve(
        buildDefaultResult(isOriginBlockedForGeolocation() ? 'insecure' : 'unsupported'),
      );
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (result) => {
          const liveResult = {
            source: 'live',
            position: {
              lat: result.coords.latitude,
              lng: result.coords.longitude,
            },
            accuracyMeters: Math.max(5, Math.round(result.coords.accuracy)),
            updatedAt: Date.now(),
            reason: null,
          };
          saveLocationSnapshot(liveResult);
          resolve(liveResult);
        },
        (error) => {
          resolve(buildDefaultResult(getGeolocationReason(error)));
        },
        FAST_GEOLOCATION_OPTIONS,
      );
    });
  }

  function requestLiveLocation() {
    if (!navigator.geolocation) {
      return Promise.resolve(
        buildDefaultResult(isOriginBlockedForGeolocation() ? 'insecure' : 'unsupported'),
      );
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (result) => {
          const liveResult = {
            source: 'live',
            position: {
              lat: result.coords.latitude,
              lng: result.coords.longitude,
            },
            accuracyMeters: Math.max(5, Math.round(result.coords.accuracy)),
            updatedAt: Date.now(),
            reason: null,
          };

          saveLocationSnapshot(liveResult);
          resolve(liveResult);
        },
        (error) => {
          resolve(buildDefaultResult(getGeolocationReason(error)));
        },
        GEOLOCATION_OPTIONS,
      );
    });
  }

  async function resolveUserLocation(options) {
    const config = options || {};
    const liveResult = await requestLiveLocation();

    if (liveResult.source === 'live') {
      return liveResult;
    }

    if (config.allowSaved !== false) {
      const savedResult = loadSavedLocation();
      if (savedResult) {
        return {
          ...savedResult,
          reason: liveResult.reason,
        };
      }
    }

    return liveResult;
  }

  function startLocationWatch(handlers) {
    if (!navigator.geolocation) {
      return null;
    }

    const callbacks = handlers || {};
    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        const liveResult = {
          source: 'live',
          position: {
            lat: result.coords.latitude,
            lng: result.coords.longitude,
          },
          accuracyMeters: Math.max(5, Math.round(result.coords.accuracy)),
          updatedAt: Date.now(),
          reason: null,
        };

        saveLocationSnapshot(liveResult);

        if (typeof callbacks.onUpdate === 'function') {
          callbacks.onUpdate(liveResult);
        }
      },
      (error) => {
        if (typeof callbacks.onError === 'function') {
          callbacks.onError(buildDefaultResult(getGeolocationReason(error)));
        }
      },
      {
        ...GEOLOCATION_OPTIONS,
        maximumAge: 0,
        timeout: 20000,
      },
    );

    return function stopLocationWatch() {
      navigator.geolocation.clearWatch(watchId);
    };
  }
  function buildDefaultResult(reason) {
    return {
      source: 'default',
      position: null,
      accuracyMeters: null,
      updatedAt: null,
      reason,
    };
  }

  function getGeolocationReason(error) {
    if (!error) {
      return 'unavailable';
    }

    if (error.code === 1) {
      return isOriginBlockedForGeolocation() ? 'insecure' : 'denied';
    }

    if (error.code === 2) {
      return 'unavailable';
    }

    if (error.code === 3) {
      return 'timeout';
    }

    return 'unavailable';
  }

  function isOriginBlockedForGeolocation() {
    return global.isSecureContext !== true;
  }

  async function fetchNearbyEvacuationPlaces(origin, options) {
    if (!origin) {
      return Promise.resolve([]);
    }

    const config = options || {};
    const radiusMeters =
      typeof config.radiusMeters === 'number' ? config.radiusMeters : REAL_CENTER_RADIUS_METERS;
    const cacheKey = `${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:${radiusMeters}`;

    if (!config.force && nearbyFacilityCache.has(cacheKey)) {
      return nearbyFacilityCache.get(cacheKey);
    }

    const rawPlaces = await requestNearbyPlacesFromOverpass(origin, radiusMeters, config.signal);

    // Safety filter: reject any place beyond the search radius (some Overpass mirrors return bad data)
    const maxKm = (radiusMeters / 1000) * 1.5; // allow 50% tolerance
    const places = rawPlaces.filter((place) => haversineKm(origin, place) <= maxKm);

    nearbyFacilityCache.set(cacheKey, places);
    return places;
  }

  async function fetchHazardSignalsAround(origin, options) {
    if (!origin) {
      return Promise.resolve([]);
    }

    const config = options || {};
    const radiusMeters =
      typeof config.radiusMeters === 'number' ? config.radiusMeters : HAZARD_SIGNAL_RADIUS_METERS;
    const cacheKey = `${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:hazards:${radiusMeters}`;

    if (!config.force && hazardSignalCache.has(cacheKey)) {
      return hazardSignalCache.get(cacheKey);
    }

    const rawSignals = await requestHazardSignalsFromOverpass(origin, radiusMeters, config.signal);

    // Safety filter: reject any signal beyond the search radius
    const maxKm = (radiusMeters / 1000) * 1.5;
    const signals = rawSignals.filter((sig) => haversineKm(origin, sig) <= maxKm);

    hazardSignalCache.set(cacheKey, signals);
    return signals;
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const externalSignal = options.signal;

    if (externalSignal && externalSignal.aborted) {
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

  async function requestNearbyPlacesFromOverpass(origin, radiusMeters, signal) {
    const requestBody = `data=${encodeURIComponent(buildEvacuationPlaceQuery(origin, radiusMeters))}`;
    const opts = {
      body: requestBody,
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      method: 'POST',
      mode: 'cors',
      signal,
    };
    try {
      const payload = await Promise.any(
        OVERPASS_API_ENDPOINTS.map((endpoint) =>
          fetchWithTimeout(endpoint, opts, FETCH_TIMEOUT_MS).then((res) => {
            if (res.status === 429 || res.status === 504 || !res.ok) throw new Error(`Overpass ${res.status}`);
            return res.json();
          }),
        ),
      );
      return normalizeEvacuationPlaces(payload.elements || []);
    } catch (err) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      throw new Error('All Overpass endpoints failed');
    }
  }

  async function requestHazardSignalsFromOverpass(origin, radiusMeters, signal) {
    const requestBody = `data=${encodeURIComponent(buildHazardSignalQuery(origin, radiusMeters))}`;
    const opts = {
      body: requestBody,
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      method: 'POST',
      mode: 'cors',
      signal,
    };
    try {
      const payload = await Promise.any(
        OVERPASS_API_ENDPOINTS.map((endpoint) =>
          fetchWithTimeout(endpoint, opts, FETCH_TIMEOUT_MS).then((res) => {
            if (res.status === 429 || res.status === 504 || !res.ok) throw new Error(`Overpass ${res.status}`);
            return res.json();
          }),
        ),
      );
      return normalizeHazardSignals(payload.elements || []);
    } catch (err) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      throw new Error('All Overpass hazard endpoints failed');
    }
  }

  function buildEvacuationPlaceQuery(origin, radiusMeters) {
    const lat = origin.lat.toFixed(6);
    const lng = origin.lng.toFixed(6);
    const r = radiusMeters;

    return `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
(
  nwr(around:${r},${lat},${lng})["amenity"~"^(townhall|community_centre|social_centre|social_facility|school|college|university)$"];
  nwr(around:${r},${lat},${lng})["building"~"^(civic|public|school|sports_hall)$"];
  nwr(around:${r},${lat},${lng})["building"="government"];
  nwr(around:${r},${lat},${lng})["office"="government"];
  nwr(around:${r},${lat},${lng})["government"];
  nwr(around:${r},${lat},${lng})["leisure"~"^(sports_hall|sports_centre)$"];
  nwr(around:${r},${lat},${lng})["evacuation_center"="yes"];
  nwr(around:${r},${lat},${lng})["social_facility"="shelter"];
  nwr(around:${r},${lat},${lng})["emergency"~"^(evacuation_centre|shelter)$"];
);
out center tags;`;
  }

  function buildHazardSignalQuery(origin, radiusMeters) {
    const lat = origin.lat.toFixed(6);
    const lng = origin.lng.toFixed(6);
    const r = radiusMeters;

    return `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
(
  nwr(around:${r},${lat},${lng})["natural"~"^(water|wetland|coastline|cliff|scree|volcano)$"];
  nwr(around:${r},${lat},${lng})["waterway"];
  nwr(around:${r},${lat},${lng})["landuse"~"^(industrial|quarry)$"];
  nwr(around:${r},${lat},${lng})["man_made"~"^(storage_tank|works)$"];
);
out center tags;`;
  }

  function normalizeEvacuationPlaces(elements) {
    const seenIds = new Set();

    return elements
      .map((element) => normalizeEvacuationPlace(element, seenIds))
      .filter(Boolean);
  }

  function normalizeHazardSignals(elements) {
    const seenIds = new Set();

    return elements
      .map((element) => normalizeHazardSignal(element, seenIds))
      .filter(Boolean);
  }

  function normalizeEvacuationPlace(element, seenIds) {
    const position = getElementPosition(element);
    const tags = element.tags || {};
    const name = readFacilityName(tags);
    const facilityType = describeFacilityType(tags);
    const facilityId = `${element.type}-${element.id}`;

    if (!position || !name || seenIds.has(facilityId)) {
      return null;
    }

    seenIds.add(facilityId);

    return {
      address: readFacilityAddress(tags),
      badgeClass: facilityType.badgeClass,
      badgeLabel: facilityType.badgeLabel,
      id: facilityId,
      lat: position.lat,
      lng: position.lng,
      name,
      typeLabel: facilityType.label,
      typePriority: facilityType.priority,
    };
  }

  function normalizeHazardSignal(element, seenIds) {
    const position = getElementPosition(element);
    const tags = element.tags || {};
    const signalType = describeHazardSignal(tags);
    const signalId = `${element.type}-${element.id}`;

    if (!position || !signalType || seenIds.has(signalId)) {
      return null;
    }

    seenIds.add(signalId);

    return {
      id: signalId,
      lat: position.lat,
      lng: position.lng,
      kind: signalType.kind,
      label: signalType.label,
      weight: signalType.weight,
    };
  }

  function getElementPosition(element) {
    if (typeof element.lat === 'number' && typeof element.lon === 'number') {
      return {
        lat: element.lat,
        lng: element.lon,
      };
    }

    if (
      element.center &&
      typeof element.center.lat === 'number' &&
      typeof element.center.lon === 'number'
    ) {
      return {
        lat: element.center.lat,
        lng: element.center.lon,
      };
    }

    return null;
  }

  function readFacilityName(tags) {
    return (
      tags.name ||
      tags['official_name'] ||
      tags['short_name'] ||
      tags.operator ||
      tags['name:en'] ||
      tags['alt_name'] ||
      buildFacilityFallbackName(tags)
    );
  }

  function readFacilityAddress(tags) {
    if (tags['addr:full']) {
      return tags['addr:full'];
    }

    const streetLine = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
    const localityLine = [
      tags['addr:quarter'],
      tags['addr:neighbourhood'],
      tags['addr:suburb'],
      tags['addr:barangay'],
      tags['addr:city'],
      tags['addr:province'],
    ]
      .filter(Boolean)
      .join(', ');

    const address = [streetLine, localityLine].filter(Boolean).join(', ');
    return address || 'OpenStreetMap place data';
  }

  function buildFacilityFallbackName(tags) {
    const areaHint = pickFirstText(
      tags['addr:barangay'],
      tags['addr:suburb'],
      tags['addr:neighbourhood'],
      tags['addr:city'],
      tags['addr:street'],
    );

    let baseName = '';

    if (
      tags['evacuation_center'] === 'yes' ||
      tags['social_facility'] === 'shelter' ||
      tags['emergency:social_facility'] === 'shelter' ||
      tags['emergency'] === 'evacuation_centre'
    ) {
      baseName = 'Evacuation Center';
    } else if (
      tags['government'] === 'barangay' ||
      tags['government'] === 'municipality' ||
      tags['office'] === 'government' ||
      tags['amenity'] === 'townhall' ||
      tags['building'] === 'government'
    ) {
      baseName = tags['government'] === 'barangay' ? 'Barangay Hall' : 'Government Hall';
    } else if (
      tags['amenity'] === 'community_centre' ||
      tags['amenity'] === 'social_facility' ||
      tags['amenity'] === 'social_centre' ||
      tags['community_centre'] === 'public_hall' ||
      tags['community_centre'] === 'village_hall' ||
      tags['building'] === 'civic' ||
      tags['building'] === 'public'
    ) {
      baseName = 'Community Hall';
    } else if (
      tags['amenity'] === 'school' ||
      tags['building'] === 'school' ||
      tags['amenity'] === 'college' ||
      tags['amenity'] === 'university'
    ) {
      baseName = 'School';
    } else if (
      tags['leisure'] === 'sports_hall' ||
      tags['leisure'] === 'sports_centre' ||
      tags['building'] === 'sports_hall'
    ) {
      baseName = 'Sports Hall';
    }

    if (!baseName) {
      return null;
    }

    return areaHint ? `${baseName}, ${areaHint}` : baseName;
  }

  function describeFacilityType(tags) {
    if (
      tags['evacuation_center'] === 'yes' ||
      tags['social_facility'] === 'shelter' ||
      tags['emergency:social_facility'] === 'shelter' ||
      tags['emergency'] === 'evacuation_centre'
    ) {
      return {
        badgeClass: 'badge-responding',
        badgeLabel: 'Official',
        label: 'Official evacuation site',
        priority: 0,
      };
    }

    if (
      tags['amenity'] === 'townhall' ||
      tags['building'] === 'government' ||
      tags['office'] === 'government' ||
      tags['government'] === 'barangay' ||
      tags['government'] === 'municipality' ||
      tags['government'] === 'local_authority' ||
      tags['government'] === 'administrative'
    ) {
      return {
        badgeClass: 'badge-critical',
        badgeLabel: 'Gov',
        label: 'Municipal or barangay center',
        priority: 1,
      };
    }

    if (
      tags['amenity'] === 'community_centre' ||
      tags['amenity'] === 'social_facility' ||
      tags['amenity'] === 'social_centre' ||
      tags['community_centre'] === 'public_hall' ||
      tags['community_centre'] === 'village_hall' ||
      tags['leisure'] === 'sports_hall' ||
      tags['leisure'] === 'sports_centre' ||
      tags['building'] === 'sports_hall' ||
      tags['building'] === 'civic'
    ) {
      return {
        badgeClass: 'badge-low',
        badgeLabel: 'Civic',
        label: 'Community or civic hall',
        priority: 2,
      };
    }

    if (
      tags['amenity'] === 'school' ||
      tags['building'] === 'school' ||
      tags['amenity'] === 'college' ||
      tags['amenity'] === 'university'
    ) {
      return {
        badgeClass: 'badge-medium',
        badgeLabel: 'School',
        label: 'School campus',
        priority: 3,
      };
    }

    return {
      badgeClass: 'badge-pending',
      badgeLabel: 'Public',
      label: 'Public facility',
      priority: 4,
    };
  }

  function describeHazardSignal(tags) {
    if (
      tags['natural'] === 'coastline'
    ) {
      return {
        kind: 'storm_surge',
        label: 'Storm surge exposure',
        weight: 2.2,
      };
    }

    if (
      tags['waterway'] ||
      tags['natural'] === 'water' ||
      tags['natural'] === 'wetland' ||
      tags['water']
    ) {
      return {
        kind: 'flood',
        label: 'Flood exposure',
        weight: 1.8,
      };
    }

    if (
      tags['natural'] === 'cliff' ||
      tags['natural'] === 'scree' ||
      tags['landuse'] === 'quarry'
    ) {
      return {
        kind: 'landslide',
        label: 'Slope or landslide exposure',
        weight: 1.6,
      };
    }

    if (
      tags['landuse'] === 'industrial' ||
      tags['industrial'] ||
      tags['man_made'] === 'storage_tank' ||
      tags['man_made'] === 'works'
    ) {
      return {
        kind: 'industrial',
        label: 'Industrial or chemical exposure',
        weight: 1.4,
      };
    }

    if (tags['natural'] === 'volcano') {
      return {
        kind: 'volcanic',
        label: 'Volcanic exposure',
        weight: 2.4,
      };
    }

    return null;
  }

  function assessPlaceRisk(place, hazardSignals, options) {
    const config = options || {};
    if (config.unavailable) {
      return {
        riskBadgeClass: 'badge-pending',
        riskBadgeLabel: 'Unknown',
        riskLabel: 'Unknown',
        riskLevel: 'unknown',
        threatLabels: [],
        threatSummary: 'Threat screening is unavailable right now.',
      };
    }

    const signals = Array.isArray(hazardSignals) ? hazardSignals : [];
    const nearestByKind = new Map();

    signals.forEach((signal) => {
      const distanceKm = haversineKm(place, signal);
      if (!isThreatRelevant(signal.kind, distanceKm)) {
        return;
      }

      const existing = nearestByKind.get(signal.kind);
      if (!existing || distanceKm < existing.distanceKm) {
        nearestByKind.set(signal.kind, {
          ...signal,
          distanceKm,
        });
      }
    });

    const matchedThreats = Array.from(nearestByKind.values())
      .sort((left, right) => left.distanceKm - right.distanceKm);

    const threatLabels = matchedThreats.map((signal) => signal.label);
    const totalThreatScore = matchedThreats.reduce(
      (score, signal) => score + computeThreatScore(signal),
      0,
    );
    const facilityAdjustment =
      place.typePriority === 0 ? -0.8 : place.typePriority <= 2 ? -0.25 : 0;
    const netRiskScore = totalThreatScore + facilityAdjustment;

    if (matchedThreats.length === 0) {
      return {
        riskBadgeClass: 'badge-low',
        riskBadgeLabel: 'Mas ligtas',
        riskLabel: 'Mas ligtas',
        riskLevel: 'low',
        threatLabels: [],
        threatSummary: 'No immediate map-based threat signal was found nearby.',
      };
    }

    if (netRiskScore >= 3.2) {
      return {
        riskBadgeClass: 'badge-critical',
        riskBadgeLabel: 'Dilikado',
        riskLabel: 'Dilikado',
        riskLevel: 'high',
        threatLabels,
        threatSummary: threatLabels.join(', '),
      };
    }

    return {
      riskBadgeClass: 'badge-medium',
      riskBadgeLabel: 'May risk',
      riskLabel: 'May risk',
      riskLevel: 'medium',
      threatLabels,
      threatSummary: threatLabels.join(', '),
    };
  }

  function isThreatRelevant(kind, distanceKm) {
    if (kind === 'flood') {
      return distanceKm <= 0.25;
    }

    if (kind === 'storm_surge') {
      return distanceKm <= 1.5;
    }

    if (kind === 'landslide') {
      return distanceKm <= 0.35;
    }

    if (kind === 'industrial') {
      return distanceKm <= 0.5;
    }

    if (kind === 'volcanic') {
      return distanceKm <= 30;
    }

    return false;
  }

  function computeThreatScore(signal) {
    if (signal.kind === 'volcanic') {
      return signal.distanceKm <= 10 ? 3 : 1.6;
    }

    if (signal.kind === 'storm_surge') {
      return signal.distanceKm <= 0.6 ? 2.4 : 1.4;
    }

    if (signal.kind === 'flood') {
      return signal.distanceKm <= 0.1 ? 2 : 1.2;
    }

    if (signal.kind === 'landslide') {
      return signal.distanceKm <= 0.15 ? 1.8 : 1.1;
    }

    if (signal.kind === 'industrial') {
      return signal.distanceKm <= 0.2 ? 1.5 : 0.9;
    }

    return signal.weight;
  }

  function formatLatitude(latitude) {
    return `${Math.abs(latitude).toFixed(4)}\u00B0 ${latitude >= 0 ? 'N' : 'S'}`;
  }

  function formatLongitude(longitude) {
    return `${Math.abs(longitude).toFixed(4)}\u00B0 ${longitude >= 0 ? 'E' : 'W'}`;
  }

  function formatAccuracy(accuracyMeters) {
    if (typeof accuracyMeters !== 'number') {
      return 'Waiting';
    }

    return `\u00B1${Math.round(accuracyMeters)}m`;
  }

  function formatDistance(distanceKm) {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }

    return `${distanceKm.toFixed(1)} km`;
  }

  function estimateWalkMinutes(distanceKm) {
    return Math.max(3, Math.round((distanceKm / 4.8) * 60));
  }

  function haversineKm(start, end) {
    const earthRadiusKm = 6371;
    const toRadians = (value) => (value * Math.PI) / 180;
    const deltaLat = toRadians(end.lat - start.lat);
    const deltaLng = toRadians(end.lng - start.lng);
    const startLat = toRadians(start.lat);
    const endLat = toRadians(end.lat);

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;

    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function fitMapToPoints(map, points, options) {
    const config = options || {};
    const padding = config.padding || [32, 32];
    const maxZoom = config.maxZoom || 15;
    const singleZoom = config.singleZoom || 15;
    const validPoints = points
      .filter(Boolean)
      .map((point) => (Array.isArray(point) ? point : [point.lat, point.lng]));

    if (validPoints.length === 0) {
      return;
    }

    if (validPoints.length === 1) {
      map.setView(validPoints[0], singleZoom);
      return;
    }

    map.fitBounds(validPoints, { padding, maxZoom });
  }

  function invalidateMap(map, delayMs) {
    global.setTimeout(() => {
      map.invalidateSize();
    }, delayMs || 0);
  }

  function popupContent(title, meta) {
    return `
      <div class="resq-popup__title">${title}</div>
      <div class="resq-popup__meta">${meta}</div>
    `;
  }

  function toShareUrl(position) {
    const latitude = position.lat.toFixed(5);
    const longitude = position.lng.toFixed(5);

    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
  }

  // ── Fast query: only schools + government (most common evacuation centers in PH) ──
  function buildCombinedEvacHazardQuery(origin, placesRadius, hazardsRadius) {
    const lat = origin.lat.toFixed(6);
    const lng = origin.lng.toFixed(6);
    const pr = placesRadius;
    const hr = hazardsRadius;

    return `[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
(
  nwr(around:${pr},${lat},${lng})["amenity"~"^(townhall|community_centre|social_centre|social_facility|school|college|university)$"];
  nwr(around:${pr},${lat},${lng})["building"~"^(civic|public|school|sports_hall)$"];
  nwr(around:${pr},${lat},${lng})["building"="government"];
  nwr(around:${pr},${lat},${lng})["office"="government"];
  nwr(around:${pr},${lat},${lng})["government"];
  nwr(around:${pr},${lat},${lng})["leisure"~"^(sports_hall|sports_centre)$"];
  nwr(around:${pr},${lat},${lng})["evacuation_center"="yes"];
  nwr(around:${pr},${lat},${lng})["social_facility"="shelter"];
  nwr(around:${pr},${lat},${lng})["emergency"~"^(evacuation_centre|shelter)$"];
  nwr(around:${hr},${lat},${lng})["natural"~"^(water|wetland|coastline|cliff|scree|volcano)$"];
  nwr(around:${hr},${lat},${lng})["waterway"];
  nwr(around:${hr},${lat},${lng})["landuse"~"^(industrial|quarry)$"];
  nwr(around:${hr},${lat},${lng})["man_made"~"^(storage_tank|works)$"];
);
out center tags;`;
  }

  async function fetchEvacDataCombined(origin, options) {
    if (!origin) return { places: [], hazards: [] };

    const config = options || {};
    const placesRadius = typeof config.placesRadius === 'number' ? config.placesRadius : REAL_CENTER_RADIUS_METERS;
    const hazardsRadius = typeof config.hazardsRadius === 'number' ? config.hazardsRadius : HAZARD_SIGNAL_RADIUS_METERS;
    const placesCacheKey = `${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:${placesRadius}`;
    const hazardsCacheKey = `${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:hazards:${hazardsRadius}`;

    if (!config.force && nearbyFacilityCache.has(placesCacheKey) && hazardSignalCache.has(hazardsCacheKey)) {
      return {
        places: nearbyFacilityCache.get(placesCacheKey),
        hazards: hazardSignalCache.get(hazardsCacheKey),
      };
    }

    const requestBody = `data=${encodeURIComponent(buildCombinedEvacHazardQuery(origin, placesRadius, hazardsRadius))}`;
    const opts = {
      body: requestBody,
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      method: 'POST',
      mode: 'cors',
      signal: config.signal,
    };

    let elements;
    try {
      const payload = await Promise.any(
        OVERPASS_API_ENDPOINTS.map((endpoint) =>
          fetchWithTimeout(endpoint, opts, FETCH_TIMEOUT_MS).then((res) => {
            if (res.status === 429 || res.status === 504 || !res.ok) throw new Error(`Overpass ${res.status}`);
            return res.json();
          }),
        ),
      );
      elements = payload.elements || [];
    } catch (err) {
      if (config.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      throw new Error('All Overpass endpoints failed');
    }

    const maxPlacesKm = (placesRadius / 1000) * 1.5;
    const maxHazardsKm = (hazardsRadius / 1000) * 1.5;
    const places = normalizeEvacuationPlaces(elements).filter((p) => haversineKm(origin, p) <= maxPlacesKm);
    const hazards = normalizeHazardSignals(elements).filter((s) => haversineKm(origin, s) <= maxHazardsKm);

    nearbyFacilityCache.set(placesCacheKey, places);
    hazardSignalCache.set(hazardsCacheKey, hazards);
    return { places, hazards };
  }

  function buildFastEvacQuery(origin, radiusMeters) {
    const lat = origin.lat.toFixed(6);
    const lng = origin.lng.toFixed(6);
    const r = radiusMeters;

    return `[out:json][timeout:8];
(
  nwr(around:${r},${lat},${lng})["amenity"~"^(school|townhall)$"];
  nwr(around:${r},${lat},${lng})["building"="government"];
  nwr(around:${r},${lat},${lng})["government"];
  nwr(around:${r},${lat},${lng})["building"~"^(school|civic|public)$"];
);
out center tags;`;
  }

  async function fetchFastEvacPlaces(origin, options) {
    if (!origin) return [];

    const config = options || {};
    const radiusMeters = REAL_CENTER_RADIUS_METERS;
    const cacheKey = `fast:${origin.lat.toFixed(3)}:${origin.lng.toFixed(3)}:${radiusMeters}`;

    if (!config.force && nearbyFacilityCache.has(cacheKey)) {
      return nearbyFacilityCache.get(cacheKey);
    }

    const requestBody = `data=${encodeURIComponent(buildFastEvacQuery(origin, radiusMeters))}`;
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
          fetchWithTimeout(endpoint, opts, 8000).then((res) => {
            if (!res.ok) throw new Error(`Fast query ${res.status}`);
            return res.json();
          }),
        ),
      );
      const maxKm = (radiusMeters / 1000) * 1.5;
      const places = normalizeEvacuationPlaces(payload.elements || []).filter((p) => haversineKm(origin, p) <= maxKm);
      nearbyFacilityCache.set(cacheKey, places);
      return places;
    } catch {
      return [];
    }
  }

  global.ResqMaps = Object.freeze({
    assessPlaceRisk,
    DEFAULT_LOCATION,
    createAccuracyCircle,
    createBaseMap,
    createCenterMarker,
    createResidentMarker,
    estimateWalkMinutes,
    fetchEvacDataCombined,
    fetchFastEvacPlaces,
    fetchHazardSignalsAround,
    fetchNearbyEvacuationPlaces,
    fitMapToPoints,
    formatAccuracy,
    formatDistance,
    formatLatitude,
    formatLongitude,
    haversineKm,
    invalidateMap,
    loadSavedLocation,
    popupContent,
    requestFastLocation,
    requestLiveLocation,
    resolveUserLocation,
    reverseGeocode,
    saveLocationSnapshot,
    startLocationWatch,
    toShareUrl,
  });
})(window);
