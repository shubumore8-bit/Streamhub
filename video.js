import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";


const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


const page =
  document.querySelector("#page");


/* =========================
   ESCAPE HTML
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
   AGE CHECK
========================= */

function checkAge() {

  if (
    localStorage.getItem(
      "desivexa_age_verified"
    ) === "1"
  ) {

    return true;

  }


  const accepted = confirm(
    "18+ ONLY\n\n" +
    "You must be 18 years or older " +
    "to access this website."
  );


  if (!accepted) {

    window.location.href =
      "index.html";

    return false;

  }


  localStorage.setItem(
    "desivexa_age_verified",
    "1"
  );


  return true;

}


/* =========================
   GET VIDEO ID
========================= */

function getVideoId() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  return params.get("id");

}


/* =========================
   VIDEO CARD
========================= */

function createVideoCard(video) {

  const title =
    esc(
      video.title ||
      "Untitled video"
    );


  const category =
    esc(
      video.category ||
      "Other"
    );


  const views =
    Number(
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
      href="video.html?id=${encodeURIComponent(video.id)}"
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
   MORE / RANDOM VIDEOS
========================= */

async function loadMoreVideos(
  currentId
) {

  const box =
    document.querySelector(
      "#randomVideos"
    );


  if (!box) {
    return;
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
      thumbnail_url,
      views,
      created_at
    `)

    .eq(
      "published",
      true
    )

    .neq(
      "id",
      currentId
    )

    .limit(20);


  if (
    error ||
    !data ||
    !data.length
  ) {

    box.innerHTML = "";

    return;

  }


  /* RANDOMIZE */
  const randomVideos =
    [...data]
      .sort(
        () => Math.random() - 0.5
      )
      .slice(0, 8);


  box.innerHTML = `

    <div class="dvSectionTitle">

      <div>

        <span class="sectionLabel">
          MORE
        </span>

        <h2>
          More Videos
        </h2>

      </div>

    </div>


    <div class="dvGrid">

      ${randomVideos
        .map(createVideoCard)
        .join("")}

    </div>

  `;

}


/* =========================
   LOAD VIDEO
========================= */

async function loadVideo() {

  if (!checkAge()) {
    return;
  }


  const videoId =
    getVideoId();


  if (!videoId) {

    page.innerHTML = `

      <div class="videoError">

        <h2>
          Video not found
        </h2>

        <a href="index.html">
          Go Home
        </a>

      </div>

    `;

    return;

  }


  /* =========================
     GET VIDEO
  ========================== */

  const {
    data: video,
    error
  } = await supabase

    .from("videos")

    .select(`
      id,
      title,
      category,
      description,
      video_url,
      thumbnail_url,
      views,
      created_at
    `)

    .eq(
      "id",
      videoId
    )

    .eq(
      "published",
      true
    )

    .maybeSingle();


  if (error) {

    console.error(
      "Video loading error:",
      error
    );


    page.innerHTML = `

      <div class="videoError">

        <h2>
          Could not load video
        </h2>

        <p>
          Please try again later.
        </p>

        <a href="index.html">
          Go Home
        </a>

      </div>

    `;

    return;

  }


  if (
    !video ||
    !video.video_url
  ) {

    page.innerHTML = `

      <div class="videoError">

        <h2>
          Video unavailable
        </h2>

        <a href="index.html">
          Go Home
        </a>

      </div>

    `;

    return;

  }


  /* =========================
     VIDEO DATA
  ========================== */

  const title =
    esc(
      video.title ||
      "Untitled video"
    );


  const category =
    esc(
      video.category ||
      "Other"
    );


  const description =
    esc(
      video.description ||
      ""
    );


  const views =
    Number(
      video.views || 0
    ).toLocaleString();


  const poster =
    video.thumbnail_url
      ? `poster="${esc(
          video.thumbnail_url
        )}"`
      : "";


  /* =========================
     VIDEO PAGE
  ========================== */

  page.innerHTML = `

    <section class="videoWatch">


      <!-- PLAYER -->

      <div class="videoPlayerWrap">

        <video
          id="player"
          controls
          playsinline
          preload="metadata"
          ${poster}
        >

          <source
            src="${esc(video.video_url)}"
            type="video/mp4"
          >

          Your browser does not support
          HTML5 video.

        </video>

      </div>


      <!-- INFO -->

      <div class="videoInfo">

        <h1>
          ${title}
        </h1>


        <div class="videoMeta">

          <span>
            ${category}
          </span>

          <span>
            ${views} views
          </span>

        </div>


        ${
          description
            ? `
              <p class="videoDescription">
                ${description}
              </p>
            `
            : ""
        }

      </div>


      <!-- SMALL JUICYADS -->

      <div
        class="dvAdSlot dvAdSmall"
        style="
          width:100%;
          max-width:108px;
          min-height:140px;
          margin:20px auto;
          display:flex;
          justify-content:center;
          align-items:center;
        "
      >

        <script
          type="text/javascript"
          data-cfasync="false"
          async
          src="https://poweredby.jads.co/js/jads.js">
        </script>

        <ins
          id="1128309"
          data-width="108"
          data-height="140">
        </ins>

        <script
          type="text/javascript"
          data-cfasync="false"
          async
        >
          (adsbyjuicy = window.adsbyjuicy || []).push({
            'adzone': 1128309
          });
        </script>

      </div>


      <!-- MORE VIDEOS -->

      <div id="randomVideos"></div>


    </section>

  `;


  /* =========================
     COUNT VIEW
  ========================== */

  try {

    await supabase.rpc(
      "increment_video_views",
      {
        video_id: video.id
      }
    );

  } catch (error) {

    console.warn(
      "View counter error:",
      error
    );

  }


  /* =========================
     LOAD RANDOM VIDEOS
  ========================== */

  await loadMoreVideos(
    video.id
  );

}


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


      const query =
        event.target.value.trim();


      if (query) {

        window.location.href =
          `index.html?search=${encodeURIComponent(
            query
          )}`;

      } else {

        window.location.href =
          "index.html";

      }

    }
  );


/* =========================
   START
========================= */

loadVideo();
