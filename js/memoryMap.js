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
    url: element.dataset.url || '#'
  })).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  if (mapCanvas) {
    const lightStyle = 'https://tiles.openfreemap.org/styles/positron';
    const darkStyle = 'https://tiles.openfreemap.org/styles/dark';
    const colorStyle = 'https://tiles.openfreemap.org/styles/bright';
    const isDarkMode = () => document.documentElement.getAttribute('color-mode') === 'dark';
    const initialCenter = points.length ? [points[0].longitude, points[0].latitude] : [0, 20];
    const initialZoom = points.length === 1 ? 5.5 : (points.length ? 2 : 1.5);
    let mapLoaded = false;

    function popupContent(point) {
      const content = document.createElement('div');
      content.className = 'memory-map-popup';

      const title = document.createElement('a');
      title.href = point.url;
      title.textContent = point.title;
      content.appendChild(title);

      if (point.location) {
        const location = document.createElement('span');
        location.textContent = point.location;
        content.appendChild(location);
      }

      if (point.date) {
        const date = document.createElement('time');
        date.dateTime = point.date;
        date.textContent = point.date;
        content.appendChild(date);
      }

      return content;
    }

    try {
      const map = new maplibregl.Map({
        container: mapCanvas,
        style: isDarkMode() ? darkStyle : lightStyle,
        center: initialCenter,
        zoom: initialZoom,
        minZoom: 1.5,
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
        minZoom: 1.5,
        maxZoom: 16,
        attributionControl: false,
        maplibreLogo: false,
        interactive: false
      }) : null;
      let baseMapIdle = false;
      let colorMapIdle = !colorMap;

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
        const masks = points.map((point) => {
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

      const markers = points.map((point) => {
        const markerElement = document.createElement('button');
        markerElement.type = 'button';
        markerElement.className = 'memory-interactive-marker';
        markerElement.setAttribute('aria-label', [point.title, point.location].filter(Boolean).join('，'));

        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: true,
          offset: 18,
          maxWidth: '240px'
        }).setDOMContent(popupContent(point));

        return new maplibregl.Marker({ element: markerElement, anchor: 'center' })
          .setLngLat([point.longitude, point.latitude])
          .setPopup(popup)
          .addTo(colorMap);
      });

      function showAllPlaces(animated) {
        if (!points.length) {
          map.easeTo({ center: [0, 20], zoom: 1.5, duration: animated ? 650 : 0 });
          return;
        }

        if (points.length === 1) {
          map.easeTo({
            center: [points[0].longitude, points[0].latitude],
            zoom: 5.5,
            duration: animated ? 650 : 0
          });
          return;
        }

        const bounds = new maplibregl.LngLatBounds();
        points.forEach((point) => bounds.extend([point.longitude, point.latitude]));
        map.fitBounds(bounds, {
          padding: window.innerWidth < 600 ? 42 : 72,
          maxZoom: 7,
          duration: animated ? 650 : 0
        });
      }

      map.on('load', () => {
        mapLoaded = true;
        mapShell.classList.add('is-interactive');
        requestAnimationFrame(() => {
          map.resize();
          colorMap?.resize();
          showAllPlaces(false);
          syncColorMap();
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
        markers.forEach((marker) => marker.remove());
        colorMap?.remove();
        map.remove();
      }, { once: true });
    } catch (error) {
      mapShell.classList.add('is-fallback-visible');
      console.warn('Interactive Memory map could not be loaded; using the static fallback.', error);
    }
  }
}
