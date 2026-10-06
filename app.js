import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// =====================================================
// AGE GATE
// =====================================================

const gate = document.querySelector("#ageGate");

if (localStorage.dv18 === "yes") {
  gate?.remove();
}

document.querySelector("#enter")?.addEventListener("click", () => {
  localStorage.dv18 = "yes";
  gate?.remove();
});

// =====================================================
// ELEMENTS
// =====================================================

const videosEl = document.querySelector("#videos");
const trendingEl = document.querySelector("#trendingVideos");

const categoryBtn = document.querySelector("#categoryBtn");
const categoryList = document.querySelector("#cats");
const categoryItems = document.querySelector("#categoryItems");
const categorySearch = document.querySelector("#categorySearch");

const search = document.querySelector("#search");

// =====================================================
// URL PARAMETERS
// =====================================================

const urlParams = new URLSearchParams(location.search);

let searchQuery =
  (urlParams.get("search") || "").trim();

let activeCategory =
  (urlParams.get("category") || "All").trim() || "All";

if (search && searchQuery) {
  search.value = searchQuery;
}

// =====================================================
// DATA
// =====================================================

let all = [];

// =====================================================
// CATEGORY MENU
// =====================================================

categoryBtn?.addEventListener("click", (e) => {
  e.stopPropagation();

  categoryList?.classList.toggle("show");

  if (categoryList?.classList.contains("show")) {
    setTimeout(() => {
      categorySearch?.focus();
    }, 50);
  }
});

// Close category menu when clicking outside

document.addEventListener("click", (e) => {
  if (!e.target.closest(".categoryMenu")) {
    categoryList?.classList.remove("show");
  }
});

// =====================================================
// SEARCH
// =====================================================

search?.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;

  e.preventDefault();

  const value = search.value.trim();

  // Empty search
  if (!value) {

    if (activeCategory !== "All") {
      location.href =
        `index.html?category=${encodeURIComponent(activeCategory)}`;
    } else {
      location.href = "index.html";
    }

    return;
  }

  const params = new URLSearchParams();

  params.set("search", value);

  if (activeCategory !== "All") {
    params.set("category", activeCategory);
  }

  location.href =
    `index.html?${params.toString()}`;
});

// =====================================================
// LOAD VIDEOS
// =====================================================

async function load() {

  if (videosEl) {
    videosEl.innerHTML =
      `<p class="muted">Loading videos...</p>`;
  }

  if (trendingEl) {
    trendingEl.innerHTML = "";
  }

  const {
    data,
    error
  } = await supabase
    .from("videos")
    .select("*")
    .eq("published", true)
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(
      "Supabase error:",
      error
    );

    if (videosEl) {
      videosEl.innerHTML = `
        <div class="videoError">
          <h3>Could not load videos</h3>
          <p>Please try again later.</p>
        </div>
      `;
    }

    return;
  }

  all = data || [];

  // Render categories
  renderCategories();

  // IMPORTANT:
  // Search/category selected
  // => Hide Most Viewed
  // => Show only matching Latest videos

  if (
    searchQuery ||
    activeCategory !== "All"
  ) {

    hideTrending();

  } else {

    showTrending();
    renderTrending();

  }

  // Render Latest
  render();
}

// =====================================================
// FILTER VIDEOS
// =====================================================

function getFiltered() {

  const q =
    searchQuery
      .toLowerCase()
      .trim();

  const selectedCategory =
    activeCategory
      .trim()
      .toLowerCase();

  return all.filter((v) => {

    const title =
      String(v.title || "")
        .toLowerCase();

    const category =
      String(v.category || "")
        .toLowerCase();

    const description =
      String(v.description || "")
        .toLowerCase();

    // Category check
    const categoryOK =
      selectedCategory === "all" ||
      category === selectedCategory;

    // Search check
    const searchOK =
      !q ||
      title.includes(q) ||
      category.includes(q) ||
      description.includes(q);

    return (
      categoryOK &&
      searchOK
    );
  });
}

// =====================================================
// VIDEO CARD
// =====================================================

function videoCard(v) {

  const id =
    encodeURIComponent(v.id);

  const title =
    esc(v.title || "Untitled video");

  const category =
    esc(v.category || "Other");

  const views =
    Number(v.views || 0)
      .toLocaleString();

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
          onerror="
            this.style.display='none'
          "
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
            position:absolute;
            left:50%;
            top:50%;
            transform:translate(-50%,-50%);
            z-index:2;
          "
        >
          ▶
        </div>

        <div
          class="cardViews"
          style="
            position:absolute;
            right:6px;
            bottom:5px;
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

// =====================================================
// LATEST VIDEOS
// =====================================================

function render() {

  if (!videosEl) return;

  const items =
    getFiltered();

  // No results
  if (!items.length) {

    let message =
      "No videos found.";

    if (
      searchQuery &&
      activeCategory !== "All"
    ) {

      message =
        `No videos found for "${esc(searchQuery)}" in "${esc(activeCategory)}".`;

    } else if (searchQuery) {

      message =
        `No video matches "${esc(searchQuery)}".`;

    } else if (
      activeCategory !== "All"
    ) {

      message =
        `No videos found in "${esc(activeCategory)}".`;
    }

    videosEl.innerHTML = `
      <div class="videoError">

        <h3>
          No videos found
        </h3>

        <p>
          ${message}
        </p>

      </div>
    `;

  } else {

    videosEl.innerHTML =
      items
        .map(videoCard)
        .join("");

  }

  // Hide old empty message if present
  const empty =
    document.querySelector("#empty");

  if (empty) {
    empty.hidden = true;
  }

  // Update category button
  if (categoryBtn) {

    categoryBtn.textContent =
      activeCategory === "All"
        ? "☰ Categories"
        : "☰ " + activeCategory;

  }
}

// =====================================================
// MOST VIEWED
// =====================================================

function renderTrending() {

  if (!trendingEl) return;

  // Most viewed is only shown
  // when there is NO search
  // and NO category filter.

  if (
    searchQuery ||
    activeCategory !== "All"
  ) {

    hideTrending();

    return;
  }

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

// =====================================================
// HIDE MOST VIEWED
// =====================================================

function hideTrending() {

  if (!trendingEl) return;

  trendingEl.innerHTML = "";

  // Find section containing Most Viewed
  const section =
    trendingEl.closest(".dvSection");

  if (section) {
    section.style.display = "none";
  }
}

// =====================================================
// SHOW MOST VIEWED
// =====================================================

function showTrending() {

  if (!trendingEl) return;

  const section =
    trendingEl.closest(".dvSection");

  if (section) {
    section.style.display = "";
  }
}

// =====================================================
// CATEGORIES
// =====================================================

function renderCategories() {

  if (!categoryItems) return;

  const categories = [
    "All",
    ...new Set(
      all
        .map(v =>
          String(v.category || "")
            .trim()
        )
        .filter(Boolean)
    )
  ];

  const q =
    (categorySearch?.value || "")
      .toLowerCase()
      .trim();

  const filtered =
    categories.filter(
      category =>
        category
          .toLowerCase()
          .includes(q)
    );

  categoryItems.innerHTML =
    filtered
      .map(category => {

        const active =
          category.toLowerCase() ===
          activeCategory.toLowerCase();

        return `
          <button
            type="button"
            class="
              categoryItem
              ${active ? "active" : ""}
            "
            data-category="${esc(category)}"
          >
            ${esc(category)}
          </button>
        `;

      })
      .join("");

  // Category click
  categoryItems
    .querySelectorAll(
      "[data-category]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const selected =
            button.dataset.category ||
            "All";

          // ALL
          if (
            selected.toLowerCase() ===
            "all"
          ) {

            if (searchQuery) {

              location.href =
                `index.html?search=${encodeURIComponent(searchQuery)}`;

            } else {

              location.href =
                "index.html";

            }

            return;
          }

          // Selected category
          const params =
            new URLSearchParams();

          params.set(
            "category",
            selected
          );

          // Keep search if present
          if (searchQuery) {

            params.set(
              "search",
              searchQuery
            );

          }

          location.href =
            `index.html?${params.toString()}`;
        }
      );

    });
}

// =====================================================
// CATEGORY SEARCH
// =====================================================

categorySearch?.addEventListener(
  "input",
  () => {

    renderCategories();

  }
);

// =====================================================
// ESCAPE HTML
// =====================================================

export function esc(s) {

  return String(s ?? "")
    .replace(
      /[&<>"']/g,
      m =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[m]
    );
}

// =====================================================
// START
// =====================================================

load();
