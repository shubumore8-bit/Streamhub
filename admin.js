import { supabase, esc } from "./app.js";


const auth =
  document.querySelector("#auth");

const panel =
  document.querySelector("#panel");

const status =
  document.querySelector("#status");

const manage =
  document.querySelector("#manage");

const adminSearch =
  document.querySelector("#adminSearch");

const adminFilter =
  document.querySelector("#adminFilter");

const uploadBtn =
  document.querySelector("#uploadBtn");


let videos = [];


/* =========================
   BOOT
========================= */

async function boot() {

  const {
    data: {
      session
    }
  } = await supabase.auth.getSession();


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


  document
    .querySelector("#logout")
    .onclick = async () => {

      await supabase.auth.signOut();

      location.reload();

    };


  await load();

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
            placeholder="Email"
            required
          >
        </label>


        <label>
          Password

          <input
            name="password"
            type="password"
            placeholder="Password"
            required
          >
        </label>


        <button
          class="btn"
          type="submit"
        >
          Sign in
        </button>


        <p
          id="loginMsg"
          class="adminStatus"
        ></p>

      </form>

    </div>

  `;


  document
    .querySelector("#login")
    .onsubmit = async e => {

      e.preventDefault();


      const form =
        new FormData(e.target);


      const email =
        form.get("email");

      const password =
        form.get("password");


      const msg =
        document.querySelector(
          "#loginMsg"
        );


      msg.textContent =
        "Signing in...";


      const {
        error
      } =
        await supabase.auth
          .signInWithPassword({
            email,
            password
          });


      if (error) {

        msg.textContent =
          error.message;

        return;

      }


      location.reload();

    };

}


/* =========================
   LOAD
========================= */

async function load() {

  const {
    data,
    error
  } =
    await supabase
      .from("videos")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (error) {

    manage.innerHTML = `

      <p class="empty">
        ${esc(error.message)}
      </p>

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
      v => v.published
    ).length;


  const hidden =
    total - published;


  const views =
    videos.reduce(
      (sum, v) =>
        sum +
        Number(v.views || 0),
      0
    );


  const totalEl =
    document.querySelector(
      "#statTotal"
    );

  const publishedEl =
    document.querySelector(
      "#statPublished"
    );

  const hiddenEl =
    document.querySelector(
      "#statHidden"
    );

  const viewsEl =
    document.querySelector(
      "#statViews"
    );


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

function getFiltered() {

  const query =
    (
      adminSearch?.value ||
      ""
    )
      .toLowerCase()
      .trim();


  const filter =
    adminFilter?.value ||
    "all";


  return videos.filter(v => {

    const text = (

      String(v.title || "") +
      " " +
      String(v.category || "") +
      " " +
      String(v.description || "")

    ).toLowerCase();


    const searchOk =
      !query ||
      text.includes(query);


    const filterOk =

      filter === "all"

        ? true

        : filter === "published"

          ? v.published === true

          : v.published === false;


    return (
      searchOk &&
      filterOk
    );

  });

}


/* =========================
   RENDER
========================= */

function render() {

  const items =
    getFiltered();


  if (!items.length) {

    manage.innerHTML = `

      <div class="adminEmpty">

        <strong>
          No videos found
        </strong>

        <span>
          Try another search or filter.
        </span>

      </div>

    `;

    return;

  }


  manage.innerHTML =
    items
      .map(videoRow)
      .join("");


  /* EDIT */

  document
    .querySelectorAll(
      "[data-edit]"
    )
    .forEach(button => {

      button.onclick = () =>
        editVideo(
          button.dataset.edit
        );

    });


  /* PUBLISH */

  document
    .querySelectorAll(
      "[data-toggle]"
    )
    .forEach(button => {

      button.onclick = () =>
        togglePublish(
          button.dataset.toggle,
          button.dataset.published
        );

    });


  /* DELETE */

  document
    .querySelectorAll(
      "[data-delete]"
    )
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

function videoRow(v) {

  const title =
    esc(
      v.title ||
      "Untitled video"
    );


  const category =
    esc(
      v.category ||
      "Other"
    );


  const views =
    Number(
      v.views || 0
    ).toLocaleString();


  const thumb =
    v.thumbnail_url

      ? `
        <img
          src="${esc(v.thumbnail_url)}"
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
        ${thumb}
      </div>


      <div class="manageInfo">

        <strong>
          ${title}
        </strong>

        <span>
          ${category}
          ·
          ${views} views
        </span>

        <small
          class="${
            v.published
              ? "published"
              : "hidden"
          }"
        >

          ${
            v.published
              ? "● Published"
              : "● Hidden"
          }

        </small>

      </div>


      <div class="manageActions">

        <button
          class="btn ghost"
          data-edit="${v.id}"
          type="button"
        >
          Edit
        </button>


        <button
          class="btn ghost"
          data-toggle="${v.id}"
          data-published="${v.published}"
          type="button"
        >
          ${
            v.published
              ? "Unpublish"
              : "Publish"
          }
        </button>


        <button
          class="btn danger"
          data-delete="${v.id}"
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
      v => String(v.id) === String(id)
    );


  if (!video) {

    alert(
      "Video not found."
    );

    return;

  }


  const title =
    prompt(
      "Title",
      video.title || ""
    );


  if (title === null)
    return;


  const category =
    prompt(
      "Category",
      video.category || ""
    );


  if (category === null)
    return;


  const description =
    prompt(
      "Description",
      video.description || ""
    );


  if (description === null)
    return;


  const {
    error
  } =
    await supabase
      .from("videos")
      .update({
        title:
          title.trim(),

        category:
          category.trim(),

        description:
          description.trim()
      })
      .eq(
        "id",
        id
      );


  if (error) {

    alert(
      error.message
    );

    return;

  }


  await load();

}


/* =========================
   PUBLISH
========================= */

async function togglePublish(
  id,
  current
) {

  const next =
    current !== "true";


  const {
    error
  } =
    await supabase
      .from("videos")
      .update({
        published
