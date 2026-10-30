const API = "https://api.alquran.cloud/v1";
const $ = (id) => document.getElementById(id);
let surahs = [];
let currentSurah = 1;
let reciters = [{identifier:"ar.alafasy", name:"مشاري العفاسي"}];
let prayerTimer = null;

const prayerNames = [
  ["Fajr","الفجر","✦"],["Sunrise","الشروق","☀"],["Dhuhr","الظهر","☼"],
  ["Asr","العصر","◷"],["Maghrib","المغرب","☾"],["Isha","العشاء","✧"]
];

function toast(message){
  const el=$("toast"); el.textContent=message; el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2600);
}
function arabicDate(){
  try{return new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {day:"numeric",month:"long",year:"numeric"}).format(new Date())}
  catch{return ""}
}
function showGregorian(){
  $("gregDate").textContent=new Intl.DateTimeFormat("ar-SA",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  $("hijriDate").textContent=arabicDate();
}

async function loadSurahs(){
  try{
    const res=await fetch(`${API}/surah`);
    if(!res.ok) throw new Error("تعذر الاتصال بمصدر القرآن");
    const json=await res.json(); surahs=json.data;
    $("surahCount").textContent=`${surahs.length} سورة`;
    renderSurahs(); loadSurah(1);
  }catch(e){
    $("surahList").innerHTML=`<div class="loading">تعذر تحميل السور. تحقق من اتصال الإنترنت ثم حدّث الصفحة.</div>`;
    $("ayahContainer").innerHTML=`<p class="loading">تعذر تحميل الآيات حالياً.</p>`;
  }
}
function renderSurahs(filter=""){
  const list=surahs.filter(s=>s.name.includes(filter)||s.englishName.toLowerCase().includes(filter.toLowerCase())||String(s.number)===filter);
  $("surahList").innerHTML=list.map(s=>`<button class="surah-item ${s.number===currentSurah?"selected":""}" data-surah="${s.number}">
    <span class="surah-number"><span>${s.number}</span></span><span><b>${s.name}</b><small>${s.revelationType==="Meccan"?"مكية":"مدنية"} · ${s.numberOfAyahs} آيات</small></span></button>`).join("") || `<div class="loading">لا توجد سورة بهذا الاسم.</div>`;
  document.querySelectorAll("[data-surah]").forEach(btn=>btn.addEventListener("click",()=>loadSurah(Number(btn.dataset.surah))));
}
async function loadSurah(number){
  currentSurah=number; const s=surahs.find(x=>x.number===number); if(!s)return;
  $("currentSurah").textContent=s.name;
  $("surahInfo").textContent=`${s.revelationType==="Meccan"?"مكية":"مدنية"} · ${s.numberOfAyahs} آيات`;
  $("ayahContainer").innerHTML=`<div class="loading">جارٍ تحميل الآيات...</div>`;
  $("audioPlayer").pause(); $("audioPlayer").removeAttribute("src");
  $("audioLabel").textContent=`${s.name} · ${getReciterName()}`;
  $("basmala").style.display=number===1||number===9?"none":"block";
  renderSurahs($("searchSurah").value.trim());
  try{
    const edition=$("reciterSelect").value || "ar.alafasy";
    const [arabic,audio]=await Promise.all([
      fetch(`${API}/surah/${number}/quran-uthmani`).then(r=>r.json()),
      fetch(`${API}/surah/${number}/${edition}`).then(r=>r.json())
    ]);
    const ayahs=arabic.data.ayahs;
    $("ayahContainer").innerHTML=ayahs.map(a=>`<span class="ayah">${escapeHtml(a.text)} <span class="ayah-end">${toArabicDigits(a.numberInSurah)}</span> </span>`).join("");
    if(audio.data?.ayahs?.length){
      // نسخة السورة الكاملة متاحة في بعض الطبعات كـ audio URL؛ عند عدم توفرها نستخدم أول آية كمسار توضيحي.
      const first=audio.data.ayahs[0].audio;
      $("audioPlayer").src=first;
      $("audioLabel").textContent=`${s.name} · ${getReciterName()} (تلاوة الآيات)`;
      $("readerMessage").textContent="يمكنك تشغيل التلاوة من المشغّل. قد تختلف الإتاحة حسب القارئ.";
    }
  }catch(e){$("ayahContainer").innerHTML=`<div class="loading">حدث خطأ أثناء تحميل الآيات. حاول مرة أخرى.</div>`}
}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toArabicDigits(n){return String(n).replace(/\d/g,d=>"٠١٢٣٤٥٦٧٨٩"[d])}
function getReciterName(){return reciters.find(r=>r.identifier===$("reciterSelect").value)?.name||"القارئ"}

async function loadReciters(){
  try{
    const r=await fetch(`${API}/edition?format=audio&language=ar&type=versebyverse`);
    const j=await r.json();
    const list=j.data||[];
    if(list.length){
      reciters=list.map(x=>({identifier:x.identifier,name:x.name}));
      $("reciterSelect").innerHTML=reciters.map(x=>`<option value="${escapeHtml(x.identifier)}">${escapeHtml(x.name)}</option>`).join("");
      const preferred=reciters.find(x=>x.identifier==="ar.alafasy");
      if(preferred)$("reciterSelect").value=preferred.identifier;
    }
  }catch(e){/* يبقى القارئ الافتراضي */}
}

async function prayerByCoords(lat,lon,label){
  $("locationName").textContent=label||"موقعك الحالي";
  $("prayerGrid").innerHTML=`<div class="loading">جارٍ حساب المواقيت...</div>`;
  try{
    const date=new Date(); const ds=`${date.getDate()}-${date.getMonth()+1}-${date.getFullYear()}`;
    const response=await fetch(`https://api.aladhan.com/v1/timings/${ds}?latitude=${lat}&longitude=${lon}&method=4`);
    const json=await response.json(); if(json.code!==200)throw new Error();
    renderPrayer(json.data.timings); 
    $("hijriDate").textContent=json.data.date.hijri.date+" · "+json.data.date.hijri.month.ar;
  }catch(e){$("prayerGrid").innerHTML=`<div class="loading">تعذر جلب المواقيت. تحقق من اتصال الإنترنت.</div>`}
}
function renderPrayer(times){
  const now=new Date(); const current=now.getHours()*60+now.getMinutes();
  const main=prayerNames.filter(x=>x[0]!=="Sunrise");
  let nextName=null,nextMinutes=99999;
  main.forEach(([key])=>{const [h,m]=times[key].split(":").map(Number);let t=h*60+m;if(t<=current)t+=1440;if(t<nextMinutes){nextMinutes=t;nextName=key}});
  $("prayerGrid").innerHTML=prayerNames.map(([key,name,icon])=>{
    const val=times[key]||"--:--"; const [h,m]=val.split(":").map(Number);const mins=h*60+m;
    const active=key===nextName;
    return `<div class="prayer-card ${active?"active":""}"><div class="prayer-icon">${icon}</div><b>${name}</b><strong>${toArabicDigits(val)}</strong>${active?`<div class="next-label">الصلاة القادمة</div>`:""}</div>`;
  }).join("");
}
async function citySearch(city){
  $("locationName").textContent="جارٍ تحديد "+city;
  try{
    const response=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`);
    const data=await response.json();if(!data.length)throw new Error();
    await prayerByCoords(data[0].lat,data[0].lon,city.split(",")[0]);
  }catch(e){$("prayerGrid").innerHTML=`<div class="loading">لم نتمكن من تحديد المدينة. جرّب تحديث الموقع أو اختر مدينة أخرى.</div>`}
}
function detectLocation(){
  if(!navigator.geolocation){citySearch("Madinah,Saudi Arabia");return}
  $("locationName").textContent="بانتظار إذن الموقع...";
  navigator.geolocation.getCurrentPosition(
    pos=>prayerByCoords(pos.coords.latitude,pos.coords.longitude,"موقعك الحالي"),
    ()=>{toast("لم يُسمح بالوصول للموقع؛ تم اختيار المدينة المنورة مؤقتاً.");citySearch("Madinah,Saudi Arabia")},
    {enableHighAccuracy:false,timeout:10000,maximumAge:600000}
  );
}
$("citySelect").addEventListener("change",e=>e.target.value==="auto"?detectLocation():citySearch(e.target.value));
$("locateBtn").addEventListener("click",detectLocation);
$("searchSurah").addEventListener("input",e=>renderSurahs(e.target.value.trim()));
$("reciterSelect").addEventListener("change",()=>loadSurah(currentSurah));
$("bookmarkBtn").addEventListener("click",()=>{
  const s=surahs.find(x=>x.number===currentSurah);
  localStorage.setItem("noor-bookmark",JSON.stringify({number:currentSurah,name:s?.name||""}));
  toast(`تم حفظ موضعك عند ${s?.name||"السورة الحالية"}`);
});
$("themeBtn").addEventListener("click",()=>{document.body.classList.toggle("night");localStorage.setItem("noor-night",document.body.classList.contains("night")?"1":"0")});
if(localStorage.getItem("noor-night")==="1")document.body.classList.add("night");
const adhkar={
 morning:["أصبحنا وأصبح الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.","اللهم بك أصبحنا وبك أمسينا وبك نحيا وبك نموت وإليك النشور.","رضيت بالله رباً، وبالإسلام ديناً، وبمحمد ﷺ نبياً."],
 evening:["أمسينا وأمسى الملك لله، والحمد لله، لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.","اللهم بك أمسينا وبك أصبحنا وبك نحيا وبك نموت وإليك المصير.","رضيت بالله رباً، وبالإسلام ديناً، وبمحمد ﷺ نبياً."],
 tasbeeh:["سُبْحَانَ اللَّهِ","الْحَمْدُ لِلَّهِ","اللَّهُ أَكْبَرُ","أَسْتَغْفِرُ اللَّهَ"]
};
document.querySelectorAll("[data-dhikr]").forEach(btn=>btn.addEventListener("click",()=>{
  const type=btn.dataset.dhikr,panel=$("dhikrPanel");panel.classList.remove("hidden");
  if(type==="tasbeeh"){
    let count=0;panel.innerHTML=`<h3>المسبحة الإلكترونية</h3><div id="tasbeehText">سُبْحَانَ اللَّهِ</div><p>عدد التسبيحات: <b id="tasbeehCount">٠</b></p><button class="primary-btn" id="countBtn">سبّح</button> <button class="small-btn" id="resetBtn">إعادة</button>`;
    $("countBtn").onclick=()=>{$("tasbeehCount").textContent=toArabicDigits(++count)};
    $("resetBtn").onclick=()=>{count=0;$("tasbeehCount").textContent="٠"};
  }else{
    panel.innerHTML=`<h3>${type==="morning"?"أذكار الصباح":"أذكار المساء"}</h3>`+adhkar[type].map((x,i)=>`<p>${i+1}. ${x}</p>`).join("");
  }
  panel.scrollIntoView({behavior:"smooth",block:"nearest"});
}));
showGregorian();
loadReciters().then(()=>{});
loadSurahs();
detectLocation();
