/* Unbriefed — front-end (ES module).
 * Two-stage flow: validate -> research (/api/research) -> generate (/api/generate) -> render.
 * Role and tone drive both the server prompt and the client visual treatment.
 */
import { validateCompany, validateAchievements } from "./validate.js";
import { esc, escLines, clamp, accentFor, slideTemplate } from "./render.js";

(() => {
  "use strict";

  // ------------------------------------------------------------------ config
  const ROLES = [
    ["Marketing & Brand", "campaign"],
    ["Product Management", "deployed_code"],
    ["Consulting & Strategy", "strategy"],
    ["Corporate Finance", "payments"],
    ["Sales & Business Development", "handshake"],
    ["People & HR", "groups"],
    ["Data & Analytics", "query_stats"],
    ["Product Design & UX", "draw"],
  ];
  const DEFAULT_ROLE = "Consulting & Strategy";

  const TONES = ["Bold", "Strategic", "Corporate", "Creative", "Playful", "Minimal", "Analytical", "Storytelling"];
  const DEFAULT_TONE = "Strategic";
  const TONE_HINTS = {
    Bold: "Short declarative lines. Uppercase headlines. Thick borders, big offset shadows.",
    Strategic: "Causal reasoning, a 'so what' on every slide, evenly structured layout.",
    Corporate: "Restrained board-paper register. Hairline borders, conservative claims.",
    Creative: "Observational framing. Asymmetric layout, one oversized element per slide.",
    Playful: "Wry and conversational. Rounded accents against the sharp grid.",
    Minimal: "Sparse copy. Two stats, not three. Lots of whitespace, hairline rules.",
    Analytical: "Every claim carries a number or a hypothesis. Dense, gridlined, tabular.",
    Storytelling: "One arc across the deck; each slide picks up the previous beat.",
  };

  const STAGES = ["research", "assemble", "write", "done"];

  // ------------------------------------------------------------------ refs
  const $ = (id) => document.getElementById(id);
  const companyInput = $("company-input");
  const contextEl = $("context-textarea");
  const roleGroup = $("role-group");
  const toneToggle = $("tone-toggle");
  const toneHint = $("tone-hint");
  const nameEl = $("cand-name");
  const eduEl = $("cand-education");
  const expEl = $("cand-experience");
  const achEl = $("cand-achievements");
  const skillsEl = $("cand-skills");
  const companyError = $("company-error");
  const achError = $("achievements-error");
  const globalError = $("global-error");
  const generateBtn = $("generate-btn");
  const downloadBtn = $("download-btn");
  const viewerStatus = $("viewer-status");
  const emptyState = $("empty-state");
  const stageWrap = $("stage-wrap");
  const slideStage = $("slide-stage");
  const pdfStage = $("pdf-stage");
  const slideCanvas = $("slide-canvas");
  const loadingOverlay = $("loading-overlay");
  const loadingLabel = $("loading-label");
  const viewerControls = $("viewer-controls");
  const slideDots = $("slide-dots");
  const slideCaption = $("slide-caption");
  const prevBtn = $("prev-slide");
  const nextBtn = $("next-slide");
  const confBanner = $("conf-banner");
  const researchPanel = $("research-panel");
  const researchBadge = $("research-badge");
  const researchBody = $("research-body");
  const researchSources = $("research-sources");
  const deckViewer = $("deck-viewer");
  const outlinePanel = $("outline-panel");
  const outlineBadge = $("outline-badge");
  const outlineBody = $("outline-body");
  const appMain = $("app-main");
  const authBanner = $("auth-banner");
  const authSignedOut = $("auth-signed-out");
  const authSignedIn = $("auth-signed-in");
  const googleSigninBtn = $("google-signin-btn");
  const signoutBtn = $("signout-btn");
  const authEmailEl = $("auth-email");
  const creditsPillEl = $("credits-pill");
  const authErrorEl = $("auth-error");
  const packBtns = Array.from(document.querySelectorAll(".pack-btn"));
  const resumeDrop = $("resume-drop");
  const resumeFile = $("resume-file");
  const resumeStatus = $("resume-status");

  // ------------------------------------------------------------------ state
  const state = { role: DEFAULT_ROLE, tone: DEFAULT_TONE, deck: null, slideIndex: 0, busy: false };

  // helpers esc / escLines / clamp / accentFor / slideTemplate come from render.js

  // ------------------------------------------------------------------ build chips
  ROLES.forEach(([label, icon]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (label === state.role ? " active" : "");
    b.dataset.role = label;
    b.innerHTML = `<span class="material-symbols-outlined text-sm align-middle mr-1">${icon}</span>${esc(label)}`;
    b.addEventListener("click", () => {
      state.role = label;
      roleGroup.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.role === label));
      saveBrief();
    });
    roleGroup.appendChild(b);
  });

  TONES.forEach((tone) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (tone === state.tone ? " active" : "");
    b.dataset.tone = tone;
    b.textContent = tone;
    b.addEventListener("click", () => {
      state.tone = tone;
      toneToggle.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.tone === tone));
      toneHint.textContent = TONE_HINTS[tone] || "";
      saveBrief();
      if (state.deck) renderSlide(state.slideIndex); // live re-style current deck
    });
    toneToggle.appendChild(b);
  });
  toneHint.textContent = TONE_HINTS[state.tone];

  // ------------------------------------------------------------------ validation (imported from validate.js)
  function setInvalid(el, errEl, msg) {
    el.classList.toggle("invalid", !!msg);
    errEl.textContent = msg || "";
  }

  // ------------------------------------------------------------------ résumé
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  resumeDrop.addEventListener("click", () => resumeFile.click());
  resumeDrop.addEventListener("dragover", (e) => { e.preventDefault(); resumeDrop.classList.add("bg-surface-container"); });
  resumeDrop.addEventListener("dragleave", () => resumeDrop.classList.remove("bg-surface-container"));
  resumeDrop.addEventListener("drop", (e) => {
    e.preventDefault();
    resumeDrop.classList.remove("bg-surface-container");
    if (e.dataTransfer.files[0]) handleResumeFile(e.dataTransfer.files[0]);
  });
  resumeFile.addEventListener("change", () => { if (resumeFile.files[0]) handleResumeFile(resumeFile.files[0]); });

  async function extractPdfText(buf) {
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const parts = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      parts.push(tc.items.map((i) => i.str).join(" "));
    }
    return parts.join("\n");
  }

  async function handleResumeFile(file) {
    try {
      const fname = file.name || "";
      resumeStatus.textContent = `Reading ${fname}…`;
      let text = "";
      if (/\.pdf$/i.test(fname)) {
        if (!window.pdfjsLib) { resumeStatus.textContent = "PDF reader failed to load — paste details manually."; return; }
        text = await extractPdfText(await file.arrayBuffer());
      } else if (/\.docx$/i.test(fname)) {
        if (!window.mammoth) { resumeStatus.textContent = "Word-doc reader failed to load — paste details manually, or export as PDF/TXT."; return; }
        const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
        text = result.value || "";
      } else if (/\.(txt|md|markdown)$/i.test(fname)) {
        text = await file.text();
      } else {
        resumeStatus.textContent = `"${fname}" isn't a supported format — use PDF, DOCX, TXT, or Markdown.`;
        return;
      }
      text = (text || "").replace(/\0/g, "").trim();
      if (text.length < 30) { resumeStatus.textContent = "Couldn't pull enough text from that file — enter details manually."; return; }

      await submitResumeText(text);
    } catch (err) {
      console.error("[Unbriefed] résumé handling failed", err);
      resumeStatus.textContent = "Something went wrong reading that file — enter details manually.";
    }
  }

  // Extracted text is cached here whenever a parse attempt is blocked by the sign-in gate,
  // so entering the code retries the SAME résumé automatically — no re-upload needed.
  let pendingResumeText = null;

  async function submitResumeText(text) {
    resumeStatus.textContent = "Extracting fields…";
    const res = await fetch("/api/parse-resume", {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ text }),
    });
    if (res.status === 401) {
      pendingResumeText = text;
      flashAuthBanner();
      resumeStatus.textContent = "Sign in with Google above — this résumé retries automatically once you do.";
      return;
    }
    pendingResumeText = null;
    if (res.status === 503) {
      expEl.value = expEl.value || text.slice(0, 1400);
      resumeStatus.textContent = "AI key not set — résumé auto-fill is off. Raw text dropped into Experience; edit as needed.";
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      resumeStatus.textContent = `Auto-fill failed (${res.status}). ${j.error || "Enter details manually."}`;
      return;
    }
    const d = await res.json();
    console.log("[Unbriefed] résumé parsed ->", d);
    if (d.name) nameEl.value = d.name;
    if (d.education) eduEl.value = d.education;
    if (d.experience) expEl.value = d.experience;
    if (d.skills) skillsEl.value = d.skills;
    if (Array.isArray(d.achievements) && d.achievements.length) achEl.value = d.achievements.join("\n");
    setInvalid(achEl, achError, validateAchievements(achEl.value));
    saveBrief();
    resumeStatus.textContent = `Filled from résumé (${d.achievements?.length || 0} achievements) — review and edit.`;
  }

  // ------------------------------------------------------------------ persistence
  const BRIEF_KEY = "unbriefed.brief.v2";
  const DECK_KEY = "unbriefed.lastdeck.v2";

  // ------------------------------------------------------------------ auth + credits
  // Public by design — RLS on the `profiles` table (not this key) is what actually protects data.
  const SUPABASE_URL = "https://akjnaqvamtgyyobicpma.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFram5hcXZhbXRneXlvYmljcG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NDQzMDMsImV4cCI6MjEwNDEyMDMwM30.th9zqrGXRp63FerJGfLrr6bpVUDulKh2IAL60Iu1LMU";
  const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  let session = null;

  function authHeaders() {
    const h = { "Content-Type": "application/json" };
    if (session?.access_token) h["Authorization"] = `Bearer ${session.access_token}`;
    return h;
  }
  // Draws attention to the sign-in / buy-credits banner (401 or 402 from any API call lands here).
  function flashAuthBanner() {
    authBanner.classList.add("brief-banner-flash");
    authBanner.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => authBanner.classList.remove("brief-banner-flash"), 1600);
  }
  async function refreshCredits() {
    if (!sb || !session) return;
    const { data, error } = await sb.from("profiles").select("credits").eq("id", session.user.id).single();
    if (!error && data) creditsPillEl.textContent = `${data.credits} credit${data.credits === 1 ? "" : "s"}`;
  }
  let mainRevealed = false;
  async function updateAuthUI() {
    if (session) {
      authSignedOut.classList.add("hidden"); authSignedOut.classList.remove("flex");
      authSignedIn.classList.remove("hidden"); authSignedIn.classList.add("flex");
      authEmailEl.textContent = session.user.email || "your Google account";
      await refreshCredits();
      // The Brief/Deck Viewer only exist behind sign-in — reveal them, and scroll down into the
      // tool the first time (not on every later token-refresh event).
      if (!mainRevealed) {
        mainRevealed = true;
        appMain.classList.remove("hidden");
        appMain.classList.add("flex", "flex-1");
        setTimeout(() => companyInput.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
      }
      // A résumé upload blocked on being signed out retries automatically now that we're in.
      if (pendingResumeText) {
        const text = pendingResumeText;
        pendingResumeText = null;
        submitResumeText(text).catch((err) => {
          console.error("[Unbriefed] auto-retry of pending résumé failed", err);
          resumeStatus.textContent = "Something went wrong retrying that résumé — try uploading it again.";
        });
      }
    } else {
      authSignedIn.classList.add("hidden"); authSignedIn.classList.remove("flex");
      authSignedOut.classList.remove("hidden"); authSignedOut.classList.add("flex");
      mainRevealed = false;
      appMain.classList.add("hidden");
      appMain.classList.remove("flex", "flex-1");
    }
  }
  if (sb) {
    sb.auth.getSession().then(({ data }) => { session = data.session; updateAuthUI(); });
    sb.auth.onAuthStateChange((_event, newSession) => { session = newSession; updateAuthUI(); });
  }
  googleSigninBtn.addEventListener("click", () => {
    if (!sb) { authErrorEl.textContent = "Sign-in failed to load — refresh the page and try again."; return; }
    sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + window.location.pathname } });
  });
  signoutBtn.addEventListener("click", async () => { if (sb) await sb.auth.signOut(); });

  const PACK_LABELS = { small: "Small (3 credits)", medium: "Medium (10 credits)", large: "Large (20 credits)" };
  packBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!session) { flashAuthBanner(); return; }
      authErrorEl.textContent = "";
      btn.classList.add("busy");
      try {
        const res = await fetch("/api/checkout", { method: "POST", headers: authHeaders(), body: JSON.stringify({ pack: btn.dataset.pack }) });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.url) { window.location.href = d.url; return; }
        authErrorEl.textContent = d.error || `Could not start checkout for ${PACK_LABELS[btn.dataset.pack] || "that pack"}.`;
      } catch {
        authErrorEl.textContent = "Could not reach the payment server — try again.";
      } finally {
        btn.classList.remove("busy");
      }
    });
  });

  // Returning from Stripe Checkout — confirm, clean the URL, and refresh the credit balance
  // (the webhook usually lands within a second or two, so poll it briefly).
  (function handleCheckoutReturn() {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    if (!status) return;
    history.replaceState({}, "", window.location.pathname);
    if (status === "success") {
      authErrorEl.textContent = "Payment received — crediting your account…";
      let tries = 0;
      const poll = setInterval(async () => {
        await refreshCredits();
        if (++tries >= 5) clearInterval(poll);
      }, 1500);
      setTimeout(() => { if (authErrorEl.textContent === "Payment received — crediting your account…") authErrorEl.textContent = ""; }, 8000);
    } else if (status === "cancel") {
      authErrorEl.textContent = "Checkout cancelled — no charge made.";
    }
  })();

  function saveBrief() {
    try {
      localStorage.setItem(BRIEF_KEY, JSON.stringify({
        company: companyInput.value, context: contextEl.value, role: state.role, tone: state.tone,
        name: nameEl.value, education: eduEl.value, experience: expEl.value,
        achievements: achEl.value, skills: skillsEl.value,
      }));
    } catch {}
  }
  function loadBrief() {
    let b;
    try { b = JSON.parse(localStorage.getItem(BRIEF_KEY) || "null"); } catch { b = null; }
    if (!b) return;
    companyInput.value = b.company || "";
    contextEl.value = b.context || "";
    nameEl.value = b.name || "";
    eduEl.value = b.education || "";
    expEl.value = b.experience || "";
    achEl.value = b.achievements || "";
    skillsEl.value = b.skills || "";
    if (b.role && ROLES.some((r) => r[0] === b.role)) {
      state.role = b.role;
      roleGroup.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.role === b.role));
    }
    if (b.tone && TONES.includes(b.tone)) {
      state.tone = b.tone;
      toneToggle.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.tone === b.tone));
      toneHint.textContent = TONE_HINTS[b.tone];
    }
  }
  function saveDeck(result) {
    try { localStorage.setItem(DECK_KEY, JSON.stringify({ result, role: state.role, tone: state.tone, at: Date.now() })); } catch {}
  }
  function loadDeck() {
    let d;
    try { d = JSON.parse(localStorage.getItem(DECK_KEY) || "null"); } catch { d = null; }
    if (!d || !d.result || !Array.isArray(d.result.slides)) return;
    state.deck = d.result;
    state.role = d.role || state.role;
    state.tone = d.tone || state.tone;
    state.slideIndex = 0;
    renderDeck();
    showConfidenceBanner(d.result);
    renderOutlinePanel(d.result.outline);
    if (d.result.researchText) renderResearchPanel({ text: d.result.researchText });
    viewerStatus.textContent = "Restored from last session";
    downloadBtn.style.display = "inline-flex";
  }

  [companyInput, contextEl, nameEl, eduEl, expEl, achEl, skillsEl].forEach((el) =>
    el.addEventListener("input", () => {
      saveBrief();
      if (el === companyInput) setInvalid(companyInput, companyError, "");
      if (el === achEl) setInvalid(achEl, achError, "");
    })
  );

  // ------------------------------------------------------------------ stage indicator + loading
  function resetStages() {
    document.querySelectorAll(".stage-pill").forEach((p) => p.classList.remove("done", "active"));
  }
  function setStage(name) {
    const idx = STAGES.indexOf(name);
    document.querySelectorAll(".stage-pill").forEach((p) => {
      const i = STAGES.indexOf(p.dataset.stage);
      p.classList.toggle("done", name === "done" ? true : i < idx);
      p.classList.toggle("active", name !== "done" && i === idx);
    });
  }
  function showLoading(on, label) {
    loadingOverlay.style.display = on ? "flex" : "none";
    if (label) loadingLabel.textContent = label;
  }

  // Bring the actual slide into view — it sits below several panels inside the right column,
  // and on desktop the tall left form means the user has scrolled well past it.
  function scrollToDeck() {
    const go = () => {
      try { (slideCanvas || deckViewer).scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
    };
    go();
    setTimeout(go, 450); // again after layout / render settles
  }

  // ------------------------------------------------------------------ orchestration
  generateBtn.addEventListener("click", build);
  const scrollToBrief = () => companyInput.scrollIntoView({ behavior: "smooth", block: "center" });
  // Before sign-in, "get started" means the landing gate; once signed in, it means the actual form.
  const scrollToStart = () => (session ? scrollToBrief() : authBanner.scrollIntoView({ behavior: "smooth", block: "center" }));
  [$("nav-cta"), $("nav-cta-mobile"), $("hero-cta")].forEach((btn) => btn && btn.addEventListener("click", scrollToStart));
  const continueToBriefBtn = $("continue-to-brief-btn");
  continueToBriefBtn && continueToBriefBtn.addEventListener("click", scrollToBrief);

  async function build() {
    if (state.busy) return;
    globalError.textContent = "";
    const company = companyInput.value.trim();
    const cErr = validateCompany(company);
    const aErr = validateAchievements(achEl.value);
    setInvalid(companyInput, companyError, cErr);
    setInvalid(achEl, achError, aErr);
    if (cErr || aErr) {
      console.warn("[Unbriefed][validation] submission BLOCKED — nothing sent to the AI.", {
        company: cErr || "ok", achievements: aErr || "ok", value: company,
      });
      globalError.textContent = "Fix the highlighted fields — nothing was sent to the AI.";
      return;
    }

    state.busy = true;
    generateBtn.disabled = true;
    downloadBtn.style.display = "none";
    viewerControls.style.display = "none";
    stageWrap.classList.add("hidden");
    emptyState.style.display = "none";
    confBanner.classList.add("hidden");
    researchPanel.classList.add("hidden");
    if (outlinePanel) outlinePanel.classList.add("hidden");
    resetStages();
    scrollToDeck(); // jump to where the deck will appear

    const role = state.role;
    const tone = state.tone;
    const profile = {
      name: nameEl.value.trim(), education: eduEl.value.trim(), experience: expEl.value.trim(),
      skills: skillsEl.value.trim(),
      achievements: achEl.value.split("\n").map((s) => s.trim()).filter(Boolean),
    };

    try {
      // ---- Stage 1: research
      setStage("research");
      showLoading(true, `Researching ${company}…`);
      viewerStatus.textContent = `Researching ${company}`;
      const research = await runResearch(company);
      renderResearchPanel(research);

      // ---- Stage 2a: decide the deck shape (outline) + 2b: write it
      setStage("assemble");
      showLoading(true, `Deciding the deck shape for this ${tone} ${role} pitch…`);
      viewerStatus.textContent = "Planning the argument";

      setStage("write");
      showLoading(true, "Writing the slides…");
      viewerStatus.textContent = "Writing deck";
      const result = await runGenerate({ company, context: contextEl.value.trim(), role, tone, profile, research });

      console.groupCollapsed("%c[Unbriefed] STEP A — OUTLINE (deck shape chosen for this pitch)", "color:#630ed4;font-weight:bold");
      console.log("mood:", result.outline?.mood, "| slides:", result.outline?.slides?.length);
      (result.outline?.slides || []).forEach((s, i) => console.log(`${i + 1}. [${s.type}] ${s.purpose} — visual: ${s.visual}${s.why ? "  (" + s.why + ")" : ""}`));
      console.log("argument:", result.outline?.argument);
      console.groupEnd();
      console.groupCollapsed("%c[Unbriefed] STEP B — CONTENT PROMPT (tone/role/outline sent to the model)", "color:#630ed4;font-weight:bold");
      console.log(result.contentPrompt || result.systemPrompt || "(prompt not returned)");
      console.groupEnd();
      console.log("[Unbriefed] model:", result.model, "| offline:", !!result.offline, result.offlineReason || "",
        "| research:", result.researchConfidence, "| warnings:", result.warnings || []);
      if (result.achievementsProvided) console.log("[Unbriefed] achievements passed through:", result.achievementsProvided);

      result.researchText = research ? research.text : "";
      state.deck = result;
      state.role = role;
      state.tone = tone;
      state.slideIndex = 0;

      setStage("done");
      showLoading(false);
      showConfidenceBanner(result);
      renderOutlinePanel(result.outline);
      renderDeck();
      saveBrief();
      saveDeck(result);
      viewerStatus.textContent = result.offline
        ? "⚠ PLACEHOLDER — NOT AI-WRITTEN"
        : `Live · ${result.model} · ${result.slides.length} slides · ${deckMood()}`;
      downloadBtn.style.display = "inline-flex";
      scrollToDeck();
    } catch (err) {
      console.error("[Unbriefed] build failed", err);
      showLoading(false);
      resetStages();
      emptyState.style.display = "flex";
      globalError.textContent = "Generation failed: " + (err.message || err);
      viewerStatus.textContent = "Failed";
    } finally {
      state.busy = false;
      generateBtn.disabled = false;
    }
  }

  async function runResearch(company) {
    try {
      const r = await fetch("/api/research", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company }),
      });
      if (!r.ok) throw new Error("research " + r.status);
      const data = await r.json();
      console.groupCollapsed("%c[Unbriefed] RESEARCH DOSSIER — " + company, "color:#630ed4;font-weight:bold");
      console.log(data.text);
      console.log("confidence:", data.confidence, "| score:", data.score + "/7", "| sources:", data.sourceStatus,
        "| news items:", data.newsCount, "| elapsed:", data.elapsedMs + "ms");
      console.groupEnd();
      return data;
    } catch (e) {
      console.warn("[Unbriefed] research step failed — generation will proceed from general reasoning:", e.message);
      return null;
    }
  }

  async function runGenerate(payload) {
    const r = await fetch("/api/generate", {
      method: "POST", headers: authHeaders(), body: JSON.stringify(payload),
    });
    if (r.status === 401) {
      flashAuthBanner();
      throw new Error("Sign in with Google above, then click Build again.");
    }
    if (r.status === 402) {
      flashAuthBanner();
      throw new Error("You're out of credits — buy more above, then click Build again.");
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "generate " + r.status);
    if (!Array.isArray(data.slides) || !data.slides.length) throw new Error("No slides returned");
    return data;
  }

  // ------------------------------------------------------------------ research panel + confidence
  function renderResearchPanel(research) {
    researchPanel.classList.remove("hidden");
    if (!research) {
      researchBadge.textContent = "unavailable";
      researchBody.textContent = "The research request failed. The deck was written from general industry reasoning only.";
      researchSources.innerHTML = "";
      return;
    }
    researchBadge.textContent = research.confidence
      ? `${research.confidence.toUpperCase()} · ${research.score ?? "?"}/7`
      : "restored";
    researchBody.textContent = research.text || "(no dossier text)";
    researchSources.innerHTML = "";
    (research.sources || []).forEach((s) => {
      const a = document.createElement("a");
      a.href = s.url; a.target = "_blank"; a.rel = "noopener";
      a.className = "chip";
      a.textContent = `${s.type}: ${(s.title || s.url).slice(0, 42)}`;
      researchSources.appendChild(a);
    });
  }

  function renderOutlinePanel(outline) {
    if (!outlinePanel || !outline || !Array.isArray(outline.slides)) return;
    outlineBadge.textContent = `${outline.slides.length} slides · ${outline.mood || "balanced"}`;
    const rows = outline.slides
      .map((s, i) => `${String(i + 1).padStart(2, "0")}  ${s.purpose}\n      type: ${s.type}   ·   visual: ${s.visual}${s.why ? `\n      ${s.why}` : ""}`)
      .join("\n\n");
    outlineBody.textContent =
      (outline.argument ? `THROUGH-LINE: ${outline.argument}\n\n` : "") + rows;
    outlinePanel.classList.remove("hidden");
  }

  function showConfidenceBanner(result) {
    const conf = (result.researchConfidence || "none").toLowerCase();
    let msg, bg, bd;
    if (result.offline) {
      console.error("[Unbriefed] OFFLINE placeholder returned. reason:", result.offlineReason,
        "| warnings:", result.warnings);
      msg =
        "⚠ PLACEHOLDER DECK — this copy was NOT written by the AI, so it does not reflect the tone. " +
        (result.offlineReason === "api_error"
          ? "The AI call failed (rate limit / transient). "
          : "No working API key was detected by the server. ") +
        "FIX: 1) stop the server (Ctrl+C in its terminal) and run  npm run dev  again so it picks up .env, " +
        "2) hard-refresh this page (Ctrl+Shift+R), then Build again.";
      bg = "#ffdad6"; bd = "#ba1a1a";
    } else if (conf === "high") {
      msg = "Grounded in current multi-source research (high confidence): Wikipedia + Google News + DuckDuckGo cross-checked.";
      bg = "#e7f6e7"; bd = "#1c7c1c";
    } else if (conf === "medium") {
      msg = "Partial verified data (medium confidence). Company-specific facts are grounded in the dossier; some framing is general industry knowledge.";
      bg = "#fff4e0"; bd = "#9d4300";
    } else {
      msg = "Built from general industry patterns — limited verified data for this company. Figures shown are rounded estimates, marked “est.”";
      bg = "#fff4e0"; bd = "#9d4300";
    }
    const warns = result.warnings || [];
    if (warns.some((w) => /verbatim/i.test(w)))
      msg += "  ⚠ An achievement row may not be exactly verbatim — check the evidence slide.";
    if (warns.some((w) => /concrete figure|no number/i.test(w)))
      msg += "  ⚠ A stat came back vague rather than numeric — regenerate if it matters.";
    confBanner.textContent = msg;
    confBanner.style.background = bg;
    confBanner.style.borderColor = bd;
    confBanner.classList.remove("hidden");
  }

  // ------------------------------------------------------------------ rendering
  window.addEventListener("resize", fitStage);
  function fitStage() {
    const cw = slideCanvas.clientWidth || 1;
    stageWrap.style.transform = `scale(${cw / 1280})`;
  }

  function renderDeck() {
    emptyState.style.display = "none";
    stageWrap.classList.remove("hidden");
    viewerControls.style.display = "flex";
    buildDots();
    renderSlide(state.slideIndex);
    fitStage();
  }

  function deckMood() {
    return (state.deck?.meta?.mood || state.deck?.outline?.mood || "balanced").toString().toLowerCase();
  }

  function renderSlide(i) {
    const slides = state.deck.slides;
    state.slideIndex = clamp(i, 0, slides.length - 1);
    const slide = slides[state.slideIndex];
    const tone = state.tone;

    slideStage.className = `slide-stage tone-${tone} mood-${deckMood()}`;
    slideStage.style.setProperty("--accent", accentFor(tone));
    slideStage.innerHTML = slideTemplate(slide, state.slideIndex, slides.length);

    stageWrap.classList.remove("slide-enter");
    void stageWrap.offsetWidth;
    stageWrap.classList.add("slide-enter");

    slideCaption.textContent =
      `Slide ${state.slideIndex + 1} of ${slides.length} · ${slide.type}` +
      (slide.purpose ? ` — ${slide.purpose}` : "") +
      ` · ${tone} · ${deckMood()}` +
      (state.deck.offline ? " · PLACEHOLDER" : "");
    buildDots();
    fitStage();
  }

  function buildDots() {
    if (!state.deck) return;
    slideDots.innerHTML = "";
    state.deck.slides.forEach((s, idx) => {
      const d = document.createElement("button");
      d.title = s.type;
      d.className =
        "w-3 h-3 border border-on-background " +
        (idx === state.slideIndex ? "bg-primary border-primary" : "bg-transparent hover:bg-surface-variant");
      d.addEventListener("click", () => renderSlide(idx));
      slideDots.appendChild(d);
    });
    prevBtn.disabled = state.slideIndex === 0;
    nextBtn.disabled = state.slideIndex === state.deck.slides.length - 1;
  }
  prevBtn.addEventListener("click", () => renderSlide(state.slideIndex - 1));
  nextBtn.addEventListener("click", () => renderSlide(state.slideIndex + 1));
  document.addEventListener("keydown", (e) => {
    if (!state.deck || state.busy) return;
    if (e.key === "ArrowLeft") renderSlide(state.slideIndex - 1);
    if (e.key === "ArrowRight") renderSlide(state.slideIndex + 1);
  });

  // slideTemplate + all visual renderers live in render.js (shared with Node preview scripts)

  // ------------------------------------------------------------------ PDF
  downloadBtn.addEventListener("click", exportPDF);
  async function exportPDF() {
    if (!state.deck || state.busy) return;
    const original = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Exporting…';
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [1280, 720], compress: true });
      const tone = state.tone;
      const mood = deckMood();
      for (let i = 0; i < state.deck.slides.length; i++) {
        const slide = state.deck.slides[i];
        pdfStage.className = `slide-stage tone-${tone} mood-${mood}`;
        pdfStage.style.setProperty("--accent", accentFor(tone));
        pdfStage.innerHTML = slideTemplate(slide, i, state.deck.slides.length);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const canvas = await html2canvas(pdfStage, {
          scale: 2, width: 1280, height: 720, windowWidth: 1280, windowHeight: 720, backgroundColor: "#ffffff",
        });
        const img = canvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage([1280, 720], "landscape");
        pdf.addImage(img, "JPEG", 0, 0, 1280, 720);
      }
      const name = `${companyInput.value || "Unbriefed"}_${state.role}_${state.tone}`.replace(/[^a-z0-9]+/gi, "_");
      pdf.save(`${name}.pdf`);
    } catch (e) {
      console.error("[Unbriefed] PDF export failed", e);
      globalError.textContent = "PDF export failed — see console.";
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = original;
      pdfStage.innerHTML = "";
    }
  }

  // ------------------------------------------------------------------ init
  loadBrief();
  loadDeck();
  fitStage();
  console.log(
    "%c[Unbriefed] build: two-step outline + tone-voice (2026-09-05). " +
      "If you still see a fixed 8-slide shape or tone-identical copy, you are on a CACHED page — hard-refresh (Ctrl+Shift+R) and restart the server.",
    "color:#630ed4;font-weight:bold"
  );
})();
