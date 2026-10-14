DesiVexa video.js syntax error fix (ZIP)

Is ZIP mein complete video.js nahi hai. Ismein sirf exact patch hai jo video.js ke
recordView(id) function ke baad wali duplicate/orphaned code lines hataata hai.
Ye duplicate code JavaScript syntax error aur "Loading video..." problem ka sabab
ban sakta hai.

Android phone par:
1. ZIP extract karein.
2. videojs_syntax_fix.patch / patch ke andar diye gaye change ko dekhein.
3. GitHub par Streamhub repository kholein.
4. video.js file mein `async function recordView(id)` ke baad jo extra block
   `// PostgreSQL function returns the new count...` se shuru hota hai,
   aur doosre `async function loadLikes(id)` se just pehle khatam hota hai,
   use poora delete karein.
5. `async function loadLikes(id) {` ko rehne dein.
6. Commit changes karein, phir website refresh karein.

Dhyaan dein: ye patch ZIP hai, full video.js file nahi. GitHub ki file ko
automatically change/commit nahi kiya gaya.
