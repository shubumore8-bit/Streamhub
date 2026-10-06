import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";


import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";


const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );



/* =====================================================
   ELEMENT
===================================================== */

const page =
  document.querySelector("#page");



/* =====================================================
   VIDEO ID
===================================================== */

const id =
  new URLSearchParams(
    location.search
  ).get("id");



/* =====================================================
   EXOCLICK VAST URL
===================================================== */

const EXOCLICK_VAST =
  "https://s.magsrv.com/v1/vast.php?idz=6048654";



/* =====================================================
   ESCAPE HTML
===================================================== */

function esc(value) {

  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      character => {

        return {

          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"

        }[character];

      }
    );

}



/* =====================================================
   ERROR PAGE
===================================================== */

function show(message) {

  page.innerHTML = `

    <div class="videoError">

      <h1>
        ${esc(message)}
      </h1>

      <p>

        <a href="index.html">
          ← Back to videos
        </a>

      </p>

    </div>

  `;

}



/* =====================================================
   VIDEO CARD
===================================================== */

function videoCard(video) {

  const id =
    encodeURIComponent(
      video.id
    );


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


  const thumbnail =
    video.thumbnail_url
      ? `

        <img

          src="${esc(
            video.thumbnail_url
          )}"

          alt="${title}"

          loading="lazy"

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



/* =====================================================
   LOAD VIDEO
===================================================== */

async function run() {

  try {


    /* ================================================
       AGE GATE
    ================================================ */

    if (
      localStorage.dv18 !== "yes"
    ) {

      show("18+ only");

      return;

    }



    /* ================================================
       ID CHECK
    ================================================ */

    if (!id) {

      show("Video not found");

      return;

    }



    /* ================================================
       GET VIDEO
    ================================================ */

    const {

      data: video,

      error

    } = await supabase

      .from("videos")

      .select("*")

      .eq(
        "id",
        id
      )

      .eq(
        "published",
        true
      )

      .maybeSingle();



    if (error) {

      console.error(
        "Database error:",
        error
      );


      show(
        "Database error"
      );


      return;

    }



    if (!video) {

      show(
        "Video not found"
      );


      return;

    }



    /* ================================================
       RELATED VIDEOS
    ================================================ */

    let related = [];


    const relatedResult =
      await supabase

        .from("videos")

        .select("*")

        .eq(
          "published",
          true
        )

        .neq(
          "id",
          video.id
        )

        .order(
          "views",
          {
            ascending: false
          }
        )

        .limit(8);



    if (
      !relatedResult.error
    ) {

      related =
        relatedResult.data ||
        [];

    }



    /* ================================================
       PAGE HTML
    ================================================ */

    page.innerHTML = `

      <div class="watchTop">

        <a
          href="index.html"
          class="backLink"
        >

          ← Back to videos

        </a>

      </div>



      <!-- PLAYER -->

      <div class="playerBox">

        <video

          id="player"

          controls

          playsinline

          preload="metadata"

          poster="${esc(
            video.thumbnail_url || ""
          )}"

          style="
            width:100%;
            height:auto;
            display:block;
            background:#000;
          "

        >

          <source

            src="${esc(
              video.video_url
            )}"

            type="video/mp4"

          >

          Your browser does not support
          HTML5 video.

        </video>

      </div>



      <!-- VIDEO INFO -->

      <div class="videoInfo">

        <div>

          <span class="videoCategory">

            ${esc(
              video.category ||
              "Other"
            )}

          </span>


          <h1>

            ${esc(
              video.title ||
              "Untitled video"
            )}

          </h1>


          <p class="videoStats">

            ${Number(
              video.views || 0
            ).toLocaleString()}

            views

          </p>

        </div>

      </div>



      <!-- DESCRIPTION -->

      <div class="videoDescription">

        <p>

          ${esc(
            video.description ||
            ""
          )}

        </p>

      </div>



      <!-- RELATED -->

      <section class="relatedSection">

        <div class="sectionHeading">

          <div>

            <span class="sectionLabel">
              MORE VIDEOS
            </span>

            <h2>
              Related Videos
            </h2>

          </div>

        </div>


        <div
          id="relatedVideos"
          class="videoGrid"
        ></div>

      </section>

    `;



    /* ================================================
       RELATED RENDER
    ================================================ */

    const relatedEl =
      document.querySelector(
        "#relatedVideos"
      );


    if (relatedEl) {

      relatedEl.innerHTML =
        related
          .map(videoCard)
          .join("");

    }



    /* ================================================
       PLAYER
    ================================================ */

    if (
      typeof window.fluidPlayer !==
      "function"
    ) {

      console.error(
        "Fluid Player JS not loaded"
      );


      return;

    }



    /* ================================================
       EXOCLICK PRE-ROLL
    ================================================ */

    console.log(
      "ExoClick VAST:",
      EXOCLICK_VAST
    );


    const player =
      window.fluidPlayer(

        "player",

        {

          /* -----------------------------------------
             PLAYER CONTROLS
          ----------------------------------------- */

          layoutControls: {

            autoPlay: false,

            allowDownload: false,

            playbackRateEnabled: true,

            fillToContainer: true,

            playButtonShowing: true,

            primaryColor: "#d90000"

          },


          /* -----------------------------------------
             VAST
          ----------------------------------------- */

          vastOptions: {

            /* Pre-roll */

            adList: [

              {

                roll:
                  "preRoll",

                vastTag:
                  EXOCLICK_VAST

              }

            ],


            /* VAST WRAPPERS */

            maxAllowedVastTagRedirects:
              5,


            /* Timeout */

            vastTimeout:
              10000,


            /* VPAID */

            allowVPAID:
              true

          }

        }

      );


    console.log(
      "Fluid Player initialized",
      player
    );



    /* ================================================
       VIEW COUNTER
    ================================================ */

    Promise.resolve(

      supabase.rpc(

        "increment_video_views",

        {
          video_id:
            video.id
        }

      )

    )

      .then(
        ({ error }) => {

          if (error) {

            console.warn(
              "View counter failed:",
              error
            );

          }

        }
      )

      .catch(
        error => {

          console.warn(
            "View counter failed:",
            error
          );

        }
      );


  }


  catch (error) {

    console.error(
      "Video page error:",
      error
    );


    show(
      error?.message ||
      "Something went wrong"
    );

  }

}



/* =====================================================
   SEARCH
===================================================== */

document
  .querySelector("#topSearch")
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


      if (!value) {

        return;

      }


      location.href =
        `index.html?search=${encodeURIComponent(value)}`;

    }
  );



/* =====================================================
   START
===================================================== */

run();
