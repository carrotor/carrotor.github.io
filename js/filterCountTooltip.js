(function () {
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-filter-count]'));
  if (!buttons.length) return;

  var tooltip = document.createElement('span');
  tooltip.className = 'filter-count-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltip);
  var activeButton = null;
  var supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  function positionTooltip(button) {
    var buttonRect = button.getBoundingClientRect();
    var tooltipRect = tooltip.getBoundingClientRect();
    var left = buttonRect.left + buttonRect.width / 2 - tooltipRect.width / 2;
    left = Math.max(6, Math.min(window.innerWidth - tooltipRect.width - 6, left));
    var top = buttonRect.top - tooltipRect.height - 7;
    if (top < 6) top = buttonRect.bottom + 7;
    tooltip.style.left = Math.round(left) + 'px';
    tooltip.style.top = Math.round(top) + 'px';
  }

  function showTooltip(button) {
    activeButton = button;
    tooltip.textContent = button.getAttribute('data-filter-count') || '0';
    tooltip.classList.add('is-visible');
    positionTooltip(button);
  }

  function hideTooltip(button) {
    if (button && activeButton !== button) return;
    activeButton = null;
    tooltip.classList.remove('is-visible');
  }

  buttons.forEach(function (button) {
    if (supportsHover) {
      button.addEventListener('mouseenter', function () { showTooltip(button); });
      button.addEventListener('mouseleave', function () { hideTooltip(button); });
    }
    button.addEventListener('focus', function () {
      if (button.matches(':focus-visible')) showTooltip(button);
    });
    button.addEventListener('blur', function () { hideTooltip(button); });
  });

  window.addEventListener('scroll', function () { hideTooltip(); }, true);
  window.addEventListener('resize', function () { hideTooltip(); });
})();
