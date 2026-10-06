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


/* =========================
   CLOSE CATEGORY MENU
========================= */

document.addEventListener("click", (e) => {

  if (!e
