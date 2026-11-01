(function () {
  var globalStorageName = 'hexo-blog-encrypt:#global';
  var pageStorageName = 'hexo-blog-encrypt:#' + window.location.pathname;
  var lock = document.querySelector('#hexo-blog-encrypt');
  if (!lock) return;

  try {
    var rememberedKey = window.localStorage.getItem(globalStorageName);
    if (rememberedKey && !window.localStorage.getItem(pageStorageName)) {
      window.localStorage.setItem(pageStorageName, rememberedKey);
      window.location.reload();
      return;
    }
  } catch (error) {
    // The password field remains available when local storage is unavailable.
  }

  var unlockObserver;

  function activateProtectedScripts() {
    lock.querySelectorAll('script:not([data-site-lock-script-active])').forEach(function (oldScript) {
      if (oldScript.id === 'hbeData' || oldScript.type === 'hbeData') return;

      var activeScript = document.createElement('script');
      Array.prototype.forEach.call(oldScript.attributes, function (attribute) {
        activeScript.setAttribute(attribute.name, attribute.value);
      });
      activeScript.setAttribute('data-site-lock-script-active', 'true');
      activeScript.textContent = oldScript.textContent;
      oldScript.replaceWith(activeScript);
    });
  }

  function markUnlocked() {
    if (!lock.querySelector('.hbe-button')) return false;
    lock.classList.add('site-lock-unlocked');
    activateProtectedScripts();
    if (unlockObserver) unlockObserver.disconnect();
    return true;
  }

  if (!markUnlocked()) {
    unlockObserver = new MutationObserver(markUnlocked);
    unlockObserver.observe(lock, { childList: true, subtree: true });
  }

  window.addEventListener('hexo-blog-decrypt', function () {
    markUnlocked();

    var attempts = 0;
    var rememberUnlock = function () {
      try {
        var pageKey = window.localStorage.getItem(pageStorageName);
        if (pageKey) {
          window.localStorage.setItem(globalStorageName, pageKey);
          return;
        }
      } catch (error) {
        // Remembering the unlock is optional when local storage is unavailable.
        return;
      }

      attempts += 1;
      if (attempts < 10) window.setTimeout(rememberUnlock, 100);
    };

    rememberUnlock();
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.hbe-button')) return;
    try {
      window.localStorage.removeItem(globalStorageName);
    } catch (error) {
      // The current page can still relock without local storage.
    }
  }, true);
})();
