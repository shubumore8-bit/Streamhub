import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ageGate = document.querySelector("#ageGate");

if (localStorage.getItem("desivexa_age_verified") === "1") ageGate?.remove();
document.querySelector("#enter")?.addEventListener("click", () => {
  localStorage.setItem("desivexa_age_verified", "1");
  ageGate?.remove();
});

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function card(video) {
  const id = encodeURIComponent(video.id);
  const title = esc(video.title || "Untitled video");
  const category = esc(video.category || "Other");
  const views = Number(video.views || 0).toLocaleString();
  const thumb = video.thumbnail_url
    ? `<img src="${esc(video.thumbnail_url)}" alt="${title}" loading="lazy" decoding="async">`
    : `<div class="noThumb">DESIVEXA</div>`;
  return `<a class="card" href="video.html?id=${id}"><div class="thumb">${thumb}<div class="thumbOverlay"></div><div class="playCircle">▶</div><div class="cardViews">${views} views</div></div><div class="body"><h3>${title}</h3><div class="cardMeta"><span>${category}</span><span>${views} views</span></div></div></a>`;
}

let allVideos = [];
let activeCategory = "All";

async function loadVideos() {
  const targets = ["#trendingVideos", "#videos", "#recommendations", "#randomVideos"]
    .map(s => document.querySelector(s)).filter(Boolean);
  targets.forEach(el => el.innerHTML = `<p class="muted">Loading videos...</p>`);

  const { data, error } = await supabase
    .from("videos")
    .select("id,title,category,description,thumbnail_url,video_url,views,created_at")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    targets.forEach(el => el.innerHTML = `<p class="muted">Could not load videos.</p>`);
    return;
  }

  allVideos = data || [];
  renderFeatured(allVideos[0]);
  renderVideos();
  renderCategories();
}

function renderFeatured(video) {
  const box = document.querySelector("#featuredVideo");
  if (!box) return;
  if (!video) { box.innerHTML = `<div class="featuredEmpty">No featured video available yet.</div>`; return; }
  const title = esc(video.title || "Featured video");
  const category = esc(video.category || "Other");
  const views = Number(video.views || 0).toLocaleString();
  const image = video.thumbnail_url ? `<img src="${esc(video.thumbnail_url)}" alt="${title}">` : `<div class="featuredNoThumb">DESIVEXA</div>`;
  box.innerHTML = `<a class="featuredCard" href="video.html?id=${encodeURIComponent(video.id)}"><div class="featuredThumb">${image}<div class="featuredShade"></div><span class="featuredBadge">FEATURED</span><span class="featuredPlay">▶</span><span class="featuredViews">${views} views</span></div><div class="featuredInfo"><span class="featuredCategory">${category}</span><h2>${title}</h2><span class="featuredWatch">Watch now →</span></div></a>`;
}

function getFiltered() {
  const params = new URLSearchParams(location.search);
  const q = (params.get("search") || "").trim().toLowerCase();
  return allVideos.filter(v => {
    const cat = v.category || "Other";
    if (activeCategory !== "All" && cat !== activeCategory) return false;
    if (!q) return true;
    return `${v.title || ""} ${v.category || ""} ${v.description || ""}`.toLowerCase().includes(q);
  });
}

function trendingScore(v) {
  const ageHours = Math.max(1, (Date.now() - new Date(v.created_at).getTime()) / 3600000);
  return Number(v.views || 0) / Math.pow(ageHours, 0.35);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderGrid(selector, items, empty = "No videos found.") {
  const el = document.querySelector(selector);
  if (!el) return;
  el.innerHTML = items.length ? items.map(card).join("") : `<p class="muted">${empty}</p>`;
}

function renderVideos() {
  const filtered = getFiltered();
  const trending = [...filtered].sort((a,b) => trendingScore(b) - trendingScore(a)).slice(0, 12);
  const latest = [...filtered].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 12);
  const recommended = shuffle(filtered.filter(v => !trending.some(t => t.id === v.id))).slice(0, 12);
  const random = shuffle(filtered).slice(0, 30);

  renderGrid("#trendingVideos", trending);
  renderGrid("#videos", latest);
  renderGrid("#recommendations", recommended);
  renderGrid("#randomVideos", random);
}

function renderCategories(searchText = "") {
  const box = document.querySelector("#categoryItems");
  if (!box) return;
  const cats = [...new Set(allVideos.map(v => v.category || "Other"))].sort((a,b) => a.localeCompare(b));
  const filtered = cats.filter(c => c.toLowerCase().includes(searchText.toLowerCase()));
  box.innerHTML = `<button class="catItem ${activeCategory === "All" ? "active" : ""}" data-cat="All">All</button>` + filtered.map(c => `<button class="catItem ${activeCategory === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  box.querySelectorAll("[data-cat]").forEach(btn => btn.addEventListener("click", () => {
    activeCategory = btn.dataset.cat;
    document.querySelector("#cats")?.classList.remove("show");
    renderVideos(); renderCategories(document.querySelector("#categorySearch")?.value || "");
  }));
}

document.querySelector("#categoryBtn")?.addEventListener("click", () => document.querySelector("#cats")?.classList.toggle("show"));
document.querySelector("#categorySearch")?.addEventListener("input", e => renderCategories(e.target.value));
document.querySelector("#menuBtn")?.addEventListener("click", () => document.querySelector("#mobileMenu")?.classList.toggle("show"));
document.querySelector("#searchBtn")?.addEventListener("click", () => { const b=document.querySelector("#searchBox"); b?.classList.toggle("show"); b?.querySelector("input")?.focus(); });
document.querySelector("#search")?.addEventListener("keydown", e => { if (e.key !== "Enter") return; const v=e.target.value.trim(); location.href=v ? `index.html?search=${encodeURIComponent(v)}` : "index.html"; });

loadVideos();
