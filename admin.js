import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Sirf tumhara admin account
const ADMIN_UID = "3ec24639-7bbf-4acc-84a8-b0ce18c75159";

const auth = document.querySelector("#auth");
const panel = document.querySelector("#panel");
const status = document.querySelector("#status");
const manage = document.querySelector("#manage");

let videos = [];

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));
}

function showLogin(message = "") {
  panel.hidden = true;
  auth.innerHTML = `
    <div class="adminLogin">
      <h1>DesiVexa Admin Login</h1>
      <form id="login" class="adminForm">
        <label>Email<input name="email" type="email" required></label>
        <label>Password<input name="password" type="password" required></label>
        <button class="btn" type="submit">Sign in</button>
        <p id="loginMsg" class="adminStatus">${esc(message)}</p>
      </form>
    </div>`;

  document.querySelector("#login").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    const msg = document.querySelector("#loginMsg");
    msg.textContent = "Signing in…";

    const { error } = await supabase.auth.signInWithPassword({
      email: f.get("email"),
      password: f.get("password")
    });

    if (error) {
      msg.textContent = error.message;
      return;
    }
    location.reload();
  };
}

async function boot() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session) {
    showLogin(error?.message || "");
    return;
  }

  if (session.user.id !== ADMIN_UID) {
    await supabase.auth.signOut();
    showLogin("Access denied. This account is not the admin account.");
    return;
  }

  panel.hidden = false;
  auth.innerHTML = `
    <div class="adminAccount">
      <span>Admin: <strong>${esc(session.user.email)}</strong></span>
      <button id="logout" class="btn ghost" type="button">Log out</button>
    </div>`;

  document.querySelector("#logout").onclick = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  document.querySelector("#adminSearch")?.addEventListener("input", render);
  document.querySelector("#adminFilter")?.addEventListener("change", render);
  document.querySelector("#upload")?.addEventListener("submit", uploadVideo);

  await load();
}

async function load() {
  manage.innerHTML = `<p class="muted">Loading videos…</p>`;

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    manage.innerHTML = `<p>Could not load videos: ${esc(error.message)}</p>`;
    return;
  }

  videos = data || [];
  updateStats();
  render();
}

function updateStats() {
  const put = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  put("statTotal", videos.length);
  put("statPublished", videos.filter(v => v.published === true).length);
  put("statHidden", videos.filter(v => v.published !== true).length);
  put("statViews", videos.reduce((n, v) => n + Number(v.views || 0), 0));
}

function filteredVideos() {
  const search = (document.querySelector("#adminSearch")?.value || "")
    .toLowerCase().trim();
  const filter = document.querySelector("#adminFilter")?.value || "all";

  return videos.filter(v => {
    const text = `${v.title || ""} ${v.category || ""} ${v.description || ""}`.toLowerCase();
    const matchesSearch = !search || text.includes(search);
    const matchesFilter =
      filter === "all" ||
      (filter === "published" && v.published === true) ||
      (filter === "hidden" && v.published !== true);
    return matchesSearch && matchesFilter;
  });
}

function render() {
  const items = filteredVideos();

  if (!items.length) {
    manage.innerHTML = `<div class="adminEmpty">No videos found.</div>`;
    return;
  }

  manage.innerHTML = items.map(v => `
    <article class="manage">
      <div class="manageThumb">
        ${v.thumbnail_url && /^https?:\/\//i.test(v.thumbnail_url)
          ? `<img src="${esc(v.thumbnail_url)}" alt="">`
          : `<div class="adminThumbEmpty">▶</div>`}
      </div>
      <div class="manageInfo">
        <strong>${esc(v.title || "Untitled")}</strong>
        <span>${esc(v.category || "Other")} · ${Number(v.views || 0)} views</span>
        <small class="${v.published ? "published" : "hidden"}">
          ${v.published ? "● Published" : "● Pending / Hidden"}
        </small>
      </div>
      <div class="manageActions">
        ${!v.published ? `<button class="btn" data-approve="${esc(v.id)}">Approve</button>` : ""}
        <button class="btn ghost" data-edit="${esc(v.id)}">Edit</button>
        <button class="btn ghost" data-toggle="${esc(v.id)}" data-published="${v.published}">${v.published ? "Unpublish" : "Keep Hidden"}</button>
        <button class="btn danger" data-delete="${esc(v.id)}">Delete</button>
      </div>
    </article>
  `).join("");

  manage.querySelectorAll("[data-approve]").forEach(b =>
    b.onclick = () => setPublished(b.dataset.approve, true));

  manage.querySelectorAll("[data-toggle]").forEach(b =>
    b.onclick = () => setPublished(b.dataset.toggle, b.dataset.published !== "true"));

  manage.querySelectorAll("[data-edit]").forEach(b =>
    b.onclick = () => editVideo(b.dataset.edit));

  manage.querySelectorAll("[data-delete]").forEach(b =>
    b.onclick = () => deleteVideo(b.dataset.delete));
}

async function setPublished(id, published) {
  const { error } = await supabase.from("videos")
    .update({ published })
    .eq("id", id);

  if (error) {
    alert("Update failed: " + error.message);
    return;
  }
  await load();
}

async function editVideo(id) {
  const v = videos.find(x => String(x.id) === String(id));
  if (!v) return;

  const title = prompt("Video title:", v.title || "");
  if (title === null) return;
  const category = prompt("Category:", v.category || "");
  if (category === null) return;
  const description = prompt("Description:", v.description || "");
  if (description === null) return;

  const { error } = await supabase.from("videos").update({
    title: title.trim(),
    category: category.trim(),
    description: description.trim()
  }).eq("id", id);

  if (error) {
    alert("Edit failed: " + error.message);
    return;
  }
  await load();
}

async function deleteVideo(id) {
  const v = videos.find(x => String(x.id) === String(id));
  if (!confirm(`Delete "${v?.title || "this video"}" from the database?`)) return;

  const { error } = await supabase.from("videos").delete().eq("id", id);
  if (error) {
    alert("Delete failed: " + error.message);
    return;
  }
  await load();
}

async function uploadVideo(event) {
  event.preventDefault();

  const form = new FormData(event.target);
  const file = form.get("video");
  const thumb = form.get("thumb");
  const button = document.querySelector("#uploadBtn");

  if (!file || !file.size) {
    status.textContent = "Please select a video.";
    return;
  }

  button.disabled = true;
  status.textContent = "Uploading video…";

  let videoPath = "";
  let thumbnailPath = "";

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || user.id !== ADMIN_UID) {
      throw new Error("Admin login required.");
    }

    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${id}`;

    const videoResult = await supabase.storage.from("videos").upload(
      `${path}/${safeName}`, file,
      { contentType: file.type, upsert: false }
    );
    if (videoResult.error) throw videoResult.error;
    videoPath = videoResult.data.path;

    if (thumb && thumb.size) {
      status.textContent = "Uploading thumbnail…";
      const safeThumb = thumb.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const thumbResult = await supabase.storage.from("thumbnails").upload(
        `${path}/${safeThumb}`, thumb,
        { contentType: thumb.type, upsert: false }
      );
      if (thumbResult.error) throw thumbResult.error;
      thumbnailPath = thumbResult.data.path;
    }

    status.textContent = "Saving as pending…";
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

    status.textContent = "✓ Uploaded. Pending approval.";
    event.target.reset();
    await load();
  } catch (err) {
    console.error(err);
    status.textContent = "Upload failed: " + (err.message || "Unknown error");
    // Files may remain in Storage if the database insert failed.
    if (!videoPath) status.textContent += " Check Storage permissions and bucket settings.";
  } finally {
    button.disabled = false;
  }
}

boot();
