import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// =====================================
// HILLTOPADS VAST
// =====================================
const HILLTOPADS_VAST =
  "https://organic-package.com/dYm/F.zHdyGONAvyZkGAUS/qeGmn9PuvZDUclVkvPITVcs0/O-T/MwxWN/j/EPtqNizIQj5FMbzmEV2/NIQU";


// =====================================
// HELPERS
// =====================================
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function getVideoId() {
  return new URLSearchParams(location.search).get("id");
}


// =====================================
// AGE GATE
// =====================================
function ageGate() {
  const key = "desivexa_age_verified";

  if (localStorage.getItem(key) === "1") {
    return true;
  }

  const ok = confirm(
    "18+ ONLY\n\nYou must be 18 years or older to access this website."
  );

  if (!ok) {
    location.href = "index.html";
    return false;
  }

  localStorage.setItem(key, "1");

  return true;
}


// =====================================
// LOAD VIDEO
// =====================================
async function loadVideo() {
  const page = document.querySelector("#page");

  if (!page) return;

  const id = getVideoId();

  if (!id) {
    page.innerHTML = `
      <div class="videoError">
        <h3>Video not found</h3>
        <p>No video ID was provided.</p>
        <a href="index.html">Go Home</a>
      </div>
    `;
    return;
  }

  page.innerHTML = `
    <p class="muted">Loading video...</p>
  `;

  try {

    // =====================================
    // ONLY FETCH REQUIRED VIDEO FIELDS
    // =====================================
    const { data: video, error } = await supabase
      .from("videos")
      .select(`
        id,
        title,
        category,
        description,
        video_url,
        thumbnail_url,
        views
      `)
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();

    if (error) throw error;

    if (!video) {
      page.innerHTML = `
        <div class="videoError">
          <h3>Video not found</h3>
          <p>This video may have been removed.</p>
          <a href="index.html">Go Home</a>
        </div>
      `;
      return;
    }


    // =====================================
    // DATA
    // =====================================
    const title = esc(
      video.title || "Untitled video"
    );

    const category = esc(
      video.category || "Other"
    );

    const description = esc(
      video.description || ""
    );

    const videoUrl = esc(
      video.video_url || ""
    );

    const thumbnail = esc(
      video.thumbnail_url || ""
    );


    if (!videoUrl) {
      page.innerHTML = `
        <div class="videoError">
          <h3>Video unavailable</h3>
        </div>
      `;
      return;
    }


    // =====================================
    // VIDEO HTML
    // =====================================
    page.innerHTML = `
      <section class="videoWatch">

        <div class="videoPlayerWrap">

          <video
            id="player"
            controls
            playsinline
            preload="metadata"
            ${thumbnail ? `poster="${thumbnail}"` : ""}
            style="
              width:100%;
              height:auto;
              background:#000;
            "
          >

            <source
              src="${videoUrl}"
              type="video/mp4"
            >

          </video>

        </div>


        <div class="videoInfo">

          <h1>${title}</h1>

          <div class="videoMeta">

            <span>${category}</span>

            <span>
              ${Number(video.views || 0).toLocaleString()} views
            </span>

          </div>


          ${
            description
              ? `<p class="videoDescription">${description}</p>`
              : ""
          }

        </div>


        <!-- RANDOM VIDEOS -->
        <div id="randomVideos"></div>

      </section>
    `;


    // =====================================
    // HILLTOPADS PRE-ROLL
    // =====================================
    if (window.fluidPlayer) {

      try {

        window.fluidPlayer("player", {

          layoutControls: {

            autoPlay: false,

            allowDownload: false,

            playbackRateEnabled: true,

            fillToContainer: true,

            playButtonShowing: true,

            primaryColor: "#d90000"

          },


          vastOptions: {

            adList: [

              {
                roll: "preRoll",

                vastTag: HILLTOPADS_VAST
              }

            ],

            // Reduced from 5
            maxAllowedVastTagRedirects: 3,

            // Reduced from 15 seconds
            vastTimeout: 8000,

            // Keep enabled because current VAST setup uses it
            allowVPAID: true

          }

        });

      } catch (e) {

        console.error(
          "Fluid Player error:",
          e
        );

      }

    }


    // =====================================
    // COUNT VIEW
    // =====================================
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


    // =====================================
    // RANDOM VIDEOS
    // =====================================
    await loadRandomVideos(video.id);


  } catch (error) {

    console.error(error);

    page.innerHTML = `
      <div class="videoError">

        <h3>Something went wrong</h3>

        <p>Please try again later.</p>

        <a href="index.html">
          Go Home
        </a>

      </div>
    `;

  }
}


// =====================================
// RANDOM VIDEOS
// =====================================
async function loadRandomVideos(currentId) {

  const box = document.querySelector(
    "#randomVideos"
  );

  if (!box) return;


  try {

    // =====================================
    // ONLY GET SMALL REQUIRED FIELDS
    // =====================================
    const { data, error } = await supabase

      .from("videos")

      .select(`
        id,
        title,
        category,
        thumbnail_url,
        views
      `)

      .eq("published", true)

      .neq("id", currentId)

      // Previously 50
      .limit(12);


    if (error) throw error;


    if (!data || data.length === 0) {

      box.innerHTML = "";

      return;
    }


    // =====================================
    // RANDOMIZE
    // =====================================
    const shuffled = [...data]

      .sort(
        () => Math.random() - 0.5
      )

      .slice(0, 8);


    // =====================================
    // DISPLAY
    // =====================================
    box.innerHTML = `

      <section class="dvSection randomSection">

        <div class="dvSectionTitle">

          <h2>
            <span>🎲</span>
            Random Videos
          </h2>

        </div>


        <div class="dvGrid randomGrid">

          ${shuffled
            .map(videoCard)
            .join("")}

        </div>

      </section>

    `;


    // =====================================
    // LAZY LOAD IMAGES
    // =====================================
    box
      .querySelectorAll("img")
      .forEach(img => {

        img.loading = "lazy";

        img.decoding = "async";

      });


  } catch (error) {

    console.warn(
      "Random videos error:",
      error
    );

  }
}


// =====================================
// VIDEO CARD
// =====================================
function videoCard(video) {

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


  const thumbnail = video.thumbnail_url
    ? esc(video.thumbnail_url)
    : "";


  return `

    <a
      class="card"
      href="video.html?id=${id}"
    >

      <div class="thumb">

        ${
          thumbnail

            ? `

              <img

                src="${thumbnail}"

                alt="${title}"

                loading="lazy"

                decoding="async"

              >

            `

            : `

              <div
                style="
                  width:100%;
                  height:100%;
                  background:#191919;
                "
              ></div>

            `
        }


        <div class="thumbOverlay">

          <div class="playCircle">
            ▶
          </div>


          <span class="cardViews">

            ${views} views

          </span>

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


// =====================================
// SEARCH
// =====================================
function setupSearch() {

  const search =
    document.querySelector(
      "#topSearch"
    );


  if (!search) return;


  search.addEventListener(
    "keydown",
    event => {

      if (event.key !== "Enter") {
        return;
      }


      const value =
        event.target.value.trim();


      if (!value) return;


      location.href =
        `index.html?search=${encodeURIComponent(value)}`;

    }
  );

}


// =====================================
// START
// =====================================
document.addEventListener(
  "DOMContentLoaded",
  () => {

    if (!ageGate()) {
      return;
    }


    setupSearch();


    loadVideo();

  }
);
