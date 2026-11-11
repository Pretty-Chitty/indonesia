// Headless-Chrome screenshot via the DevTools protocol: real-time wait, then capture.
// usage: node shot.mjs <url> <out.png> <width> <height> [waitMs] [--click "Text"]...
//   --click clicks, in order, the smallest visible element whose text is exactly "Text"
//   (a tab such as CANVAS or CHITS, a gallery entry, a button), waiting 3 s after each.
//   --clickAt X,Y presses the pointer at a page position (a piece on the 3D table, say).
//   --after MS waits this much longer after the clicks before capturing (a tutorial N seconds after Start).
//   --key Name presses a key (ArrowRight, Space, Enter…), in order with the clicks, waiting 1.5 s after it;
//   --key ArrowRight:14 presses it 14 times (a tutorial's → steps forward and makes the player's moves).
//   Both kinds run in the order given.
//   --frames N:MS then records N frames MS apart (out-001.png, out-002.png…) to see a piece move; the last action's
//   wait is skipped so the recording starts with it (tap Deliver, then watch the good travel).
//   Console errors/warnings and uncaught exceptions from the page are printed at the end
//   (deduplicated) — a blank table almost always has its cause there.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const argv = process.argv.slice(2);
let afterMs = 0;
{
  const i = argv.indexOf("--after");
  if (i !== -1) afterMs = Number(argv.splice(i, 2)[1]);
}
let frames = 0, frameMs = 0;
{
  const i = argv.indexOf("--frames");
  if (i !== -1) [frames, frameMs] = argv.splice(i, 2)[1].split(":").map(Number);
}
const clicks = [];
const isAction = (a) => a === "--click" || a === "--clickAt" || a === "--key";
for (let i = argv.findIndex(isAction); i !== -1; i = argv.findIndex(isAction)) {
  const [flag, value] = argv.splice(i, 2);
  if (flag === "--key") {
    const [key, times = "1"] = value.split(":");
    for (let k = 0; k < Number(times); k++) clicks.push({ key });
  } else clicks.push(flag === "--clickAt" ? { at: value.split(",").map(Number) } : { text: value });
}
const [url, out, w, h, waitMs = "25000"] = argv;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9222 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [
  "--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
  "--hide-scrollbars", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", `--remote-debugging-port=${port}`, `--window-size=${w},${h}`,
  `--user-data-dir=/tmp/hc-shot-${port}`, "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  let targets;
  for (let i = 0; i < 50; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {}
    await sleep(200);
  }
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map();
  const logs = new Map();
  const note = (k) => logs.set(k, (logs.get(k) ?? 0) + 1);
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      note(`EXCEPTION ${d.exception?.description ?? d.text}`.slice(0, 1200));
    } else if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) {
      const text = m.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
      if (!/THREE\.|BufferGeometryUtils|DevTools|font/i.test(text)) note(`${m.params.type.toUpperCase()} ${text}`.slice(0, 600));
    }
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 1, mobile: +w < 600 });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url });
  await sleep(+waitMs);
  const KEY_CODES = { ArrowRight: 39, ArrowLeft: 37, Space: 32, Enter: 13, Escape: 27 };
  for (const c of clicks) {
    if (c.key) {
      const code = KEY_CODES[c.key] ?? 0;
      const text = c.key === "Space" ? " " : c.key === "Enter" ? "\r" : undefined;
      for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: c.key === "Space" ? " " : c.key, code: c.key, windowsVirtualKeyCode: code, ...(text && type === "keyDown" ? { text } : {}) });
      await sleep(1500);
      continue;
    }
    if (c.at) {
      const [x, y] = c.at;
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
        await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: type === "mouseMoved" ? 0 : 1 });
      console.log(`click at ${x},${y}`);
      await sleep(frames && c === clicks.at(-1) ? 0 : 3000);
      continue;
    }
    const text = c.text;
    // The innermost visible element with exactly this text; press it the way a pointer does
    // (some widgets, such as MUI selects, open on mousedown rather than click).
    const expr = `(() => {
      const t = ${JSON.stringify(text)};
      const els = [...document.querySelectorAll("body *")].filter((e) => e.offsetParent !== null && e.innerText && e.innerText.trim() === t);
      const el = els.find((e) => ![...e.children].some((c) => els.includes(c))) ?? els[0];
      if (!el) return "not found";
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
      return "clicked";
    })()`;
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    console.log(`click "${text}":`, r.result?.result?.value);
    await sleep(frames && c === clicks.at(-1) ? 0 : 3000);
  }
  if (afterMs) await sleep(afterMs);
  if (frames) {
    const t0 = Date.now();
    for (let f = 1; f <= frames; f++) {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(out.replace(/\.png$/, `-${String(f).padStart(3, "0")}.png`), Buffer.from(shot.result.data, "base64"));
      const wait = t0 + f * frameMs - Date.now();
      if (wait > 0) await sleep(wait);
    }
    console.log(`wrote ${frames} frames over ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (!shot.result) { console.error("capture failed:", JSON.stringify(shot).slice(0, 500)); process.exit(1); }
  writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log("wrote", out);
  for (const [k, n] of logs) console.log(`[console x${n}] ${k}`);
  ws.close();
} finally { chrome.kill(); }
