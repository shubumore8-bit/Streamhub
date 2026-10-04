import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
export const supabase=createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

const gate=document.querySelector("#ageGate");
if(localStorage.dv18==="yes") gate?.remove();
document.querySelector("#enter")?.addEventListener("click",()=>{localStorage.dv18="yes";gate.remove()});

const videosEl=document.querySelector("#videos");
if(videosEl){
 let all=[];
 let activeCategory="All";
 async function load(){
  const {data,error}=await supabase.from("videos").select("*").eq("published",true).order("created_at",{ascending:false});
  all=data||[];
  if(error){ videosEl.innerHTML="<p>Could not load videos.</p>"; return; }
  render();
 }
 function getFiltered(){
  const q=(document.querySelector("#search")?.value||"").toLowerCase().trim();
  return all.filter(v=>{
   const text=(v.title+" "+v.category+" "+(v.description||"")).toLowerCase();
   const categoryOk=activeCategory==="All" || String(v.category||"").toLowerCase()===activeCategory.toLowerCase();
   return categoryOk && (!q || text.includes(q));
  });
 }
 function render(){
  const items=getFiltered();
  videosEl.innerHTML=items.map(v=>`<a class="card" href="video.html?id=${encodeURIComponent(v.id)}"><div class="thumb" style="${v.thumbnail_url?`background-image:url('${v.thumbnail_url}')`:''}"><b>▶</b></div><div class="body"><h3>${esc(v.title)}</h3><small>${esc(v.category||"Other")} · ${Number(v.views||0).toLocaleString()} views</small></div></a>`).join("");
  document.querySelector("#empty").hidden=items.length>0;
  const cats=[...new Set(all.map(v=>String(v.category||"").trim()).filter(Boolean))];
  const catsEl=document.querySelector("#cats");
  catsEl.innerHTML=["All",...cats].map(c=>`<button type="button" class="chip${c.toLowerCase()===activeCategory.toLowerCase()?" active":""}" data-c="${esc(c)}">${esc(c)}</button>`).join("");
  catsEl.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.c; render();});
 }
 document.querySelector("#search").oninput=()=>{activeCategory="All";render()};
 load();
}
export function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
