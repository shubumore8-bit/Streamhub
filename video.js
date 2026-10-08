import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const page = document.getElementById("page");

const params = new URLSearchParams(
  window.location.search
);

const videoId = params.get("id");

const visitorKey = "desivexa_visitor_id";

function getVisitorId() {
  let id = localStorage.getItem(visitorKey);

  if (!id) {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      id = crypto.randomUUID();
    } else {
      id =
        "dv-" +
        Date.now() +
        "-" +
        Math.random().toString(36).slice(2);
    }

    localStorage.setItem(visitorKey, id);
  }

  return id;
}

const visitorId = getVisitorId();


/* =========================
   START
========================= */

if (!videoId) {

  page.innerHTML = `
    <div style="
      padding:30px;
      color:white;
      text-align:center;
    ">
      Video ID missing.
    </div>
  `;

} else {

  loadVideo();

}


/* =========================
   LOAD VIDEO
========================= */

async function loadVideo() {

  try {

    const result = await supabase
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
      .eq("id", videoId)
      .eq("published", true)
      .maybeSingle();

    if (result.error) {

      showError(result.error.message);

      return;

    }

    const video = result.data;

    if (!video) {

      showError("Video not found.");

      return;

    }

    renderVideo(video);

    /*
      Important:
      These are loaded separately so that
      a comment/like problem cannot break
      the video player.
    */

    loadLikes();

    loadComments();

    loadRandomVideos(video.id);

  } catch (error) {

    showError(
      error.message ||
      "Unable to load video."
    );

  }

}


/* =========================
   RENDER VIDEO
========================= */

function renderVideo(video) {

  page.innerHTML = `

    <div style="
      width:100%;
      max-width:1000px;
      margin:auto;
    ">

      <video
        id="mainVideo"
        controls
        playsinline
        preload="metadata"
        style="
          width:100%;
          display:block;
          background:#000;
          border-radius:10px;
        "
      ></video>


      <h1 style="
        color:white;
        font-size:21px;
        margin:15px 0 8px;
      ">
        ${escapeHTML(video.title || "Untitled")}
      </h1>


      <div style="
        color:#999;
        font-size:13px;
      ">

        ${escapeHTML(
          video.category || "Video"
        )}

        ·

        <span id="viewCount">
          ${Number(video.views || 0)}
        </span>

        views

      </div>


      <div style="
        display:flex;
        gap:10px;
        margin:18px 0;
      ">

        <button
          id="likeBtn"
          type="button"
          style="
            background:#222;
            color:white;
            border:0;
            border-radius:8px;
            padding:12px 18px;
            font-size:15px;
            cursor:pointer;
          "
        >

          ❤️
          <span id="likeText">
            Like
          </span>

          <span id="likeCount">
            0
          </span>

        </button>


        <button
          id="commentBtn"
          type="button"
          style="
            background:#222;
            color:white;
            border:0;
            border-radius:8px;
            padding:12px 18px;
            font-size:15px;
            cursor:pointer;
          "
        >
          💬 Comment
        </button>

      </div>


      ${
        video.description
          ? `
            <div style="
              color:#ccc;
              line-height:1.5;
              margin-bottom:25px;
            ">
              ${escapeHTML(video.description)}
            </div>
          `
          : ""
      }


      <!-- COMMENTS -->

      <section
        id="commentsSection"
        style="
          margin-top:30px;
        "
      >

        <h2 style="
          color:white;
        ">
          Comments
        </h2>


        <div style="
          display:flex;
          gap:8px;
          margin:15px 0;
        ">

          <input
            id="commentInput"
            type="text"
            maxlength="500"
            placeholder="Write a comment..."
            style="
              flex:1;
              min-width:0;
              background:#171717;
              color:white;
              border:1px solid #333;
              border-radius:8px;
              padding:12px;
              outline:none;
            "
          >


          <button
            id="commentSubmit"
            type="button"
            style="
              background:#e00000;
              color:white;
              border:0;
              border-radius:8px;
              padding:0 16px;
              cursor:pointer;
            "
          >
            Post
          </button>

        </div>


        <div id="commentStatus"></div>


        <div id="commentsList">

          <p style="
            color:#888;
          ">
            Loading comments...
          </p>

        </div>

      </section>


      <!-- RANDOM VIDEOS -->

      <section style="
        margin-top:35px;
      ">

        <h2 style="
          color:white;
        ">
          Random Videos
        </h2>


        <div
          id="randomVideos"
          style="
            display:grid;
            grid-template-columns:
              repeat(3,minmax(0,1fr));
            gap:8px;
          "
        >

          <p style="
            color:#888;
          ">
            Loading videos...
          </p>

        </div>

      </section>

    </div>

  `;


  /* VIDEO PLAYER */

  const player =
    document.getElementById(
      "mainVideo"
    );

  player.src =
    video.video_url;


  if (video.thumbnail_url) {

    player.poster =
      video.thumbnail_url;

  }


  player.load();


  /* VIEW COUNT */

  let counted = false;


  player.addEventListener(
    "play",
    async () => {

      if (counted) return;

      counted = true;

      const newViews =
        Number(video.views || 0) + 1;


      document.getElementById(
        "viewCount"
      ).textContent = newViews;


      await supabase
        .from("videos")
        .update({
          views: newViews
        })
        .eq(
          "id",
          video.id
        );

    }
  );


  /* BUTTONS */

  document
    .getElementById("likeBtn")
    .onclick = toggleLike;


  document
    .getElementById("commentBtn")
    .onclick = () => {

      document
        .getElementById(
          "commentsSection"
        )
        .scrollIntoView({
          behavior: "smooth"
        });

    };


  document
    .getElementById(
      "commentSubmit"
    )
    .onclick = addComment;


  document
    .getElementById(
      "commentInput"
    )
    .addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Enter"
        ) {

          addComment();

        }

      }
    );

}


/* =========================
   LOAD LIKES
========================= */

async function loadLikes() {

  const countEl =
    document.getElementById(
      "likeCount"
    );

  const textEl =
    document.getElementById(
      "likeText"
    );

  const button =
    document.getElementById(
      "likeBtn"
    );


  if (!countEl) return;


  try {

    const result =
      await supabase
        .from("video_likes")
        .select("*", {
          count: "exact",
          head: true
        })
        .eq(
          "video_id",
          videoId
        );


    if (result.error) {

      console.error(
        "Like count error:",
        result.error
      );

      countEl.textContent =
        "0";

    } else {

      countEl.textContent =
        Number(
          result.count || 0
        );

    }


    const userLike =
      await supabase
        .from("video_likes")
        .select("id")
        .eq(
          "video_id",
          videoId
        )
        .eq(
          "visitor_id",
          visitorId
        )
        .limit(1);


    if (userLike.error) {

      console.error(
        "User like error:",
        userLike.error
      );

      return;

    }


    const liked =
      userLike.data &&
      userLike.data.length > 0;


    if (liked) {

      textEl.textContent =
        "Liked";

      button.style.background =
        "#e00000";

    } else {

      textEl.textContent =
        "Like";

      button.style.background =
        "#222";

    }

  } catch (error) {

    console.error(
      "Like loading error:",
      error
    );

  }

}


/* =========================
   TOGGLE LIKE
========================= */

async function toggleLike() {

  const button =
    document.getElementById(
      "likeBtn"
    );


  if (!button) return;


  button.disabled =
    true;


  try {

    const existing =
      await supabase
        .from("video_likes")
        .select("id")
        .eq(
          "video_id",
          videoId
        )
        .eq(
          "visitor_id",
          visitorId
        )
        .limit(1);


    if (existing.error) {

      console.error(
        "Like check error:",
        existing.error
      );

      return;

    }


    if (
      existing.data &&
      existing.data.length > 0
    ) {

      const likeId =
        existing.data[0].id;


      const result =
        await supabase
          .from("video_likes")
          .delete()
          .eq(
            "id",
            likeId
          );


      if (result.error) {

        console.error(
          "Unlike error:",
          result.error
        );

      }

    } else {

      const result =
        await supabase
          .from("video_likes")
          .insert({
            video_id: videoId,
            visitor_id: visitorId
          });


      if (result.error) {

        console.error(
          "Like insert error:",
          result.error
        );

      }

    }


    await loadLikes();

  } catch (error) {

    console.error(
      "Like error:",
      error
    );

  } finally {

    button.disabled =
      false;

  }

}


/* =========================
   LOAD COMMENTS
========================= */

async function loadComments() {

  const list =
    document.getElementById(
      "commentsList"
    );


  if (!list) return;


  try {

    const result =
      await supabase
        .from("video_comments")
        .select(`
          id,
          comment,
          created_at
        `)
        .eq(
          "video_id",
          videoId
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(100);


    if (result.error) {

      console.error(
        "Comments loading error:",
        result.error
      );


      list.innerHTML = `

        <p style="
          color:#888;
        ">
          Could not load comments.
        </p>

      `;

      return;

    }


    const comments =
      result.data || [];


    if (!comments.length) {

      list.innerHTML = `

        <p style="
          color:#888;
        ">
          No comments yet.
          Be the first!
        </p>

      `;

      return;

    }


    list.innerHTML =
      comments
        .map(item => `

          <div style="
            background:#171717;
            border-radius:8px;
            padding:12px;
            margin-bottom:8px;
          ">

            <strong style="
              color:white;
            ">
              Guest
            </strong>


            <p style="
              color:#ccc;
              margin:6px 0 0;
              word-break:break-word;
            ">
              ${escapeHTML(
                item.comment
              )}
            </p>

          </div>

        `)
        .join("");


  } catch (error) {

    console.error(
      "Comments exception:",
      error
    );

    list.innerHTML = `

      <p style="
        color:#888;
      ">
        Could not load comments.
      </p>

    `;

  }

}


/* =========================
   ADD COMMENT
========================= */

async function addComment() {

  const input =
    document.getElementById(
      "commentInput"
    );

  const button =
    document.getElementById(
      "commentSubmit"
    );

  const status =
    document.getElementById(
      "commentStatus"
    );


  if (!input || !button) {
    return;
  }


  const comment =
    input.value.trim();


  if (!comment) {

    return;

  }


  button.disabled =
    true;

  button.textContent =
    "Posting...";


  if (status) {

    status.innerHTML = "";

  }


  try {

    const result =
      await supabase
        .from("video_comments")
        .insert({
          video_id: videoId,
          visitor_id: visitorId,
          comment: comment
        });


    /*
      IMPORTANT:
      If Supabase rejects the comment,
      show the exact error.
    */

    if (result.error) {

      console.error(
        "COMMENT INSERT ERROR:",
        result.error
      );


      const errorCode =
        result.error.code ||
        "unknown";

      const errorMessage =
        result.error.message ||
        "unknown";

      const errorDetails =
        result.error.details ||
        "none";

      const errorHint =
        result.error.hint ||
        "none";


      alert(
        "COMMENT ERROR\n\n" +
        "Code: " +
        errorCode +
        "\n\n" +
        "Message: " +
        errorMessage +
        "\n\n" +
        "Details: " +
        errorDetails +
        "\n\n" +
        "Hint: " +
        errorHint
      );


      return;

    }


    /* SUCCESS */

    input.value = "";


    if (status) {

      status.innerHTML = `

        <div style="
          color:#55d66b;
          font-size:13px;
          margin:8px 0 12px;
        ">
          ✓ Comment posted
        </div>

      `;

    }


    await loadComments();


  } catch (error) {

    console.error(
      "COMMENT EXCEPTION:",
      error
    );


    alert(
      "COMMENT ERROR\n\n" +
      (error.message ||
        "Unknown error")
    );


  } finally {

    button.disabled =
      false;

    button.textContent =
      "Post";

  }

}


/* =========================
   RANDOM VIDEOS
========================= */

async function loadRandomVideos(
  currentId
) {

  const box =
    document.getElementById(
      "randomVideos"
    );


  if (!box) return;


  try {

    const result =
      await supabase
        .from("videos")
        .select(`
          id,
          title,
          category,
          thumbnail_url,
          views
        `)
        .eq(
          "published",
          true
        )
        .neq(
          "id",
          currentId
        )
        .limit(50);


    if (result.error) {

      console.error(
        "Random videos error:",
        result.error
      );


      box.innerHTML = `

        <p style="
          color:#888;
        ">
          Unable to load videos.
        </p>

      `;

      return;

    }


    const videos =
      result.data || [];


    if (!videos.length) {

      box.innerHTML = `

        <p style="
          color:#888;
        ">
          No other videos available.
        </p>

      `;

      return;

    }


    videos.sort(
      () => Math.random() - 0.5
    );


    box.innerHTML =
      videos
        .slice(0, 20)
        .map(video => {

          const id =
            encodeURIComponent(
              video.id
            );


          return `

            <a
              href="video.html?id=${id}"
              style="
                display:block;
                text-decoration:none;
                color:white;
              "
            >

              ${
                video.thumbnail_url
                  ? `

                    <img
                      src="${escapeHTML(
                        video.thumbnail_url
                      )}"
                      loading="lazy"
                      style="
                        width:100%;
                        aspect-ratio:16/9;
                        object-fit:cover;
                        border-radius:7px;
                        display:block;
                      "
                      alt=""
                    >

                  `
                  : `

                    <div style="
                      width:100%;
                      aspect-ratio:16/9;
                      background:#171717;
                      border-radius:7px;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      font-size:25px;
                    ">
                      ▶
                    </div>

                  `
              }


              <div style="
                font-size:13px;
                margin-top:6px;
                line-height:1.3;
              ">

                ${escapeHTML(
                  video.title ||
                  "Untitled"
                )}

              </div>


              <div style="
                color:#888;
                font-size:11px;
                margin-top:3px;
              ">

                ${Number(
                  video.views || 0
                )}
                views

              </div>

            </a>

          `;

        })
        .join("");


  } catch (error) {

    console.error(
      "Random videos exception:",
      error
    );


    box.innerHTML = `

      <p style="
        color:#888;
      ">
        Unable to load videos.
      </p>

    `;

  }

}


/* =========================
   ERROR
========================= */

function showError(
  message
) {

  page.innerHTML = `

    <div style="
      padding:30px 20px;
      color:white;
      text-align:center;
    ">

      <h2>
        Could not load video
      </h2>

      <p style="
        color:#aaa;
      ">
        ${escapeHTML(message)}
      </p>

    </div>

  `;

}


/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}
