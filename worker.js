const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type,Authorization,X-Admin-Key"
};
const SOURCES=[
  {name:"TV9 Gujarati",feed:"https://tv9gujarati.com/gujarat/feed",home:"https://tv9gujarati.com/"},
  {name:"Gujarat Samachar",feed:"https://www.gujaratsamachar.com/rss/top-stories",home:"https://www.gujaratsamachar.com/"},
  {name:"Divya Bhaskar",feed:"https://www.divyabhaskar.co.in/rss-feed/1037/",home:"https://www.divyabhaskar.co.in/"},
  {name:"News18 World",feed:"https://www.news18.com/rss/world.xml",home:"https://www.news18.com/"},
  {name:"The Hindu",feed:"https://www.thehindu.com/feeder/default.rss",home:"https://www.thehindu.com/"},
  {name:"Indian Express",feed:"https://indianexpress.com/print/front-page/feed/",home:"https://indianexpress.com/"}
];
const CITIES={Ahmedabad:[23.0225,72.5714,"અમદાવાદ"],Surat:[21.1702,72.8311,"સુરત"],Rajkot:[22.3039,70.8022,"રાજકોટ"],Vadodara:[22.3072,73.1812,"વડોદરા"],Gandhinagar:[23.2156,72.6369,"ગાંધીનગર"],Bhuj:[23.242,69.6669,"ભુજ"],Bhavnagar:[21.7645,72.1519,"ભાવનગર"],Jamnagar:[22.4707,70.0577,"જામનગર"],Junagadh:[21.5222,70.4579,"જૂનાગઢ"],Mehsana:[23.588,72.3693,"મહેસાણા"]};
function json(x,s=200){return new Response(JSON.stringify(x),{status:s,headers:{"Content-Type":"application/json;charset=utf-8","Cache-Control":"no-store, no-cache, must-revalidate, proxy-revalidate","Pragma":"no-cache",...CORS}})}
async function fetchWithTimeout(url,options={},ms=10000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  try{return await fetch(url,{...options,signal:controller.signal,redirect:"follow"})}
  finally{clearTimeout(timer)}
}
function isoDate(value,fallback){
  if(!value)return fallback;
  const d=new Date(value);
  return Number.isNaN(d.getTime())?fallback:d.toISOString();
}
function clean(s){return String(s||"").replace(/<!\[CDATA\[/gi,"").replace(/\]\]>/gi,"").replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&nbsp;/gi," ").replace(/\s+/g," ").trim()}
function tag(b,n){const m=b.match(new RegExp("<"+n+"(?:\\:[^ >]+)?[^>]*>([\\s\\S]*?)<\\/"+n+">","i"));return clean(m?.[1]||"")}
function attr(b,names){for(const n of names){const m=b.match(new RegExp(n+"\\s*=\\s*[\"']([^\"']+)[\"']","i"));if(m)return m[1]}return""}
function parseFeed(xml,source){const blocks=xml.match(/<item\b[\s\S]*?<\/item>/gi)||xml.match(/<entry\b[\s\S]*?<\/entry>/gi)||[];return blocks.slice(0,20).map(b=>{const links=[...b.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]);const url=tag(b,"link")||attr(links.find(x=>/href=/i.test(x))||"",["href"])||attr(b,["href"]);const media=/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/i.exec(b)?.[0]||"";return{source:source.name,url,title:tag(b,"title"),description:tag(b,"description")||tag(b,"summary")||tag(b,"content:encoded")||tag(b,"content"),published:tag(b,"pubDate")||tag(b,"published")||tag(b,"updated")||tag(b,"dc:date"),image:attr(media,["url","href"])}}).filter(x=>x.url&&x.title)}
function slugify(s){return String(s||"news").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s-]/gu,"").trim().replace(/[\s_-]+/g,"-").slice(0,100)||"news"}
function admin(req,env){return !!env.ADMIN_KEY&&req.headers.get("X-Admin-Key")===env.ADMIN_KEY}
async function ensureSchema(db){await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS articles(id INTEGER PRIMARY KEY AUTOINCREMENT,source_name TEXT NOT NULL,source_url TEXT NOT NULL UNIQUE,source_article_id TEXT,title_original TEXT,title_gujarati TEXT NOT NULL,title_english TEXT,summary_gujarati TEXT,summary_english TEXT,content_gujarati TEXT,content_english TEXT,category TEXT,city TEXT,image_url TEXT,image_width INTEGER DEFAULT 1000,image_height INTEGER DEFAULT 600,published_at TEXT,fetched_at TEXT NOT NULL,status TEXT DEFAULT 'published',slug TEXT UNIQUE,seo_title TEXT,seo_description TEXT,tags TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
  db.prepare("CREATE TABLE IF NOT EXISTS sources(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,feed_url TEXT,homepage_url TEXT,enabled INTEGER DEFAULT 1,notes TEXT)"),
  db.prepare("CREATE TABLE IF NOT EXISTS publishing_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,run_at TEXT NOT NULL,source_name TEXT,fetched INTEGER DEFAULT 0,published INTEGER DEFAULT 0,skipped INTEGER DEFAULT 0,errors INTEGER DEFAULT 0,message TEXT)"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC)"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category)"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_articles_city ON articles(city)")
]);for(const s of SOURCES)await db.prepare("INSERT INTO sources(name,feed_url,homepage_url,enabled) VALUES(?,?,?,1) ON CONFLICT(name) DO UPDATE SET feed_url=excluded.feed_url,homepage_url=excluded.homepage_url,enabled=1").bind(s.name,s.feed,s.home).run();for(const legacy of ["IAM Gujarat","Google News Gujarati","News18 Gujarati","ABP Asmita"])await db.prepare("UPDATE sources SET enabled=0 WHERE name=?").bind(legacy).run()}
async function articleImage(url){if(!url)return"";try{const c=new AbortController(),t=setTimeout(()=>c.abort(),6000),r=await fetch(url,{signal:c.signal,headers:{"User-Agent":"Mozilla/5.0 GG-Samachar/1.0"}});clearTimeout(t);if(!r.ok)return"";const h=await r.text();const p=[/property=["']og:image["'][^>]+content=["']([^"']+)["']/i,/content=["']([^"']+)["'][^>]+property=["']og:image["']/i,/name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,/content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i];for(const x of p){const m=h.match(x);if(m?.[1])return m[1]}return""}catch{return""}}
async function ai(env,item){
  if(!env.GROQ_API_KEY)return null;
  const model=env.AI_MODEL||"openai/gpt-oss-20b";
  const r=await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+env.GROQ_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model,temperature:.2,response_format:{type:"json_object"},messages:[{role:"system",content:"You are GG Samachar's factual Gujarati-first news editor. Rewrite only the supplied facts in original wording. Never invent facts. Return JSON with title_gujarati,title_english,summary_gujarati,summary_english,content_gujarati,content_english,category,city,seo_title,seo_description,tags."},{role:"user",content:JSON.stringify(item)}]})},15000);
  if(!r.ok)throw Error("Groq "+r.status);
  const j=await r.json();
  return JSON.parse(j.choices?.[0]?.message?.content||"{}");
}
async function collect(env){
  await ensureSchema(env.DB);
  const now=new Date().toISOString();
  let fetched=0,published=0,skipped=0,errors=0;
  const configured=await env.DB.prepare("SELECT name,feed_url,homepage_url FROM sources WHERE enabled=1 ORDER BY id").all();
  const sources=(configured.results?.length?configured.results:SOURCES).filter(x=>x.feed_url);
  for(const source of sources){
    try{
      const rr=await fetchWithTimeout(source.feed_url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; GG-Samachar-NewsBot/1.0; +https://gg-samachar.rahulsocialwits.workers.dev/)","Accept":"application/rss+xml,application/atom+xml,text/xml,application/xml;q=0.9,*/*;q=0.8"}},12000);
      if(!rr.ok){errors++;continue}
      const items=parseFeed(await rr.text(),source);
      fetched+=items.length;
      for(const item of items.slice(0,4)){
        if(!item.url||!item.title)continue;
        if(await env.DB.prepare("SELECT id FROM articles WHERE source_url=?").bind(item.url).first()){skipped++;continue}
        try{
          let a=null;
          try{a=await ai(env,item)}catch{}
          const fallbackCategory=/india|national|bharat/i.test(item.title)?"India":/world|america|pakistan|china|global/i.test(item.title)?"World":"Gujarat";
          const publishedAt=isoDate(item.published,now);
          const img=item.image||"";
          const titleGu=a?.title_gujarati||item.title;
          const titleEn=a?.title_english||item.title;
          const summaryGu=a?.summary_gujarati||item.description||"";
          const summaryEn=a?.summary_english||item.description||"";
          const contentGu=a?.content_gujarati||summaryGu;
          const contentEn=a?.content_english||summaryEn;
          const slug=slugify(titleEn)+"-"+Date.now();
          await env.DB.prepare("INSERT INTO articles(source_name,source_url,title_original,title_gujarati,title_english,summary_gujarati,summary_english,content_gujarati,content_english,category,city,image_url,image_width,image_height,published_at,fetched_at,status,slug,seo_title,seo_description,tags) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(source.name,item.url,item.title,titleGu,titleEn,summaryGu,summaryEn,contentGu,contentEn,a?.category||fallbackCategory,a?.city||"",img,1000,600,publishedAt,now,"published",slug,a?.seo_title||titleEn,a?.seo_description||summaryEn,Array.isArray(a?.tags)?a.tags.join(","):String(a?.tags||"")).run();
          published++;
        }catch{errors++}
      }
    }catch{errors++}
  }
  await env.DB.prepare("INSERT INTO publishing_logs(run_at,source_name,fetched,published,skipped,errors,message) VALUES(?,?,?,?,?,?,?)").bind(now,"ALL",fetched,published,skipped,errors,"RSS → D1 → optional Groq rewrite").run();
  return{fetched,published,skipped,errors,sources:sources.length,run_at:now};
}
async function getArticles(env,u){await ensureSchema(env.DB);const limit=Math.min(Math.max(Number(u.searchParams.get("limit")||24),1),100),page=Math.max(Number(u.searchParams.get("page")||1),1),cat=u.searchParams.get("category"),city=u.searchParams.get("city"),q=u.searchParams.get("q");let sql="SELECT * FROM articles WHERE status='published'",p=[];if(cat){sql+=" AND category=?";p.push(cat)}if(city){sql+=" AND city=?";p.push(city)}if(q){sql+=" AND (title_gujarati LIKE ? OR title_english LIKE ? OR summary_gujarati LIKE ? OR summary_english LIKE ?)";const z="%"+q+"%";p.push(z,z,z,z)}sql+=" ORDER BY datetime(published_at) DESC,id DESC LIMIT ? OFFSET ?";p.push(limit,(page-1)*limit);const r=await env.DB.prepare(sql).bind(...p).all();return{page,limit,count:r.results?.length||0,articles:r.results||[]}}
async function getAdminData(env){await ensureSchema(env.DB);const [stats,logs,articles,sources]=await Promise.all([env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) published,SUM(CASE WHEN image_url!='' THEN 1 ELSE 0 END) with_images FROM articles").first(),env.DB.prepare("SELECT * FROM publishing_logs ORDER BY id DESC LIMIT 50").all(),env.DB.prepare("SELECT * FROM articles ORDER BY id DESC LIMIT 100").all(),env.DB.prepare("SELECT * FROM sources ORDER BY name").all()]);return{stats:stats||{},logs:logs.results||[],articles:articles.results||[],sources:sources.results||[]}}
async function body(req){try{return await req.json()}catch{return{}}}
async function saveArticle(req,env,id){const b=await body(req);const fields=["title_gujarati","title_english","summary_gujarati","summary_english","content_gujarati","content_english","category","city","image_url","seo_title","seo_description","tags","status"];if(!id){if(!b.title_gujarati)return json({ok:false,error:"Gujarati title required"},400);const slug=slugify(b.title_english||b.title_gujarati)+"-"+Date.now();const r=await env.DB.prepare("INSERT INTO articles(source_name,source_url,title_original,title_gujarati,title_english,summary_gujarati,summary_english,content_gujarati,content_english,category,city,image_url,image_width,image_height,published_at,fetched_at,status,slug,seo_title,seo_description,tags) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind("GG Samachar Admin",b.source_url||"admin:"+Date.now(),b.title_gujarati,b.title_gujarati,b.title_english||b.title_gujarati,b.summary_gujarati||"",b.summary_english||"",b.content_gujarati||"",b.content_english||"",b.category||"Gujarat",b.city||"",b.image_url||"",1000,600,b.published_at||new Date().toISOString(),new Date().toISOString(),b.status||"published",slug,b.seo_title||b.title_english||b.title_gujarati,b.seo_description||b.summary_english||b.summary_gujarati||"",b.tags||"").run();return json({ok:true,id:r.meta?.last_row_id,slug})}const sets=[],vals=[];for(const f of fields)if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+"=?");vals.push(b[f])}if(!sets.length)return json({ok:false,error:"No fields to update"},400);vals.push(id);await env.DB.prepare("UPDATE articles SET "+sets.join(", ")+" WHERE id=?").bind(...vals).run();return json({ok:true})}
export default{async scheduled(event,env,ctx){ctx.waitUntil(collect(env))},async fetch(req,env){const u=new URL(req.url);if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});try{if(!env.DB)return json({ok:false,error:"D1 binding DB missing"},500);if(u.pathname==="/health")return json({ok:true,service:"GG Samachar API",version:"2.2.0",bindings:{GROQ_API_KEY:!!env.GROQ_API_KEY,DB:!!env.DB},endpoints:["/health","/articles","/article/:slug","/collect","/sources","/weather","/market","/admin/data","/admin/articles","/admin/sources","/admin/logs"]});if(u.pathname==="/articles")return json({ok:true,...await getArticles(env,u)});if(u.pathname.startsWith("/article/")){await ensureSchema(env.DB);const a=await env.DB.prepare("SELECT * FROM articles WHERE slug=? LIMIT 1").bind(decodeURIComponent(u.pathname.slice(9))).first();return a?json({ok:true,article:a}):json({ok:false,error:"Article not found"},404)}if(u.pathname==="/collect"){if(req.method!=="POST")return json({ok:false,error:"POST required"},405);return json({ok:true,...await collect(env)})}if(u.pathname==="/sources")return json({ok:true,sources:SOURCES});if(u.pathname==="/admin/data"){if(!admin(req,env))return json({ok:false,error:"Unauthorized"},401);return json({ok:true,...await getAdminData(env)})}if(u.pathname==="/admin/collect"){if(!admin(req,env))return json({ok:false,error:"Unauthorized"},401);if(req.method!=="POST")return json({ok:false,error:"POST required"},405);return json({ok:true,...await collect(env)})}if(u.pathname==="/admin/articles"&&req.method==="POST"){if(!admin(req,env))return json({ok:false,error:"Unauthorized"},401);return saveArticle(req,env,null)}if(u.pathname.match(/^\/admin\/articles\/\d+$/)&&["PUT","PATCH"].includes(req.method)){if(!admin(req,env))return json({ok:false,error:"Unauthorized"},401);return saveArticle(req,env,Number(u.pathname.split("/").pop()))}if(u.pathname.match(/^\/admin\/articles\/\d+$/)&&req.method==="DELETE"){if(!admin(req,env))return json({ok:false,error:"Unauthorized"},401);await env.DB.prepare("DELETE FROM articles WHERE id=?").bind(Number(u.pathname.split("/").pop())).run();return json({ok:true})}if(u.pathname==="/admin/sources"&&req.method==="POST"){if(!admin(req,env))return json({ok:false,error:"Unauthorized"},401);const b=await body(req);if(!b.name||!b.feed_url)return json({ok:false,error:"Name and feed URL required"},400);await env.DB.prepare("INSERT INTO sources(name,feed_url,homepage_url,enabled,notes) VALUES(?,?,?,?,?)").bind(b.name,b.feed_url,b.homepage_url||"",b.enabled===false?0:1,b.notes||"").run();return json({ok:true})}if(u.pathname==="/admin/sources"&&req.method==="DELETE"){if(!admin(req,env))return json({ok:false,error:"Unauthorized"},401);const b=await body(req);await env.DB.prepare("DELETE FROM sources WHERE id=?").bind(b.id).run();return json({ok:true})}if(u.pathname==="/admin/logs"){if(!admin(req,env))return json({ok:false,error:"Unauthorized"},401);const r=await env.DB.prepare("SELECT * FROM publishing_logs ORDER BY id DESC LIMIT 100").all();return json({ok:true,logs:r.results||[]})}if(u.pathname==="/weather"){const city=u.searchParams.get("city")||"Ahmedabad",c=CITIES[city]||CITIES.Ahmedabad,api=new URL("https://api.open-meteo.com/v1/forecast");api.searchParams.set("latitude",c[0]);api.searchParams.set("longitude",c[1]);api.searchParams.set("current","temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");api.searchParams.set("daily","temperature_2m_max,temperature_2m_min,precipitation_probability_max");api.searchParams.set("timezone","Asia/Kolkata");api.searchParams.set("forecast_days","7");const r=await fetch(api);return json({ok:r.ok,provider:"Open-Meteo",city,data:await r.json()},r.ok?200:502)}if(u.pathname==="/collect-now"){if(req.method!=="POST")return json({ok:false,error:"POST required"},405);return json({ok:true,...await collect(env)})}if(u.pathname==="/market"){return json({ok:true,provider:"TejHQ",mode:"snapshot",message:"TejHQ keyless snapshot is connected as the no-key market layer. For intraday NIFTY/SENSEX live quotes, add a licensed/live market provider key.",api:"https://api.tejhq.dev"})}return json({ok:true,service:"GG Samachar API",version:"2.1.0",endpoints:["/health","/articles","/collect","/sources","/weather","/market","/admin/data","/admin/articles","/admin/sources","/admin/logs"]})}catch(e){return json({ok:false,error:String(e?.message||e)},500)}}};