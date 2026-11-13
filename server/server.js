// NB Enterprise: website + product catalogue API + staff admin. No dependencies (Node 20+).
// Run: node server.js   (PORT env var, default 4610). Data: data/db.json, uploaded photos: data/products/
"use strict";
const http = require("http"), fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, ".."), SITE = path.join(ROOT, "site"), ADMIN = path.join(ROOT, "admin");
const DATA = path.join(__dirname, "data"), DB_FILE = path.join(DATA, "db.json"), IMG_DIR = path.join(DATA, "products");
const PORT = +process.env.PORT || 4610;
fs.mkdirSync(IMG_DIR, { recursive: true });

const CATS = [
  ["laptops", "Laptops"], ["desktops", "Desktop PCs"], ["monitors", "Monitors"], ["printers", "Printers & ink"],
  ["network", "Wi-Fi & networking"], ["peripherals", "Keyboards & mice"], ["multimedia", "Multimedia"],
  ["storage", "Storage & flash"], ["gaming", "Gaming"], ["pos", "Point of sale"], ["components", "Components & power"]
];
const CAT_IDS = CATS.map(c => c[0]), STOCK = ["in", "order", "out"];

/* ---------- storage (one JSON file, atomic writes) ---------- */
function hash(pw, salt) { salt = salt || crypto.randomBytes(16).toString("hex"); return salt + ":" + crypto.scryptSync(pw, salt, 32).toString("hex"); }
function check(pw, stored) { const [s, h] = stored.split(":"); const a = Buffer.from(hash(pw, s).split(":")[1], "hex"), b = Buffer.from(h, "hex"); return crypto.timingSafeEqual(a, b); }
let db;
function save() { const t = DB_FILE + ".tmp"; fs.writeFileSync(t, JSON.stringify(db, null, 1)); fs.renameSync(t, DB_FILE); }
function load() {
  if (fs.existsSync(DB_FILE)) { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8").replace(/^﻿/, "")); return; }
  // first run: start from the products on the public seed file (taken from NB's own promo flyers)
  const seed = JSON.parse(fs.readFileSync(path.join(SITE, "data", "seed.json"), "utf8"));
  const pw = crypto.randomBytes(6).toString("base64url");
  db = { products: seed.products, notice: seed.notice || "", users: [{ username: "owner", role: "owner", pass: hash(pw) }] };
  save();
  fs.writeFileSync(path.join(DATA, "FIRST-OWNER-LOGIN.txt"), "Owner login (change it under Staff logins after the first sign-in)\r\nusername: owner\r\npassword: " + pw + "\r\n");
  console.log("First run: owner login written to data/FIRST-OWNER-LOGIN.txt");
}
load();

/* ---------- helpers ---------- */
const sessions = new Map(), fails = new Map();
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain" };
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n || 200);
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + "T12:00"));
const money = v => v === "" || v == null ? null : Math.max(0, Math.round(+v)) || null;
const today = () => new Date().toLocaleDateString("en-CA");
function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); }
function body(req, max) { return new Promise((ok, no) => { let b = ""; req.on("data", c => { b += c; if (b.length > (max || 50000)) { req.destroy(); no(new Error("too big")); } }); req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { no(e); } }); }); }
function who(req) { const t = (req.headers.authorization || "").replace("Bearer ", ""), s = sessions.get(t); if (!s || s.exp < Date.now()) { sessions.delete(t); return null; } return s; }
// a special with an end date drops off the specials row by itself after that date
const onSpecial = p => p.special && (!p.specialTo || p.specialTo >= today());
const pub = p => ({ id: p.id, cat: p.cat, name: p.name, brand: p.brand, price: p.price, was: p.was, blurb: p.blurb, image: p.image, stock: p.stock, special: onSpecial(p), specialTo: p.specialTo });

// photo arrives as a data URL (the admin page shrinks it first); only real JPEG/PNG/WebP bytes are kept
function savePhoto(dataUrl, id) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || ""); if (!m) return null;
  const buf = Buffer.from(m[2], "base64"); if (buf.length > 4e6) return null;
  const ok = m[1] === "jpeg" ? buf[0] === 0xff && buf[1] === 0xd8 : m[1] === "png" ? buf.readUInt32BE(0) === 0x89504e47 : buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP";
  if (!ok) return null;
  const name = id + "-" + crypto.randomBytes(3).toString("hex") + "." + (m[1] === "jpeg" ? "jpg" : m[1]);
  fs.writeFileSync(path.join(IMG_DIR, name), buf); return "/product-img/" + name;
}
// only uploaded photos are deleted; the starter photos in site/img stay
function dropPhoto(url) { const n = /^\/product-img\/([a-f0-9-]+\.(jpg|png|webp))$/.exec(url || ""); if (n) fs.rmSync(path.join(IMG_DIR, n[1]), { force: true }); }
function readProduct(d, p) {
  p.name = str(d.name, 120); p.brand = str(d.brand, 40); p.blurb = str(d.blurb, 400);
  p.cat = CAT_IDS.includes(d.cat) ? d.cat : ""; p.stock = STOCK.includes(d.stock) ? d.stock : "in";
  p.price = money(d.price); p.was = money(d.was); p.special = !!d.special; p.specialTo = isDate(d.specialTo) ? d.specialTo : "";
  if (!p.name) return "Give the product a name.";
  if (!p.cat) return "Pick a category.";
  if (p.was && p.price && p.was <= p.price) return "The old price should be higher than the new price (or leave it empty).";
  if (d.image) { const u = savePhoto(d.image, p.id); if (!u) return "That photo could not be used. Try a JPG or PNG under 4 MB."; dropPhoto(p.image); p.image = u; }
  else if (d.removeImage) { dropPhoto(p.image); p.image = ""; }
  return null;
}

/* ---------- API ---------- */
async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  if (p === "/api/public" && m === "GET") return json(res, 200, { cats: CATS, notice: db.notice, products: db.products.filter(x => !x.hidden).map(pub) });
  if (p === "/api/login" && m === "POST") {
    const ip = req.socket.remoteAddress, f = fails.get(ip) || { n: 0, t: Date.now() };
    if (Date.now() - f.t > 9e5) { f.n = 0; f.t = Date.now(); }
    if (f.n >= 8) return json(res, 429, { error: "Too many tries. Wait 15 minutes." });
    const d = await body(req), u = db.users.find(x => x.username === str(d.username, 40).toLowerCase());
    if (!u || !check(str(d.password, 100), u.pass)) { f.n++; fails.set(ip, f); return json(res, 401, { error: "Wrong username or password." }); }
    const token = crypto.randomBytes(32).toString("hex"); sessions.set(token, { username: u.username, role: u.role, exp: Date.now() + 12 * 36e5 });
    return json(res, 200, { token, username: u.username, role: u.role });
  }
  if (!p.startsWith("/api/admin/")) return json(res, 404, { error: "Not found" });
  const s = who(req); if (!s) return json(res, 401, { error: "Please sign in." });
  const seg = p.split("/");

  if (p === "/api/admin/me") return json(res, 200, { username: s.username, role: s.role });
  if (p === "/api/admin/products" && m === "GET") return json(res, 200, { cats: CATS, products: db.products, today: today() });
  if (p === "/api/admin/products" && m === "POST") {
    if (db.products.length >= 2000) return json(res, 400, { error: "The catalogue is full. Remove old products first." });
    const d = await body(req, 6e6), pr = { id: crypto.randomBytes(6).toString("hex"), image: "" }, err = readProduct(d, pr);
    if (err) { dropPhoto(pr.image); return json(res, 400, { error: err }); }
    pr.by = s.username; pr.at = new Date().toISOString(); db.products.unshift(pr); save(); return json(res, 201, pr);
  }
  if (seg[3] === "products" && seg[4]) {
    const pr = db.products.find(x => x.id === seg[4]); if (!pr) return json(res, 404, { error: "That product is gone." });
    if (m === "PUT") { const d = await body(req, 6e6), copy = { ...pr }, err = readProduct(d, copy); if (err) return json(res, 400, { error: err }); Object.assign(pr, copy, { by: s.username, at: new Date().toISOString() }); save(); return json(res, 200, pr); }
    if (m === "PATCH") { // quick switches from the list: stock, special, hidden
      const d = await body(req);
      if (d.stock != null) { if (!STOCK.includes(d.stock)) return json(res, 400, { error: "Bad stock value." }); pr.stock = d.stock; }
      if (d.special != null) pr.special = !!d.special;
      if (d.hidden != null) pr.hidden = !!d.hidden;
      pr.by = s.username; pr.at = new Date().toISOString(); save(); return json(res, 200, pr);
    }
    if (m === "DELETE") { dropPhoto(pr.image); db.products = db.products.filter(x => x !== pr); save(); return json(res, 200, { ok: true }); }
  }
  if (p === "/api/admin/notice" && m === "PUT") { const d = await body(req); db.notice = str(d.notice, 160); save(); return json(res, 200, { ok: true }); }
  if (p === "/api/admin/notice" && m === "GET") return json(res, 200, { notice: db.notice });

  if (s.role !== "owner") return json(res, 403, { error: "Owner only." });
  if (p === "/api/admin/users" && m === "GET") return json(res, 200, { users: db.users.map(u => ({ username: u.username, role: u.role })) });
  if (p === "/api/admin/users" && m === "POST") {
    const d = await body(req), un = str(d.username, 40).toLowerCase(), pw = str(d.password, 100);
    if (!/^[a-z0-9._-]{3,40}$/.test(un) || pw.length < 8) return json(res, 400, { error: "Username 3+ letters/numbers; password 8+ characters." });
    const ex = db.users.find(u => u.username === un);
    if (ex) ex.pass = hash(pw); else db.users.push({ username: un, role: "staff", pass: hash(pw) });
    save(); return json(res, 200, { ok: true });
  }
  if (seg[3] === "users" && seg[4] && m === "DELETE") {
    const un = decodeURIComponent(seg[4]); if (un === s.username) return json(res, 400, { error: "You cannot remove yourself." });
    db.users = db.users.filter(u => u.username !== un); for (const [t, x] of sessions) if (x.username === un) sessions.delete(t); save(); return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: "Not found" });
}

/* ---------- static files ---------- */
function serve(req, res, url) {
  let rel = decodeURIComponent(url.pathname), base = SITE;
  if (rel === "/admin") { res.writeHead(302, { Location: "/admin/" }); return res.end(); }
  if (rel.startsWith("/admin/")) { base = ADMIN; rel = rel.slice(6); }
  else if (rel.startsWith("/product-img/")) { base = IMG_DIR; rel = rel.slice(12); if (!/^\/[a-f0-9-]+\.(jpg|png|webp)$/.test(rel)) { res.writeHead(404); return res.end("Not found"); } }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(base, rel);
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
  const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": type, "Content-Length": fs.statSync(file).size, "X-Content-Type-Options": "nosniff", "Cache-Control": /html|javascript|css|json/.test(type) ? "no-cache" : "public, max-age=3600" });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try { if (url.pathname.startsWith("/api/")) await api(req, res, url); else serve(req, res, url); }
  catch (e) { console.error(e); if (!res.headersSent) json(res, 500, { error: "Something went wrong." }); else res.end(); }
}).listen(PORT, process.env.HOST || "127.0.0.1", () => console.log("NB Enterprise on port " + PORT));
