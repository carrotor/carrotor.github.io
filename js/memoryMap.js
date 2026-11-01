import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl.mjs';

const mapShell = document.querySelector('[data-memory-map]');

if (mapShell) {
  const mapCanvas = mapShell.querySelector('[data-memory-map-canvas]');
  const colorMapCanvas = mapShell.querySelector('[data-memory-map-color-canvas]');
  const resetButton = mapShell.querySelector('[data-memory-map-reset]');
  const points = Array.from(mapShell.querySelectorAll('[data-memory-point]')).map((element) => ({
    latitude: Number(element.dataset.latitude),
    longitude: Number(element.dataset.longitude),
    title: element.dataset.title || '',
    location: element.dataset.location || '',
    date: element.dataset.date || '',
    url: element.dataset.url || '#',
    kind: element.dataset.kind === 'discovery' ? 'discovery' : 'travel'
  })).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  const filterButtons = Array.from(document.querySelectorAll('[data-memory-filter]'));
  const staticMarkers = Array.from(mapShell.querySelectorAll('[data-memory-kind]'));
  const contentSections = Array.from(document.querySelectorAll('[data-memory-section]'));
  const discoveryFilterButtons = Array.from(document.querySelectorAll('[data-discovery-filter-group][data-discovery-filter-value]'));
  const discoveryCards = Array.from(document.querySelectorAll('.memory-discovery-card'));
  const discoverySelection = { category: 'all', location: 'all' };
  const reader = document.querySelector('[data-memory-reader]');
  const readerBackdrop = document.querySelector('[data-memory-reader-backdrop]');
  const readerFrame = reader?.querySelector('[data-memory-reader-frame]');
  const readerTitle = reader?.querySelector('[data-memory-reader-title]');
  const readerOpenLink = reader?.querySelector('[data-memory-reader-open]');
  const readerLoading = reader?.querySelector('[data-memory-reader-loading]');
  const readerDesktop = window.matchMedia('(min-width: 900px)');
  let activeKind = 'all';
  let markerRecords = [];
  let showAllPlaces = () => {};
  let renderMapMarkers = () => {};
  let readerIsOpen = false;
  let readerLoadingTimer = 0;

  function finishReaderLoading() {
    window.clearTimeout(readerLoadingTimer);
    readerLoadingTimer = 0;
    if (readerLoading) readerLoading.hidden = true;
  }

  function hideReader(fromHistory) {
    if (!reader || !readerIsOpen) return;
    finishReaderLoading();
    readerIsOpen = false;
    document.body.classList.remove('memory-reader-open');
    reader.setAttribute('aria-hidden', 'true');
    reader.inert = true;
    readerBackdrop?.setAttribute('aria-hidden', 'true');
    if (readerFrame) readerFrame.src = 'about:blank';
    if (!fromHistory && window.history.state?.memoryReader) window.history.back();
  }

  function showReader(link) {
    if (!reader || !readerFrame || !readerDesktop.matches) return false;
    const articleUrl = new URL(link.href, window.location.href);
    const embeddedUrl = new URL(articleUrl.href);
    embeddedUrl.searchParams.set('memory-drawer', '1');
    const title = link.dataset.memoryReaderTitle || link.textContent.trim() || 'Memory';

    if (readerTitle) readerTitle.textContent = title;
    if (readerOpenLink) readerOpenLink.href = articleUrl.href;
    if (readerLoading) {
      readerLoading.hidden = false;
      window.clearTimeout(readerLoadingTimer);
      readerLoadingTimer = window.setTimeout(finishReaderLoading, 1800);
    }
    readerFrame.title = title;
    readerFrame.src = embeddedUrl.href;
    readerIsOpen = true;
    reader.inert = false;
    reader.setAttribute('aria-hidden', 'false');
    readerBackdrop?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('memory-reader-open');
    if (!window.history.state?.memoryReader) {
      window.history.pushState({ memoryReader: true }, '', window.location.href);
    }
    reader.querySelector('[data-memory-reader-close]')?.focus();
    return true;
  }

  // MapLibre stops click events inside popup content before they bubble to the
  // document. Listen during capture so popup article links still open in the
  // desktop reader, while mobile links keep their normal navigation.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-memory-reader-link]');
    if (!link || !showReader(link)) return;
    event.preventDefault();
  }, true);
  reader?.querySelector('[data-memory-reader-close]')?.addEventListener('click', () => hideReader(false));
  readerBackdrop?.addEventListener('click', () => hideReader(false));
  readerFrame?.addEventListener('load', finishReaderLoading);
  window.addEventListener('popstate', () => hideReader(true));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && readerIsOpen) hideReader(false);
  });
  readerDesktop.addEventListener('change', (event) => {
    if (!event.matches && readerIsOpen) hideReader(false);
  });

  const visiblePoints = () => points.filter((point) => activeKind === 'all' || point.kind === activeKind);

  function applyFilter(kind) {
    activeKind = kind === 'discovery' || kind === 'travel' ? kind : 'all';
    filterButtons.forEach((button) => {
      const active = button.dataset.memoryFilter === activeKind;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    contentSections.forEach((section) => {
      section.hidden = activeKind !== 'all' && section.dataset.memorySection !== activeKind;
    });
    staticMarkers.forEach((marker) => {
      marker.hidden = activeKind !== 'all' && marker.dataset.memoryKind !== activeKind;
    });
    renderMapMarkers();
    if (resetButton) resetButton.hidden = visiblePoints().length === 0;
    showAllPlaces(true);
  }

  filterButtons.forEach((button) => button.addEventListener('click', () => applyFilter(button.dataset.memoryFilter)));

  function applyDiscoveryFilters() {
    discoveryFilterButtons.forEach((button) => {
      const group = button.dataset.discoveryFilterGroup;
      const active = button.dataset.discoveryFilterValue === discoverySelection[group];
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    discoveryCards.forEach((card) => {
      const matches = Object.keys(discoverySelection).every((group) => {
        const values = JSON.parse(card.getAttribute(`data-discovery-${group}`) || '[]');
        return discoverySelection[group] === 'all' || values.includes(discoverySelection[group]);
      });
      card.hidden = !matches;
    });
  }

  discoveryFilterButtons.forEach((button) => button.addEventListener('click', () => {
    discoverySelection[button.dataset.discoveryFilterGroup] = button.dataset.discoveryFilterValue;
    applyDiscoveryFilters();
  }));
  applyDiscoveryFilters();

  if (mapCanvas) {
    const lightStyle = 'https://tiles.openfreemap.org/styles/positron';
    const darkStyle = 'https://tiles.openfreemap.org/styles/dark';
    const colorStyle = 'https://tiles.openfreemap.org/styles/bright';
    const isDarkMode = () => document.documentElement.getAttribute('color-mode') === 'dark';
    const minimumZoom = window.innerWidth < 600 ? 1 : 1.5;
    const initialCenter = points.length ? [points[0].longitude, points[0].latitude] : [0, 20];
    const initialZoom = points.length === 1 ? 5.5 : (points.length ? (window.innerWidth < 600 ? 1.2 : 2) : minimumZoom);
    let mapLoaded = false;

    function popupContent(clusterPoints) {
      const content = document.createElement('div');
      content.className = `memory-map-popup${clusterPoints.length > 1 ? ' memory-map-popup-cluster' : ''}`;

      if (clusterPoints.length > 1) {
        const count = document.createElement('strong');
        count.className = 'memory-map-popup-count';
        count.textContent = `${clusterPoints.length} 篇回忆`;
        content.appendChild(count);
      }

      clusterPoints.forEach((point) => {
        const item = document.createElement('div');
        item.className = 'memory-map-popup-item';

        const title = document.createElement('a');
        title.href = point.url;
        title.textContent = point.title;
        title.dataset.memoryReaderLink = '';
        title.dataset.memoryReaderTitle = point.title;
        item.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'memory-map-popup-meta';
        if (point.location) {
          const location = document.createElement('span');
          location.textContent = point.location;
          meta.appendChild(location);
        }

        if (point.date) {
          const date = document.createElement('time');
          date.dateTime = point.date;
          date.textContent = point.date;
          meta.appendChild(date);
        }
        if (meta.childNodes.length) item.appendChild(meta);
        content.appendChild(item);
      });

      return content;
    }

    try {
      const map = new maplibregl.Map({
        container: mapCanvas,
        style: isDarkMode() ? darkStyle : lightStyle,
        center: initialCenter,
        zoom: initialZoom,
        minZoom: minimumZoom,
        maxZoom: 16,
        attributionControl: false,
        maplibreLogo: false,
        cooperativeGestures: false
      });

      const colorMap = colorMapCanvas && points.length ? new maplibregl.Map({
        container: colorMapCanvas,
        style: colorStyle,
        center: initialCenter,
        zoom: initialZoom,
        minZoom: minimumZoom,
        maxZoom: 16,
        attributionControl: false,
        maplibreLogo: false,
        interactive: false
      }) : null;
      let baseMapIdle = false;
      let colorMapIdle = !colorMap;
      let gestureStartZoom = null;

      function clampZoom(value) {
        return Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), value));
      }

      function zoomAroundPointer(zoom, clientX, clientY) {
        const bounds = mapCanvas.getBoundingClientRect();
        const around = map.unproject([
          clientX - bounds.left,
          clientY - bounds.top
        ]);
        map.zoomTo(clampZoom(zoom), { around, duration: 0 });
      }

      function handleTrackpadPinch(event) {
        if (!event.ctrlKey) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const delta = Math.max(-0.5, Math.min(0.5, -event.deltaY * 0.01));
        zoomAroundPointer(map.getZoom() + delta, event.clientX, event.clientY);
      }

      function handleGestureStart(event) {
        event.preventDefault();
        gestureStartZoom = map.getZoom();
      }

      function handleGestureChange(event) {
        if (gestureStartZoom == null) return;
        event.preventDefault();
        zoomAroundPointer(gestureStartZoom + Math.log2(Number(event.scale) || 1), event.clientX, event.clientY);
      }

      function handleGestureEnd(event) {
        event.preventDefault();
        gestureStartZoom = null;
      }

      mapCanvas.addEventListener('wheel', handleTrackpadPinch, { passive: false, capture: true });
      mapCanvas.addEventListener('gesturestart', handleGestureStart, { passive: false });
      mapCanvas.addEventListener('gesturechange', handleGestureChange, { passive: false });
      mapCanvas.addEventListener('gestureend', handleGestureEnd, { passive: false });

      function revealMapWhenReady() {
        if (baseMapIdle && colorMapIdle) mapShell.classList.add('is-ready');
      }

      if (!colorMap && colorMapCanvas) colorMapCanvas.hidden = true;
      if (!points.length && resetButton) resetButton.hidden = true;

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

      function updateColorMask() {
        if (!colorMap || !colorMapCanvas) return;
        const radius = Math.min(380, Math.max(90, 155 * Math.pow(2, (map.getZoom() - 5.5) * 0.35)));
        const masks = visiblePoints().map((point) => {
          const pixel = map.project([point.longitude, point.latitude]);
          return `radial-gradient(circle ${radius.toFixed(1)}px at ${pixel.x.toFixed(1)}px ${pixel.y.toFixed(1)}px, #000 0%, #000 60%, rgb(0 0 0 / 92%) 72%, rgb(0 0 0 / 45%) 88%, transparent 100%)`;
        });

        const maskImage = masks.join(', ');
        colorMapCanvas.style.maskImage = maskImage;
        colorMapCanvas.style.webkitMaskImage = maskImage;
        colorMapCanvas.style.maskComposite = masks.map(() => 'add').join(', ');
        colorMapCanvas.style.webkitMaskComposite = masks.map(() => 'source-over').join(', ');
      }

      function syncColorMap() {
        if (!colorMap) return;
        const center = map.getCenter();
        colorMap.jumpTo({
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch()
        });
        updateColorMask();
      }

      map.on('move', syncColorMap);
      map.on('resize', syncColorMap);
      colorMap?.on('load', () => {
        colorMap.resize();
        syncColorMap();
      });
      colorMap?.once('idle', () => {
        colorMapIdle = true;
        revealMapWhenReady();
      });

      function clustersForCurrentView(clusterPoints) {
        const threshold = window.innerWidth < 600 ? 38 : 44;
        const projected = clusterPoints.map((point) => ({
          point,
          pixel: map.project([point.longitude, point.latitude])
        }));
        const parents = projected.map((_, index) => index);
        function root(index) {
          while (parents[index] !== index) {
            parents[index] = parents[parents[index]];
            index = parents[index];
          }
          return index;
        }
        function join(first, second) {
          const firstRoot = root(first);
          const secondRoot = root(second);
          if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot;
        }
        projected.forEach((first, firstIndex) => {
          for (let secondIndex = firstIndex + 1; secondIndex < projected.length; secondIndex += 1) {
            const second = projected[secondIndex];
            if (Math.hypot(first.pixel.x - second.pixel.x, first.pixel.y - second.pixel.y) <= threshold) {
              join(firstIndex, secondIndex);
            }
          }
        });
        const groups = new Map();
        projected.forEach(({ point }, index) => {
          const key = root(index);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(point);
        });
        return Array.from(groups.values());
      }

      renderMapMarkers = function () {
        markerRecords.forEach(({ marker }) => marker.remove());
        markerRecords = [];
        if (!colorMap) return;

        markerRecords = clustersForCurrentView(visiblePoints()).map((clusterPoints) => {
          const isCluster = clusterPoints.length > 1;
          const markerElement = document.createElement('button');
          markerElement.type = 'button';
          markerElement.className = `memory-interactive-marker${isCluster ? ' memory-interactive-marker-cluster' : ` memory-interactive-marker-${clusterPoints[0].kind}`}`;
          if (isCluster) {
            const count = document.createElement('span');
            count.className = 'memory-interactive-marker-count';
            count.textContent = String(clusterPoints.length);
            markerElement.appendChild(count);
          }
          markerElement.setAttribute('aria-label', isCluster
            ? `此区域有 ${clusterPoints.length} 篇回忆`
            : [clusterPoints[0].title, clusterPoints[0].location].filter(Boolean).join('，'));

          const popup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: true,
            offset: isCluster ? 22 : 18,
            maxWidth: isCluster ? '320px' : '240px'
          }).setDOMContent(popupContent(clusterPoints));

          // The Bright map is clipped by the soft circular color mask. Move an
          // opened popup outside that masked canvas so its card stays crisp.
          popup.on('open', () => {
            const popupElement = popup.getElement();
            if (popupElement) mapShell.appendChild(popupElement);
          });

          const longitude = clusterPoints.reduce((sum, point) => sum + point.longitude, 0) / clusterPoints.length;
          const latitude = clusterPoints.reduce((sum, point) => sum + point.latitude, 0) / clusterPoints.length;
          const marker = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
            .setLngLat([longitude, latitude])
            .setPopup(popup)
            .addTo(colorMap);
          return { marker, element: markerElement, points: clusterPoints };
        });
      };

      map.on('moveend', renderMapMarkers);
      map.on('resize', renderMapMarkers);
      colorMap?.on('load', renderMapMarkers);

      showAllPlaces = function (animated) {
        const shownPoints = visiblePoints();
        if (!shownPoints.length) {
          map.easeTo({ center: [0, 20], zoom: minimumZoom, duration: animated ? 650 : 0 });
          updateColorMask();
          return;
        }

        if (shownPoints.length === 1) {
          map.easeTo({
            center: [shownPoints[0].longitude, shownPoints[0].latitude],
            zoom: 5.5,
            duration: animated ? 650 : 0
          });
          return;
        }

        const bounds = new maplibregl.LngLatBounds();
        shownPoints.forEach((point) => bounds.extend([point.longitude, point.latitude]));
        map.fitBounds(bounds, {
          padding: window.innerWidth < 600 ? 30 : 72,
          maxZoom: 7,
          duration: animated ? 650 : 0
        });
      };

      map.on('load', () => {
        mapLoaded = true;
        mapShell.classList.add('is-interactive');
        requestAnimationFrame(() => {
          map.resize();
          colorMap?.resize();
          showAllPlaces(false);
          syncColorMap();
          renderMapMarkers();
        });
      });

      map.once('idle', () => {
        baseMapIdle = true;
        revealMapWhenReady();
        mapCanvas.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      });

      resetButton?.addEventListener('click', () => showAllPlaces(true));

      const colorModeObserver = new MutationObserver(() => {
        if (!mapLoaded) return;
        map.setStyle(isDarkMode() ? darkStyle : lightStyle);
      });
      colorModeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['color-mode'] });

      window.addEventListener('pagehide', () => {
        colorModeObserver.disconnect();
        mapCanvas.removeEventListener('wheel', handleTrackpadPinch, { capture: true });
        mapCanvas.removeEventListener('gesturestart', handleGestureStart);
        mapCanvas.removeEventListener('gesturechange', handleGestureChange);
        mapCanvas.removeEventListener('gestureend', handleGestureEnd);
        markerRecords.forEach(({ marker }) => marker.remove());
        colorMap?.remove();
        map.remove();
      }, { once: true });
    } catch (error) {
      mapShell.classList.add('is-fallback-visible');
      console.warn('Interactive Memory map could not be loaded; using the static fallback.', error);
    }
  }
}
