(function () {
  function initializeArchiveTags() {
    var archive = document.querySelector('.archives');
    if (!archive || archive.dataset.tagFilterReady === 'true') return;

    archive.dataset.tagFilterReady = 'true';
    var activeTag = '';

    function applyFilter() {
      var items = Array.prototype.slice.call(archive.querySelectorAll('.post-item[data-archive-year]'));
      var yearHasVisiblePost = {};

      items.forEach(function (item) {
        var itemTags = [];
        try {
          itemTags = JSON.parse(decodeURIComponent(item.dataset.tags || '%5B%5D'));
        } catch (error) {
          itemTags = [];
        }
        var matches = !activeTag || itemTags.indexOf(activeTag) !== -1;

        item.hidden = !matches;
        if (matches) yearHasVisiblePost[item.dataset.archiveYear] = true;
      });

      archive.querySelectorAll('.content-title[data-archive-year]').forEach(function (heading) {
        heading.hidden = !yearHasVisiblePost[heading.dataset.archiveYear];
      });

      archive.querySelectorAll('.archive-tag-filter').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.tag === activeTag));
      });
    }

    archive.addEventListener('click', function (event) {
      var button = event.target.closest('.archive-tag-filter');
      if (!button || !archive.contains(button)) return;

      activeTag = activeTag === button.dataset.tag ? '' : button.dataset.tag;
      applyFilter();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeArchiveTags);
  } else {
    initializeArchiveTags();
  }

  window.addEventListener('hexo-blog-decrypt', initializeArchiveTags);
})();
