(function () {
  // Click-to-play facade for every YouTube embed on the page (hero trailer + THE FEED shorts).
  // Loads the YouTube iframe only on click — nothing autoplays on page load.
  function play(btn) {
    var id = btn.getAttribute('data-id');
    if (!id) return;
    var src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    if (btn.getAttribute('data-loop')) src += '&loop=1&playlist=' + id;
    var ifr = document.createElement('iframe');
    ifr.src = src;
    ifr.title = btn.getAttribute('aria-label') || 'SCRUMBAG video';
    ifr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    ifr.setAttribute('allowfullscreen', '');
    ifr.setAttribute('frameborder', '0');
    btn.replaceWith(ifr);
    ifr.tabIndex = -1; ifr.focus();
  }
  document.querySelectorAll('.lite-yt[data-id]').forEach(function (btn) {
    btn.addEventListener('click', function () { play(btn); });
  });
})();
