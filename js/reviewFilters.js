(function () {
  var reviewPage = document.querySelector('.review-index');
  if (!reviewPage) return;

  var categoryButtons = Array.prototype.slice.call(reviewPage.querySelectorAll('[data-review-category-filter]'));
  var gameFilterContainer = reviewPage.querySelector('.review-game-filters');
  var gameButtons = Array.prototype.slice.call(reviewPage.querySelectorAll('[data-review-game-filter]'));
  var yearButtons = Array.prototype.slice.call(reviewPage.querySelectorAll('[data-review-year-filter]'));
  var reviewEntries = Array.prototype.slice.call(reviewPage.querySelectorAll('[data-review-category][data-review-year]'));
  var coverImages = Array.prototype.slice.call(reviewPage.querySelectorAll('.review-card-cover'));
  var reviewGrid = reviewPage.querySelector('.review-year-entries');
  var pagination = reviewPage.querySelector('.review-pagination');
  var pageNumbers = reviewPage.querySelector('[data-review-page-numbers]');
  var previousPageButton = reviewPage.querySelector('[data-review-page-previous]');
  var nextPageButton = reviewPage.querySelector('[data-review-page-next]');
  var restoreStorageKey = 'review-filter-restore';
  var selectedCategory = 'all';
  var selectedGameCategory = 'all';
  var selectedYear = 'all';
  var currentPage = 1;
  var rowsPerPage = 5;
  var lastPageSize = getColumnCount() * rowsPerPage;
  var resizeTimer;
  var rowHeightTimer;

  function hasFilterValue(buttons, attribute, value) {
    return buttons.some(function (button) {
      return button.getAttribute(attribute) === value;
    });
  }

  try {
    var restoredState = JSON.parse(window.sessionStorage.getItem(restoreStorageKey) || 'null');
    window.sessionStorage.removeItem(restoreStorageKey);
    if (restoredState) {
      if (hasFilterValue(categoryButtons, 'data-review-category-filter', restoredState.category)) {
        selectedCategory = restoredState.category;
      }
      if (hasFilterValue(gameButtons, 'data-review-game-filter', restoredState.gameCategory)) {
        selectedGameCategory = restoredState.gameCategory;
      }
      if (hasFilterValue(yearButtons, 'data-review-year-filter', restoredState.year)) {
        selectedYear = restoredState.year;
      }
      currentPage = Math.max(1, Number(restoredState.page) || 1);
    }
  } catch (error) {
    // Continue with the default filters if session storage is unavailable.
  }

  function updateCoverFit(image) {
    if (!image.naturalWidth || !image.naturalHeight) return;
    image.closest('.review-card-link').classList.add('has-loaded-cover');
  }

  function updateReviewRowHeights() {
    window.cancelAnimationFrame(rowHeightTimer);
    rowHeightTimer = window.requestAnimationFrame(function () {
      var visibleEntries = reviewEntries.filter(function (entry) { return !entry.hidden; });
      var columnCount = getColumnCount();

      reviewEntries.forEach(function (entry) {
        entry.style.removeProperty('--review-row-height');
        entry.style.removeProperty('--review-expanded-height');
      });

      for (var rowStart = 0; rowStart < visibleEntries.length; rowStart += columnCount) {
        var rowEntries = visibleEntries.slice(rowStart, rowStart + columnCount);
        var rowHeight = rowEntries.reduce(function (height, entry) {
          var link = entry.querySelector('.review-card-link');
          return link ? Math.max(height, link.getBoundingClientRect().height) : height;
        }, 0);

        rowEntries.forEach(function (entry) {
          entry.style.setProperty('--review-row-height', rowHeight + 'px');
          if (!entry.classList.contains('has-review')) return;

          var link = entry.querySelector('.review-card-link');
          var overlay = entry.querySelector('.review-card-overlay');
          var review = entry.querySelector('.review-card-review');
          if (!link || !overlay || !review) return;

          var overlayStyle = window.getComputedStyle(overlay);
          var children = Array.prototype.filter.call(overlay.children, function (child) {
            return window.getComputedStyle(child).display !== 'none';
          });
          var contentHeight = children.reduce(function (height, child) {
            return height + (child === review ? review.scrollHeight : child.getBoundingClientRect().height);
          }, 0);
          var gap = parseFloat(overlayStyle.rowGap || overlayStyle.gap) || 0;
          var padding = (parseFloat(overlayStyle.paddingTop) || 0) + (parseFloat(overlayStyle.paddingBottom) || 0);
          var requiredHeight = contentHeight + gap * Math.max(0, children.length - 1) + padding;
          var naturalHeight = link.getBoundingClientRect().height;
          var expandedHeight = Math.min(rowHeight, Math.max(naturalHeight, requiredHeight));
          entry.style.setProperty('--review-expanded-height', expandedHeight + 'px');
        });
      }
    });
  }

  coverImages.forEach(function (image) {
    if (image.complete) updateCoverFit(image);
    image.addEventListener('load', function () {
      updateCoverFit(image);
      updateReviewRowHeights();
    });
  });

  if (window.matchMedia('(hover: none), (pointer: coarse)').matches) {
    reviewEntries.forEach(function (entry) {
      var link = entry.querySelector('.review-card-link');
      if (!link || !entry.classList.contains('has-review')) return;

      link.addEventListener('click', function (event) {
        if (entry.classList.contains('is-review-open')) return;
        event.preventDefault();
        reviewEntries.forEach(function (otherEntry) {
          otherEntry.classList.remove('is-review-open');
        });
        entry.classList.add('is-review-open');
      });
    });

    document.addEventListener('click', function (event) {
      if (event.target.closest('.review-card')) return;
      reviewEntries.forEach(function (entry) {
        entry.classList.remove('is-review-open');
      });
    });
  }

  function updateButtonGroup(buttons, attribute, selectedValue) {
    buttons.forEach(function (button) {
      var active = button.getAttribute(attribute) === selectedValue;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function getColumnCount() {
    if (window.matchMedia('(max-width: 479px)').matches) return 2;
    if (window.matchMedia('(max-width: 699px)').matches) return 3;
    if (window.matchMedia('(max-width: 1099px)').matches) return 4;
    return 6;
  }

  function makePageButton(page) {
    var button = document.createElement('button');
    button.className = 'review-page-button';
    button.type = 'button';
    button.textContent = String(page);
    button.setAttribute('aria-label', 'Page ' + page);
    button.setAttribute('aria-current', page === currentPage ? 'page' : 'false');
    button.classList.toggle('active', page === currentPage);
    button.addEventListener('click', function () {
      currentPage = page;
      applyReviewFilters(true);
    });
    return button;
  }

  function appendPageEllipsis() {
    var ellipsis = document.createElement('span');
    ellipsis.className = 'review-page-ellipsis';
    ellipsis.textContent = '…';
    ellipsis.setAttribute('aria-hidden', 'true');
    pageNumbers.appendChild(ellipsis);
  }

  function updatePagination(totalPages) {
    pagination.hidden = totalPages <= 1;
    pageNumbers.textContent = '';
    previousPageButton.disabled = currentPage <= 1;
    nextPageButton.disabled = currentPage >= totalPages;

    if (totalPages <= 1) return;

    var pageRadius = window.matchMedia('(max-width: 699px)').matches ? 1 : 2;
    var pages = [1, totalPages];
    for (var pageOffset = -pageRadius; pageOffset <= pageRadius; pageOffset++) {
      pages.push(currentPage + pageOffset);
    }
    pages = pages
      .filter(function (page) { return page >= 1 && page <= totalPages; })
      .filter(function (page, index, values) { return values.indexOf(page) === index; })
      .sort(function (a, b) { return a - b; });

    pages.forEach(function (page, index) {
      if (index && page - pages[index - 1] > 1) appendPageEllipsis();
      pageNumbers.appendChild(makePageButton(page));
    });
  }

  function applyReviewFilters(scrollToGrid) {
    reviewEntries.forEach(function (entry) {
      entry.classList.remove('is-review-open');
    });
    var matchingEntries = reviewEntries.filter(function (entry) {
      var matchesCategory = selectedCategory === 'all' || entry.getAttribute('data-review-category') === selectedCategory;
      var matchesGameCategory = selectedCategory !== 'game' || selectedGameCategory === 'all' || entry.getAttribute('data-review-game-category') === selectedGameCategory;
      var matchesYear = selectedYear === 'all' || entry.getAttribute('data-review-year') === selectedYear;
      return matchesCategory && matchesGameCategory && matchesYear;
    });
    var pageSize = getColumnCount() * rowsPerPage;
    var totalPages = Math.max(1, Math.ceil(matchingEntries.length / pageSize));
    currentPage = Math.min(Math.max(currentPage, 1), totalPages);
    var pageStart = (currentPage - 1) * pageSize;
    var visibleEntries = matchingEntries.slice(pageStart, pageStart + pageSize);

    reviewEntries.forEach(function (entry) {
      entry.hidden = visibleEntries.indexOf(entry) === -1;
    });

    updateButtonGroup(categoryButtons, 'data-review-category-filter', selectedCategory);
    updateButtonGroup(gameButtons, 'data-review-game-filter', selectedGameCategory);
    updateButtonGroup(yearButtons, 'data-review-year-filter', selectedYear);
    gameFilterContainer.hidden = selectedCategory !== 'game';
    updatePagination(totalPages);
    lastPageSize = pageSize;
    updateReviewRowHeights();

    if (scrollToGrid) {
      reviewGrid.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
    }
  }

  categoryButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      selectedCategory = button.getAttribute('data-review-category-filter');
      selectedGameCategory = 'all';
      currentPage = 1;
      applyReviewFilters();
    });
  });

  gameButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      selectedGameCategory = button.getAttribute('data-review-game-filter');
      currentPage = 1;
      applyReviewFilters();
    });
  });

  yearButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      selectedYear = button.getAttribute('data-review-year-filter');
      currentPage = 1;
      applyReviewFilters();
    });
  });

  previousPageButton.addEventListener('click', function () {
    if (currentPage <= 1) return;
    currentPage -= 1;
    applyReviewFilters(true);
  });

  nextPageButton.addEventListener('click', function () {
    currentPage += 1;
    applyReviewFilters(true);
  });

  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(function () {
      var pageSize = getColumnCount() * rowsPerPage;
      if (pageSize === lastPageSize) return;
      var firstVisibleIndex = (currentPage - 1) * lastPageSize;
      currentPage = Math.floor(firstVisibleIndex / pageSize) + 1;
      applyReviewFilters();
    }, 120);
  });

  applyReviewFilters();
})();
