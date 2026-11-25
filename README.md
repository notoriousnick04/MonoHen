# MonoHen (PS4 12.00 GoldHEN host)

A very small, static PS4 WebKit jailbreak host for **firmware 12.00**. It has three things:

- a **Start** button,
- an autoscrolling **log panel**,
- an **offline cache** (automatic on first visit, plus a manual refresh button).

The exploit chain is the one WebKitty uses by default on 12.00: **Wobkot (WebKit userland) + Lapse (kernel)**, loading the newest `goldhen_v*.bin` found in `payloads/`.

> This is a personal, minimal host. It has been checked statically only. **It has not been tested on real hardware.** Verify it on your own console with the checklist below.

## Repository layout

```
index.html            the only page: Start button, log panel, cache UI
app.js                UI, orchestration, and automatic retry
style.css             all styling
manifest.appcache     generated offline cache manifest
tools/update_payload.py  regenerates the payload pointer and manifest
.github/workflows/    regenerates the index on every push to main
src/wobkot/           vendored, unmodified exploit chain from WebKitty
payloads/             GoldHEN binaries, kept under their original filenames
```

## Host it

### GitHub Pages

1. Create a public repository and push this folder to its default branch.
2. In the repository, go to **Settings → Pages** and set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`.
3. Open `https://<username>.github.io/<repo-name>/` on the PS4.

`.nojekyll` is included so Jekyll does not skip the `src/` directory.

> **HTTPS note:** the PS4 browser can reject modern TLS certificates, and WebKitty itself redirects PS4 users from HTTPS to HTTP. If the page will not load, use a custom domain served over HTTP, or serve the folder locally on your LAN (below).

### Local test server

```sh
python3 -m http.server 8000
```

Then open `http://<your-ip>:8000/` on the PS4 (same network). Use HTTP, not HTTPS.

## Updating GoldHEN

GoldHEN files keep their original names, for example `goldhen_v2.4b18.14.bin`. The site picks the highest version number in `payloads/` automatically.

**On GitHub:** paste the new `goldhen_v*.bin` into `payloads/` and push. The workflow regenerates `payloads/current.js` and `manifest.appcache` and commits them back.

**Locally:** paste the new file, then run:

```sh
python3 tools/update_payload.py
```

The script prints which file it selected. It only considers files named `goldhen_vX.YbZ.W.bin`, so other files in the folder are ignored. The `payloads/current.js` pointer is generated — don't edit it by hand.

## Offline caching

The page declares `manifest="manifest.appcache"`. The PS4's WebKit supports the HTML5 Application Cache, not Service Workers, so the manifest is the caching mechanism.

- On the first visit the browser downloads everything in the manifest automatically; the status bar shows progress.
- The **Cache for offline** button calls `applicationCache.update()`.
- After caching, the PS4 can open the bookmarked page with no network connection.
- `manifest.appcache` is generated with a content hash in its header comment. Any change to the file list changes that comment, which makes browsers refresh their cache; then press the cache button.

GitHub Pages serves `.appcache` as `text/cache-manifest` (via mime-db), which the PS4 browser requires. Verify on your live URL:

```sh
curl -I https://<username>.github.io/<repo-name>/manifest.appcache | grep -i content-type
```

Modern desktop browsers have removed AppCache, so the status line will say "not supported in this browser" there — that is expected. Desktop mode is for visual testing only: on a non-PS4 browser, Start streams a simulated log.

## Start and retry behavior

Nothing happens automatically when you open the page — you must press Start. The exploit then runs **on the same page**, and its log streams into the panel you are looking at; there is no second page or tab.

If an attempt fails, the page waits 5 seconds and retries automatically, up to **3 attempts total**. The button turns into **Stop retry** during the countdown if you want to cancel. After 3 failed attempts it stops and the button becomes **Retry**. A full kernel panic cannot be detected by the browser — in that case, reboot the console manually.

## Hardware test checklist

1. Clear the PS4 browser's cookies/site data, then open the host URL and let caching reach 100%.
2. Confirm the page reports `PS4 · 12.00` and the Start button is enabled.
3. Press Start and watch the log. Look for `===USERLAND===`, `===KERNEL===`, `Achieved jailbreak !!`, and `===END===`.
4. Check the PS4 notification for HEN/GoldHEN, then check **Settings → System → System Information**: the firmware line should show the HEN version.
5. Power the console off and on, disable the network, open the bookmark, and confirm the page still loads from cache.
6. If it fails: note the last log line. The host will auto-retry up to 3 times; press **Stop retry** to cancel. Kernel panics and "not enough memory" dialogs are normal in this scene — keep pressing OK, and reboot manually if the console freezes.

## Credits and license

The exploit chain and GoldHEN binary are vendored unmodified from [ArabPixel/WebKitty](https://github.com/ArabPixel/WebKitty), which is licensed under **AGPL-3.0**. See `LICENSE` and `src/wobkot/LICENSE.txt`. All credit for the exploit work goes to the researchers credited upstream: ufm42, Al Azif, ArabPixel, Nathan Fargo, nhk, Dr.Yenyen, cow, idlesauce, jordy, ChendoChap, sonic-iso, SiSTRo, and the rest of the list in `src/wobkot/README.md` (not vendored here).

The landing page HTML/CSS/JS in this repository is original work, reimplemented to match the minimal look of common PS4 hosts rather than copied from WebKitty.

Because this repository contains AGPL-3.0 code, it is distributed under **AGPL-3.0-or-later** as well.
