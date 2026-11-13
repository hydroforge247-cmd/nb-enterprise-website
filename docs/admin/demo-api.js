// Practice copy of the staff admin for the GitHub Pages preview: it fakes the server's /api in the browser,
// so staff can be taught on github.io. It switches itself off everywhere else (the real server is used there).
(function () {
  "use strict";
  if (!/\.github\.io$/.test(location.hostname)) return;
  var KEY = "nb-demo-v2", real = window.fetch.bind(window);
  var CATS = ["laptops", "desktops", "monitors", "printers", "network", "peripherals", "multimedia", "storage", "gaming", "pos", "components"];
  var CAT_LABEL = ["Laptops", "Desktop PCs", "Monitors", "Printers & ink", "Wi-Fi & networking", "Keyboards & mice", "Multimedia", "Storage & flash", "Gaming", "Point of sale", "Components & power"];
  var CATS2 = CATS.map(function (c, i) { return [c, CAT_LABEL[i]]; });
  var uid = function () { return Math.random().toString(16).slice(2, 14); };
  var today = function () { return new Date().toLocaleDateString("en-CA"); };
  var str = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n || 200); };
  var isDate = function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + "T12:00")); };
  var money = function (v) { return v === "" || v == null ? null : Math.max(0, Math.round(+v)) || null; };
  var db; try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  var ready = db ? Promise.resolve() : real("../data/seed.json").then(function (r) { return r.json(); }).then(function (s) {
    db = { products: s.products, notice: s.notice || "", users: [{ username: "owner", role: "owner", pass: "ab0511abc" }, { username: "staff", role: "staff", pass: "ab0511abc" }] };
  });
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  function readProduct(d, p) {
    p.name = str(d.name, 120); p.brand = str(d.brand, 40); p.blurb = str(d.blurb, 400);
    p.cat = CATS.indexOf(d.cat) > -1 ? d.cat : ""; p.stock = ["in", "order", "out"].indexOf(d.stock) > -1 ? d.stock : "in";
    p.price = money(d.price); p.was = money(d.was); p.special = !!d.special; p.specialTo = isDate(d.specialTo) ? d.specialTo : "";
    if (!p.name) return "Give the product a name.";
    if (!p.cat) return "Pick a category.";
    if (p.was && p.price && p.was <= p.price) return "The old price should be higher than the new price (or leave it empty).";
    if (d.image) { if (!/^data:image\/(jpeg|png|webp);base64,/.test(d.image)) return "That photo could not be used. Try a JPG or PNG under 4 MB."; p.image = d.image; }
    else if (d.removeImage) p.image = "";
    return null;
  }
  function handle(m, p, d, tok) {
    var seg = p.split("/"), me, pr;
    if (p === "/api/login") { var u = db.users.filter(function (x) { return x.username === str(d.username, 40).toLowerCase(); })[0]; if (!u || u.pass !== str(d.password, 100)) return [401, { error: "Wrong username or password." }]; return [200, { token: "demo." + u.username, username: u.username, role: u.role }]; }
    if (p.indexOf("/api/admin/") !== 0) return [404, { error: "Not found" }];
    me = db.users.filter(function (x) { return "demo." + x.username === tok; })[0]; if (!me) return [401, { error: "Please sign in." }];
    if (p === "/api/admin/me") return [200, { username: me.username, role: me.role }];
    if (p === "/api/admin/products" && m === "GET") return [200, { cats: CATS2, products: db.products, today: today() }];
    if (p === "/api/admin/products" && m === "POST") {
      pr = { id: uid(), image: "" }; var err = readProduct(d, pr); if (err) return [400, { error: err }];
      pr.by = me.username; pr.at = new Date().toISOString(); db.products.unshift(pr); save(); return [201, pr];
    }
    if (seg[3] === "products" && seg[4]) {
      pr = db.products.filter(function (x) { return x.id === seg[4]; })[0]; if (!pr) return [404, { error: "That product is gone." }];
      if (m === "PUT") { var copy = Object.assign({}, pr), e = readProduct(d, copy); if (e) return [400, { error: e }]; Object.assign(pr, copy, { by: me.username, at: new Date().toISOString() }); save(); return [200, pr]; }
      if (m === "PATCH") {
        if (d.stock != null) { if (["in", "order", "out"].indexOf(d.stock) < 0) return [400, { error: "Bad stock value." }]; pr.stock = d.stock; }
        if (d.special != null) pr.special = !!d.special;
        if (d.hidden != null) pr.hidden = !!d.hidden;
        pr.by = me.username; pr.at = new Date().toISOString(); save(); return [200, pr];
      }
      if (m === "DELETE") { db.products = db.products.filter(function (x) { return x !== pr; }); save(); return [200, { ok: true }]; }
    }
    if (p === "/api/admin/notice" && m === "PUT") { db.notice = str(d.notice, 160); save(); return [200, { ok: true }]; }
    if (p === "/api/admin/notice" && m === "GET") return [200, { notice: db.notice }];
    if (me.role !== "owner") return [403, { error: "Owner only." }];
    if (p === "/api/admin/users" && m === "GET") return [200, { users: db.users.map(function (x) { return { username: x.username, role: x.role }; }) }];
    if (p === "/api/admin/users" && m === "POST") {
      var un = str(d.username, 40).toLowerCase(), pw = str(d.password, 100);
      if (!/^[a-z0-9._-]{3,40}$/.test(un) || pw.length < 8) return [400, { error: "Username 3+ letters/numbers; password 8+ characters." }];
      var ex = db.users.filter(function (x) { return x.username === un; })[0]; if (ex) ex.pass = pw; else db.users.push({ username: un, role: "staff", pass: pw });
      save(); return [200, { ok: true }];
    }
    if (seg[3] === "users" && seg[4] && m === "DELETE") { var du = decodeURIComponent(seg[4]); if (du === me.username) return [400, { error: "You cannot remove yourself." }]; db.users = db.users.filter(function (x) { return x.username !== du; }); save(); return [200, { ok: true }]; }
    return [404, { error: "Not found" }];
  }

  window.fetch = function (url, opt) {
    if (typeof url !== "string" || url.indexOf("/api/") !== 0) return real.apply(this, arguments);
    opt = opt || {};
    return ready.then(function () {
      var r = handle((opt.method || "GET").toUpperCase(), url, opt.body ? JSON.parse(opt.body) : {}, ((opt.headers || {}).Authorization || "").replace("Bearer ", ""));
      return new Response(JSON.stringify(r[1]), { status: r[0], headers: { "Content-Type": "application/json" } });
    });
  };

  document.addEventListener("DOMContentLoaded", function () {
    var bar = document.createElement("div");
    bar.style.cssText = "background:#fff3cd;color:#5b4300;font:14px/1.4 system-ui,sans-serif;padding:.6rem 1rem;text-align:center;border-bottom:1px solid #e6cf85";
    bar.innerHTML = "<b>Practice copy.</b> Sign in as <b>owner</b> or <b>staff</b>, password <b>ab0511abc</b>. Nothing here is real and changes stay on this device only. ";
    var b = document.createElement("button"); b.textContent = "Start over"; b.style.cssText = "margin-left:.6rem;padding:.2rem .7rem;border:1px solid #b89400;border-radius:999px;background:#fff;color:#5b4300;cursor:pointer";
    b.onclick = function () { try { localStorage.removeItem(KEY); sessionStorage.clear(); } catch (e) {} location.reload(); };
    bar.appendChild(b); document.body.insertBefore(bar, document.body.firstChild);
  });
})();
