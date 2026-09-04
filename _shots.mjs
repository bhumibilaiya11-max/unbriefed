import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { research } from "./api/research.js";
import { generateDeck } from "./api/generate.js";
import { slideTemplate, accentFor } from "./render.js";
import puppeteer from "puppeteer-core";

const OUT = path.resolve("preview");
fs.mkdirSync(OUT, { recursive: true });

const CHROME =
  ["C:/Program Files/Google/Chrome/Application/chrome.exe",
   "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find(fs.existsSync);

// --- extract the slide CSS straight from code.html so preview == the real app ---
const html = fs.readFileSync("code.html", "utf8");
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");

const FONT_LINKS = `
<link href="https://fonts.googleapis.com/css2?family=Epilogue:wght@700;800&family=Geist:wght@600;700&family=Hanken+Grotesk:wght@400;600&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet">`;

function pageHtml(slide, tone, mood, index, total) {
  return `<!doctype html><html><head><meta charset="utf-8">${FONT_LINKS}<style>
    html,body{margin:0;padding:0}
    .material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr}
    ${css}
  </style></head><body>
    <div class="slide-stage tone-${tone} mood-${mood || "balanced"}" id="stage" style="--accent:${accentFor(tone)}">${slideTemplate(slide, index, total)}</div>
  </body></html>`;
}

const CANDIDATE = {
  name: "Aarav Mehta",
  education: "BBA, Shaheed Sukhdev College of Business Studies, 2024",
  experience:
    "Brand & growth intern at a D2C athleisure label: ran the campus ambassador programme across 12 colleges, owned the Instagram content calendar, launched a referral loop.",
  skills: "consumer research, campaign planning, SQL, community building, copywriting",
  achievements: [
    "Grew a campus run club from 15 to 480 members in one semester",
    "Ran a referral campaign that cut CAC 34% over 3 months",
    "Produced 40+ short-form videos averaging 22k views on a zero budget",
  ],
};
const BRIEF = {
  company: "Nike",
  context:
    "Nike's campus activations in India are episodic — big spikes around festivals or drops, then silence — so Gen Z never builds a daily brand habit.",
  role: "Marketing & Brand",
  profile: CANDIDATE,
};

const TONES = process.argv.slice(2).length ? process.argv.slice(2) : ["Corporate", "Bold", "Playful"];

const rNike = await research("Nike");
console.log(`research: Nike ${rNike.confidence} ${rNike.score}/7`);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--force-color-profile=srgb", "--hide-scrollbars"],
});

const decks = {};
for (let i = 0; i < TONES.length; i++) {
  const tone = TONES[i];
  if (i) { console.log("  (waiting 95s for the free-tier token window)"); await new Promise((r) => setTimeout(r, 95000)); }
  console.log(`generating Nike / Marketing & Brand / ${tone} ...`);
  const deck = await generateDeck({ ...BRIEF, tone, research: rNike });
  const mood = deck.meta?.mood || deck.outline?.mood || "balanced";
  decks[tone] = { model: deck.model, offline: !!deck.offline, mood, outline: deck.outline?.slides, warnings: deck.warnings, slides: deck.slides };
  console.log(`  -> ${deck.slides.length} slides, mood=${mood}, model=${deck.model}`);
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
  for (let s = 0; s < deck.slides.length; s++) {
    const slide = deck.slides[s];
    try {
      await page.setContent(pageHtml(slide, tone, mood, s, deck.slides.length), { waitUntil: "load" });
      try {
        await page.evaluate(async () => {
          await document.fonts.load('19px "Material Symbols Outlined"');
          await document.fonts.load('700 40px "Epilogue"');
          await document.fonts.ready;
        });
      } catch {}
      await new Promise((r) => setTimeout(r, 900));
      const file = path.join(OUT, `${tone}-${s + 1}-${slide.type}.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1280, height: 720 } });
      console.log("  " + path.basename(file));
    } catch (e) {
      console.log(`  !! ${tone} slide ${s + 1} (${slide.type}) failed: ${e.message}`);
    }
  }
  await page.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "decks.json"), JSON.stringify(decks, null, 2));
console.log("\nDone. PNGs + decks.json in ./preview");
