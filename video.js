import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const MEDIA_FUNCTION =
  `${SUPABASE_URL}/functions/v1/get-video-media`;

const page = document.getElementById("page");


// ======================================================
// GET VIDEO ID
// ======================================================

function getVideoId() {
  const params = new URLSearchParams(window.location.search);
  let id = params.get("id");

  if (!id) {
    return null;
  }

  // Handle accidental duplicate query string
  // Example:
  // UUID?id=UUID
  if (id.includes("?")) {
    id = id.split("?")[0];
  }

  if (id.includes("=")) {
    id = id.split("=")[0];
  }

  return id.trim();
}


const videoId = getVideoId();

console.log("=================================");
console.log("DESIVEXA VIDEO PAGE");
console.log("URL:", window.location.href);
console.log("VIDEO ID:", videoId);
console.log("=================================");


// ======================================================
// UUID VALIDATION
// ======================================================

function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(value);
}


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// ======================================================
// ERROR
// ======================================================

function showError(message) {
  if (!page) {
    return;
  }

  page.innerHTML = `
    <div style="
      min-height:50vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:30px 15px;
    ">
      <div style="
        width:100%;
        max-width:600px;
        background:#111;
        border:1px solid #292929;
        border-radius:14px;
        padding:25px;
        text-align:center;
      ">
        <div style="
          color:#ff3030;
          font-size:22px;
          font-weight:700;
          margin-bottom:12px;
        ">
          Could not load video
        </div>

        <div style="
          color:#aaa;
          font-size:14px;
          line-height:1.5;
          word-break:break-word;
        ">
          ${escapeHtml(message)}
        </div>

        <a href="index.html" style="
          display:inline-block;
          margin-top:20px;
          padding:11px 18px;
          background:#e50914;
          color:#fff;
          text-decoration:none;
          border-radius:8px;
          font-weight:600;
        ">
          Go Home
        </a>
      </div>
    </div>
  `;
}


// ======================================================
// MEDIA FUNCTION
// ======================================================

async function getMedia(id) {

  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  };

  console.log("---------------------------------");
  console.log("MEDIA FUNCTION REQUEST");
  console.log("URL:", MEDIA_FUNCTION);
  console.log("METHOD: POST");
  console.log("VIDEO ID:", id);
  console.log("---------------------------------");

  let response;

  try {

    response = await fetch(MEDIA_FUNCTION, {
      method: "POST",
      headers,
      body: JSON.stringify({
        videoId: id
      })
    });

  } catch (error) {

    console.error("MEDIA NETWORK ERROR:", error);

    throw new Error(
      "Media server se connection nahi ho paaya."
    );
  }


  const responseText = await response.text();

  console.log(
    "MEDIA RESPONSE STATUS:",
    response.status
  );

  console.log(
    "MEDIA RESPONSE:",
    responseText
  );


  let result = {};

  try {
    result = JSON.parse(responseText);
  } catch {
    result = {
      error: responseText
    };
  }


  if (!response.ok) {

    throw new Error(
      result.error ||
      result.message ||
      `Media request failed (${response.status})`
    );
  }


  if (!result.videoUrl) {

    console.error(
      "No videoUrl returned:",
      result
    );

    throw new Error(
      "Signed video URL nahi mili."
    );
  }


  return result;
}


// ======================================================
// LOAD VIDEO
// ======================================================

async function loadVideo() {

  if (!page) {
    console.error(
      "#page element nahi mila."
    );

    return;
  }


  if (!videoId) {

    showError(
      "Video ID URL me nahi mili."
    );

    return;
  }


  if (!isValidUUID(videoId)) {

    showError(
      `Invalid video ID: ${videoId}`
    );

    return;
  }


  page.innerHTML = `
    <div style="
      min-height:50vh;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#aaa;
      font-size:16px;
    ">
      Loading video...
    </div>
  `;


  try {

    // -----------------------------------------------
    // GET VIDEO DATABASE ROW
    // -----------------------------------------------

    const {
      data: video,
      error: videoError
    } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .eq("published", true)
      .maybeSingle();


    if (videoError) {

      console.error(
        "VIDEO DATABASE ERROR:",
        videoError
      );

      throw new Error(
        videoError.message
      );
    }


    if (!video) {

      throw new Error(
        "Published video nahi mila."
      );
    }


    console.log(
      "VIDEO DATABASE ROW:",
      video
    );


    // -----------------------------------------------
    // GET SIGNED MEDIA URL
    // -----------------------------------------------

    const media = await getMedia(
      video.id
    );


    console.log(
      "SIGNED MEDIA:",
      media
    );


    // -----------------------------------------------
    // RENDER
    // -----------------------------------------------

    renderVideo(
      video,
      media
    );


    // -----------------------------------------------
    // VIEWS
    // -----------------------------------------------

    increaseViews(
      video.id,
      video.views
    );


    // -----------------------------------------------
    // RANDOM VIDEOS
    // -----------------------------------------------

    loadRandomVideos(
      video.id
    );


    // -----------------------------------------------
    // COMMENTS
    // -----------------------------------------------

    loadComments(
      video.id
    );


    // -----------------------------------------------
    // LIKES
    // -----------------------------------------------

    setupLikeButton(
      video.id
    );


  } catch (error) {

    console.error(
      "LOAD VIDEO ERROR:",
      error
    );

    showError(
      error.message ||
      "Unknown error"
    );
  }
}


// ======================================================
// RENDER VIDEO
// ======================================================

function renderVideo(video, media) {

  page.innerHTML = `

    <section style="
      width:100%;
      padding:12px;
    ">

      <div style="
        width:100%;
        background:#000;
        border-radius:10px;
        overflow:hidden;
      ">

        <video
          id="mainVideo"
          controls
          playsinline
          preload="metadata"
          poster="${escapeHtml(media.thumbnailUrl || "")}"
          style="
            width:100%;
            max-height:75vh;
            display:block;
            background:#000;
          "
        ></video>

      </div>


      <div style="
        padding:15px 2px;
      ">

        <h1 style="
          margin:0 0 10px;
          font-size:20px;
          line-height:1.35;
          color:#fff;
        ">
          ${escapeHtml(video.title)}
        </h1>


        <div style="
          display:flex;
          gap:8px;
          flex-wrap:wrap;
          margin-bottom:14px;
        ">

          <span style="
            background:#181818;
            border:1px solid #292929;
            color:#aaa;
            padding:6px 10px;
            border-radius:20px;
            font-size:13px;
          ">
            ${escapeHtml(video.category || "Other")}
          </span>

          <span style="
            background:#181818;
            border:1px solid #292929;
            color:#aaa;
            padding:6px 10px;
            border-radius:20px;
            font-size:13px;
          ">
            ${Number(video.views || 0)} views
          </span>

        </div>


        <div style="
          display:flex;
          gap:10px;
          margin-bottom:18px;
        ">

          <button
            id="likeBtn"
            type="button"
            style="
              flex:1;
              padding:11px;
              border:1px solid #333;
              border-radius:8px;
              background:#151515;
              color:#fff;
              font-size:14px;
              cursor:pointer;
            "
          >
            ❤️ Like
          </button>


          <button
            id="commentScrollBtn"
            type="button"
            style="
              flex:1;
              padding:11px;
              border:1px solid #333;
              border-radius:8px;
              background:#151515;
              color:#fff;
              font-size:14px;
              cursor:pointer;
            "
          >
            💬 Comments
          </button>


          <button
            id="shareBtn"
            type="button"
            style="
              flex:1;
              padding:11px;
              border:1px solid #333;
              border-radius:8px;
              background:#151515;
              color:#fff;
              font-size:14px;
              cursor:pointer;
            "
          >
            ↗ Share
          </button>

        </div>


        ${
          video.description
            ? `
              <div style="
                background:#111;
                border:1px solid #222;
                border-radius:10px;
                padding:14px;
                color:#bbb;
                font-size:14px;
                line-height:1.6;
                margin-bottom:20px;
              ">
                ${escapeHtml(video.description)}
              </div>
            `
            : ""
        }


        <section id="commentsSection" style="
          margin-top:25px;
          scroll-margin-top:70px;
        ">

          <h2 style="
            font-size:19px;
            margin:0 0 14px;
          ">
            Comments
          </h2>


          <div id="commentForm"></div>


          <div id="commentsList">
            <div style="
              color:#777;
              padding:10px 0;
            ">
              Loading comments...
            </div>
          </div>

        </section>


        <section style="
          margin-top:35px;
        ">

          <h2 style="
            font-size:19px;
            margin:0 0 15px;
          ">
            Random Videos
          </h2>


          <div
            id="randomVideos"
            style="
              display:grid;
              grid-template-columns:repeat(2,minmax(0,1fr));
              gap:10px;
            "
          >
            <div style="color:#777;">
              Loading...
            </div>
          </div>

        </section>

      </div>

    </section>
  `;


  // -----------------------------------------------
  // VIDEO SOURCE
  // -----------------------------------------------

  const player =
    document.getElementById("mainVideo");


  if (player) {

    player.src =
      media.videoUrl;


    if (media.thumbnailUrl) {

      player.poster =
        media.thumbnailUrl;
    }


    player.addEventListener(
      "error",
      () => {

        console.error(
          "VIDEO PLAYER ERROR:",
          player.error
        );

      }
    );


    player.addEventListener(
      "loadedmetadata",
      () => {

        console.log(
          "VIDEO METADATA LOADED"
        );

      }
    );
  }


  // -----------------------------------------------
  // COMMENT SCROLL
  // -----------------------------------------------

  const commentButton =
    document.getElementById(
      "commentScrollBtn"
    );


  if (commentButton) {

    commentButton.addEventListener(
      "click",
      () => {

        const section =
          document.getElementById(
            "commentsSection"
          );

        if (section) {

          section.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

        }

      }
    );
  }


  // -----------------------------------------------
  // SHARE
  // -----------------------------------------------

  const shareButton =
    document.getElementById(
      "shareBtn"
    );


  if (shareButton) {

    shareButton.addEventListener(
      "click",
      async () => {

        const url =
          window.location.href;


        try {

          if (
            navigator.share
          ) {

            await navigator.share({
              title: video.title,
              url
            });

          } else {

            await navigator.clipboard.writeText(
              url
            );

            alert(
              "Video link copied!"
            );
          }

        } catch (error) {

          console.log(
            "Share cancelled:",
            error
          );

        }

      }
    );
  }
}


// ======================================================
// INCREASE VIEWS
// ======================================================

async function increaseViews(
  id,
  currentViews
) {

  try {

    await supabase
      .from("videos")
      .update({
        views:
          Number(currentViews || 0) + 1
      })
      .eq("id", id);

  } catch (error) {

    console.log(
      "Views update failed:",
      error
    );
  }
}


// ======================================================
// LIKE BUTTON
// ======================================================

async function setupLikeButton(
  id
) {

  const button =
    document.getElementById(
      "likeBtn"
    );


  if (!button) {
    return;
  }


  let liked = false;


  button.addEventListener(
    "click",
    async () => {

      liked = !liked;


      button.innerHTML =
        liked
          ? "❤️ Liked"
          : "❤️ Like";


      button.style.borderColor =
        liked
          ? "#e50914"
          : "#333";


      try {

        const visitorId =
          getVisitorId();


        if (liked) {

          await supabase
            .from("video_likes")
            .insert({
              video_id: id,
              visitor_id: visitorId
            });

        } else {

          await supabase
            .from("video_likes")
            .delete()
            .eq("video_id", id)
            .eq("visitor_id", visitorId);

        }

      } catch (error) {

        console.log(
          "Like database update:",
          error
        );

      }

    }
  );
}


// ======================================================
// VISITOR ID
// ======================================================

function getVisitorId() {

  let id =
    localStorage.getItem(
      "desivexa_visitor_id"
    );


  if (!id) {

    if (
      window.crypto &&
      crypto.randomUUID
    ) {

      id =
        crypto.randomUUID();

    } else {

      id =
        "visitor-" +
        Date.now() +
        "-" +
        Math.random()
          .toString(36)
          .substring(2);

    }


    localStorage.setItem(
      "desivexa_visitor_id",
      id
    );
  }


  return id;
}


// ======================================================
// COMMENTS
// ======================================================

async function loadComments(
  videoId
) {

  const list =
    document.getElementById(
      "commentsList"
    );


  const form =
    document.getElementById(
      "commentForm"
    );


  if (!list || !form) {
    return;
  }


  form.innerHTML = `

    <div style="
      display:flex;
      gap:8px;
      margin-bottom:18px;
    ">

      <input
        id="commentInput"
        type="text"
        maxlength="500"
        placeholder="Write a comment..."
        style="
          flex:1;
          min-width:0;
          background:#111;
          color:#fff;
          border:1px solid #333;
          border-radius:8px;
          padding:11px;
          outline:none;
        "
      >

      <button
        id="commentSubmit"
        type="button"
        style="
          padding:0 15px;
          border:0;
          border-radius:8px;
          background:#e50914;
          color:#fff;
          font-weight:600;
        "
      >
        Post
      </button>

    </div>
  `;


  const input =
    document.getElementById(
      "commentInput"
    );


  const submit =
    document.getElementById(
      "commentSubmit"
    );


  if (submit) {

    submit.addEventListener(
      "click",
      async () => {

        const body =
          input.value.trim();


        if (!body) {
          return;
        }


        submit.disabled = true;


        try {

          const visitorId =
            getVisitorId();


          const {
            error
          } = await supabase
            .from("video_comments")
            .insert({
              video_id: videoId,
              visitor_id: visitorId,
              body
            });


          if (error) {

            throw error;
          }


          input.value = "";


          await fetchComments(
            videoId
          );


        } catch (error) {

          console.error(
            "COMMENT ERROR:",
            error
          );


          alert(
            "Comment post nahi hua."
          );

        } finally {

          submit.disabled = false;

        }

      }
    );
  }


  await fetchComments(
    videoId
  );
}


// ======================================================
// FETCH COMMENTS
// ======================================================

async function fetchComments(
  videoId
) {

  const list =
    document.getElementById(
      "commentsList"
    );


  if (!list) {
    return;
  }


  try {

    const {
      data,
      error
    } = await supabase
      .from("video_comments")
      .select("*")
      .eq("video_id", videoId)
      .order("created_at", {
        ascending: false
      });


    if (error) {

      throw error;
    }


    if (!data || data.length === 0) {

      list.innerHTML = `
        <div style="
          color:#777;
          padding:15px 0;
        ">
          No comments yet.
        </div>
      `;

      return;
    }


    list.innerHTML =
      data.map(
        comment => `

          <div style="
            background:#111;
            border:1px solid #222;
            border-radius:10px;
            padding:12px;
            margin-bottom:10px;
          ">

            <div style="
              color:#aaa;
              font-size:12px;
              margin-bottom:6px;
            ">
              Visitor
            </div>

            <div style="
              color:#eee;
              font-size:14px;
              line-height:1.5;
              word-break:break-word;
            ">
              ${escapeHtml(comment.body)}
            </div>

          </div>

        `
      ).join("");


  } catch (error) {

    console.error(
      "FETCH COMMENTS ERROR:",
      error
    );


    list.innerHTML = `
      <div style="
        color:#777;
        padding:10px 0;
      ">
        Comments unavailable.
      </div>
    `;
  }
}


// ======================================================
// RANDOM VIDEOS
// ======================================================

async function loadRandomVideos(
  currentVideoId
) {

  const container =
    document.getElementById(
      "randomVideos"
    );


  if (!container) {
    return;
  }


  try {

    const {
      data,
      error
    } = await supabase
      .from("videos")
      .select(
        "id,title,category,thumbnail_url,views,duration"
      )
      .eq("published", true)
      .neq("id", currentVideoId)
      .limit(20);


    if (error) {

      throw error;
    }


    if (!data || data.length === 0) {

      container.innerHTML = `
        <div style="color:#777;">
          No other videos found.
        </div>
      `;

      return;
    }


    container.innerHTML = "";


    for (const video of data) {

      const card =
        document.createElement(
          "a"
        );


      card.href =
        `video.html?id=${encodeURIComponent(video.id)}`;


      card.style.cssText = `
        display:block;
        text-decoration:none;
        color:#fff;
        background:#111;
        border:1px solid #222;
        border-radius:9px;
        overflow:hidden;
      `;


      const thumbnail =
        video.thumbnail_url || "";


      card.innerHTML = `

        <div style="
          aspect-ratio:16/9;
          background:#1a1a1a;
          overflow:hidden;
        ">

          ${
            thumbnail
              ? `
                <img
                  src="${escapeHtml(thumbnail)}"
                  alt=""
                  loading="lazy"
                  style="
                    width:100%;
                    height:100%;
                    object-fit:cover;
                  "
                >
              `
              : `
                <div style="
                  width:100%;
                  height:100%;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  color:#e50914;
                  font-weight:700;
                ">
                  DesiVexa
                </div>
              `
          }

        </div>


        <div style="
          padding:9px;
        ">

          <div style="
            font-size:13px;
            font-weight:600;
            line-height:1.35;
            display:-webkit-box;
            -webkit-line-clamp:2;
            -webkit-box-orient:vertical;
            overflow:hidden;
          ">
            ${escapeHtml(video.title)}
          </div>


          <div style="
            color:#777;
            font-size:11px;
            margin-top:5px;
          ">
            ${Number(video.views || 0)} views
          </div>

        </div>
      `;


      container.appendChild(
        card
      );
    }


  } catch (error) {

    console.error(
      "RANDOM VIDEOS ERROR:",
      error
    );


    container.innerHTML = `
      <div style="color:#777;">
        Random videos unavailable.
      </div>
    `;
  }
}


// ======================================================
// START
// ======================================================

loadVideo();
