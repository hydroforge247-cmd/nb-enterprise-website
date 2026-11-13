(function () {
  "use strict";
  var WA = "27762141596";
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var rand = function (n) { return "R" + Number(n).toLocaleString("en-ZA"); };
  var STOCK = { in: ["In stock", "in"], order: ["On order, ask us", "order"], out: ["Out of stock", "out"] };
  var state = { cat: "all", q: "", data: null };
  // drawn stand-ins for products that have no photo yet (line icons, one per kind)
  var ICON = {
    laptops: '<svg viewBox="0 0 48 48"><rect x="10" y="10" width="28" height="19" rx="2"/><path d="M5 34h38l-3 4H8z"/></svg>',
    desktops: '<svg viewBox="0 0 48 48"><rect x="6" y="8" width="24" height="18" rx="2"/><path d="M14 32h8M18 26v6"/><rect x="33" y="8" width="9" height="26" rx="1.5"/><path d="M36 13h3M36 17h3"/></svg>',
    monitors: '<svg viewBox="0 0 48 48"><rect x="6" y="8" width="36" height="24" rx="2"/><path d="M18 40h12M24 32v8"/></svg>',
    other: '<svg viewBox="0 0 48 48"><rect x="10" y="10" width="28" height="28" rx="3"/><path d="M18 18h12v12H18z"/></svg>'
  };
  document.getElementById("yr").textContent = new Date().getFullYear();

  // live catalogue from the shop's server; the static preview falls back to the starter list
  fetch("/api/public").then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .catch(function () { return fetch("data/seed.json").then(function (r) { return r.json(); }).then(function (s) { return { cats: FALLBACK_CATS, notice: s.notice, products: s.products }; }); })
    .then(function (d) { state.data = d; draw(); })
    .catch(function () { document.getElementById("grid").innerHTML = '<p class="empty">The product list could not load. Please call us on 018 294 4382.</p>'; });

  var FALLBACK_CATS = [["laptops", "Laptops"], ["desktops", "Desktop PCs"], ["monitors", "Monitors"], ["printers", "Printers & ink"], ["network", "Wi-Fi & networking"], ["peripherals", "Keyboards & mice"], ["multimedia", "Multimedia"], ["storage", "Storage & flash"], ["gaming", "Gaming"], ["pos", "Point of sale"], ["components", "Components & power"]];

  // no photo yet: the key specs become the face of the card instead of an empty picture
  function specFace(p) {
    var specs = String(p.blurb || "").split(/s*·s*/).filter(Boolean).slice(0, 3);
    if (!specs.length) return ICON[p.cat] || ICON.other;
    return '<div class="spec"><span class="spec__icon">' + (ICON[p.cat] || ICON.other) + "</span><ul>" + specs.map(function (s) { return "<li>" + esc(s.replace(/.$/, "")) + "</li>"; }).join("") + "</ul></div>";
  }
  function card(p, showTag) {
    var ask = "https://wa.me/" + WA + "?text=" + encodeURIComponent("Hi NB Enterprise, is the " + p.name + (p.price ? " (" + rand(p.price) + ")" : "") + " in stock?");
    var st = STOCK[p.stock] || STOCK.in;
    return '<article class="card">' + (showTag && p.special ? '<span class="tag">Special</span>' : "") +
      '<div class="card__img">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' : specFace(p)) + "</div>" +
      (p.brand ? '<span class="card__brand">' + esc(p.brand) + "</span>" : "") +
      '<h3 class="card__name">' + esc(p.name) + "</h3>" + (p.blurb ? '<p class="card__blurb">' + esc(p.blurb) + "</p>" : "") +
      '<span class="stock stock--' + st[1] + '">' + st[0] + "</span>" +
      '<div class="card__foot">' + (p.price ? '<span class="price">' + (p.was ? "<s>" + rand(p.was) + "</s>" : "") + rand(p.price) + "</span>" : '<span class="price price--ask">Ask for price</span>') +
      '<a class="ask" href="' + ask + '" target="_blank" rel="noopener" aria-label="Ask about ' + esc(p.name) + ' on WhatsApp">Ask</a></div></article>';
  }

  function draw() {
    var d = state.data, specials = d.products.filter(function (p) { return p.special; });
    var n = document.getElementById("notice"); if (d.notice) { n.textContent = d.notice; n.hidden = false; }
    // specials row (hidden when there are none)
    document.getElementById("specials").hidden = !specials.length;
    document.getElementById("rail").innerHTML = specials.map(function (p) { return card(p, false); }).join("");
    // three specials fanned out in the hero
    document.getElementById("deck").innerHTML = specials.filter(function (p) { return p.image; }).slice(0, 3).map(function (p) {
      return '<div class="dcard"><img src="' + esc(p.image) + '" alt=""><b>' + (p.price ? rand(p.price) : "") + "<small>" + esc(p.name) + "</small></b></div>";
    }).join("");
    // category chips with counts
    var counts = {}; d.products.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });
    document.getElementById("chips").innerHTML = '<button data-c="all" aria-pressed="' + (state.cat === "all") + '">All<small>' + d.products.length + "</small></button>" +
      d.cats.filter(function (c) { return counts[c[0]]; }).map(function (c) { return '<button data-c="' + c[0] + '" aria-pressed="' + (state.cat === c[0]) + '">' + esc(c[1]) + (counts[c[0]] ? "<small>" + counts[c[0]] + "</small>" : "") + "</button>"; }).join("");
    list(); setTimeout(syncBar, 0);
  }
  function list() {
    var d = state.data, q = state.q.toLowerCase().trim();
    var items = d.products.filter(function (p) { return (state.cat === "all" || p.cat === state.cat) && (!q || (p.name + " " + p.brand + " " + p.blurb).toLowerCase().indexOf(q) > -1); });
    var catName = (d.cats.filter(function (c) { return c[0] === state.cat; })[0] || [])[1];
    document.getElementById("grid").innerHTML = items.length ? items.map(function (p) { return card(p, true); }).join("") :
      '<p class="empty">' + (q ? "Nothing matches “" + esc(state.q) + "”." : "Nothing listed under " + esc(catName) + " right now.") + ' We stock far more than we list, so <a href="https://wa.me/' + WA + "?text=" + encodeURIComponent("Hi NB Enterprise, do you have " + (q || catName || "")) + '" target="_blank" rel="noopener">ask us on WhatsApp</a>.</p>';
  }
  document.getElementById("chips").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    state.cat = b.dataset.c; [].forEach.call(this.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); }); list();
  });
  /* specials row controls: arrows move one screen, the bar follows (and drives) the scroll */
  var rail = document.getElementById("rail"), rbar = document.getElementById("rbar"), rprev = document.getElementById("rprev"), rnext = document.getElementById("rnext");
  var maxScroll = function () { return Math.max(0, rail.scrollWidth - rail.clientWidth); };
  function syncBar() { var m = maxScroll(); rbar.value = m ? Math.round(rail.scrollLeft / m * 1000) : 0; rprev.disabled = rail.scrollLeft < 8; rnext.disabled = rail.scrollLeft > m - 8; }
  rail.addEventListener("scroll", syncBar, { passive: true }); addEventListener("resize", syncBar);
  rbar.addEventListener("input", function () { rail.scrollLeft = rbar.value / 1000 * maxScroll(); });
  rprev.addEventListener("click", function () { rail.scrollBy({ left: -rail.clientWidth * 0.8, behavior: "smooth" }); });
  rnext.addEventListener("click", function () { rail.scrollBy({ left: rail.clientWidth * 0.8, behavior: "smooth" }); });

  /* light / dark switch for everyone; first visit follows the phone or PC setting */
  var look = (new URLSearchParams(location.search).get("look")) || (function () { try { return localStorage.getItem("nb-look"); } catch (e) { return null; } })() || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "royal");
  function setLook(l) { document.documentElement.setAttribute("data-look", l); [].forEach.call(document.querySelectorAll(".looks button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.look === l)); }); try { localStorage.setItem("nb-look", l); } catch (e) {} }
  document.querySelector(".looks").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setLook(b.dataset.look); });
  setLook(look);
  // the third look, "Clean", is only for the owner to compare (?preview=1)
  var preview = /[?&]preview=1/.test(location.search) || (function () { try { return localStorage.getItem("nb-preview") === "1"; } catch (e) { return false; } })();
  if (preview) { document.querySelector(".looks [data-look=clean]").hidden = false; try { localStorage.setItem("nb-preview", "1"); } catch (e) {} }

  document.getElementById("q").addEventListener("input", function () { state.q = this.value; list(); });
})();

/* Microstar tower: close the glass once when the band comes into view, then leave it */
(function () {
  var t = document.querySelector(".tower"); if (!t) return;
  if (!("IntersectionObserver" in window)) { t.classList.add("in"); return; }
  var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { t.classList.add("in"); io.disconnect(); } }, { threshold: 0.45 });
  io.observe(t);
})();
