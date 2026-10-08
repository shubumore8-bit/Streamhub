import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const MEDIA_FUNCTION =
  `${SUPABASE_URL}/functions/v1/get-video-media`;

const page = document.getElementById("page");
const videoId = new URLSearchParams(location.search).get("id");

const visitorKey = "desivexa_visitor_id";

function getVisitorId() {
  let id = localStorage.getItem(visitorKey);

  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : `dv-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

    localStorage.setItem(visitorKey, id);
  }

  return id;
}

const visitorId = getVisitorId();

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
   GET PRIVATE VIDEO / THUMBNAIL SIGNED URL
========================================================= */

async function getMedia(id) {
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
  };

  console.log("=================================");
  console.log("DESIVEXA MEDIA REQUEST");
  console.log("URL:", MEDIA_FUNCTION);
  console.log("METHOD: POST");
  console.log("VIDEO ID:", id);
  console.log("=================================");

  let response;

  try {
    response = await fetch(MEDIA_FUNCTION, {
      method: "POST",
      headers,
      body: JSON.stringify({
        videoId: id
      })
    });
  } catch (networkError) {
    console.error("MEDIA NETWORK ERROR:", networkError);
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

/* =========================================================
   START
========================================================= */

if (!page) {
  console.error(
    "Page container #page not found."
  );
} else if (!videoId) {
  showError("Video ID missing.");
} else {
  loadVideo();
}

/* =========================================================
   LOAD VIDEO
========================================================= */

async function loadVideo() {
  try {
    page.innerHTML = `
      <div style="
        max-width:1000px;
        margin:auto;
        padding:20px;
        text-align:center;
        color:white;
      ">
        <div style="
          font-size:18px;
          margin-bottom:10px;
        ">
          Loading video...
        </div>

        <div style="
          color:#888;
          font-size:13px;
        ">
          Please wait...
        </div>
      </div>
    `;

    console.log(
      "Loading video:",
      videoId
    );

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
        views
      `)
      .eq("id", videoId)
      .eq("published", true)
      .maybeSingle();

    if (error) {
      console.error(
        "Supabase video error:",
        error
      );

      throw error;
    }

    if (!video) {
      throw new Error(
        "Video not found or video is not published."
      );
    }

    console.log(
      "Video database record:",
      video
    );

    /* -----------------------------------------
       GET SIGNED MEDIA URL
    ----------------------------------------- */

    const media = await getMedia(video.id);

    console.log(
      "SIGNED MEDIA:",
      media
    );

    renderVideo(
      video,
      media
    );

    loadLikes();
    loadRandomVideos(video.id);
    loadComments();

  } catch (error) {
    console.error(
      "VIDEO LOADING ERROR:",
      error
    );

    showError(
      error.message ||
      "Unable to load video."
    );
  }
}

/* =========================================================
   RENDER VIDEO
========================================================= */

function renderVideo(
  video,
  media
) {
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
        ${escapeHTML(
          video.title || "Untitled"
        )}
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
        gap:8px;
        margin:18px 0;
        flex-wrap:wrap;
      ">

        <button
          id="likeBtn"
          type="button"
          style="
            background:#222;
            color:white;
            border:0;
            border-radius:8px;
            padding:12px 16px;
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
            padding:12px 16px;
          "
        >
          💬 Comment
          <span id="commentCount">
            0
          </span>
        </button>

        <button
          id="shareBtn"
          type="button"
          style="
            background:#222;
            color:white;
            border:0;
            border-radius:8px;
            padding:12px 16px;
          "
        >
          🔗 Share
        </button>

      </div>

      <div
        id="shareStatus"
        style="
          color:#55d66b;
          font-size:13px;
        "
      ></div>

      ${
        video.description
          ? `
            <div style="
              color:#ccc;
              line-height:1.5;
              margin:16px 0 25px;
            ">
              ${escapeHTML(
                video.description
              )}
            </div>
          `
          : ""
      }

      <section style="
        margin-top:35px;
      ">

        <h2 style="
          color:white;
          font-size:20px;
        ">
          Random Videos
        </h2>

        <div
          id="randomVideos"
          style="
            display:grid;
            grid-template-columns:
              repeat(
                3,
                minmax(0,1fr)
              );
            gap:8px;
          "
        >
          <p style="color:#888">
            Loading videos...
          </p>
        </div>

      </section>

      <section
        id="commentsSection"
        style="
          margin-top:35px;
          padding-top:25px;
          border-top:1px solid #222;
        "
      >

        <h2 style="color:white">
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
            "
          >
            Post
          </button>

        </div>

        <div id="commentStatus"></div>

        <div id="commentsList">
          <p style="color:#888">
            Loading comments...
          </p>
        </div>

      </section>

    </div>
  `;

  const player =
    document.getElementById(
      "mainVideo"
    );

  /* -----------------------------------------
     SET VIDEO SOURCE
  ----------------------------------------- */

  if (!media.videoUrl) {
    console.error(
      "Missing videoUrl:",
      media
    );

    showError(
      "Video URL nahi mili."
    );

    return;
  }

  console.log(
    "SETTING VIDEO SRC:",
    media.videoUrl
  );

  player.src =
    media.videoUrl;

  if (media.thumbnailUrl) {
    player.poster =
      media.thumbnailUrl;
  }

  player.load();

  /* -----------------------------------------
     VIDEO EVENTS
  ----------------------------------------- */

  player.addEventListener(
    "loadedmetadata",
    () => {
      console.log(
        "VIDEO METADATA LOADED"
      );
    }
  );

  player.addEventListener(
    "canplay",
    () => {
      console.log(
        "VIDEO CAN PLAY"
      );
    }
  );

  player.addEventListener(
    "playing",
    () => {
      console.log(
        "VIDEO PLAYING"
      );
    }
  );

  player.addEventListener(
    "waiting",
    () => {
      console.log(
        "VIDEO WAITING"
      );
    }
  );

  player.addEventListener(
    "error",
    () => {
      const error =
        player.error;

      console.error(
        "VIDEO PLAYBACK ERROR:",
        error
      );

      if (error) {
        console.error(
          "MEDIA ERROR CODE:",
          error.code
        );

        console.error(
          "MEDIA ERROR MESSAGE:",
          error.message
        );
      }
    }
  );

  /* -----------------------------------------
     VIEW COUNT
  ----------------------------------------- */

  let counted = false;

  player.addEventListener(
    "play",
    async () => {
      if (counted) return;

      counted = true;

      const newViews =
        Number(video.views || 0) + 1;

      const viewCount =
        document.getElementById(
          "viewCount"
        );

      if (viewCount) {
        viewCount.textContent =
          newViews;
      }

      const {
        error
      } = await supabase
        .from("videos")
        .update({
          views: newViews
        })
        .eq(
          "id",
          video.id
        );

      if (error) {
        console.warn(
          "View count update failed:",
          error.message
        );
      }
    }
  );

  /* -----------------------------------------
     BUTTONS
  ----------------------------------------- */

  document.getElementById(
    "likeBtn"
  ).onclick = toggleLike;

  document.getElementById(
    "commentBtn"
  ).onclick = () => {
    document
      .getElementById(
        "commentsSection"
      )
      .scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
  };

  document.getElementById(
    "shareBtn"
  ).onclick = shareVideo;

  document.getElementById(
    "commentSubmit"
  ).onclick = addComment;

  document.getElementById(
    "commentInput"
  ).addEventListener(
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

/* =========================================================
   LIKES
========================================================= */

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
    console.warn(
      "Like count:",
      result.error.message
    );
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
    console.warn(
      "User like:",
      userLike.error.message
    );

    return;
  }

  const liked =
    (userLike.data || [])
      .length > 0;

  textEl.textContent =
    liked
      ? "Liked"
      : "Like";

  button.style.background =
    liked
      ? "#e00000"
      : "#222";
}

async function toggleLike() {
  const button =
    document.getElementById(
      "likeBtn"
    );

  button.disabled = true;

  try {
    const {
      data,
      error
    } = await supabase
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

    if (error) throw error;

    if (data?.length) {
      const result =
        await supabase
          .from("video_likes")
          .delete()
          .eq(
            "id",
            data[0].id
          );

      if (result.error) {
        throw result.error;
      }
    } else {
      const result =
        await supabase
          .from("video_likes")
          .insert({
            video_id:
              videoId,
            visitor_id:
              visitorId
          });

      if (result.error) {
        throw result.error;
      }
    }

    await loadLikes();

  } catch (error) {
    console.error(
      "Like update failed:",
      error
    );

    alert(
      "Like update nahi hua."
    );

  } finally {
    button.disabled = false;
  }
}

/* =========================================================
   COMMENTS
========================================================= */

async function loadComments() {
  const list =
    document.getElementById(
      "commentsList"
    );

  const countEl =
    document.getElementById(
      "commentCount"
    );

  try {
    const result =
      await supabase
        .from("video_comments")
        .select(
          "id,body,created_at"
        )
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
      throw result.error;
    }

    const comments =
      result.data || [];

    countEl.textContent =
      comments.length;

    renderComments(
      comments
    );

  } catch (error) {
    console.error(
      "Comments loading failed:",
      error
    );

    list.innerHTML = `
      <p style="color:#888">
        Could not load comments.
      </p>
    `;
  }
}

function renderComments(
  comments
) {
  const list =
    document.getElementById(
      "commentsList"
    );

  if (!comments.length) {
    list.innerHTML = `
      <p style="color:#888">
        No comments yet.
        Be the first!
      </p>
    `;

    return;
  }

  list.innerHTML =
    comments
      .map(
        item => `
          <div style="
            background:#171717;
            border:1px solid #242424;
            border-radius:8px;
            padding:12px;
            margin-bottom:8px;
          ">

            <strong style="color:white">
              Guest
            </strong>

            <p style="
              color:#ccc;
              margin:6px 0 0;
              word-break:break-word;
            ">
              ${escapeHTML(
                item.body ||
                item.comment ||
                ""
              )}
            </p>

          </div>
        `
      )
      .join("");
}

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

  const comment =
    input.value.trim();

  if (!comment) return;

  button.disabled = true;
  button.textContent =
    "Posting...";

  try {
    const {
      error
    } = await supabase
      .from("video_comments")
      .insert({
        video_id:
          videoId,
        visitor_id:
          visitorId,
        body:
          comment
      });

    if (error) {
      throw error;
    }

    input.value = "";

    status.innerHTML = `
      <p style="color:#55d66b">
        ✓ Comment posted
      </p>
    `;

    await loadComments();

  } catch (error) {
    console.error(
      "Comment insert failed:",
      error
    );

    alert(
      "Comment post nahi hua: " +
      (
        error.message ||
        "Unknown error"
      )
    );

  } finally {
    button.disabled = false;
    button.textContent =
      "Post";
  }
}

/* =========================================================
   SHARE
========================================================= */

async function shareVideo() {
  const url =
    location.href;

  const status =
    document.getElementById(
      "shareStatus"
    );

  try {
    if (
      navigator.share
    ) {
      await navigator.share({
        title:
          document.title ||
          "DesiVexa Video",
        text:
          "Watch this video on DesiVexa",
        url
      });
    } else {
      await navigator.clipboard
        .writeText(url);

      status.textContent =
        "✓ Video link copied";
    }

  } catch (error) {
    if (
      error.name !==
      "AbortError"
    ) {
      alert(
        "Copy this video link:\n\n" +
        url
      );
    }
  }
}

/* =========================================================
   RANDOM VIDEOS
========================================================= */

async function loadRandomVideos(
  currentId
) {
  const box =
    document.getElementById(
      "randomVideos"
    );

  try {
    const {
      data,
      error
    } = await supabase
      .from("videos")
      .select(
        "id,title,category,thumbnail_url,views"
      )
      .eq(
        "published",
        true
      )
      .neq(
        "id",
        currentId
      )
      .limit(50);

    if (error) {
      throw error;
    }

    const videos =
      data || [];

    if (!videos.length) {
      box.innerHTML = `
        <p style="color:#888">
          No other videos available.
        </p>
      `;

      return;
    }

    videos.sort(
      () =>
        Math.random() -
        0.5
    );

    const selected =
      videos.slice(
        0,
        20
      );

    box.innerHTML =
      selected
        .map(
          video => `
            <a
              href="video.html?id=${encodeURIComponent(
                video.id
              )}"
              style="
                display:block;
                text-decoration:none;
                color:white;
              "
            >

              <div
                id="thumb-${video.id}"
                style="
                  width:100%;
                  aspect-ratio:16/9;
                  background:#171717;
                  border-radius:7px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  color:#888;
                "
              >
                ▶
              </div>

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
          `
        )
        .join("");

    await Promise.all(
      selected.map(
        async video => {
          const target =
            document.getElementById(
              `thumb-${video.id}`
            );

          if (
            !target ||
            !video.thumbnail_url
          ) {
            return;
          }

          try {
            const media =
              await getMedia(
                video.id
              );

            if (
              media.thumbnailUrl
            ) {
              const img =
                document.createElement(
                  "img"
                );

              img.src =
                media.thumbnailUrl;

              img.alt = "";

              img.loading =
                "lazy";

              img.style.cssText =
                `
                  width:100%;
                  height:100%;
                  aspect-ratio:16/9;
                  object-fit:cover;
                  border-radius:7px;
                  display:block;
                `;

              target.replaceWith(
                img
              );
            }

          } catch (error) {
            console.warn(
              "Thumbnail unavailable:",
              video.id,
              error.message
            );
          }
        }
      )
    );

  } catch (error) {
    console.error(
      "Random videos failed:",
      error
    );

    box.innerHTML = `
      <p style="color:#888">
        Unable to load videos.
      </p>
    `;
  }
}

/* =========================================================
   ERROR
========================================================= */

function showError(
  message
) {
  if (!page) return;

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
        word-break:break-word;
      ">
        ${escapeHTML(
          message
        )}
      </p>

    </div>
  `;
}
