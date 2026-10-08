import {
  createClient
} from "https://esm.sh/@supabase/supabase-js@2";

import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY
} from "./config.js";


const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );


const page =
  document.querySelector("#page");


function esc(value){

  return String(value ?? "")
    .replace(
      /[&<>"']/g,
      c => ({
        "&":"&amp;",
        "<":"&lt;",
        ">":"&gt;",
        '"':"&quot;",
        "'":"&#39;"
      }[c])
    );

}


function getVideoId(){

  return new URLSearchParams(
    location.search
  ).get("id");

}


function showError(
  title,
  text="Please try again later."
){

  page.innerHTML = `
    <div class="videoError">

      <h2>
        ${esc(title)}
      </h2>

      <p>
        ${esc(text)}
      </p>

      <a href="index.html">
        Go Home
      </a>

    </div>
  `;

}


function checkAge(){

  if(
    localStorage.getItem(
      "desivexa_age_verified"
    ) === "1"
  ){

    return true;

  }


  const ok =
    confirm(
      "18+ ONLY\n\n" +
      "You must be 18 years or older " +
      "to access this website."
    );


  if(!ok){

    location.href =
      "index.html";

    return false;

  }


  localStorage.setItem(
    "desivexa_age_verified",
    "1"
  );


  return true;

}


function createVideoCard(video){

  const title =
    esc(
      video.title ||
      "Untitled video"
    );


  const category =
    esc(
      video.category ||
      "Other"
    );


  const views =
    Number(
      video.views || 0
    ).toLocaleString();


  const thumb =
    video.thumbnail_url

      ? `
        <img
          src="${esc(video.thumbnail_url)}"
          alt="${title}"
          loading="lazy"
          decoding="async">
      `

      : `
        <div class="noThumb">
          DESIVEXA
        </div>
      `;


  return `

    <a
      class="card"
      href="video.html?id=${encodeURIComponent(video.id)}"
    >

      <div class="thumb">

        ${thumb}

        <div class="thumbOverlay"></div>

        <div class="playCircle">
          ▶
        </div>

        <div class="cardViews">
          ${views} views
        </div>

      </div>


      <div class="body">

        <h3>
          ${title}
        </h3>

        <div class="cardMeta">

          <span>
            ${category}
          </span>

          <span>
            ${views} views
          </span>

        </div>

      </div>

    </a>

  `;

}


async function loadMoreVideos(
  currentId
){

  const box =
    document.querySelector(
      "#randomVideos"
    );


  if(!box){
    return;
  }


  const {
    data,
    error
  } =
    await supabase

      .from("videos")

      .select(
        "id,title,category,thumbnail_url,views,created_at"
      )

      .eq(
        "published",
        true
      )

      .neq(
        "id",
        currentId
      )

      .order(
        "created_at",
        {
          ascending:false
        }
      )

      .limit(8);


  if(
    error ||
    !data?.length
  ){

    box.innerHTML =
      "";

    return;

  }


  box.innerHTML = `

    <div class="dvSectionTitle">

      <div>

        <span class="sectionLabel">
          MORE
        </span>

        <h2>
          More Videos
        </h2>

      </div>

    </div>


    <div class="dvGrid">

      ${data
        .map(createVideoCard)
        .join("")}

    </div>

  `;

}


async function loadVideo(){

  if(!checkAge()){
    return;
  }


  const id =
    getVideoId();


  if(!id){

    showError(
      "Video not found",
      "No video ID was provided."
    );

    return;

  }


  let result;


  try{

    result =
      await Promise.race([

        supabase

          .from("videos")

          .select(
            "id,title,category,description,video_url,thumbnail_url,views,created_at"
          )

          .eq(
            "id",
            id
          )

          .eq(
            "published",
            true
          )

          .maybeSingle(),


        new Promise(
          (_, reject) => {

            setTimeout(
              () =>
                reject(
                  new Error(
                    "timeout"
                  )
                ),
              12000
            );

          }
        )

      ]);

  }
  catch(error){

    console.error(error);

    showError(
      "Could not load video",
      "The video database request timed out or failed."
    );

    return;

  }


  const {
    data:video,
    error
  } =
    result;


  if(error){

    console.error(
      error
    );

    showError(
      "Could not load video",
      error.message ||
      "Database error."
    );

    return;

  }


  if(!video){

    showError(
      "Video unavailable",
      "This video does not exist or is not published."
    );

    return;

  }


  if(!video.video_url){

    showError(
      "Video unavailable",
      "This video has no video file URL."
    );

    return;

  }


  const title =
    esc(
      video.title ||
      "Untitled video"
    );


  const category =
    esc(
      video.category ||
      "Other"
    );


  const description =
    esc(
      video.description ||
      ""
    );


  const views =
    Number(
      video.views || 0
    ).toLocaleString();


  const poster =
    video.thumbnail_url

      ? `poster="${esc(
          video.thumbnail_url
        )}"`

      : "";


  page.innerHTML = `

    <section class="videoWatch">


      <!-- VIDEO PLAYER -->

      <div class="videoPlayerWrap">

        <video
          id="player"
          controls
          playsinline
          preload="metadata"
          ${poster}
        >

          <source
            src="${esc(video.video_url)}"
            type="video/mp4"
          >

          Your browser does not support
          HTML5 video.

        </video>

      </div>


      <!-- VIDEO INFO -->

      <div class="videoInfo">

        <h1>
          ${title}
        </h1>


        <div class="videoMeta">

          <span>
            ${category}
          </span>

          <span>
            ${views} views
          </span>

        </div>


        ${
          description

            ? `
              <p class="videoDescription">
                ${description}
              </p>
            `

            : ""
        }


        <!-- ACTION BUTTONS -->

        <div class="videoActions">

          <button
            type="button"
            id="shareBtn"
          >
            Share
          </button>


          <button
            type="button"
            id="copyBtn"
          >
            Copy Link
          </button>

        </div>


        <!-- CATEGORY -->

        <div>

          <span class="videoTag">
            ${category}
          </span>

        </div>

      </div>


      <!-- JUICYADS 1128312 -->

      <div class="dvAdSlot midAd">

        <script
          type="text/javascript"
          data-cfasync="false"
          async
          src="https://poweredby.jads.co/js/jads.js">
        </script>

        <ins
          id="1128312"
          data-width="300"
          data-height="100">
        </ins>

        <script
          type="text/javascript"
          data-cfasync="false"
          async
        >

          (adsbyjuicy =
            window.adsbyjuicy || [])
            .push({
              'adzone':1128312
            });

        </script>

      </div>


      <!-- MORE VIDEOS -->

      <div
        id="randomVideos">
      </div>


    </section>

  `;


  /* SHARE */

  document
    .getElementById("shareBtn")
    ?.addEventListener(
      "click",
      async () => {

        try{

          if(navigator.share){

            await navigator.share({

              title:
                video.title ||
                "DesiVexa",

              url:
                location.href

            });

          }
          else{

            await navigator.clipboard
              .writeText(
                location.href
              );

            alert(
              "Video link copied."
            );

          }

        }
        catch(_){}

      }
    );


  /* COPY LINK */

  document
    .getElementById("copyBtn")
    ?.addEventListener(
      "click",
      async () => {

        try{

          await navigator.clipboard
            .writeText(
              location.href
            );

          alert(
            "Video link copied."
          );

        }
        catch(_){

          prompt(
            "Copy this link:",
            location.href
          );

        }

      }
    );


  /* VIEW COUNT */

  try{

    await supabase.rpc(
      "increment_video_views",
      {
        video_id:
          video.id
      }
    );

  }
  catch(error){

    console.warn(
      "View counter:",
      error
    );

  }


  /* MORE VIDEOS */

  loadMoreVideos(
    video.id
  );

}


loadVideo();
