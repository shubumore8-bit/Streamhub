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


const id =
  new URLSearchParams(
    location.search
  ).get("id");


const EXOCLICK_VAST =
  "https://s.magsrv.com/v1/vast.php?idz=6048654";


function esc(s) {

  return String(s ?? "")
    .replace(
      /[&<>"']/g,
      m => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m])
    );

}


function show(message) {

  page.innerHTML = `

    <div class="videoError">

      <h1>${esc(message)}</h1>

      <p>
        <a href="index.html">
          ← Back to videos
        </a>
      </p>

    </div>

  `;

}


async function run() {

  try {

    /* 18+ */

    if (
      localStorage.dv18 !== "yes"
    ) {

      show("18+ only");

      return;

    }


    if (!id) {

      show("Video not found");

      return;

    }


    /* CURRENT VIDEO */

    const {
      data: v,
      error
    } = await supabase

      .from("videos")

      .select("*")

      .eq("id", id)

      .eq("published", true)

      .maybeSingle();


    if (error) {

      console.error(error);

      show(
        "Database error: " +
        (error.message || "Unknown error")
      );

      return;

    }


    if (!v) {

      show("Video not found");

      return;

    }


    /* RELATED VIDEOS */

    let related = [];


    const relatedResult =
      await supabase

        .from("videos")

        .select("*")

        .eq("published", true)

        .neq("id", v.id)

        .order(
          "views",
          {
            ascending: false
          }
        )

        .limit(8);


    if (!relatedResult.error) {

      related =
        relatedResult.data || [];

    }


    /* PAGE */

    page.innerHTML = `

      <div class="watchTop">

        <a
          href="index.html"
          class="backLink"
        >
          ← Back to videos
        </a>

      </div>


      <div class="playerBox">

        <video
          id="player"
          controls
          playsinline
          preload="metadata"
          poster="${esc(
            v.thumbnail_url || ""
          )}"
          style="
            width:100%;
            height:auto;
          "
        >

          <source
            src="${esc(v.video_url)}"
            type="video/mp4"
          >

          Your browser does not support
          HTML5 video.

        </video>

      </div>


      <div class="videoInfo">

        <div>

          <span class="videoCategory">
            ${esc(
              v.category || "Other"
            )}
          </span>

          <h1>
            ${esc(
              v.title || "Untitled video"
            )}
          </h1>

          <p class="videoStats">
            ${Number(
              v.views || 0
            ).toLocaleString()}
            views
          </p>

        </div>

      </div>


      <div class="videoDescription">

        <p>
          ${esc(
            v.description || ""
          )}
        </p>

      </div>


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


    /* RELATED */

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


    /* FLUID PLAYER */

    if (
      typeof window.fluidPlayer ===
      "function"
    ) {

      fluidPlayer(
        "player",
        {

          layoutControls: {

            autoPlay: false,

            allowDownload: false,

            playbackRateEnabled: true,

            fillToContainer: true,

            playButtonShowing: true

          },


          vastOptions: {

            adList: [

              {

                roll: "preRoll",

                vastTag:
                  EXOCLICK_VAST

              }

            ]

          }

        }
      );

    }


    /* VIEW COUNT */

    Promise.resolve(

      supabase.rpc(
        "increment_video_views",
        {
          video_id: v.id
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

      .catch(err => {

        console.warn(
          "View counter failed:",
          err
        );

      });


  } catch (err) {

    console.error(
      "Video page error:",
      err
    );

    show(
      err?.message ||
      "Something went wrong"
    );

  }

}


/* =========================
   RELATED CARD
========================= */

function videoCard(v) {

  const title =
    esc(
      v.title ||
      "Untitled video"
    );


  const category =
    esc(
      v.category ||
      "Other"
    );


  const views =
    Number(
      v.views || 0
    ).toLocaleString();


  const thumbnail =
    v.thumbnail_url

      ? `background-image:url("${esc(
          v.thumbnail_url
        )}")`

      : "";


  return `

    <a
      class="card"
      href="video.html?id=${encodeURIComponent(
        v.id
      )}"
    >

      <div
        class="thumb"
        style="${thumbnail}"
      >

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


run();
