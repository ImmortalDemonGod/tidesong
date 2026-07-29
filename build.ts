// Bundle the game into a single self-contained dist/index.html.
const result = await Bun.build({ entrypoints: ["./src/main.ts"], target: "browser", minify: true });
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const js = await result.outputs[0].text();
const html = `<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TIDESONG</title>
<style>
  :root{--deep:#06121C;--mid:#0E3450;--glow:#35C8D6;--biolum:#7FE8A9;--ink:#D8E9EE;--muted:#7FA0AC}
  html,body{margin:0;min-height:100%;background:linear-gradient(180deg,var(--mid),var(--deep) 70%);display:flex;align-items:center;justify-content:center;flex-direction:column;font-family:system-ui,sans-serif;gap:6px;padding:4px 0}
  h1{margin:0;font-size:clamp(28px,4vw,44px);font-weight:900;letter-spacing:.12em;color:var(--glow);text-shadow:0 3px 0 rgba(0,0,0,.35)}
  .sub{margin:-8px 0 0;color:var(--muted);font-size:13px;letter-spacing:.14em;text-transform:uppercase}
  canvas{max-width:min(96vw,1240px);max-height:84vh;aspect-ratio:16/9;border-radius:10px;box-shadow:0 16px 70px rgba(0,0,0,.6),0 0 0 1px rgba(53,200,214,.18)}
  .chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:900px;padding:0 16px}
  .chip{background:rgba(53,200,214,.08);border:1px solid rgba(53,200,214,.25);color:var(--muted);font-size:12.5px;padding:5px 11px;border-radius:999px;line-height:1.5}
  .chip b{color:var(--biolum);font-weight:800}
</style>
<canvas id="game"></canvas>
<div class="chips">
  <span class="chip"><b>WASD/arrows</b> swim</span>
  <span class="chip"><b>E</b> talk and listen</span>
  <span class="chip"><b>1-6</b> abilities in combat</span>
  <span class="chip"><b>up/down</b> pick a boss part</span>
  <span class="chip"><b>space</b> pass turn</span>
  <span class="chip"><b>P</b> pause · <b>M</b> mute · <b>R</b> replay after victory</span>
</div>
<script>${js.replace(/<\/script>/g, "<\\/script>")}</script>
`;
await Bun.write("dist/index.html", html);
console.log(`dist/index.html: ${(html.length / 1024).toFixed(1)} KB`);
