(function () {
  var menuPage = document.querySelector('.menu-index');
  if (!menuPage) return;

  var buttons = Array.prototype.slice.call(menuPage.querySelectorAll('[data-menu-filter-group][data-menu-filter-value]'));
  var cards = Array.prototype.slice.call(menuPage.querySelectorAll('.menu-card'));
  if (!buttons.length) return;

  var selected = { categories: 'all', ingredients: 'all', difficulty: 'all' };
  try {
    var restored = JSON.parse(window.sessionStorage.getItem('menu-filter-restore') || 'null');
    window.sessionStorage.removeItem('menu-filter-restore');
    if (restored) Object.keys(selected).forEach(function (group) {
      var available = buttons.some(function (button) {
        return button.getAttribute('data-menu-filter-group') === group
          && button.getAttribute('data-menu-filter-value') === restored[group];
      });
      if (available) selected[group] = restored[group];
    });
  } catch (error) {
    // Continue with every group set to All if session storage is unavailable.
  }

  function applyFilters() {
    buttons.forEach(function (button) {
      var group = button.getAttribute('data-menu-filter-group');
      var active = button.getAttribute('data-menu-filter-value') === selected[group];
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    cards.forEach(function (card) {
      var matches = Object.keys(selected).every(function (group) {
        var values = JSON.parse(card.getAttribute('data-menu-' + group) || '[]');
        return selected[group] === 'all' || values.indexOf(selected[group]) !== -1;
      });
      card.hidden = !matches;
    });
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      selected[button.getAttribute('data-menu-filter-group')] = button.getAttribute('data-menu-filter-value');
      applyFilters();
    });
  });

  var expandButton = menuPage.querySelector('[data-menu-filter-expand]');
  var ingredientList = menuPage.querySelector('[data-menu-filter-list="ingredients"]');
  if (expandButton && ingredientList) {
    expandButton.addEventListener('click', function () {
      var expanded = ingredientList.classList.toggle('is-expanded');
      expandButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      expandButton.textContent = expanded ? '收起' : '展开';
    });
  }

  applyFilters();
})();
