# NB Enterprise website

Built 2026-11-13 by NFC Software Solutions to replace nbe.co.za.

- `site/` public website (index.html, style.css, app.js). Products load from the server; `site/data/seed.json` is the starter catalogue (15 products from NB's November promo flyers) and the fallback for a static preview.
- `admin/` staff page at /admin/ (also linked as "Staff login" in the footer): add/edit/remove products with photo, price, old price, stock, Specials flag with optional end date, hide/show; one-line shop notice; owner manages staff logins.
- `server/server.js` Node 20+, no dependencies, port 4610. Data in `server/data/db.json`, uploaded photos in `server/data/products/`. The first owner login is written to `server/data/FIRST-OWNER-LOGIN.txt` on first run.
- `work/` source material from the old site (not part of the website).

Run: double-click "Start NB Enterprise.bat" (or the desktop shortcut "NB Enterprise - START").
Hosting: needs an always-on Node host for the staff page. A static copy (site only) can preview the design but staff changes won't save there.
