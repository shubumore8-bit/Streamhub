
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";

const $ = (selector) => document.querySelector(selector);

let videos = [];
let previewToken = 0;

const auth = $("#auth");
const panel = $("#panel");
const manage = $("#manage");
const statusBox = $("#status");

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function showLogin(message = "") {
  panel.hidden = true;

  auth.innerHTML = `
    <div class="adminLogin">
      <h1>DesiVexa Admin Login</h1>
      <form id="login" class="adminForm">
        <label>Email
          <input name="email" type="email" required>
        </label>
        <label>Password
          <input name="password" type="password" required>
        </label>
        <button class="btn" type="submit">Sign in</button>
        <p id="loginMsg" class="adminStatus">${esc(message)}</p>
      </form>
    </div>
  `;

  $("#login").onsubmit = async (event) => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const msg = $("#loginMsg");
    msg.textContent = "Signing in...";

    const { error } = await supabase.auth.signInWithPassword({
      email: form.get("email"),
      password: form.get("password")
    });

    if (error) {
      msg.textContent = error.message;
      return;
    }

    location.reload();
  };
}

/*
 * Storage path ko playable URL mein convert karta hai.
 * Private bucket ke liye signed URL banata hai.
 */
async function storageUrl(bucket, value) {
  if (!value) {
    throw new Error("Database mein file path khaali hai.");
  }

  let path = String(value).trim();

  // Agar poora URL database mein saved hai
  if (/^https?:\/\//i.test(path)) {
    let parsed;

    try {
      parsed = new URL(path);
    } catch {
      throw new Error("Storage URL valid nahi hai.");
    }

    // External video URL ko directly use karo
    if (!parsed.hostname.endsWith(".supabase.co")) {
      return path;
    }

    // Pehle se signed URL ho to token ke saath use karo
    if (
      parsed.pathname.includes("/storage/v1/object/sign/") &&
      parsed.searchParams.has("token")
    ) {
      return path;
    }

    // Supabase Storage URL se bucket aur object path nikaalo
    const match = parsed.pathname.match(
      /\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/
    );

    if (!match) {
      throw new Error("Supabase Storage URL se file path nahi mila.");
    }

    const urlBucket = decodeURIComponent(match[1]);

    if (urlBucket !== bucket) {
      throw new Error(
        `File ${urlBucket} bucket mein hai, lekin code ${bucket} bucket check kar raha hai.`
      );
    }

    path = decodeURIComponent(match[2]);
  }

  path = path.replace(/^\/+/, "");

  // Agar path mein bucket ka naam bhi ho, hata do
  if (path.startsWith(bucket + "/")) {
    path = path.slice(bucket.length + 1);
  }

  if (!path) {
    throw new Error("Storage object path khaali hai.");
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error) {
    throw new Error(
      `Storage file nahi mili ya access denied: ${error.message}. Path: ${path}`
    );
  }

  if (!data?.signedUrl) {
    throw new Error("Supabase ne signed URL nahi diya.");
  }

  return data.signedUrl;
}

async function boot() {
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;

  if (error || !session) {
    showLogin(error?.message || "");
    return;
  }

  if (session.user.id !== ADMIN_UID) {
    await supabase.auth.signOut();
    showLogin("Access denied: yeh admin account nahi hai.");
    return;
  }

  panel.hidden = false;

  auth.innerHTML = `
    <div class="adminAccount">
      <span>Admin: <strong>${esc(session.user.email)}</strong></span>
      <button id="logout" class="btn ghost" type="button">
        Log out
      </button>
    </div>
  `;

  $("#logout").onclick = async () => {
    closePreview();
    await supabase.auth.signOut();
    location.reload();
  };

  $("#adminSearch")?.addEventListener("input", render);
  $("#adminFilter")?.addEventListener("change", render);
  $("#upload")?.addEventListener("submit", uploadVideo);
  $("#refreshVideos")?.addEventListener("click", load);

  $("#closeVideoPreview")?.addEventListener("click", closePreview);

  $("#videoPreviewModal")?.addEventListener("click", (event) => {
    if (event.target.id === "videoPreviewModal") {
      closePreview();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePreview();
  });

  await load();
}

async function load() {
  manage.innerHTML = `<p class="muted">Loading videos...</p>`;

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    manage.innerHTML =
      `<p>Videos load nahi hui: ${esc(error.message)}</p>`;
    return;
  }

  videos = data || [];
  updateStats();
  render();
}

function updateStats() {
  const put = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  };

  put("statTotal", videos.length);
  put("statPublished", videos.filter(v => v.published === true).length);
  put("statHidden", videos.filter(v => v.published !== true).length);
  put(
    "statViews",
    videos.reduce((total, v) => total + Number(v.views || 0), 0)
  );
}

function filteredVideos() {
  const search = ($("#adminSearch")?.value || "").toLowerCase().trim();
  const filter = $("#adminFilter")?.value || "all";

  return videos.filter((v) => {
    const text =
      `${v.title || ""} ${v.category || ""} ${v.description || ""}`
        .toLowerCase();

    const matchesSearch = !search || text.includes(search);

    const matchesFilter =
      filter === "all" ||
      (filter === "published" && v.published === true) ||
      (filter === "hidden" && v.published !== true) ||
      (filter === "pending" &&
        v.published !== true &&
        v.status !== "hidden");

    return matchesSearch && matchesFilter;
  });
}

function render() {
  const items = filteredVideos();

  if (!items.length) {
    manage.innerHTML = `<div class="adminEmpty">No videos found.</div>`;
    return;
  }

  manage.innerHTML = items.map((v) => `
    <article class="manage">
      <div class="manageThumb">
        <div class="adminThumbEmpty">▶</div>
      </div>

      <div class="manageInfo">
        <strong>${esc(v.title || "Untitled")}</strong>
        <span>${esc(v.category || "Other")} · ${Number(v.views || 0)} views</span>
        <small class="${v.published ? "published" : "hidden"}">
          ${v.published ? "● Published" : "● Pending / Hidden"}
        </small>
      </div>

      <div class="manageActions">
        <button class="btn" data-preview="${esc(v.id)}" type="button">
          ▶ Preview
        </button>

        ${!v.published
          ? `<button class="btn" data-approve="${esc(v.id)}" type="button">Publish</button>`
          : ""}

        <button class="btn ghost" data-edit="${esc(v.id)}" type="button">
          Edit
        </button>

        <button
          class="btn ghost"
          data-toggle="${esc(v.id)}"
          data-published="${v.published}"
          type="button">
          ${v.published ? "Unpublish" : "Keep Hidden"}
        </button>

        <button class="btn danger" data-delete="${esc(v.id)}" type="button">
          Delete
        </button>
      </div>
    </article>
  `).join("");

  manage.querySelectorAll("[data-preview]").forEach((button) => {
    button.onclick = () => previewVideo(button.dataset.preview);
  });

  manage.querySelectorAll("[data-approve]").forEach((button) => {
    button.onclick = () => setPublished(button.dataset.approve, true);
  });

  manage.querySelectorAll("[data-toggle]").forEach((button) => {
    button.onclick = () => setPublished(
      button.dataset.toggle,
      button.dataset.published !== "true"
    );
  });

  manage.querySelectorAll("[data-edit]").forEach((button) => {
    button.onclick = () => editVideo(button.dataset.edit);
  });

  manage.querySelectorAll("[data-delete]").forEach((button) => {
    button.onclick = () => deleteVideo(button.dataset.delete);
  });
}

/* Main preview function */
async function previewVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));

  if (!video) {
    alert("Video database mein nahi mili.");
    return;
  }

  const modal = $("#videoPreviewModal");
  const player = $("#previewPlayer");
  const title = $("#previewTitle");
  const info = $("#previewInfo");
  const errorBox = $("#previewError");

  if (!modal || !player || !title || !info || !errorBox) {
    alert("Preview modal HTML mein nahi mila. admin.html check karo.");
    return;
  }

  const token = ++previewToken;

  player.pause();
  player.removeAttribute("src");
  player.load();

  title.textContent = video.title || "Video Preview";
  info.textContent = "Storage file load ho rahi hai...";
  errorBox.textContent = "";
  modal.hidden = false;

  try {
    const url = await storageUrl("videos", video.video_url);

    // Agar user ne is beech doosra preview khola ho
    if (token !== previewToken) return;

    player.src = url;
    player.load();

    info.textContent =
      `Category: ${video.category || "Other"} · Views: ${video.views || 0}`;

    player.onerror = () => {
      if (token !== previewToken) return;

      errorBox.textContent =
        "Video load nahi hui. Storage path, permissions, file format aur network check karo.";
    };

    // Mobile browser autoplay block kar sakta hai;
    // isliye controls se Play dabaya ja sakta hai.
    const playPromise = player.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        info.textContent =
          "Video ready hai. Playback ke liye player par Play dabao.";
      });
    }
  } catch (error) {
    if (token !== previewToken) return;

    errorBox.textContent = error.message || "Video preview failed.";
    info.textContent = "Storage se video URL nahi ban saka.";
  }
}

function closePreview() {
  previewToken++;

  const modal = $("#videoPreviewModal");
  const player = $("#previewPlayer");

  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.load();
  }

  if (modal) modal.hidden = true;

  if ($("#previewInfo")) $("#previewInfo").textContent = "";
  if ($("#previewError")) $("#previewError").textContent = "";
}

async function setPublished(id, published) {
  const { error } = await supabase
    .from("videos")
    .update({ published })
    .eq("id", id);

  if (error) {
    alert("Publish update failed: " + error.message);
    return;
  }

  await load();
}

async function editVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));
  if (!video) return;

  const title = prompt("Video title:", video.title || "");
  if (title === null) return;

  const category = prompt("Category:", video.category || "");
  if (category === null) return;

  const description = prompt("Description:", video.description || "");
  if (description === null) return;

  const { error } = await supabase
    .from("videos")
    .update({
      title: title.trim(),
      category: category.trim(),
      description: description.trim()
    })
    .eq("id", id);

  if (error) {
    alert("Edit failed: " + error.message);
    return;
  }

  await load();
}

async function deleteVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));

  if (!confirm(
    `Database se "${video?.title || "this video"}" delete karna hai?`
  )) return;

  const { error } = await supabase
    .from("videos")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Delete failed: " + error.message);
    return;
  }

  // Note: yeh database row delete karta hai, Storage files nahi.
  await load();
}

async function uploadVideo(event) {
  event.preventDefault();

  const form = new FormData(event.currentTarget);
  const file = form.get("video");
  const thumb = form.get("thumb");
  const button = $("#uploadBtn");

  if (!file || !file.size) {
    statusBox.textContent = "Pehle video file select karo.";
    return;
  }

  if (file.type && !file.type.startsWith("video/")) {
    statusBox.textContent = "Selected file video format mein nahi hai.";
    return;
  }

  button.disabled = true;
  statusBox.textContent = "Video upload ho rahi hai...";

  let videoPath = "";
  let thumbnailPath = "";

  try {
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    const user = userData?.user;

    if (userError || !user || user.id !== ADMIN_UID) {
      throw new Error("Admin login required.");
    }

    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${id}`;

    const videoResult = await supabase.storage
      .from("videos")
      .upload(`${path}/${safeName}`, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (videoResult.error) throw videoResult.error;

    videoPath = videoResult.data.path;

    if (thumb && thumb.size) {
      statusBox.textContent = "Thumbnail upload ho raha hai...";

      if (thumb.type && !thumb.type.startsWith("image/")) {
        throw new Error("Thumbnail image file honi chahiye.");
      }

      const safeThumb = thumb.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      const thumbResult = await supabase.storage
        .from("thumbnails")
        .upload(`${path}/${safeThumb}`, thumb, {
          contentType: thumb.type || "image/jpeg",
          upsert: false
        });

      if (thumbResult.error) throw thumbResult.error;

      thumbnailPath = thumbResult.data.path;
    }

    statusBox.textContent = "Database mein save ho raha hai...";

    const { error } = await supabase.from("videos").insert({
      id,
      user_id: user.id,
      title: String(form.get("title") || "").trim(),
      category: String(form.get("category") || "").trim(),
      description: String(form.get("description") || "").trim(),
      video_url: videoPath,
      thumbnail_url: thumbnailPath,
      published: false,
      views: 0
    });

    if (error) throw error;

    statusBox.textContent = "Upload successful. Video approval ke liye pending hai.";
    event.currentTarget.reset();

    await load();
  } catch (error) {
    console.error(error);

    statusBox.textContent =
      "Upload failed: " + (error.message || "Unknown error");
  } finally {
    button.disabled = false;
  }
}

boot();
