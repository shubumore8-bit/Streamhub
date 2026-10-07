import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================
   AGE GATE
========================= */

const ageGate = document.querySelector("#ageGate");

if (
  localStorage.getItem("desivexa_age_verified") === "1"
) {
  ageGate?.remove();
}

document
  .querySelector("#enter")
  ?.addEventListener("click", () => {

    localStorage.setItem(
      "desivexa_age_verified",
      "1"
    );

    ageGate?.remove();

  });


/* =========================
   HTML ESCAPE
========================= */

function esc(value) {

  return String(value ?? "")
    .replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));

}


/* =========================
   NORMALIZE
========================= */

function normalize(value) {

  return String(value ?? "")
    .trim()
    .toLowerCase();

}


/* =========================
   VIDEO CARD
========================= */

function createCard(video) {

  const id = encodeURIComponent(
    video.id
  );

  const title = esc(
    video.title || "Untitled video"
  );

  const category = esc(
    video.category || "Other"
  );

  const views = Number(
    video.views || 0
  ).toLocaleString();

  let thumbnail = "";

  if (video.thumbnail_url) {

    thumbnail = `
      <img
        src="${esc(video.thumbnail_url)}"
        alt="${title}"
        loading="lazy"
        decoding="async"
      >
    `;

  } else {

    thumbnail = `
      <div class="noThumb">
        DESIVEXA
      </div>
    `;

  }

  return `
    <a
      class="card"
      href="video.html?id=${id}"
    >

      <div class="thumb">

        ${thumbnail}

        <div class="thumbOverlay"></div>

        <div class="playCircle">
          ▶
        </div>

        <div class="cardViews">
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
   VARIABLES
========================= */

let allVideos = [];

let activeCategory = "All";


/* =========================
   LOAD VIDEOS
========================= */

async function loadVideos() {

  const latestContainer =
    document.querySelector("#videos");

  const trendingContainer =
    document.querySelector("#trendingVideos");


  if (latestContainer) {

    latestContainer.innerHTML = `
      <p class="muted">
        Loading videos...
      </p>
    `;

  }


  const {
    data,
    error
  } = await supabase

    .from("videos")

    .select(`
      id,
      title,
      category,
      description,
      thumbnail_url,
      views,
      created_at
    `)

    .eq(
      "published",
      true
    )

    .order(
      "created_at",
      {
        ascending: false
      }
    )

    .limit(40);


  if (error) {

    console.error(
      "Supabase video error:",
      error
    );


    if (latestContainer) {

      latestContainer.innerHTML = `
        <p class="muted">
          Could not load videos.
        </p>
      `;

    }


    if (trendingContainer) {

      trendingContainer.innerHTML = "";

    }

    return;

  }


  allVideos = data || [];


  renderVideos();

  renderCategories();

}


/* =========================
   FILTER + RENDER
========================= */

function renderVideos() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  const searchQuery =
    normalize(
      params.get("search") || ""
    );


  let filtered =
    allVideos.filter(video => {

      const videoCategory =
        normalize(
          video.category || "Other"
        );


      /* CATEGORY FILTER */

      if (
        activeCategory !== "All" &&
        videoCategory !==
          normalize(activeCategory)
      ) {

        return false;

      }


      /* SEARCH FILTER */

      if (!searchQuery) {

        return true;

      }


      const searchableText =
        normalize(`
          ${video.title || ""}
          ${video.category || ""}
          ${video.description || ""}
        `);


      return searchableText
        .includes(searchQuery);

    });


  /* =========================
     MOST VIEWED
  ========================== */

  const mostViewed =
    [...filtered]
      .sort(
        (a, b) =>
          Number(b.views || 0) -
          Number(a.views || 0)
      )
      .slice(0, 8);


  /* =========================
     LATEST
  ========================== */

  const latest =
    [...filtered]
      .sort(
        (a, b) =>
          new Date(b.created_at) -
          new Date(a.created_at)
      )
      .slice(0, 12);


  const trendingContainer =
    document.querySelector(
      "#trendingVideos"
    );


  const latestContainer =
    document.querySelector(
      "#videos"
    );


  /* =========================
     MOST VIEWED OUTPUT
  ========================== */

  if (trendingContainer) {

    if (mostViewed.length) {

      trendingContainer.innerHTML =
        mostViewed
          .map(createCard)
          .join("");

    } else {

      trendingContainer.innerHTML = `
        <p class="muted">
          No videos found.
        </p>
      `;

    }

  }


  /* =========================
     LATEST OUTPUT
  ========================== */

  if (latestContainer) {

    if (latest.length) {

      latestContainer.innerHTML =
        latest
          .map(createCard)
          .join("");

    } else {

      latestContainer.innerHTML = `
        <p class="muted">
          No videos found.
        </p>
      `;

    }

  }

}


/* =========================
   CATEGORIES
========================= */

function renderCategories(
  searchText = ""
) {

  const categoryBox =
    document.querySelector(
      "#categoryItems"
    );


  if (!categoryBox) {

    return;

  }


  const categoryMap =
    new Map();


  allVideos.forEach(video => {

    const raw =
      String(
        video.category || "Other"
      ).trim();


    if (!raw) {

      return;

    }


    const key =
      normalize(raw);


    if (!categoryMap.has(key)) {

      categoryMap.set(
        key,
        raw
      );

    }

  });


  const categories =
    [...categoryMap.values()]
      .sort(
        (a, b) =>
          a.localeCompare(b)
      );


  const filteredCategories =
    categories.filter(
      category =>
        normalize(category)
          .includes(
            normalize(searchText)
          )
    );


  let html = `

    <button
      class="categoryItem ${
        activeCategory === "All"
          ? "active"
          : ""
      }"
      data-cat="All"
      type="button"
    >
      All
    </button>

  `;


  html +=
    filteredCategories
      .map(category => {

        const safeCategory =
          esc(category);


        return `

          <button
            class="categoryItem ${
              normalize(
                activeCategory
              ) ===
              normalize(category)
                ? "active"
                : ""
            }"
            data-cat="${safeCategory}"
            type="button"
          >
            ${safeCategory}
          </button>

        `;

      })
      .join("");


  categoryBox.innerHTML =
    html;


  categoryBox
    .querySelectorAll(
      "[data-cat]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          activeCategory =
            button.dataset.cat ||
            "All";


          document
            .querySelector("#cats")
            ?.classList
            .remove("show");


          renderVideos();


          renderCategories(
            document
              .querySelector(
                "#categorySearch"
              )
              ?.value || ""
          );


          document
            .querySelector(
              "#categories"
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });

        }
      );

    });

}


/* =========================
   CATEGORY BUTTON
========================= */

document
  .querySelector("#categoryBtn")
  ?.addEventListener(
    "click",
    () => {

      document
        .querySelector("#cats")
        ?.classList
        .toggle("show");

    }
  );


/* =========================
   CATEGORY SEARCH
========================= */

document
  .querySelector("#categorySearch")
  ?.addEventListener(
    "input",
    event => {

      renderCategories(
        event.target.value
      );

    }
  );


/* =========================
   MOBILE MENU
========================= */

document
  .querySelector("#menuBtn")
  ?.addEventListener(
    "click",
    () => {

      document
        .querySelector(
          "#mobileMenu"
        )
        ?.classList
        .toggle("show");

    }
  );


/* =========================
   SEARCH BUTTON
========================= */

document
  .querySelector("#searchBtn")
  ?.addEventListener(
    "click",
    () => {

      const searchBox =
        document.querySelector(
          "#searchBox"
        );


      searchBox
        ?.classList
        .toggle("show");


      searchBox
        ?.querySelector("input")
        ?.focus();

    }
  );


/* =========================
   SEARCH
========================= */

const searchInput =
  document.querySelector(
    "#search"
  );


/* Restore search text */

if (searchInput) {

  const params =
    new URLSearchParams(
      window.location.search
    );

  searchInput.value =
    params.get("search") || "";

}


/* Search on Enter */

searchInput
  ?.addEventListener(
    "keydown",
    event => {

      if (
        event.key !== "Enter"
      ) {

        return;

      }


      const value =
        event.target.value.trim();


      if (value) {

        window.location.href =
          `index.html?search=${encodeURIComponent(
            value
          )}`;

      } else {

        window.location.href =
          "index.html";

      }

    }
  );


/* =========================
   CLOSE MOBILE MENU
========================= */

document
  .querySelectorAll(
    "#mobileMenu a"
  )
  .forEach(link => {

    link.addEventListener(
      "click",
      () => {

        document
          .querySelector(
            "#mobileMenu"
          )
          ?.classList
          .remove("show");

      }
    );

  });


/* =========================
   START
========================= */

loadVideos();
