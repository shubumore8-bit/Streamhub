import { createClient }
from "https://esm.sh/@supabase/supabase-js@2";

import {
SUPABASE_URL,
SUPABASE_ANON_KEY
} from "./config.js";

const supabase = createClient(
SUPABASE_URL,
SUPABASE_ANON_KEY
);

const page =
document.getElementById("page");

const params =
new URLSearchParams(
window.location.search
);

const videoId =
params.get("id");

const FALLBACK_THUMB =
"https://via.placeholder.com/640x360?text=DesiVexa";

function escapeHTML(value) {

if (
value === null ||
value === undefined
) {
return "";
}

return String(value)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");

}

function isUUID(value) {

return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
.test(value);

}

function formatViews(views) {

const number =
Number(views || 0);

if (number >= 1000000) {
return (
number / 1000000
).toFixed(1) + "M";
}

if (number >= 1000) {
return (
number / 1000
).toFixed(1) + "K";
}

return String(number);

}

function showError(title, message) {

page.innerHTML = "<div class="error"> <h2>${escapeHTML(title)}</h2> <p>${escapeHTML(message)}</p> <a href="index.html">Go Home</a> </div>";

}

/* -------------------------
CHECK VIDEO ID
------------------------- */

if (!videoId) {

showError(
"Video not found",
"No video ID was provided."
);

} else if (!isUUID(videoId)) {

showError(
"Invalid video link",
"This link does not contain a valid video ID."
);

} else {

loadVideo();

}

/* -------------------------
LOAD VIDEO
------------------------- */

async function loadVideo() {

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
  thumbnail_url,
  video_url,
  views,
  created_at
`)

.eq("id", videoId)

.eq("published", true)

.maybeSingle();

if (error) {

console.error(error);

showError(
  "Could not load video",
  "There was a problem loading this video."
);

return;

}

if (!video) {

showError(
  "Video not found",
  "This video may have been removed or unpublished."
);

return;

}

renderVideo(video);

increaseViews(video.id);

loadRelated(video);

loadComments(video.id);

}

/* -------------------------
RENDER VIDEO
------------------------- */

function renderVideo(video) {

const title =
escapeHTML(
video.title || "Untitled Video"
);

const category =
escapeHTML(
video.category || "Video"
);

const description =
escapeHTML(
video.description || ""
);

const videoURL =
video.video_url || "";

if (!videoURL) {

page.innerHTML = `
  <div class="error">
    Video file is not available.
  </div>
`;

return;

}

page.innerHTML = `

<div class="player">

  <video
    id="mainVideo"
    controls
    playsinline
    preload="metadata"
    poster="${escapeHTML(
      video.thumbnail_url || FALLBACK_THUMB
    )}"
  >

    <source
      src="${escapeHTML(videoURL)}"
      type="video/mp4"
    >

    Your browser does not support video playback.

  </video>

</div>


<h1 class="video-title">
  ${title}
</h1>


<div class="video-meta">
  ${category}
  ·
  ${formatViews(video.views)} views
</div>


<div class="actions">

  <button
    id="likeBtn"
    class="action-btn"
  >
    ❤️ Like
  </button>

  <button
    id="commentBtn"
    class="action-btn"
  >
    💬 Comments
  </button>

  <button
    id="shareBtn"
    class="action-btn"
  >
    🔗 Share
  </button>

</div>


${
  description
    ? `
      <div class="description">
        ${description}
      </div>
    `
    : ""
}


<section
  id="commentsSection"
  class="comments-box"
>

  <div class="comments-title">
    Comments
  </div>

  <form
    id="commentForm"
    class="comment-form"
  >

    <input
      id="commentInput"
      type="text"
      maxlength="500"
      placeholder="Write a comment..."
      autocomplete="off"
      required
    >

    <button type="submit">
      Post
    </button>

  </form>

  <div id="commentsList">
    <div class="loading">
      Loading comments...
    </div>
  </div>

</section>


<section class="related">

  <div class="related-title">
    Related Videos
  </div>

  <div
    id="relatedGrid"
    class="related-grid"
  >

    <div class="loading">
      Loading related videos...
    </div>

  </div>

</section>

`;

document
.getElementById("commentBtn")
?.addEventListener(
"click",
() => {

    document
      .getElementById("commentsSection")
      ?.scrollIntoView({
        behavior: "smooth"
      });

  }
);

document
.getElementById("shareBtn")
?.addEventListener(
"click",
shareVideo
);

document
.getElementById("likeBtn")
?.addEventListener(
"click",
likeVideo
);

document
.getElementById("commentForm")
?.addEventListener(
"submit",
postComment
);

}

/* -------------------------
VIEWS
------------------------- */

async function increaseViews(id) {

try {

const {
  data: current,
  error: readError
} = await supabase

  .from("videos")

  .select("views")

  .eq("id", id)

  .maybeSingle();


if (readError || !current) {
  return;
}


const newViews =
  Number(current.views || 0) + 1;


await supabase

  .from("videos")

  .update({
    views: newViews
  })

  .eq("id", id);

} catch (error) {

console.error(
  "View update error:",
  error
);

}

}

/* -------------------------
LIKE
------------------------- */

function likeVideo() {

const button =
document.getElementById(
"likeBtn"
);

if (!button) return;

button.textContent =
"❤️ Liked";

button.disabled = true;

}

/* -------------------------
SHARE
------------------------- */

async function shareVideo() {

const url =
window.location.href;

try {

if (
  navigator.share
) {

  await navigator.share({
    title: document.title,
    url
  });

  return;
}


await navigator.clipboard.writeText(
  url
);


alert(
  "Video link copied!"
);

} catch (error) {

console.error(
  "Share error:",
  error
);

}

}

/* -------------------------
RELATED VIDEOS
------------------------- */

async function loadRelated(video) {

const grid =
document.getElementById(
"relatedGrid"
);

if (!grid) return;

let query =
supabase

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

  .neq("id", video.id);

if (video.category) {

query =
  query.eq(
    "category",
    video.category
  );

}

const {
data,
error
} = await query

.order("created_at", {
  ascending: false
})

.limit(20);

if (error) {

console.error(error);

grid.innerHTML = `
  <div class="error">
    Could not load related videos.
  </div>
`;

return;

}

let videos =
data || [];

/*

* Agar same category me kam videos hain,
* to baaki latest videos le aao.
  */

if (videos.length < 20) {

const {
  data: extra
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

  .eq("published", true)

  .neq("id", video.id)

  .order("created_at", {
    ascending: false
  })

  .limit(20);


if (extra) {

  const existing =
    new Set(
      videos.map(
        item => item.id
      )
    );


  for (const item of extra) {

    if (
      !existing.has(item.id)
    ) {

      videos.push(item);

      existing.add(item.id);

    }

  }

}

}

videos =
videos.slice(0, 20);

if (!videos.length) {

grid.innerHTML = `
  <div class="empty">
    No related videos available.
  </div>
`;

return;

}

grid.innerHTML =
videos
.map(relatedCard)
.join("");

}

function relatedCard(video) {

const id =
encodeURIComponent(
video.id
);

const title =
escapeHTML(
video.title || "Untitled Video"
);

const thumbnail =
video.thumbnail_url ||
FALLBACK_THUMB;

return `

<a
  class="related-card"
  href="video.html?id=${id}"
>

  <img
    src="${escapeHTML(thumbnail)}"
    alt="${title}"
    loading="lazy"
    onerror="this.src='${FALLBACK_THUMB}'"
  >

  <div class="related-info">

    <div class="related-name">
      ${title}
    </div>

  </div>

</a>

`;

}

/* -------------------------
COMMENTS
------------------------- */

async function loadComments(videoId) {

const list =
document.getElementById(
"commentsList"
);

if (!list) return;

/*

* This assumes a comments table with:
* id
* video_id
* name
* comment
* created_at
  */

const {
data,
error
} = await supabase

.from("comments")

.select(`
  id,
  video_id,
  name,
  comment,
  created_at
`)

.eq("video_id", videoId)

.order("created_at", {
  ascending: false
})

.limit(100);

if (error) {

console.error(
  "Comments error:",
  error
);


list.innerHTML = `
  <div class="empty">
    Comments are currently unavailable.
  </div>
`;

return;

}

if (!data || data.length === 0) {

list.innerHTML = `
  <div class="empty">
    No comments yet. Be the first!
  </div>
`;

return;

}

list.innerHTML =
data
.map(commentCard)
.join("");

}

function commentCard(comment) {

const name =
escapeHTML(
comment.name || "Anonymous"
);

const text =
escapeHTML(
comment.comment || ""
);

return `

<div class="comment">

  <div class="comment-name">
    ${name}
  </div>

  <div class="comment-text">
    ${text}
  </div>

</div>

`;

}

/* -------------------------
POST COMMENT
------------------------- */

async function postComment(event) {

event.preventDefault();

const input =
document.getElementById(
"commentInput"
);

const button =
event.target.querySelector(
"button"
);

if (!input) return;

const commentText =
input.value.trim();

if (!commentText) return;

if (commentText.length > 500) {

alert(
  "Comment is too long."
);

return;

}

button.disabled = true;

button.textContent =
"Posting...";

/*

* Anonymous comments.
  */

const {
error
} = await supabase

.from("comments")

.insert({

  video_id: videoId,

  name: "Anonymous",

  comment: commentText

});

if (error) {

console.error(error);


alert(
  "Could not post comment."
);

button.disabled = false;

button.textContent =
  "Post";

return;

}

input.value = "";

button.disabled = false;

button.textContent =
"Post";

await loadComments(
videoId
);

}
