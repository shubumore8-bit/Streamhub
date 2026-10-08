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

function escapeHTML(value) {
if (value === null || value === undefined) {
return "";
}

return String(value)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function showMessage(title, message) {
page.innerHTML = "<div style=" padding:30px 15px; text-align:center; color:white; "> <h2>${escapeHTML(title)}</h2> <p style="color:#aaa;"> ${escapeHTML(message)} </p> <a href="index.html" style="color:#ff3344;"> Go Home </a> </div>";
}

if (!videoId) {

showMessage(
"Video ID missing",
"Video URL me ID nahi mili."
);

} else {

loadVideo();

}

async function loadVideo() {

page.innerHTML = "<div style=" padding:40px; text-align:center; color:#aaa; "> Loading video... </div>";

console.log("Video ID:", videoId);

const {
data,
error
} = await supabase

.from("videos")

.select("*")

.eq("id", videoId)

.maybeSingle();

console.log("Supabase data:", data);
console.log("Supabase error:", error);

if (error) {

showMessage(
  "Supabase Error",
  error.message
);

return;

}

if (!data) {

showMessage(
  "Video not found",
  "Is ID ki koi row videos table me nahi mili."
);

return;

}

if (!data.video_url) {

showMessage(
  "Video URL missing",
  "Database me video_url empty hai."
);

return;

}

renderVideo(data);

}

function renderVideo(video) {

const title =
escapeHTML(
video.title || "Untitled Video"
);

const description =
escapeHTML(
video.description || ""
);

const category =
escapeHTML(
video.category || "Video"
);

const thumbnail =
video.thumbnail_url || "";

page.innerHTML = `

<div style="
  max-width:1000px;
  margin:auto;
  padding:10px;
  color:white;
">

  <video
    controls
    playsinline
    preload="metadata"
    ${
      thumbnail
        ? `poster="${escapeHTML(thumbnail)}"`
        : ""
    }
    style="
      width:100%;
      max-height:75vh;
      display:block;
      background:#000;
      border-radius:8px;
    "
  >

    <source
      src="${escapeHTML(video.video_url)}"
      type="video/mp4"
    >

    Your browser does not support video playback.

  </video>


  <h1 style="
    font-size:21px;
    margin:15px 0 6px;
  ">
    ${title}
  </h1>


  <div style="
    color:#999;
    font-size:13px;
  ">
    ${category}
    ·
    ${Number(video.views || 0)} views
  </div>


  ${
    description
      ? `
        <div style="
          color:#ccc;
          line-height:1.5;
          margin-top:15px;
          white-space:pre-wrap;
        ">
          ${description}
        </div>
      `
      : ""
  }

</div>

`;

}
