(function () {
  // Hero trailer: lightweight click-to-play facade (loads YouTube only on click).
  var btn = document.getElementById('heroTrailer');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var id = btn.getAttribute('data-id');
    var ifr = document.createElement('iframe');
    ifr.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    ifr.title = 'SCRUMBAG trailer';
    ifr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    ifr.setAttribute('allowfullscreen', '');
    ifr.setAttribute('frameborder', '0');
    btn.replaceWith(ifr);
  });
})();
