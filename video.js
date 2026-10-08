import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const page = document.querySelector("#page");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function getVideoId() {
  return new URLSearchParams(location.search).get("id");
}

function showError(title, message = "") {
  if (!page) return;

  page.innerHTML = `
    <div class="videoError">
      <h2>${esc(title)}</h2>
      ${message ? `<p>${esc(message)}</p>` : ""}
      <a href="index.html">← Back to videos</a>
    </div>
  `;
}

function checkAge() {
  if (localStorage.getItem("desivexa_age_verified") === "1") {
    return true;
  }

  const ok = confirm(
    "18+ ONLY\n\nYou must be 18 years or older to access this website."
  );

  if (!ok) {
    location.href = "index.html";
    return false;
  }

  localStorage.setItem("desivexa_age_verified", "1");
  return true;
}

function createVideoCard(video) {
  const id = encodeURIComponent(video.id);
  const title = esc(video.title || "Untitled video");
  const category = esc(video.category || "Other");
  const views = Number(video.views || 0).toLocaleString();

  const thumb = video.thumbnail_url
    ? `<img src="${esc(video.thumbnail_url)}"
            alt="${title}"
            loading="lazy"
            decoding="async">`
    : `<div class="noThumb">DESIVEXA</div>`;

  return `
    <a class="card" href="video.html?id=${id}">
      <div class="thumb">
        ${thumb}
        <div class="thumbOverlay"></div>
        <div class="playCircle">▶</div>
        <div class="cardViews">${views} views</div>
      </div>

      <div class="body">
        <h3>${title}</h3>

        <div class="cardMeta">
          <span>${category}</span>
          <span>${views} views</span>
        </div>
      </div>
    </a>
  `;
}

async function loadMoreVideos(currentId) {
  const box = document.querySelector("#randomVideos");

  if (!box) return;

  try {
    const { data, error } = await supabase
      .from("videos")
      .select(`
        id,
        title,
        category,
        thumbnail_url,
        views,
        created_at
      `)
      .eq("published", true)
      .neq("id", currentId)
      .order("created_at", {
        ascending: false
      })
      .limit(8);

    if (error) throw error;

    if (!data || data.length === 0) {
      box.innerHTML = "";
      return;
    }

    box.innerHTML = `
      <div class="dvSectionTitle">
        <div>
          <span class="sectionLabel">MORE</span>
          <h2>More Videos</h2>
        </div>
      </div>

      <div class="dvGrid">
        ${data.map(createVideoCard).join("")}
      </div>
    `;

  } catch (error) {
    console.warn("More videos error:", error);
    box.innerHTML = "";
  }
}

async function loadVideo() {

  if (!page) return;

  if (!checkAge()) return;

  const videoId = getVideoId();

  if (!videoId) {
    showError(
      "Video not found",
      "No video ID was provided."
    );
    return;
  }

  page.innerHTML = `
    <p class="muted">
      Loading video...
    </p>
  `;

  // 12 second safety timeout
  const timeout = setTimeout(() => {

    if (page.querySelector(".muted")) {

      showError(
        "Video loading timed out",
        "Please refresh the page and try again."
      );

    }

  }, 12000);

  try {

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

      .eq("id", videoId)

      .eq("published", true)

      .maybeSingle();

    clearTimeout(timeout);

    if (error) {

      console.error(
        "Supabase video error:",
        error
      );

      showError(
        "Could not load video",
        error.message || "Database error"
      );

      return;
    }

    if (!video) {

      showError(
        "Video not found",
        "This video may be unpublished or removed."
      );

      return;
    }

    if (!video.video_url) {

      showError(
        "Video unavailable",
        "This video does not have a video URL."
      );

      return;
    }

    const title =
      esc(video.title || "Untitled video");

    const category =
      esc(video.category || "Other");

    const description =
      esc(video.description || "");

    const videoUrl =
      esc(video.video_url);

    const views =
      Number(video.views || 0)
      .toLocaleString();

    const poster =
      video.thumbnail_url
        ? `poster="${esc(video.thumbnail_url)}"`
        : "";

    page.innerHTML = `

      <section class="videoWatch">

        <div class="videoPlayerWrap">

          <video
            id="player"
            controls
            playsinline
            preload="metadata"
            ${poster}>

            <source
              src="${videoUrl}"
              type="video/mp4">

            Your browser does not support
            HTML5 video.

          </video>

        </div>


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


        <div
          class="dvAdSlot dvAdSmall"
          data-juicy-ad="small">
        </div>


        <div id="randomVideos"></div>

      </section>

    `;


    // View counter
    supabase

      .rpc(
        "increment_video_views",
        {
          video_id: video.id
        }
      )

      .then(({ error }) => {

        if (error) {
          console.warn(
            "View counter error:",
            error
          );
        }

      })

      .catch(error => {

        console.warn(
          "View counter error:",
          error
        );

      });


    // More videos
    loadMoreVideos(video.id);


  } catch (error) {

    clearTimeout(timeout);

    console.error(
      "Video page error:",
      error
    );

    showError(
      "Something went wrong",
      error?.message ||
      "Please try again."
    );

  }
}


/* MENU */

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


/* SEARCH BUTTON */

document
  .querySelector("#searchBtn")
  ?.addEventListener(
    "click",
    () => {

      const box =
        document.querySelector(
          "#searchBox"
        );

      box?.classList.toggle("show");

      box
        ?.querySelector("input")
        ?.focus();

    }
  );


/* SEARCH */

document
  .querySelector("#search")
  ?.addEventListener(
    "keydown",
    event => {

      if (event.key !== "Enter") {
        return;
      }

      const query =
        event.target.value.trim();

      if (query) {

        location.href =
          `index.html?search=${encodeURIComponent(query)}`;

      } else {

        location.href =
          "index.html";

      }

    }
  );


/* START */

if (
  document.readyState === "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    loadVideo
  );

} else {

  loadVideo();

}
