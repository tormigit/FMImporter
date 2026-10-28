// Cloudflare Web Analytics: counts visits without cookies (see projectDashboard/NEW-WEBSITE.md).
// Loaded after the page, so it never delays the main image, and only on the live addresses, so deploy previews and
// local tests are not counted.
(function () {
  if (["fmimporter.netlify.app","seljenes.no","www.seljenes.no"].indexOf(location.hostname) < 0) return;
  addEventListener('load', function () {
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', '{"token": "2d7176814fb141279fa18a6197b84c08"}');
    document.body.appendChild(s);
  });
})();
