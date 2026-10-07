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
   VIDEO CARD
========================= */

function createCard(video) {

  const id =
    encodeURIComponent(video.id);

  const title =
    esc(video.title || "Untitled video");

  const category =
    esc(video.category || "Other");

  const views =
    Number(video.views || 0)
      .toLocaleString();

  let thumbnail = "";

  if (video.thumbnail_url) {

    thumbnail = `
      <img
        src="${esc(video.thumbnail_url)}"
        alt="${title}"
        loading="lazy"
        decoding="async">
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
      href="video.html?id=${id}">

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

    .eq("published", true)

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

  renderFeatured(
    [...allVideos].sort(
      (a, b) =>
        Number(b.views || 0) -
        Number(a.views || 0)
    )[0]
  );

  renderVideos();

  renderCategories();

}


/* =========================
   FEATURED VIDEO
========================= */

function renderFeatured(video) {

  const box = document.querySelector("#featuredVideo");

  if (!box) return;

  if (!video) {
    box.innerHTML = `
      <div class="featuredEmpty">
        No featured video available yet.
      </div>
    `;
    return;
  }

  const id = encodeURIComponent(video.id);
  const title = esc(video.title || "Featured video");
  const category = esc(video.category || "Other");
  const views = Number(video.views || 0).toLocaleString();

  const image = video.thumbnail_url
    ? `<img src="${esc(video.thumbnail_url)}" alt="${title}" loading="eager" decoding="async">`
    : `<div class="featuredNoThumb">DESIVEXA</div>`;

  box.innerHTML = `
    <a class="featuredCard" href="video.html?id=${id}">
      <div class="featuredThumb">
        ${image}
        <div class="featuredShade"></div>
        <span class="featuredBadge">FEATURED</span>
        <span class="featuredPlay">▶</span>
        <span class="featuredViews">${views} views</span>
      </div>

      <div class="featuredInfo">
        <span class="featuredCategory">${category}</span>
        <h2>${title}</h2>
        <span class="featuredWatch">Watch now →</span>
      </div>
    </a>
  `;
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
    (
      params.get("search") || ""
    )
      .trim()
      .toLowerCase();


  let filtered =
    allVideos.filter(video => {

      const category =
        video.category || "Other";


      if (
        activeCategory !== "All" &&
        category !== activeCategory
      ) {

        return false;

      }


      if (!searchQuery) {

        return true;

      }


      const searchableText = `

        ${video.title || ""}

        ${video.category || ""}

        ${video.description || ""}

      `.toLowerCase();


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
     TRENDING OUTPUT
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


  const categories = [

    ...new Set(

      allVideos.map(
        video =>
          video.category || "Other"
      )

    )

  ]
    .sort(
      (a, b) =>
        a.localeCompare(b)
    );


  const filteredCategories =
    categories.filter(
      category =>
        category
          .toLowerCase()
          .includes(
            searchText.toLowerCase()
          )
    );


  let html = `

    <button
      class="catItem ${
        activeCategory === "All"
          ? "active"
          : ""
      }"
      data-cat="All">

      All

    </button>

  `;


  html += filteredCategories

    .map(category => {

      const safeCategory =
        esc(category);

      return `

        <button
          class="catItem ${
            activeCategory === category
              ? "active"
              : ""
          }"
          data-cat="${safeCategory}">

          ${safeCategory}

        </button>

      `;

    })

    .join("");


  categoryBox.innerHTML = html;


  categoryBox
    .querySelectorAll(
      "[data-cat]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          activeCategory =
            button.dataset.cat;


          const categoryPanel =
            document.querySelector(
              "#cats"
            );


          categoryPanel
            ?.classList
            .remove("show");


          renderVideos();


          renderCategories(
            document.querySelector(
              "#categorySearch"
            )?.value || ""
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
        .querySelector("#mobileMenu")
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

document
  .querySelector("#search")
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
          `index.html?search=${encodeURIComponent(value)}`;

      } else {

        window.location.href =
          "index.html";

      }

    }
  );


/* =========================
   START
========================= */

loadVideos();
