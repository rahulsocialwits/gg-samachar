const API="https://gg-samachar.rahulsocialwits.workers.dev";
const FALLBACK_DEMO=[];
const IMAGE_FALLBACK="https://gg-samachar.rahulsocialwits.workers.dev/assets/images/news-placeholder.svg";
const hasGujarati=s=>/[\u0A80-\u0AFF]/.test(String(s||""));
const guTitle=x=>hasGujarati(x?.title_gujarati)?x.title_gujarati:(hasGujarati(x?.title_original)?x.title_original:"ગુજરાતી અનુવાદ તૈયાર થઈ રહ્યો છે…");
const guSummary=x=>hasGujarati(x?.summary_gujarati)?x.summary_gujarati:(hasGujarati(x?.summary_english)?x.summary_english:"સમાચારનો ગુજરાતી સારાંશ તૈયાર થઈ રહ્યો છે…");
const guContent=x=>hasGujarati(x?.content_gujarati)?x.content_gujarati:guSummary(x);
const safeImage=url=>url&&/^https?:\/\//i.test(String(url))?url:IMAGE_FALLBACK;

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const cities={Ahmedabad:[23.0225,72.5714,"અમદાવાદ"],Surat:[21.1702,72.8311,"સુરત"],Rajkot:[22.3039,70.8022,"રાજકોટ"],Vadodara:[22.3072,73.1812,"વડોદરા"],Gandhinagar:[23.2156,72.6369,"ગાંધીનગર"],Bhuj:[23.242,69.6669,"ભુજ"],Bhavnagar:[21.7645,72.1519,"ભાવનગર"],Jamnagar:[22.4707,70.0577,"જામનગર"],Junagadh:[21.5222,70.4579,"જૂનાગઢ"],Mehsana:[23.588,72.3693,"મહેસાણા"]};
async function staticNews(path){
  const r=await fetch("assets/data/news.json?_t="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw Error("Static news unavailable");
  const j=await r.json();
  let d=j.articles||[];
  const u=new URL(path,location.origin);
  const slug=u.searchParams.get("slug")|| (u.pathname.startsWith("/article/")?decodeURIComponent(u.pathname.split("/").pop()):"");
  if(slug)return {article:d.find(x=>x.slug===slug)||null};
  const cat=u.searchParams.get("category"),city=u.searchParams.get("city"),q=u.searchParams.get("q");
  if(cat)d=d.filter(x=>(x.category||"").toLowerCase()===cat.toLowerCase());
  if(city)d=d.filter(x=>(x.city||"").toLowerCase()===city.toLowerCase());
  if(q){const z=q.toLowerCase();d=d.filter(x=>(x.title+" "+x.summary+" "+x.category+" "+x.source_name).toLowerCase().includes(z))}
  const limit=Number(u.searchParams.get("limit")||24);
  return {articles:d.slice(0,limit),total:d.length};
}
async function api(path,opt={}){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
  try{
    const r=await fetch(API+path,{...opt,signal:controller.signal,headers:{"Content-Type":"application/json",...(opt.headers||{})}});
    const j=await r.json();
    if(!r.ok)throw Error(j.error||"API error");
    return j;
  }catch(e){
    throw e;
  }finally{clearTimeout(timer)}
}
function articleHref(slug){return "article.html?slug="+encodeURIComponent(slug||"")}
function shareUrl(slug){return new URL(articleHref(slug),location.origin).href}
function shareButtons(x){const u=shareUrl(x.slug),t=guTitle(x);return '<div class="share-actions" onclick="event.stopPropagation()"><button type="button" class="share-btn whatsapp" data-share="whatsapp" data-url="'+esc(u)+'" data-title="'+esc(t)+'">WhatsApp</button><button type="button" class="share-btn" data-share="native" data-url="'+esc(u)+'" data-title="'+esc(t)+'">↗ Share</button></div>'}
function card(x){
  const title=guTitle(x),summary=guSummary(x),img=safeImage(x.image_url);
  return '<article class="story"><a class="story-link" href="'+articleHref(x.slug)+'"><div class="story-art has-image"><img src="'+esc(img)+'" alt="'+esc(title)+'" loading="lazy" onerror="this.onerror=null;this.src=\''+IMAGE_FALLBACK+'\'"><span>'+esc(x.category||"સમાચાર")+'</span></div><div class="story-body"><div class="tag">'+esc(x.category||"સમાચાર")+'</div><h3>'+esc(title)+'</h3><p>'+esc(summary)+'</p><div class="meta">'+esc(x.source_name||"GG Samachar")+' · '+(x.published_at?new Date(x.published_at).toLocaleDateString("gu-IN"):"હમણાં")+'</div></div></a>'+shareButtons(x)+'</article>'
}
function miniCard(x){
  const img=safeImage(x.image_url),title=guTitle(x);
  return '<a class="mini-item" href="'+articleHref(x.slug)+'"><img src="'+esc(img)+'" alt="'+esc(title)+'" loading="lazy" onerror="this.onerror=null;this.src=\''+IMAGE_FALLBACK+'\'"><div><div class="tag">'+esc(x.category||"સમાચાર")+'</div><h3>'+esc(title)+'</h3><div class="meta">'+esc(x.source_name||"GG Samachar")+'</div></div></a>'
}
async function homeNews(){const grid=$("#newsGrid");if(!grid)return;try{const j=await api("/articles?limit=24&_t="+Date.now()),d=j.articles||[];const first=d[0];if(!first){grid.innerHTML='<div class="empty">હાલમાં સમાચાર ઉપલબ્ધ નથી.</div>';return}$("#ticker")&&( $("#ticker").textContent=first.title_gujarati||first.title );
const hero=$("#heroStory");hero.innerHTML='<img src="'+esc(safeImage(first.image_url))+'" alt="'+esc(guTitle(first))+'" onerror="this.onerror=null;this.src=\''+IMAGE_FALLBACK+'\'"><div class="lead-overlay"><div class="tag-light">FEATURED · '+esc(first.category||"NEWS")+'</div><h1>'+esc(guTitle(first))+'</h1><p>'+esc(guSummary(first))+'</p><a class="btn" href="article.html?slug='+encodeURIComponent(first.slug)+'">પૂર્ણ સમાચાર વાંચો →</a></div>';
$("#sideStories").innerHTML=d.slice(1,5).map(miniCard).join("")||'<div class="empty">વધુ સમાચાર માટે Latest જુઓ.</div>';
grid.innerHTML=d.slice(5,11).map(card).join("")||d.slice(0,6).map(card).join("");
const by=(cat)=>d.filter(x=>(x.category||"").toLowerCase()===cat.toLowerCase());
const g=$("#gujaratGrid");if(g)g.innerHTML=by("Gujarat").slice(0,4).map(card).join("")||d.slice(0,4).map(card).join("");
const i=$("#indiaGrid");if(i)i.innerHTML=by("India").slice(0,5).map(miniCard).join("")||'<div class="empty">ભારતના સમાચાર લોડ થશે.</div>';
const w=$("#worldGrid");if(w)w.innerHTML=by("World").slice(0,5).map(miniCard).join("")||'<div class="empty">વિશ્વના સમાચાર લોડ થશે.</div>';
}catch(e){if(grid)grid.innerHTML='<div class="empty">લાઇવ સમાચાર હાલમાં ઉપલબ્ધ નથી. થોડીવાર પછી ફરી પ્રયાસ કરો.</div>';const hero=$("#heroStory");if(hero)hero.innerHTML='<div class="lead-overlay"><div class="tag-light">GG SAMACHAR</div><h1>લાઇવ સમાચાર લોડ થઈ રહ્યા છે…</h1><p>ન્યૂઝ ફીડ ફરી પ્રયાસ કરી રહી છે.</p></div>';}
async function loadNews(){const grid=$("#newsGrid");if(!grid||$("#heroStory"))return;grid.innerHTML='<div class="loading">સમાચાર લોડ થઈ રહ્યા છે…</div>';try{const q=new URLSearchParams(location.search),p=new URLSearchParams();if(q.get("category"))p.set("category",q.get("category"));if(q.get("city"))p.set("city",q.get("city"));if(q.get("q"))p.set("q",q.get("q"));p.set("limit","30");const j=await api("/articles?"+p+"&_t="+Date.now());const d=j.articles||[];grid.innerHTML=d.length?d.map(card).join(""):'<div class="empty">હાલમાં કોઈ સમાચાર ઉપલબ્ધ નથી.</div>';const t=$("#ticker");if(t&&d[0])t.textContent=d[0].title_gujarati||d[0].title}catch(e){grid.innerHTML='<div class="empty">લાઇવ સમાચાર હાલમાં ઉપલબ્ધ નથી.</div>';}}
async function categoryLabel(name){return({Gujarat:"ગુજરાત",India:"ભારત",World:"વિશ્વ",Business:"બિઝનેસ",Sports:"સ્પોર્ટ્સ",Technology:"ટેકનોલોજી",Entertainment:"મનોરંજન",Lifestyle:"લાઇફસ્ટાઇલ"})[name]||name}
function initDynamicCategories(){try{const j=await api("/categories?_t="+Date.now()),cats=(j.categories||[]).filter(x=>x.enabled);const nav=document.querySelector(".site-header nav");if(nav){const existing=new Set([...nav.querySelectorAll("a")].map(x=>x.getAttribute("href")||""));cats.forEach(c=>{const href="latest.html?category="+encodeURIComponent(c.name);if(!existing.has(href)&&c.name!=="Gujarat")nav.insertAdjacentHTML("beforeend",'<a href="'+href+'">'+esc(categoryLabel(c.name))+'</a>')})}const box=$("#categoryList");if(box)box.innerHTML=cats.map(c=>'<a class="category-chip" href="latest.html?category='+encodeURIComponent(c.name)+'">'+esc(categoryLabel(c.name))+'</a>').join("")}catch{}}
function initFilters(){$$(".filter button").forEach(b=>b.onclick=()=>location.href=b.dataset.category?"latest.html?category="+encodeURIComponent(b.dataset.category):"latest.html");$$(".city-grid a").forEach(a=>a.onclick=e=>{if(location.pathname.endsWith("category.html"))return;e.preventDefault();location.href=a.href})}
function initMenu(){const b=$("#menu"),n=document.querySelector("nav");if(b&&n)b.onclick=()=>n.classList.toggle("open")}
function initDate(){const d=new Date(),m=["જાન્યુઆરી","ફેબ્રુઆરી","માર્ચ","એપ્રિલ","મે","જૂન","જુલાઈ","ઑગસ્ટ","સપ્ટેમ્બર","ઑક્ટોબર","નવેમ્બર","ડિસેમ્બર"];if($("#dateMini"))$("#dateMini").textContent=d.getDate()+" "+m[d.getMonth()];if($("#liveDate"))$("#liveDate").textContent=d.toLocaleDateString("gu-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
function injectMobileNav(){if(document.querySelector(".mobile-bottom"))return;const p=location.pathname.split("/").pop()||"index.html",active=p==="index.html"?"home":p==="search.html"?"search":p==="market.html"?"market":p==="category.html"||p==="latest.html"?"category":"other";document.body.insertAdjacentHTML("beforeend",'<nav class="mobile-bottom"><a class="'+(active==="home"?"active":"")+'" href="index.html"><span class="mi">⌂</span><span>Home</span></a><a class="'+(active==="search"?"active":"")+'" href="search.html"><span class="mi">⌕</span><span>Search</span></a><a class="'+(active==="market"?"active":"")+'" href="market.html"><span class="mi">↗</span><span>Market</span></a><a class="'+(active==="category"?"active":"")+'" href="category.html"><span class="mi">▦</span><span>Category</span></a><button id="otherNav"><span class="mi">•••</span><span>Other</span></button></nav>');$("#otherNav").onclick=()=>document.body.classList.toggle("other-open");document.body.insertAdjacentHTML("beforeend",'<div class="other-drawer"><div class="other-inner"><b>More</b><button onclick="document.body.classList.remove(\'other-open\')">×</button><a href="weather.html">🌤️ Weather</a><a href="calendar.html">🗓️ Gujarati Calendar</a><a href="latest.html?category=Technology">💻 Technology</a><a href="latest.html?category=Entertainment">🎬 Entertainment</a><a href="latest.html?category=Sports">🏏 Sports</a></div></div>')}
function weatherIcon(c){if(c===0)return"☀️";if([1,2,3].includes(c))return"⛅";if([45,48].includes(c))return"🌫️";if([51,53,55,61,63,65,80,81,82].includes(c))return"🌧️";if([95,96,99].includes(c))return"⛈️";return"🌤️"}
async function initWeather(){const el=$("#weatherCard");if(!el)return;const render=async city=>{el.innerHTML='<div class="loading">હવામાન લોડ થઈ રહ્યું છે…</div>';try{const j=await api("/weather?city="+encodeURIComponent(city)),c=j.data.current,d=j.data.daily,name=cities[city]?.[2]||city;el.innerHTML='<div class="weather-main"><span>'+weatherIcon(c.weather_code)+' '+esc(name)+'</span><strong>'+Math.round(c.temperature_2m)+'°</strong><p>Feels like '+Math.round(c.apparent_temperature)+'°C</p></div><div class="weather-stats"><b>💧 '+Math.round(c.relative_humidity_2m)+'%<small>Humidity</small></b><b>💨 '+Math.round(c.wind_speed_10m)+' km/h<small>Wind</small></b><b>🌧️ '+Math.round(c.precipitation)+' mm<small>Rain</small></b></div>';const f=$("#forecast");if(f)f.innerHTML=d.time.map((x,i)=>'<div><b>'+new Date(x+"T00:00:00").toLocaleDateString("gu-IN",{weekday:"short"})+'</b><strong>'+Math.round(d.temperature_2m_max[i])+'° / '+Math.round(d.temperature_2m_min[i])+'°</strong><small>Rain '+(d.precipitation_probability_max[i]||0)+'%</small></div>').join("")}catch(e){el.innerHTML='<div class="empty">હવામાન ઉપલબ્ધ નથી.</div>'}};$$(".weather-cities [data-city]").forEach(b=>b.onclick=()=>render(b.dataset.city));const s=$("#weatherSearch");if(s)s.oninput=()=>{const q=s.value.toLowerCase();$$(".weather-cities [data-city]").forEach(b=>b.hidden=!b.textContent.toLowerCase().includes(q))};render("Ahmedabad")}
async function initArticle(){
  const el=$("#article");if(!el)return;
  const slug=new URLSearchParams(location.search).get("slug");
  if(!slug){el.innerHTML='<div class="empty"><strong>Article not found.</strong><br><a class="btn-link" href="latest.html">તાજા સમાચાર જુઓ →</a></div>';return}
  const renderArticle=a=>{
    document.title=guTitle(a)+" — GG Samachar";
    const bodyGu=guContent(a).split(/\n+/).filter(Boolean).map(p=>"<p>"+esc(p)+"</p>").join("");
    const bodyEn=(a.content_english||a.summary_english||"").split(/\n+/).filter(Boolean).map(p=>"<p>"+esc(p)+"</p>").join("");
    el.innerHTML='<div class="article-top"><span class="eyebrow">'+esc(a.category||"સમાચાર")+'</span><h1>'+esc(guTitle(a))+'</h1><p class="article-en">'+esc(a.title_english||"")+'</p><div class="meta">'+esc(a.source_name||"GG Samachar")+' · '+(a.published_at?new Date(a.published_at).toLocaleString("gu-IN"):"હમણાં")+'</div></div>'+shareButtons(a)+(a.image_url?'<img class="article-feature-image" src="'+esc(a.image_url)+'" alt="" loading="eager">':"")+'<p class="article-lead">'+esc(guSummary(a))+'</p><div class="article-language"><button class="active" data-lang="gu">ગુજરાતી</button><button data-lang="en">English</button></div><div id="articleContent" class="article-content">'+bodyGu+'</div><div class="source-box">'+(a.source_url&&/^https?:/i.test(a.source_url)?'Source: <a href="'+esc(a.source_url)+'" target="_blank" rel="noopener noreferrer">Original source ↗</a>':"GG Samachar newsroom")+'</div>';
    const c=$("#articleContent");
    $$(".article-language button").forEach(b=>b.onclick=()=>{const enMode=b.dataset.lang==="en";$$(".article-language button").forEach(x=>x.classList.toggle("active",x===b));c.innerHTML=enMode?bodyEn:bodyGu});
  };
  try{
    const j=await api("/article/"+encodeURIComponent(slug)+"?_t="+Date.now());
    if(j.article){renderArticle(j.article);return}
    throw Error("Article not found");
  }catch(e){
    el.innerHTML='<div class="empty"><strong>સમાચાર લોડ થઈ શક્યા નથી.</strong><p>લાઇવ ન્યૂઝ સર્વિસનો જવાબ મળ્યો નથી. કૃપા કરીને થોડા સમય પછી ફરી પ્રયાસ કરો.</p><a class="btn-link" href="latest.html">તાજા સમાચાર જુઓ →</a></div>';
  }
}
async function initCalendar(){
  const el=$("#panchangData");if(!el)return;
  const label=v=>{if(v==null)return"—";if(typeof v==="string"||typeof v==="number")return String(v);return v.name||v.label||v.text||v.value||"—"};
  const dateParts=d=>{const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const o={};parts.forEach(x=>o[x.type]=x.value);return o};
  const now=dateParts(new Date());
  const iso=now.year+"-"+now.month+"-"+now.day;
  const guMonths=["જાન્યુઆરી","ફેબ્રુઆરી","માર્ચ","એપ્રિલ","મે","જૂન","જુલાઈ","ઑગસ્ટ","સપ્ટેમ્બર","ઑક્ટોબર","નવેમ્બર","ડિસેમ્બર"];
  const localDate=new Date(iso+"T12:00:00+05:30");
  if($("#guDay"))$("#guDay").textContent=localDate.getDate();
  if($("#guMonth"))$("#guMonth").textContent=guMonths[localDate.getMonth()]+" "+localDate.getFullYear();
  if($("#guVaar"))$("#guVaar").textContent=localDate.toLocaleDateString("gu-IN",{weekday:"long"});
  try{
    const j=await api("/calendar?city=mumbai&date="+iso+"&_t="+Date.now());
    const x=j.data||{};
    const keys=[["તારીખ",x.date||iso],["તિથિ",label(x.tithi)],["પક્ષ",label(x.paksha)],["નક્ષત્ર",label(x.nakshatra)],["યોગ",label(x.yoga)],["કરણ",label(x.karana)],["સૂર્યોદય",label(x.sunrise)],["સૂર્યાસ્ત",label(x.sunset)],["રાહુકાળ",label(x.rahu_kalam||x.rahuKalam)]];
    el.innerHTML=keys.map(([k,v])=>'<div><small>'+esc(k)+'</small><b>'+esc(v)+'</b></div>').join("");
    const c=$(".choghadiya .lead");if(c)c.textContent="મુંબઈ માટે આજનું તિથિ, નક્ષત્ર, સૂર્યોદય/સૂર્યાસ્ત અને રાહુકાળ.";
  }catch{el.innerHTML='<div class="empty">કેલેન્ડર સેવા હાલમાં ઉપલબ્ધ નથી. થોડીવાર પછી ફરી પ્રયાસ કરો.</div>'}
}
async function initMarket(){
  const s=$("#marketStatus");if(!s)return;
  const money=v=>Number.isFinite(Number(v))?Number(v).toLocaleString("en-IN",{maximumFractionDigits:2}):"—";
  const pct=v=>Number.isFinite(Number(v))?(Number(v)>=0?"+":"")+Number(v).toFixed(2)+"%":"—";
  const row=x=>'<div class="market-row"><span><b>'+esc(x.symbol||x.name||"—")+'</b><small>'+esc(x.name||"")+'</small></span><span>₹'+money(x.last)+' <em class="'+(Number(x.change_pct)>=0?"up":"down")+'">'+pct(x.change_pct)+'</em></span></div>';
  try{
    const q=$("#stockSearch")?.value.trim()||"";
    const j=await api("/market"+(q?"?q="+encodeURIComponent(q):"?")+"_t="+Date.now());
    s.textContent="● Daily market snapshot · "+(j.date||"latest");
    const vals=[j.indices?.nifty50,j.indices?.sensex,j.indices?.bankNifty,j.usdInr];
    $$(".market-cards>div").forEach((el,i)=>{const x=vals[i];const v=x?.value??x?.close??null;const ch=x?.change_pct;el.querySelector("strong").textContent=v==null?"—":(i===3?"₹"+money(v):money(v));const sp=el.querySelector("span");if(sp)sp.textContent=ch==null?(i===3?"Daily reference":"Index level"):pct(ch)+" today"});
    const g=$("#gainers"),l=$("#losers"),n=$("#nseActive"),w=$("#week52");
    if(g)g.innerHTML=(j.gainers||[]).length?j.gainers.map(row).join(""):'<div class="empty">આ સત્ર માટે gainers ઉપલબ્ધ નથી.</div>';
    if(l)l.innerHTML=(j.losers||[]).length?j.losers.map(row).join(""):'<div class="empty">આ સત્ર માટે losers ઉપલબ્ધ નથી.</div>';
    if(n)n.innerHTML=(j.active||[]).length?j.active.map(row).join(""):'<div class="empty">Active stocks ઉપલબ્ધ નથી.</div>';
    if(w)w.innerHTML=(j.search||[]).length?j.search.map(row).join(""):'<div class="empty">Company search માટે ઉપર stock નામ લખો.</div>';
  }catch{if(s)s.textContent="● Market data unavailable";["#gainers","#losers","#nseActive","#week52"].forEach(sel=>{const e=$(sel);if(e)e.innerHTML='<div class="empty">Market data હાલમાં ઉપલબ્ધ નથી.</div>'})}
}
async function initSearch(){const g=$("#searchGrid");if(!g)return;const input=$("#newsSearch"),title=$("#searchTitle"),initial=new URLSearchParams(location.search).get("q");if(initial){input.value=initial;}const run=async()=>{const q=input.value.trim();title.textContent=q?'“'+q+'” માટે પરિણામો':'તાજેતરના પરિણામો';g.innerHTML='<div class="loading">શોધી રહ્યા છીએ…</div>';try{const j=await api("/articles?limit=30"+(q?"&q="+encodeURIComponent(q):"")+"&_t="+Date.now());const d=j.articles||[];g.innerHTML=d.length?d.map(card).join(""):'<div class="empty">કોઈ સમાચાર મળ્યા નથી.</div>'}catch{g.innerHTML='<div class="empty">Search service હાલમાં ઉપલબ્ધ નથી.</div>'}};$("#searchBtn").onclick=run;input.onkeydown=e=>{if(e.key==="Enter")run()};run()}
function initSharing(){if(document.body.dataset.sharingReady)return;document.body.dataset.sharingReady="1";document.addEventListener("click",async e=>{const b=e.target.closest("[data-share]");if(!b)return;e.preventDefault();e.stopPropagation();const url=b.dataset.url||location.href,title=b.dataset.title||document.title,text=title+"\n\nGG Samachar પર સંપૂર્ણ સમાચાર વાંચો:\n"+url;if(b.dataset.share==="whatsapp"){window.open("https://wa.me/?text="+encodeURIComponent(text),"_blank");return}try{if(navigator.share){await navigator.share({title,text,url});return}}catch(err){if(err?.name==="AbortError")return}try{await navigator.clipboard.writeText(url);const old=b.textContent;b.textContent="✓ Link copied";setTimeout(()=>b.textContent=old,1800)}catch{}})}
function stockSearch(){const b=$("#stockSearchBtn"),i=$("#stockSearch");if(!b||!i)return;b.onclick=()=>initMarket();i.onkeydown=e=>{if(e.key==="Enter")initMarket()}}
document.addEventListener("DOMContentLoaded",()=>{injectMobileNav();initMenu();initDate();homeNews();loadNews();initDynamicCategories();initFilters();initWeather();initArticle();initCalendar();initMarket();initSearch();stockSearch();initSharing()});
