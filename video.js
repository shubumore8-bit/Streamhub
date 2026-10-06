import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const page = document.querySelector("#page");
const id = new URLSearchParams(location.search).get("id");

const EXOCLICK_VAST =
  "https://s.magsrv.com/v1/vast.php?idz=6048654";

function show(message) {
  page.innerHTML = `
    <h1>${message}</h1>
    <p>
      <a href="index.html">← Back to videos</a>
    </p>
  `;
}

async function run() {
  try {

    if (localStorage.dv18 !== "yes") {
      show("18+ only");
      return;
    }

    if (!id) {
      show("Video not found");
      return;
    }

    const { data: v, error } = await supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();

    if (error) {
      console.error("Supabase video error:", error);
      show("Database error: " + (error.message || "Unknown error"));
      return;
    }

    if (!v) {
      show("Video not found");
      return;
    }

    page.innerHTML = `
      <a href="index.html">← Back</a>

      <video
        id="player"
        controls
        playsinline
        preload="metadata"
        poster="${esc(v.thumbnail_url || "")}"
        style="width:100%;height:auto;"
      >
        <source
          src="${esc(v.video_url)}"
          type="video/mp4"
        >

        Your browser does not support HTML5 video.
      </video>

      <h1>${esc(v.title)}</h1>

      <p class="muted">
        ${esc(v.category || "")}
        ·
        ${Number(v.views || 0).toLocaleString()} views
      </p>

      <p>${esc(v.description || "")}</p>
    `;

    // Fluid Player + ExoClick pre-roll
    if (typeof window.fluidPlayer === "function") {

      fluidPlayer("player", {
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
              vastTag: EXOCLICK_VAST
            }
          ]
        }
      });

      console.log("Fluid Player loaded");
    } else {
      console.warn("Fluid Player not loaded. Using normal video.");
    }

    // View counter
    Promise.resolve(
      supabase.rpc("increment_video_views", {
        video_id: v.id
      })
    )
      .then(({ error }) => {
        if (error) {
          console.warn("View counter failed:", error);
        }
      })
      .catch(err => {
        console.warn("View counter failed:", err);
      });

  } catch (err) {

    console.error("Video page error:", err);

    show(
      `Page error: ${err?.message || String(err)}`
    );
  }
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

run();
