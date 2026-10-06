import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================
   AGE GATE
========================= */

const gate = document.querySelector("#ageGate");

if (localStorage.dv18 === "yes") {
  gate?.remove();
}

document.querySelector("#enter")?.addEventListener("click", () => {
  localStorage.dv18 = "yes";
  gate?.remove();
});


/* =========================
   ELEMENTS
========================= */

const videosEl = document.querySelector("#videos");
const trendingEl = document.querySelector("#trendingVideos");

const categoryBtn = document.querySelector("#categoryBtn");
const categoryList = document.querySelector("#cats");
const categoryItems = document.querySelector("#categoryItems");
const categorySearch = document.querySelector("#categorySearch");

const search = document.querySelector("#search");


/* =========================
   DATA
========================= */

let all = [];
let activeCategory = "All";


/* =========================
   CATEGORY MENU
========================= */

categoryBtn?.addEventListener("click", (e) => {

  e.stopPropagation();

  categoryList?.classList.toggle("show");

  if (categoryList?.classList.contains("show")) {

    setTimeout(() => {
      categorySearch?.focus();
    }, 50);

  }

});


/* =========================
   CLOSE CATEGORY MENU
========================= */

document.addEventListener("click", (e) => {

  if (!e.target.closest(".categoryMenu")) {
    categoryList?.classList.remove("show");
  }

});


/* =========================
   LOAD VIDEOS
========================= */

async function load() {

  if (videosEl) {
    videosEl.innerHTML = `
      <p class="muted">Loading videos...</p>
    `;
  }

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("published", true)
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error("Supabase error:", error);

    if (videosEl) {
      videosEl.innerHTML = `
        <p class="muted">
          Could not load videos.
        </p>
      `;
    }

    if (trendingEl) {
      trendingEl.innerHTML = `
        <p class="muted">
          Could not load videos.
        </p>
      `;
    }

    return;
  }

  all = data || [];

  render();
  renderTrending();
}


/* =========================
   FILTER VIDEOS
========================= */

function getFiltered() {

  const q =
    (search?.value || "")
      .toLowerCase()
      .trim();

  return all.filter(v => {

    const text =
      `${v.title || ""} ${v.category || ""} ${v.description || ""}`
        .toLowerCase();

    const categoryOk =
      activeCategory === "All" ||
      String(v.category || "")
        .toLowerCase() ===
      activeCategory.toLowerCase();

    return (
      categoryOk &&
      (!q || text.includes(q))
    );

  });

}


/* =========================
   VIDEO CARD
========================= */

function videoCard(v) {

  const id =
    encodeURIComponent(v.id);

  const title =
    esc(v.title || "Untitled video");

  const category =
    esc(v.category || "Other");

  const views =
    Number(v.views || 0).toLocaleString();

  const thumbnail =
    v.thumbnail_url
      ? `
        <img
          src="${esc(v.thumbnail_url)}"
          alt="${title}"
          loading="lazy"
          style="
            position:absolute;
            inset:0;
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
          "
          onerror="this.style.display='none'"
        >
      `
      : "";

  return `
    <a
      class="card"
      href="video.html?id=${id}"
    >

      <div
        class="thumb"
        style="
          position:relative;
          overflow:hidden;
        "
      >

        ${thumbnail}

        <div
          class="thumbOverlay"
          style="
            position:absolute;
            inset:0;
            z-index:1;
          "
        ></div>

        <div
          class="playCircle"
          style="
            position:relative;
            z-index:2;
          "
        >
          ▶
        </div>

        <div
          class="cardViews"
          style="
            position:relative;
            z-index:2;
          "
        >
          ${views} views
        </div>

      </div>

      <div class="body">

        <h3>
          ${title}
        </h3>

        <div class="cardMeta">

          <span>
            ${category}
          </span>

          <span>
            ${views} views
          </span>

        </div>

      </div>

    </a>
  `;
}


/* =========================
   LATEST VIDEOS
========================= */

function render() {

  if (!videosEl) return;

  const items =
    getFiltered();

  videosEl.innerHTML =
    items
      .map(videoCard)
      .join("");


  const empty =
    document.querySelector("#empty");

  if (empty) {
    empty.hidden =
      items.length > 0;
  }


  renderCategories();

}


/* =========================
   MOST VIEWED
========================= */

function renderTrending() {

  if (!trendingEl) return;

  const mostViewed =
    [...all]
      .sort(
        (a, b) =>
          Number(b.views || 0) -
          Number(a.views || 0)
      )
      .slice(0, 8);


  if (!mostViewed.length) {

    trendingEl.innerHTML = `
      <p class="muted">
        No videos available yet.
      </p>
    `;

    return;
  }


  trendingEl.innerHTML =
    mostViewed
      .map(videoCard)
      .join("");

}


/* =========================
   CATEGORIES
========================= */

function renderCategories() {

  if (!categoryItems) return;

  const categories = [
    "All",
    ...new Set(
      all
        .map(v =>
          String(v.category || "").trim()
        )
        .filter(Boolean)
    )
  ];


  const q =
    (categorySearch?.value || "")
      .toLowerCase()
      .trim();


  const filtered =
    categories.filter(category =>
      category
        .toLowerCase()
        .includes(q)
    );


  categoryItems.innerHTML =
    filtered
      .map(category => `

        <button
          type="button"
          class="categoryItem ${
            category.toLowerCase() ===
            activeCategory.toLowerCase()
              ? "active"
              : ""
          }"
          data-category="${esc(category)}"
        >
          ${esc(category)}
        </button>

      `)
      .join("");


  categoryItems
    .querySelectorAll("[data-category]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          activeCategory =
            button.dataset.category;


          if (categoryBtn) {

            categoryBtn.textContent =
              activeCategory === "All"
                ? "☰ Categories"
                : "☰ " + activeCategory;

          }


          categoryList
            ?.classList
            .remove("show");


          render();

        }
      );

    });

}


/* =========================
   CATEGORY SEARCH
========================= */

categorySearch?.addEventListener(
  "input",
  () => {

    renderCategories();

  }
);


/* =========================
   VIDEO SEARCH
========================= */

search?.addEventListener(
  "input",
  () => {

    activeCategory = "All";

    if (categoryBtn) {
      categoryBtn.textContent =
        "☰ Categories";
    }

    render();

  }
);


/* =========================
   ESCAPE HTML
========================= */

export function esc(s) {

  return String(s ?? "")
    .replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m]));

}


/* =========================
   START
========================= */

load();
