
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";

const $ = selector => document.querySelector(selector);

const auth = $("#auth");
const panel = $("#panel");
const statusBox = $("#status");
const manage = $("#manage");
const modal = $("#videoPreviewModal");
const player = $("#previewPlayer");

let videos = [];
let previewToken = 0;
let loading = false;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function videoStatus(video) {
  if (["pending", "published", "hidden"].includes(video.status)) {
    return video.status;
  }
  return video.published === true ? "published" : "pending";
}

function statusLabel(value) {
  return ({
    pending: "Pending Approval",
    published: "Published",
    hidden: "Hidden"
  })[value] || "Pending Approval";
}

function statusClass(value) {
  return ({
    pending: "hidden",
    published: "published",
    hidden: "hidden"
  })[value] || "hidden";
}

function showLogin(message = "") {
  closePreview();
  panel.hidden = true;

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
        <p id="loginMsg" role="status">${esc(message)}</p>
      </form>
    </div>`;

  $("#login").addEventListener("submit", async event => {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector("button");
    const message = $("#loginMsg");

    button.disabled = true;
    message.textContent = "Signing in…";

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.get("email"),
        password: form.get("password")
      });

      if (error) throw error;
      await boot();
    } catch (error) {
      message.textContent = "Login failed: " + error.message;
    } finally {
      button.disabled = false;
    }
  });
}

async function boot() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    showLogin(error?.message || "");
    return;
  }

  if (data.session.user.id !== ADMIN_UID) {
    await supabase.auth.signOut();
    showLogin("Access denied. Use the authorised admin account.");
    return;
  }

  auth.innerHTML = `
    <div class="adminAccount">
      <span>Admin: <strong>${esc(data.session.user.email)}</strong></span>
      <button id="logout" class="btn ghost" type="button">Log out</button>
    </div>`;

  panel.hidden = false;

  $("#logout").onclick = async () => {
    closePreview();
    await supabase.auth.signOut();
    showLogin();
  };

  $("#adminSearch").addEventListener("input", render);
  $("#adminFilter").addEventListener("change", render);
  $("#upload").addEventListener("submit", uploadVideo);
  $("#refreshVideos").addEventListener("click", load);
  $("#closeVideoPreview").addEventListener("click", closePreview);

  modal.addEventListener("click", event => {
    if (event.target === modal) closePreview();
  });

  await load();
}

async function storageUrl(bucket, value) {
  if (!value) return "";

  const pathOrUrl = String(value).trim();

  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const path = pathOrUrl.replace(/^\/+/, "");

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 3600);

  if (error) throw error;
  return data.signedUrl;
}

async function load() {
  if (loading) return;
  loading = true;

  manage.innerHTML = `<p>Loading videos…</p>`;

  try {
    const { data, error } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    videos = data || [];
    updateStats();
    await render();
  } catch (error) {
    manage.innerHTML =
      `<p class="adminStatus">Could not load videos: ${esc(error.message)}</p>`;
  } finally {
    loading = false;
  }
}

function updateStats() {
  const count = value => {
    const element = document.getElementById(value.id);
    if (element) element.textContent = String(value.number);
  };

  count({ id: "statTotal", number: videos.length });
  count({
    id: "statPublished",
    number: videos.filter(v => videoStatus(v) === "published").length
  });
  count({
    id: "statHidden",
    number: videos.filter(v => videoStatus(v) !== "published").length
  });
  count({
    id: "statViews",
    number: videos.reduce((sum, v) => sum + Number(v.views || 0), 0)
  });
}

function filteredVideos() {
  const search = ($("#adminSearch")?.value || "").toLowerCase().trim();
  const filter = $("#adminFilter")?.value || "all";

  return videos.filter(video => {
    const text = [
      video.title,
      video.category,
      video.description
    ].join(" ").toLowerCase();

    const matchesSearch = !search || text.includes(search);
    const currentStatus = videoStatus(video);

    const matchesFilter =
      filter === "all" ||
      currentStatus === filter;

    return matchesSearch && matchesFilter;
  });
}

async function render() {
  const items = filteredVideos();

  if (!items.length) {
    manage.innerHTML = `<div class="adminEmpty">No videos found.</div>`;
    return;
  }

  manage.innerHTML = items.map(video => {
    const currentStatus = videoStatus(video);

    return `
      <article class="manage">
        <div class="manageThumb" data-thumb="${esc(video.id)}">
          <div class="adminThumbEmpty">▶</div>
        </div>

        <div class="manageInfo">
          <strong>${esc(video.title || "Untitled")}</strong>
          <span>${esc(video.category || "Other")} ·
            ${Number(video.views || 0)} views</span>
          <small class="${statusClass(currentStatus)}">
            ● ${statusLabel(currentStatus)}
          </small>
          <small>${esc(video.created_at || "")}</small>
        </div>

        <div class="manageActions">
          <button class="btn" data-preview="${esc(video.id)}" type="button">
            ▶ Watch Video
          </button>

          <label>
            Status
            <select data-status="${esc(video.id)}">
              <option value="pending" ${currentStatus === "pending" ? "selected" : ""}>Pending</option>
              <option value="published" ${currentStatus === "published" ? "selected" : ""}>Published</option>
              <option value="hidden" ${currentStatus === "hidden" ? "selected" : ""}>Hidden</option>
            </select>
          </label>

          <button class="btn ghost" data-edit="${esc(video.id)}" type="button">
            Edit
          </button>

          <button class="btn danger" data-delete="${esc(video.id)}" type="button">
            Delete
          </button>
        </div>
      </article>`;
  }).join("");

  for (const video of items) {
    const target = [...manage.querySelectorAll("[data-thumb]")]
      .find(el => el.dataset.thumb === String(video.id));

    if (!target || !video.thumbnail_url) continue;

    try {
      const url = await storageUrl("thumbnails", video.thumbnail_url);
      const img = document.createElement("img");
      img.src = url;
      img.alt = video.title || "Video thumbnail";
      img.onerror = () => {
        target.innerHTML = `<div class="adminThumbEmpty">▶</div>`;
      };
      target.replaceChildren(img);
    } catch {
      // Keep the placeholder when a thumbnail is unavailable.
    }
  }

  manage.querySelectorAll("[data-preview]").forEach(button => {
    button.onclick = () => previewVideo(button.dataset.preview);
  });

  manage.querySelectorAll("[data-status]").forEach(select => {
    select.onchange = () => {
      const oldVideo = videos.find(
        v => String(v.id) === select.dataset.status
      );
      const oldStatus = oldVideo ? videoStatus(oldVideo) : "pending";

      setVideoStatus(select.dataset.status, select.value)
        .catch(error => {
          alert("Status update failed: " + error.message);
          select.value = oldStatus;
        });
    };
  });

  manage.querySelectorAll("[data-edit]").forEach(button => {
    button.onclick = () => editVideo(button.dataset.edit);
  });

  manage.querySelectorAll("[data-delete]").forEach(button => {
    button.onclick = () => deleteVideo(button.dataset.delete);
  });
}

async function previewVideo(id) {
  const video = videos.find(v => String(v.id) === String(id));

  if (!video || !video.video_url) {
    alert("Video ka video_url database mein nahi mila.");
    return;
  }

  closePreview();
  const token = ++previewToken;

  $("#previewTitle").textContent = video.title || "Video Preview";
  $("#previewInfo").textContent =
    `${video.category || "Other"} · ${statusLabel(videoStatus(video))}`;
  $("#previewError").textContent = "Preparing video…";
  modal.hidden = false;

  try {
    const url = await storageUrl("videos", video.video_url);
    if (token !== previewToken) return;

    player.src = url;
    player.load();
    $("#previewError").textContent =
      "If playback fails, check the Storage bucket and file path.";

    player.play().catch(() => {});
  } catch (error) {
    if (token === previewToken) {
      $("#previewError").textContent =
        "Preview failed: " + error.message;
    }
  }
}

function closePreview() {
  previewToken++;
  if (player) {
    player.pause();
    player.removeAttribute("src");
    player.load();
  }
  if (modal) modal.hidden = true;
}

async function setVideoStatus(id, newStatus) {
  if (!["pending", "published", "hidden"].includes(newStatus)) {
    throw new Error("Invalid video status.");
  }

  const video = videos.find(v => String(v.id) === String(id));
  if (!video) throw new Error("Video not found.");

  const { error } = await supabase
    .from("videos")
    .update({
      status: newStatus,
      published: newStatus === "published"
    })
    .eq("id", id);

  if (error) throw error;

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

  if (!title.trim() || !category.trim()) {
    alert("Title and category are required.");
    return;
  }

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
  if (!video) return;

  if (!confirm(
    `Permanently delete "${video.title || "this video"}" from the database?`
  )) return;

  const { error } = await supabase
    .from("videos")
    .delete()
    .eq("id", id);

  if (error) {
    alert("Delete failed: " + error.message);
    return;
  }

  await load();
}

async function uploadVideo(event) {
  event.preventDefault();

  const uploadForm = event.currentTarget;
  const form = new FormData(uploadForm);
  const file = form.get("video");
  const thumb = form.get("thumb");
  const button = $("#uploadBtn");

  if (!file || !file.size || !String(file.type).startsWith("video/")) {
    statusBox.textContent = "Please choose a valid video file.";
    return;
  }

  button.disabled = true;
  statusBox.textContent = "Uploading video…";

  try {
    const { data: { user }, error: userError } =
      await supabase.auth.getUser();

    if (userError || !user || user.id !== ADMIN_UID) {
      throw new Error("Authorised admin login required.");
    }

    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const folder = `${user.id}/${id}`;
    const videoPath = `${folder}/${safeName}`;

    const videoUpload = await supabase.storage
      .from("videos")
      .upload(videoPath, file, {
        contentType: file.type,
        upsert: false
      });

    if (videoUpload.error) throw videoUpload.error;

    let thumbnailPath = "";

    if (thumb && thumb.size) {
      if (!String(thumb.type).startsWith("image/")) {
        throw new Error("Please choose a valid image thumbnail.");
      }

      statusBox.textContent = "Uploading thumbnail…";

      const safeThumb = thumb.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      const thumbUpload = await supabase.storage
        .from("thumbnails")
        .upload(`${folder}/${safeThumb}`, thumb, {
          contentType: thumb.type,
          upsert: false
        });

      if (thumbUpload.error) throw thumbUpload.error;
      thumbnailPath = thumbUpload.data.path;
    }

    statusBox.textContent = "Saving pending video…";

    const { error } = await supabase.from("videos").insert({
      id,
      user_id: user.id,
      title: String(form.get("title") || "").trim(),
      category: String(form.get("category") || "").trim(),
      description: String(form.get("description") || "").trim(),
      video_url: videoUpload.data.path,
      thumbnail_url: thumbnailPath,
      status: "pending",
      published: false,
      views: 0
    });

    if (error) throw error;

    statusBox.textContent = "✓ Video uploaded. Pending approval.";
    uploadForm.reset();
    await load();
  } catch (error) {
    console.error(error);
    statusBox.textContent = "Upload failed: " + error.message;
  } finally {
    button.disabled = false;
  }
}

boot();
