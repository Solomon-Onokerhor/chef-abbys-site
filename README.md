# Chef Abbys — story site (concept)

A scroll-driven story site for Ghanaian chef Chef Abbys: a WebGL "simmering jollof" hero, a manifesto, his journey, press "receipts", a UK tour, a passport map of the places he has cooked, a menu, and a booking form.

Built as a portfolio concept piece. Plain HTML, CSS and JavaScript, no build step.

## Run it locally

You need any static file server. With Python installed:

```bash
cd chef-abbys-site
python -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` directly from the file system mostly works, but serving it is closer to how it behaves live.

## What's in here

```
index.html   all content and section markup
styles.css   all styling (desktop first, phone rules in the @media blocks at the end)
script.js    smooth scroll, animations, the WebGL hero, pinned sections, the passport map, booking form
images/      dishes/, story/ (photos the page uses), hero-abbys.* (hero cut-out)
```

`images/press/` holds the raw press collages the story photos were cropped from. It is gitignored, so it only exists on the original machine.

## Libraries (loaded from CDNs, nothing to install)

- GSAP 3.12.5 + ScrollTrigger: animations, pinned sections, sideways scroll
- Lenis 1.1.13: smooth scrolling
- d3 7.9.0 + topojson-client 3.1.0: the passport world map

## Editing

- **Text:** edit `index.html`. Each section is a `<section>` named by its class (`hero`, `manifesto`, `story`, `receipts`, `tour`, `passport`, `menu-sec`, `work`).
- **Booking email:** the form opens the visitor's email app. Set the real address at the top of `script.js` (`BOOKING_EMAIL`), currently a placeholder.
- **Photos:** drop files into `images/` and update the `src` in `index.html`. Keep them under about 300 KB each (WebP or a compressed JPG).

## Things that will bite you (learned the hard way)

- **Create pinned ScrollTriggers in the same order the sections appear on the page.** A pin created out of order makes everything below it pin early.
- **Dense dot maps belong on canvas, not as thousands of SVG circles.** The SVG version ran at about 27 fps.
- **Don't put CSS `filter: blur()` on animated SVG.** It's slow.
- **Start every reload at the top:** `history.scrollRestoration = "manual"` before registering ScrollTrigger, plus `ScrollTrigger.clearScrollMemory("manual")`. That's already in `script.js`.

## Deploying

Any static host works: Netlify (drag the folder onto app.netlify.com/drop), Vercel, Cloudflare Pages, or GitHub Pages (Pages on a private repo needs a paid GitHub plan).

## Image rights: read before publishing

Most photos come from press coverage of Chef Abbys (Yen, Glamour, Pulse and others) and belong to those outlets or photographers. That's fine for a private concept, **but don't publish this site publicly or hand it to a client without permission for those photos**, or replace them with images you have rights to. Keep this repo private.
