
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";
const VIDEO_BUCKET = "videos";
const THUMB_BUCKET = "thumbnails";
const SIGNED_URL_SECONDS = 3600;

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

function setStatus(message) {
  if (statusBox) statusBox.textContent = message;
}

function showLogin(message = "") {
  if (panel) panel.hidden = true;
  if (!auth) return;

  auth.innerHTML = `
    <div class="adminLogin">
      <h1>DesiVexa Admin Login</h1>
      <form id="login" class="adminForm">
        <label>Email
          <input name="email" type="email" autocomplete="username" required>
        </label>
        <label>Password
          <input name="password" type="password"
            autocomplete="current-password" required>
        </label>
        <button class="btn" type="submit">Sign in</button>
        <p id="loginMsg" class="adminStatus">${esc(message)}</p>
      </form>
    </div>
  `;

  $("#login").onsubmit = async (event) => {
    event.preventDefault();

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const msg = $("#loginMsg");
    const button = formElement.querySelector('button[type="submit"]');

    if (button) button.disabled = true;
    if (msg) msg.textContent = "Signing in...";

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.get("email"),
        password: form.get("password")
      });

      if (error) throw error;
      location.reload();
    } catch (error) {
      if (msg) msg.textContent = error.message || "Login failed.";
      if (button) button.disabled = false;
    }
  };
}

/*
 * Storage path, public URL, ya purane signed URL ko
 * fresh signed URL mein convert karta hai.
 */
async function storageUrl(bucket, value) {
  if (!value) {
    throw new Error("Database mein file path khaali hai.");
  }

  let path = String(value).trim();

  if (/^https?:\/\//i.test(path)) {
    let parsed;

    try {
      parsed = new URL(path);
    } catch {
      throw new Error("Storage URL valid nahi hai.");
    }

    // Non-Supabase video/image URL
    if (!parsed.hostname.endsWith(".supabase.co")) {
      return path;
    }

    const match = parsed.pathname.match(
      /\/storage\/v1\/object\/(?:public|authenticated|sign)\/([^/]+)\/(.+)$/
    );

    if (!match) {
      throw new Error("Supabase URL se bucket aur file path nahi mila.");
    }

    const urlBucket = decodeURIComponent(match[1]);

    if (urlBucket !== bucket) {
      throw new Error(
        `File "${urlBucket}" bucket mein hai, lekin expected "${bucket}" hai.`
      );
    }

    path = decodeURIComponent(match[2]);
  }

  path = path.replace(/^\/+/, "");

  if (path.startsWith(bucket + "/")) {
    path = path.slice(bucket.length + 1);
  }

  if (!path) {
    throw new Error("Storage object path khaali hai.");
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_SECONDS);

  if (error) {
    throw new Error(
      `Storage URL nahi bana: ${error.message}. File path: ${path}`
    );
  }

  if (!data?.signedUrl) {
    throw new Error("Supabase ne signed URL nahi diya.");
  }

  return data.signedUrl;
}

async function boot() {
  if (!auth || !panel || !manage) {
    console.error("admin.html mein #auth, #panel ya #manage missing hai.");
    return;
  }

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    const session = data?.session;

    if (!session) {
      showLogin();
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
        <button id="logout" class="btn ghost" type="button">Log out</button>
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
      if (event.target.id === "videoPreviewModal") closePreview();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePreview();
    });

    await load();
  } catch (error) {
    showLogin(error.message || "Admin dashboard load nahi hua.");
  }
}

async function load() {
  if (!manage) return;

  manage.innerHTML = `<p class="muted">Loading videos...</p>`;

  try {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    videos = data || [];
    updateStats();
    render();
  } catch (error) {
    manage.innerHTML =
      `<p>Videos load nahi hui: ${esc(error.message)}</p>`;
  }
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
    const searchable =
      `${v.title || ""} ${v.category || ""} ${v.description || ""}`
        .toLowerCase();

    const matchesSearch = !search || searchable.includes(search);

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
  if (!manage) return;

  const items = filteredVideos();

  if (!items.length) {
    manage.innerHTML = `<div class="adminEmpty">No videos found.</div>`;
    return;
  }

  manage.innerHTML = items.map((v) => `
    <article class="manage" data-video-card="${esc(v.id)}">
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

        ${!v.published ? `
          <button class="btn" data-approve="${esc(v.id)}" type="button">
            Publish
          </button>
        ` : ""}

        <button class="btn ghost" data-edit="${esc(v.id)}" type="button">
          Edit
        </button>

        <button class="btn ghost"
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

  // Thumbnails load independently so one missing image
  // does not stop the rest of the dashboard.
  items.forEach(async (video) => {
    if (!video.thumbnail_url) return;

    try {
      const url = await storageUrl(THUMB_BUCKET, video.thumbnail_url);

      const card = Array.from(
        manage.querySelectorAll("[data-video-card]")
      ).find(el => el.dataset.videoCard === String(video.id));

      if (!card) return;

      const thumbBox = card.querySelector(".manageThumb");
      if (!thumbBox) return;

      const img = document.createElement("img");
      img.src = url;
      img.alt = video.title || "Video thumbnail";
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";

      img.onerror = () => {
        thumbBox.innerHTML = `<div class="adminThumbEmpty">▶</div>`;
      };

      thumbBox.replaceChildren(img);
    } catch (error) {
      console.warn("Thumbnail load failed:", video.id, error.message);
    }
  });
}

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
    alert("Preview modal HTML mein missing hai. admin.html update karna hoga.");
    return;
  }

  const token = ++previewToken;

  player.pause();
  player.onerror = null;
  player.removeAttribute("src");
  player.load();

  title.textContent = video.title || "Video Preview";
  info.textContent = "Storage file load ho rahi hai...";
  errorBox.textContent = "";
  modal.hidden = false;

  try {
    const url = await storageUrl(VIDEO_BUCKET, video.video_url);

    if (token !== previewToken) return;

    player.src = url;
    player.load();

    info.textContent =
      `Category: ${video.category || "Other"} · Views: ${video.views || 0}`;

    player.onerror = () => {
      if (token !== previewToken) return;
      errorBox.textContent =
        "Video play nahi hui. File path, permissions, format aur network check karo.";
    };

    try {
      await player.play();
    } catch {
      if (token === previewToken) {
        info.textContent =
          "Video ready hai. Playback ke liye player par Play dabao.";
      }
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
    player.onerror = null;
    player.removeAttribute("src");
    player.load();
  }

  if (modal) modal.hidden = true;
  if ($("#previewInfo")) $("#previewInfo").textContent = "";
  if ($("#previewError")) $("#previewError").textContent = "";
}

async function setPublished(id, published) {
  try {
    const { error } = await supabase
      .from("videos")
      .update({ published })
      .eq("id", id);

    if (error) throw error;

    await load();
  } catch (error) {
    alert("Publish update failed: " + error.message);
  }
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

  try {
    const { error } = await supabase
      .from("videos")
      .update({
        title: title.trim(),
        category: category.trim(),
        description: description.trim()
      })
      .eq("id", id);

    if (error) throw error;

    await load();
  } catch (error) {
    alert("Edit failed: " + error.message);
  }
}

async function deleteVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));

  if (!confirm(
    `Database se "${video?.title || "this video"}" delete karna hai?`
  )) return;

  try {
    const { error } = await supabase
      .from("videos")
      .delete()
      .eq("id", id);

    if (error) throw error;

    // Database row delete hoti hai. Storage files apne aap delete nahi hoti.
    await load();
  } catch (error) {
    alert("Delete failed: " + error.message);
  }
}

async function uploadVideo(event) {
  event.preventDefault();

  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const file = form.get("video");
  const thumb = form.get("thumb");
  const button = $("#uploadBtn");

  if (!file || !file.size) {
    setStatus("Pehle video file select karo.");
    return;
  }

  if (file.type && !file.type.startsWith("video/")) {
    setStatus("Selected file video format mein nahi hai.");
    return;
  }

  if (button) button.disabled = true;
  setStatus("Video upload ho rahi hai...");

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
      .from(VIDEO_BUCKET)
      .upload(`${path}/${safeName}`, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (videoResult.error) throw videoResult.error;

    videoPath = videoResult.data.path;

    if (thumb && thumb.size) {
      if (thumb.type && !thumb.type.startsWith("image/")) {
        throw new Error("Thumbnail image file honi chahiye.");
      }

      setStatus("Thumbnail upload ho raha hai...");

      const safeThumb = thumb.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      const thumbResult = await supabase.storage
        .from(THUMB_BUCKET)
        .upload(`${path}/${safeThumb}`, thumb, {
          contentType: thumb.type || "image/jpeg",
          upsert: false
        });

      if (thumbResult.error) throw thumbResult.error;

      thumbnailPath = thumbResult.data.path;
    }

    setStatus("Database mein save ho raha hai...");

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

    setStatus("Upload successful! Video approval ke liye pending hai.");
    formElement.reset();
    await load();
  } catch (error) {
    console.error("Upload failed:", error);

    // Upload ke baad database insert fail ho to file Storage mein reh sakti hai.
    setStatus("Upload failed: " + (error.message || "Unknown error"));
  } finally {
    if (button) button.disabled = false;
  }
}

boot();
