/* =====================================================
   DESIVEXA - JUICYADS
===================================================== */

const JUICY = {

  banner: "1128301",

  float: "1128307",

  small: "1128309",

  wide: "1128310",

  compact: "1128312",

  native: "1128313"

};


const JUICY_SCRIPT =
  "https://poweredby.jads.co/js/jads.js";


const NATIVE_SCRIPT =
  "https://js.juicyads.com/juicyads.native-ads.min.js";


window.adsbyjuicy =
  window.adsbyjuicy || [];


let juicyLoader = null;


/* =====================================================
   LOAD JUICYADS SCRIPT ONCE
===================================================== */

function loadJuicyScript() {

  if (juicyLoader) {

    return juicyLoader;

  }


  juicyLoader = new Promise(
    (resolve, reject) => {

      const existing =
        document.querySelector(
          'script[data-dv-juicy="1"]'
        );


      if (existing) {

        resolve();

        return;

      }


      const script =
        document.createElement(
          "script"
        );


      script.type =
        "text/javascript";


      script.async = true;


      script.dataset.cfasync =
        "false";


      script.dataset.dvJuicy =
        "1";


      script.src =
        JUICY_SCRIPT;


      script.onload =
        () => resolve();


      script.onerror =
        () => reject(
          new Error(
            "JuicyAds script failed"
          )
        );


      document.head.appendChild(
        script
      );

    }
  );


  return juicyLoader;

}


/* =====================================================
   CREATE STANDARD JUICYADS ZONE
===================================================== */

async function createZone(
  element,
  zoneId,
  width,
  height
) {

  if (!element) {

    return;

  }


  if (
    element.dataset.loaded === "1"
  ) {

    return;

  }


  element.dataset.loaded =
    "1";


  try {

    const ins =
      document.createElement(
        "ins"
      );


    ins.id =
      String(zoneId);


    ins.dataset.width =
      String(width);


    ins.dataset.height =
      String(height);


    element.appendChild(
      ins
    );


    await loadJuicyScript();


    window.adsbyjuicy.push({
      adzone: Number(zoneId)
    });


  } catch (error) {

    console.warn(
      "JuicyAds:",
      error
    );


    element.dataset.loaded =
      "0";

  }

}


/* =====================================================
   INITIALIZE JUICYADS
===================================================== */

export function initJuicyAds({

  float = true,

  native = true

} = {}) {


  /* =========================
     WIDE ADS
  ========================== */

  document
    .querySelectorAll(
      '[data-juicy-ad="wide"]'
    )
    .forEach(element => {

      createZone(
        element,
        JUICY.wide,
        774,
        290
      );

    });


  /* =========================
     BANNER ADS
  ========================== */

  document
    .querySelectorAll(
      '[data-juicy-ad="banner"]'
    )
    .forEach(element => {

      createZone(
        element,
        JUICY.banner,
        308,
        286
      );

    });


  /* =========================
     SMALL ADS
  ========================== */

  document
    .querySelectorAll(
      '[data-juicy-ad="small"]'
    )
    .forEach(element => {

      createZone(
        element,
        JUICY.small,
        108,
        140
      );

    });


  /* =========================
     COMPACT ADS
  ========================== */

  document
    .querySelectorAll(
      '[data-juicy-ad="compact"]'
    )
    .forEach(element => {

      createZone(
        element,
        JUICY.compact,
        300,
        100
      );

    });


  /* =================================================
     FLOAT AD
  ================================================= */

  if (
    float &&
    !document.documentElement
      .dataset.dvFloat
  ) {

    document.documentElement
      .dataset.dvFloat = "1";


    setTimeout(() => {

      try {

        const zoneScript =
          document.createElement(
            "script"
          );


        zoneScript.type =
          "text/javascript";


        zoneScript.text =
          `juicy_adzone = '${JUICY.float}';`;


        const adScript =
          document.createElement(
            "script"
          );


        adScript.type =
          "text/javascript";


        adScript.src =
          "https://poweredby.jads.co/js/jfc.js";


        adScript.charset =
          "utf-8";


        document.body.appendChild(
          zoneScript
        );


        document.body.appendChild(
          adScript
        );


      } catch (error) {

        console.warn(
          "JuicyAds Float:",
          error
        );

      }

    }, 5000);

  }


  /* =================================================
     NATIVE INTERSTITIAL
  ================================================= */

  if (
    native &&
    sessionStorage.getItem(
      "dvNative"
    ) !== "1"
  ) {

    sessionStorage.setItem(
      "dvNative",
      "1"
    );


    setTimeout(() => {

      try {

        const nativeScript =
          document.createElement(
            "script"
          );


        nativeScript.type =
          "text/javascript";


        nativeScript.dataset.id =
          "juicyads-native-ads";


        nativeScript.dataset.adZone =
          JUICY.native;


        nativeScript.dataset.targets =
          "a";


        nativeScript.src =
          NATIVE_SCRIPT;


        document.body.appendChild(
          nativeScript
        );


      } catch (error) {

        console.warn(
          "JuicyAds Native:",
          error
        );

      }

    }, 8000);

  }

}
