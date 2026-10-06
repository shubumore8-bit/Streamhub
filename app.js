import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


/* =========================
   AGE GATE
========================= */

const gate = document.querySelector("#ageGate");

if (localStorage.dv18 === "yes") {
  gate?.remove();
}

document.querySelector("#enter")?.addEventListener("click", () => {
  localStorage.dv18 = "yes";
  gate?.remove();
});


/* =========================
   ELEMENTS
========================= */

const videosEl = document.querySelector("#videos");
const categoryBtn = document.querySelector("#categoryBtn");
const categoryList = document.querySelector("#cats");
const categoryItems = document.querySelector("#categoryItems");
const categorySearch = document.querySelector("#categorySearch");
const search = document.querySelector("#search");


/* =========================
   DATA
========================= */

let all = [];
let activeCategory = "All";


/* =========================
   CATEGORY MENU
========================= */

categoryBtn?.addEventListener("click", (e) => {

  e.stopPropagation();

  categoryList?.classList.toggle("show");

  if (categoryList?.classList.contains("show")) {
    setTimeout(() => {
      categorySearch?.focus();
    }, 50);
  }

});


/* CLOSE WHEN CLICKING OUTSIDE */

document.addEventListener("click", (e) => {

  if (
    !e.target.closest(".categoryMenu")
  ) {
    categoryList?.classList.remove("show");
  }

});


/* =========================
   LOAD VIDEOS
========================= */

async function load() {

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("published", true)
    .order("created_at", {
      ascending: false
    });

  if (error) {

    console.error(error);

    videosEl.innerHTML =
      "<p>Could not load videos.</p>";

    return;
  }

  all = data || [];

  render();
}


/* =========================
   FILTER VIDEOS
========================= */

function getFiltered() {

  const q =
    (search?.value || "")
      .toLowerCase()
      .trim();

  return all.filter(v => {

    const text =
      (
        v.title +
        " " +
        v.category +
        " " +
        (v.description || "")
      ).toLowerCase();

    const categoryOk =
      activeCategory === "All" ||
      String(v.category || "")
        .toLowerCase() ===
      activeCategory.toLowerCase();

    return (
      categoryOk &&
      (!q || text.includes(q))
    );

  });

}


/* =========================
   RENDER VIDEOS
========================= */

function render() {

  const items = getFiltered();


  videosEl.innerHTML =
    items.map(v => `

      <a
        class="card"
        href="video.html?id=${encodeURIComponent(v.id)}"
      >

        <div
          class="thumb"
          style="${
            v.thumbnail_url
              ? `background-image:url('${esc(v.thumbnail_url)}')`
              : ""
          }"
        >

          <b>▶</b>

        </div>


        <div class="body">

          <h3>
            ${esc(v.title)}
          </h3>

          <small>
            ${esc(v.category || "Other")}
            ·
            ${Number(v.views || 0).toLocaleString()}
            views
          </small>

        </div>

      </a>

    `).join("");


  const empty =
    document.querySelector("#empty");

  if (empty) {
    empty.hidden = items.length > 0;
  }


  renderCategories();
}


/* =========================
   RENDER CATEGORIES
========================= */

function renderCategories() {

  const categories = [
    "All",
    ...new Set(
      all
        .map(v =>
          String(v.category || "").trim()
        )
        .filter(Boolean)
    )
  ];


  const q =
    (categorySearch?.value || "")
      .toLowerCase()
      .trim();


  const filtered =
    categories.filter(category =>

      category
        .toLowerCase()
        .includes(q)

    );


  categoryItems.innerHTML =
    filtered.map(category => `

      <button
        type="button"
        class="categoryItem ${
          category.toLowerCase() ===
          activeCategory.toLowerCase()
            ? "active"
            : ""
        }"
        data-category="${esc(category)}"
      >

        ${esc(category)}

      </button>

    `).join("");


  categoryItems
    .querySelectorAll("[data-category]")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          activeCategory =
            button.dataset.category;


          if (categoryBtn) {

            categoryBtn.textContent =
              activeCategory === "All"
                ? "☰ Categories"
                : "☰ " + activeCategory;

          }


          categoryList
            ?.classList
            .remove("show");


          render();

        }
      );

    });

}


/* =========================
   CATEGORY SEARCH
========================= */

categorySearch?.addEventListener(
  "input",
  () => {
    renderCategories();
  }
);


/* =========================
   VIDEO SEARCH
========================= */

search?.addEventListener(
  "input",
  () => {

    activeCategory = "All";

    if (categoryBtn) {
      categoryBtn.textContent =
        "☰ Categories";
    }

    render();

  }
);


/* =========================
   ESCAPE HTML
========================= */

export function esc(s) {

  return String(s ?? "")
    .replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m]));

}


/* START */

load();
