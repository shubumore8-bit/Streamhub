import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const auth = document.querySelector("#auth");
const panel = document.querySelector("#panel");
const status = document.querySelector("#status");
const manage = document.querySelector("#manage");

let videos = [];


/* =========================
   ESCAPE
========================= */

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char])
  );
}


/* =========================
   LOGIN
========================= */

function showLogin() {

  auth.innerHTML = `
    <div class="adminLogin">

      <span class="sectionLabel">
        DESIVEXA ADMIN
      </span>

      <h1>Admin Login</h1>

      <p class="muted">
        Sign in to manage your videos.
      </p>

      <form id="login" class="adminForm">

        <label>
          Email
          <input
            name="email"
            type="email"
            required
          >
        </label>

        <label>
          Password
          <input
            name="password"
            type="password"
            required
          >
        </label>

        <button
          class="btn"
          type="submit"
        >
          Sign in
        </button>

        <p id="loginMsg" class="adminStatus"></p>

      </form>

    </div>
  `;

  document.querySelector("#login").onsubmit =
    async event => {

      event.preventDefault();

      const form =
        new FormData(event.target);

      const msg =
        document.querySelector("#loginMsg");

      msg.textContent = "Signing in...";

      const { error } =
        await supabase.auth.signInWithPassword({
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


/* =========================
   BOOT
========================= */

async function boot() {

  try {

    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error(error);
      showLogin();
      return;
    }

    if (!session) {
      showLogin();
      return;
    }

    panel.hidden = false;

    auth.innerHTML = `
      <div class="adminAccount">

        <span>
          Signed in as
          <strong>
            ${esc(session.user.email)}
          </strong>
        </span>

        <button
          id="logout"
          class="btn ghost"
          type="button"
        >
          Log out
        </button>

      </div>
    `;

    document.querySelector("#logout").onclick =
      async () => {
        await supabase.auth.signOut();
        location.reload();
      };

    await load();

  } catch (error) {

    console.error(
      "Admin boot error:",
      error
    );

    auth.innerHTML = `
      <div class="adminLogin">
        <h1>Admin Error</h1>
        <p class="muted">
          ${esc(error.message)}
        </p>
      </div>
    `;
  }
}


/* =========================
   LOAD VIDEOS
========================= */

async function load() {

  const {
    data,
    error
  } = await supabase
    .from("videos")
    .select("*")
    .order(
      "created_at",
      { ascending: false }
    );

  if (error) {

    console.error(
      "Videos load error:",
      error
    );

    manage.innerHTML = `
      <div class="adminEmpty">
        <strong>Could not load videos</strong>
        <span>${esc(error.message)}</span>
      </div>
    `;

    return;
  }

  videos = data || [];

  updateStats();
  render();
}


/* =========================
   STATS
========================= */

function updateStats() {

  const total =
    videos.length;

  const published =
    videos.filter(
      video => video.published === true
    ).length;

  const hidden =
    total - published;

  const views =
    videos.reduce(
      (sum, video) =>
        sum + Number(video.views || 0),
      0
    );

  const totalEl =
    document.querySelector("#statTotal");

  const publishedEl =
    document.querySelector("#statPublished");

  const hiddenEl =
    document.querySelector("#statHidden");

  const viewsEl =
    document.querySelector("#statViews");

  if (totalEl)
    totalEl.textContent =
      total.toLocaleString();

  if (publishedEl)
    publishedEl.textContent =
      published.toLocaleString();

  if (hiddenEl)
    hiddenEl.textContent =
      hidden.toLocaleString();

  if (viewsEl)
    viewsEl.textContent =
      views.toLocaleString();
}


/* =========================
   FILTER
========================= */

function filteredVideos() {

  const search =
    (
      document.querySelector("#adminSearch")
        ?.value || ""
    )
      .toLowerCase()
      .trim();

  const filter =
    document.querySelector("#adminFilter")
      ?.value || "all";

  return videos.filter(video => {

    const text = `
      ${video.title || ""}
      ${video.category || ""}
      ${video.description || ""}
    `.toLowerCase();

    const searchOK =
      !search ||
      text.includes(search);

    let filterOK = true;

    if (filter === "published") {
      filterOK =
        video.published === true;
    }

    if (filter === "hidden") {
      filterOK =
        video.published === false;
    }

    return searchOK && filterOK;
  });
}


/* =========================
   RENDER
========================= */

function render() {

  const items =
    filteredVideos();

  if (!items.length) {

    manage.innerHTML = `
      <div class="adminEmpty">
        <strong>No videos found</strong>
        <span>
          Try another search or filter.
        </span>
      </div>
    `;

    return;
  }

  manage.innerHTML =
    items.map(videoRow).join("");

  document
    .querySelectorAll("[data-edit]")
    .forEach(button => {

      button.onclick = () =>
        editVideo(button.dataset.edit);

    });

  document
    .querySelectorAll("[data-toggle]")
    .forEach(button => {

      button.onclick = () =>
        togglePublish(
          button.dataset.toggle,
          button.dataset.published
        );

    });

  document
    .querySelectorAll("[data-delete]")
    .forEach(button => {

      button.onclick = () =>
        deleteVideo(
          button.dataset.delete
        );

    });
}


/* =========================
   VIDEO ROW
========================= */

function videoRow(video) {

  const title =
    esc(video.title || "Untitled");

  const category =
    esc(video.category || "Other");

  const views =
    Number(video.views || 0)
      .toLocaleString();

  const thumbnail =
    video.thumbnail_url
      ? `
        <img
          src="${esc(video.thumbnail_url)}"
          alt=""
        >
      `
      : `
        <div class="adminThumbEmpty">
          ▶
        </div>
      `;

  return `
    <div class="manage">

      <div class="manageThumb">
        ${thumbnail}
      </div>

      <div class="manageInfo">

        <strong>
          ${title}
        </strong>

        <span>
          ${category} · ${views} views
        </span>

        <small class="${
          video.published
            ? "published"
            : "hidden"
        }">

          ${
            video.published
              ? "● Published"
              : "● Hidden"
          }

        </small>

      </div>

      <div class="manageActions">

        <button
          class="btn ghost"
          data-edit="${video.id}"
          type="button"
        >
          Edit
        </button>

        <button
          class="btn ghost"
          data-toggle="${video.id}"
          data-published="${video.published}"
          type="button"
        >
          ${
            video.published
              ? "Unpublish"
              : "Publish"
          }
        </button>

        <button
          class="btn danger"
          data-delete="${video.id}"
          type="button"
        >
          Delete
        </button>

      </div>

    </div>
  `;
}


/* =========================
   EDIT
========================= */

async function editVideo(id) {

  const video =
    videos.find(
      item =>
        String(item.id) === String(id)
    );

  if (!video) return;

  const title =
    prompt(
      "Title",
      video.title || ""
    );

  if (title === null) return;

  const category =
    prompt(
      "Category",
      video.category || ""
    );

  if (category === null) return;

  const description =
    prompt(
      "Description",
      video.description || ""
    );

  if (description === null) return;

  const { error } =
    await supabase
      .from("videos")
      .update({
        title: title.trim(),
        category: category.trim(),
        description: description.trim()
      })
      .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await load();
}


/* =========================
   PUBLISH / UNPUBLISH
========================= */

async function togglePublish(
  id,
  current
) {

  const next =
    current !== "true";

  const { error } =
    await supabase
      .from("videos")
      .update({
        published: next
      })
      .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await load();
}


/* =========================
   DELETE
========================= */

async function deleteVideo(id) {

  const video =
    videos.find(
      item =>
        String(item.id) === String(id)
    );

  const name =
    video?.title || "this video";

  if (
    !confirm(
      `Delete "${name}"?`
    )
  ) {
    return;
  }

  const { error } =
    await supabase
      .from("videos")
      .delete()
      .eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await load();
}


/* =========================
   UPLOAD
========================= */

document
  .querySelector("#upload")
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();

      const form =
        new FormData(event.target);

      const video =
        form.get("video");

      const thumb =
        form.get("thumb");

      const button =
        document.querySelector("#uploadBtn");

      button.disabled = true;
      button.textContent =
        "Uploading...";

      status.textContent =
        "Uploading video...";

      try {

        if (!video || !video.size) {
          throw new Error(
            "Please select a video."
          );
        }

        const id =
          crypto.randomUUID();

        const base =
          `${id}-${Date.now()}`;

        const videoResult =
          await supabase.storage
            .from("videos")
            .upload(
              `${base}-${video.name}`,
              video,
              {
                contentType: video.type,
                upsert: false
              }
            );

        if (videoResult.error) {
          throw videoResult.error;
        }

        status.textContent =
          "Uploading thumbnail...";

        let thumbnailUrl = "";

        if (
          thumb &&
          thumb.size
        ) {

          const thumbnailResult =
            await supabase.storage
              .from("thumbnails")
              .upload(
                `${base}-${thumb.name}`,
                thumb,
                {
                  contentType: thumb.type,
                  upsert: false
                }
              );

          if (!thumbnailResult.error) {

            thumbnailUrl =
              supabase.storage
                .from("thumbnails")
                .getPublicUrl(
                  thumbnailResult.data.path
                )
                .data.publicUrl;
          }
        }

        const videoUrl =
          supabase.storage
            .from("videos")
            .getPublicUrl(
              videoResult.data.path
            )
            .data.publicUrl;

        status.textContent =
          "Saving video...";

        const { error } =
          await supabase
            .from("videos")
            .insert({
              id: id,
              title: form.get("title"),
              category: form.get("category"),
              description: form.get("description"),
              video_url: videoUrl,
              thumbnail_url: thumbnailUrl,
              published: true
            });

        if (error) {
          throw error;
        }

        status.textContent =
          "✓ Uploaded and published.";

        event.target.reset();

        await load();

      } catch (error) {

        console.error(error);

        status.textContent =
          error.message ||
          "Upload failed.";

      } finally {

        button.disabled = false;

        button.textContent =
          "Upload & Publish";
      }

    }
  );


/* =========================
   SEARCH
========================= */

document
  .querySelector("#adminSearch")
  ?.addEventListener(
    "input",
    render
  );


document
  .querySelector("#adminFilter")
  ?.addEventListener(
    "change",
    render
  );


/* =========================
   START
========================= */

boot();
