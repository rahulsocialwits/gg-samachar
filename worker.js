// GG Samachar Worker — deployment pipeline verified for Node 22 / Wrangler 4
const CORS={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type,Authorization,X-Admin-Key"
};
const SOURCES=[
  {name:"TV9 Gujarati",feed:"https://tv9gujarati.com/feed",home:"https://tv9gujarati.com/"},
  {name:"Hindustan Metro Gujarati",feed:"https://hindustanmetro.com/gujarati/rss/latest-posts",home:"https://hindustanmetro.com/gujarati/"},
  {name:"Divya Bhaskar",feed:"https://www.divyabhaskar.co.in/rss-feed/1037/",home:"https://www.divyabhaskar.co.in/"},
  {name:"News18 World",feed:"https://www.news18.com/rss/world.xml",home:"https://www.news18.com/"},
  {name:"The Hindu",feed:"https://www.thehindu.com/feeder/default.rss",home:"https://www.thehindu.com/"},
  {name:"Indian Express",feed:"https://indianexpress.com/print/front-page/feed/",home:"https://indianexpress.com/"}
];
const CITIES={Mumbai:[19.076,72.8777,"મુંબઈ"],Ahmedabad:[23.0225,72.5714,"અમદાવાદ"],Surat:[21.1702,72.8311,"સુરત"],Rajkot:[22.3039,70.8022,"રાજકોટ"],Vadodara:[22.3072,73.1812,"વડોદરા"],Gandhinagar:[23.2156,72.6369,"ગાંધીનગર"],Bhuj:[23.242,69.6669,"ભુજ"],Bhavnagar:[21.7645,72.1519,"ભાવનગર"],Jamnagar:[22.4707,70.0577,"જામનગર"],Junagadh:[21.5222,70.4579,"જૂનાગઢ"],Mehsana:[23.588,72.3693,"મહેસાણા"]};
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
function parseFeed(xml,source){const blocks=xml.match(/<item\b[\s\S]*?<\/item>/gi)||xml.match(/<entry\b[\s\S]*?<\/entry>/gi)||[];return blocks.slice(0,20).map(b=>{const links=[...b.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]);const url=tag(b,"link")||attr(links.find(x=>/href=/i.test(x))||"",["href"])||attr(b,["href"]);const media=/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/i.exec(b)?.[0]||"";return{source:source.name,source_name:source.name,url,title:tag(b,"title"),description:tag(b,"description")||tag(b,"summary")||tag(b,"content:encoded")||tag(b,"content"),published:tag(b,"pubDate")||tag(b,"published")||tag(b,"updated")||tag(b,"dc:date"),image:attr(media,["url","href"])}}).filter(x=>x.url&&x.title)}
function slugify(s){return String(s||"news").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s-]/gu,"").trim().replace(/[\s_-]+/g,"-").slice(0,100)||"news"}
const ADMIN_EMAIL="rahulsocialwits@gmail.com";
const PLACEHOLDER_IMAGE="https://gg-samachar.rahulsocialwits.workers.dev/assets/images/news-placeholder.svg";
async function sha256(value){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function createAdminSession(env){const token=crypto.randomUUID()+"-"+crypto.randomUUID();const hash=await sha256(token);const expires=new Date(Date.now()+86400000).toISOString();await env.DB.prepare("INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)").bind(hash,expires).run();return{token,expires}}
async function requireAdmin(req,env){
  const auth=req.headers.get("Authorization")||"";
  if(auth.startsWith("Bearer ")){const token=auth.slice(7).trim();const hash=await sha256(token);const row=await env.DB.prepare("SELECT id,expires_at FROM admin_sessions WHERE token_hash=?").bind(hash).first();if(!row)return{ok:false,error:"Unauthorized"};if(new Date(row.expires_at).getTime()<=Date.now()){await env.DB.prepare("DELETE FROM admin_sessions WHERE id=?").bind(row.id).run();return{ok:false,error:"Session expired"}}return{ok:true,sessionId:row.id}}
  if(env.ADMIN_KEY&&req.headers.get("X-Admin-Key")===env.ADMIN_KEY)return{ok:true,legacy:true};
  return{ok:false,error:"Unauthorized"};
}
async function admin(req,env){return (await requireAdmin(req,env)).ok}
let schemaReady=null;
async function ensureSchema(db){
  if(schemaReady)return schemaReady;
  schemaReady=(async()=>{
    await db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS articles(id INTEGER PRIMARY KEY AUTOINCREMENT,source_name TEXT NOT NULL,source_url TEXT NOT NULL UNIQUE,source_article_id TEXT,title_original TEXT,title_gujarati TEXT NOT NULL,title_english TEXT,summary_gujarati TEXT,summary_english TEXT,content_gujarati TEXT,content_english TEXT,category TEXT,city TEXT,image_url TEXT,image_width INTEGER DEFAULT 1000,image_height INTEGER DEFAULT 600,published_at TEXT,fetched_at TEXT NOT NULL,status TEXT DEFAULT 'published',slug TEXT UNIQUE,seo_title TEXT,seo_description TEXT,tags TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS sources(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,feed_url TEXT,homepage_url TEXT,enabled INTEGER DEFAULT 1,notes TEXT)"),
      db.prepare("CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,slug TEXT NOT NULL UNIQUE,enabled INTEGER DEFAULT 1,sort_order INTEGER DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS admin_sessions(id INTEGER PRIMARY KEY AUTOINCREMENT,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL)"),
      db.prepare("CREATE TABLE IF NOT EXISTS publishing_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,run_at TEXT NOT NULL,source_name TEXT,fetched INTEGER DEFAULT 0,published INTEGER DEFAULT 0,skipped INTEGER DEFAULT 0,errors INTEGER DEFAULT 0,message TEXT)"),
      db.prepare("CREATE TABLE IF NOT EXISTS source_health(id INTEGER PRIMARY KEY AUTOINCREMENT,source_id INTEGER,name TEXT NOT NULL,checked_at TEXT NOT NULL,status TEXT NOT NULL,http_status INTEGER,items INTEGER DEFAULT 0,error TEXT,latency_ms INTEGER)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_articles_status_published_at ON articles(status,published_at DESC)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_articles_city ON articles(city)")
    ]);

    const defaults=["Gujarat","India","World","Business","Sports","Technology","Entertainment","Lifestyle"];
    for(let i=0;i<defaults.length;i++){
      const name=defaults[i],slug=slugify(name);
      await db.prepare("INSERT INTO categories(name,slug,enabled,sort_order) VALUES(?,?,1,?) ON CONFLICT(name) DO NOTHING").bind(name,slug,i).run();
    }
    for(const s of SOURCES){
      await db.prepare("INSERT INTO sources(name,feed_url,homepage_url,enabled) VALUES(?,?,?,1) ON CONFLICT(name) DO UPDATE SET feed_url=excluded.feed_url,homepage_url=excluded.homepage_url").bind(s.name,s.feed,s.home).run();
    }
    for(const legacy of ["IAM Gujarat","Google News Gujarati","News18 Gujarati","ABP Asmita"]){
      await db.prepare("UPDATE sources SET enabled=0 WHERE name=?").bind(legacy).run();
    }
  })().catch(e=>{schemaReady=null;throw e});
  return schemaReady;
}
async function articleImage(url){if(!url)return"";try{const c=new AbortController(),t=setTimeout(()=>c.abort(),6000),r=await fetch(url,{signal:c.signal,headers:{"User-Agent":"Mozilla/5.0 GG-Samachar/1.0"}});clearTimeout(t);if(!r.ok)return"";const h=await r.text();const p=[/property=["']og:image["'][^>]+content=["']([^"']+)["']/i,/content=["']([^"']+)["'][^>]+property=["']og:image["']/i,/name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,/content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i];for(const x of p){const m=h.match(x);if(m?.[1])return m[1]}return""}catch{return""}}
function hasGujarati(s){return /[\u0A80-\u0AFF]/.test(String(s||""))}
function needsGujaratiTranslation(item){return !hasGujarati(item.title)&&!hasGujarati(item.description)&&!hasGujarati(item.content)}
function validGujaratiOutput(a){return !!a&&hasGujarati(a.title_gujarati)&&hasGujarati(a.summary_gujarati)&&hasGujarati(a.content_gujarati)}
async function ai(env,item){
  if(!env.GROQ_API_KEY)throw Error("GROQ_API_KEY is not configured");
  const model=env.AI_MODEL||"openai/gpt-oss-20b";
  const categoryRows=await env.DB.prepare("SELECT name FROM categories WHERE enabled=1 ORDER BY sort_order,name").all();
  const categoryNames=(categoryRows.results||[]).map(x=>x.name).filter(Boolean);
  const categoryList=categoryNames.length?categoryNames:["Gujarat","India","World","Business","Sports","Technology","Entertainment","Lifestyle"];
  const prompt={
    source_title:item.title||"",
    source_description:item.description||"",
    source_content:item.content||"",
    source_name:item.source_name||"",
    source_url:item.url||"",
    force_gujarati:!!item._forceGujarati
  };
  const r=await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+env.GROQ_API_KEY,"Content-Type":"application/json"},body:JSON.stringify({model,temperature:.1,response_format:{type:"json_object"},messages:[
    {role:"system",content:"You are the Gujarati editor for GG Samachar. Return ONLY valid JSON. Translate English/Hindi source material into natural, professional Gujarati. This is a STRICT translation task: title_gujarati, summary_gujarati and content_gujarati MUST contain Gujarati script (Unicode U+0A80-U+0AFF) when the source is not already Gujarati. Do not copy English sentences into Gujarati fields. English is allowed only for proper names, brands, tickers, technical terms and unavoidable abbreviations. Preserve every factual detail supplied and never invent facts. Also provide concise English versions. Choose exactly one category from this ACTIVE GG Samachar category list: "+categoryList.join(", ")+". If the story does not fit a specialized category, choose the closest broad category. Determine category from the actual story, not generic words such as 'India' or a person's name. For city, return the main city if explicitly stated, otherwise empty. tags should be short comma-separated Gujarati/English search terms."},
    {role:"user",content:JSON.stringify(prompt)}
  ]})},15000);
  if(!r.ok){const detail=await r.text().catch(()=>""),err=new Error("Groq "+r.status+(detail?" · "+detail.slice(0,240):""));err.code="GROQ_HTTP";throw err;}
  const j=await r.json();
  const raw=j.choices?.[0]?.message?.content||"{}";
  const out=JSON.parse(raw);
  const allowed=new Set(categoryNames.length?categoryNames:["Gujarat","India","World","Business","Sports","Technology","Entertainment","Lifestyle"]);
  if(!allowed.has(out.category))out.category="";
  return out;
}
async function collect(env){
  await ensureSchema(env.DB);
  const runAt=new Date().toISOString();
  let fetched=0,published=0,skipped=0,errors=0,groqErrors=0;
  const configured=await env.DB.prepare("SELECT id,name,feed_url,homepage_url FROM sources WHERE enabled=1 ORDER BY id").all();
  const sources=(configured.results||[]).filter(x=>x.feed_url);
  const sourceResults=[];
  let newPublished=0;
  const MAX_NEW_PER_RUN=3;
  for(const source of sources){
    const started=Date.now(); let status="ok",httpStatus=null,error="",itemsCount=0;
    try{
      const rr=await fetchWithTimeout(source.feed_url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; GG-Samachar-NewsBot/1.0)","Accept":"application/rss+xml,application/atom+xml,text/xml,application/xml;q=0.9,*/*;q=0.8"}},12000);
      httpStatus=rr.status;if(!rr.ok)throw Error("HTTP "+rr.status);
      const items=parseFeed(await rr.text(),source);itemsCount=items.length;fetched+=items.length;
      for(const item of items.slice(0,6)){
        if(!item.url||!item.title)continue;
        const existing=await env.DB.prepare("SELECT id FROM articles WHERE source_url=?").bind(item.url).first();
        if(!existing&&newPublished>=MAX_NEW_PER_RUN){skipped++;continue;}
        try{
          let a=null;let translationFailed=false;try{a=await ai(env,item);if(needsGujaratiTranslation(item)&&!validGujaratiOutput(a)){a=await ai(env,{...item,_forceGujarati:true});if(!validGujaratiOutput(a))throw Error("Groq returned non-Gujarati fields")}}catch(e){groqErrors++;translationFailed=true}
          const fallbackCategory=/business|market|stock|share|economy|sensex|nifty|rupee|bank|company|mou|investment/i.test(item.title)?"Business":/sports|cricket|football|tennis|ipl|match|player/i.test(item.title)?"Sports":/tech|technology|artificial intelligence|\bai\b|iphone|google|microsoft|software/i.test(item.title)?"Technology":/movie|film|actor|actress|music|bollywood|entertainment/i.test(item.title)?"Entertainment":/world|america|pakistan|china|global|iran|israel|russia|ukraine/i.test(item.title)?"World":/gujarat|ahmedabad|surat|vadodara|rajkot|gandhinagar|kutch/i.test(item.title)?"Gujarat":"India";
          const publishedAt=isoDate(item.published,runAt);let img=item.image||"";if(!img)img=await articleImage(item.url);if(!(String(img).startsWith("http://")||String(img).startsWith("https://")))img=PLACEHOLDER_IMAGE;
          const oldGujarati=existing?await env.DB.prepare("SELECT title_gujarati,summary_gujarati,content_gujarati FROM articles WHERE id=?").bind(existing.id).first():null;
          const oldGujaratiValid=!!oldGujarati&&validGujaratiOutput(oldGujarati);
          if(translationFailed&&needsGujaratiTranslation(item)&&!oldGujaratiValid){errors++;continue}
          const titleGu=translationFailed&&needsGujaratiTranslation(item)?oldGujarati.title_gujarati:((a?.title_gujarati&&validGujaratiOutput(a))?a.title_gujarati:(hasGujarati(item.title)?item.title:"")),titleEn=a?.title_english||item.title,summaryGu=translationFailed&&needsGujaratiTranslation(item)?oldGujarati.summary_gujarati:(a?.summary_gujarati||(hasGujarati(item.description)?item.description:"")),summaryEn=a?.summary_english||item.description||"",contentGu=translationFailed&&needsGujaratiTranslation(item)?oldGujarati.content_gujarati:(a?.content_gujarati||summaryGu),contentEn=a?.content_english||summaryEn,slug=slugify(titleEn)+"-"+Date.now()+"-"+Math.floor(Math.random()*10000);
          if(existing){
            await env.DB.prepare("UPDATE articles SET title_original=?,title_gujarati=?,title_english=?,summary_gujarati=?,summary_english=?,content_gujarati=?,content_english=?,category=?,city=?,image_url=?,published_at=?,fetched_at=?,seo_title=?,seo_description=?,tags=? WHERE id=?").bind(item.title,titleGu,titleEn,summaryGu,summaryEn,contentGu,contentEn,a?.category||fallbackCategory,a?.city||"",img,publishedAt,runAt,a?.seo_title||titleEn,a?.seo_description||summaryEn,Array.isArray(a?.tags)?a.tags.join(","):String(a?.tags||""),existing.id).run();
            published++;
          }else{
            await env.DB.prepare("INSERT INTO articles(source_name,source_url,title_original,title_gujarati,title_english,summary_gujarati,summary_english,content_gujarati,content_english,category,city,image_url,image_width,image_height,published_at,fetched_at,status,slug,seo_title,seo_description,tags) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(source.name,item.url,item.title,titleGu,titleEn,summaryGu,summaryEn,contentGu,contentEn,a?.category||fallbackCategory,a?.city||"",img,1000,600,publishedAt,runAt,"published",slug,a?.seo_title||titleEn,a?.seo_description||summaryEn,Array.isArray(a?.tags)?a.tags.join(","):String(a?.tags||"")).run();published++;newPublished++;
          }
        }catch(e){errors++}
      }
    }catch(e){status="error";error=String(e?.message||e);errors++}
    await env.DB.prepare("INSERT INTO source_health(source_id,name,checked_at,status,http_status,items,error,latency_ms) VALUES(?,?,?,?,?,?,?,?)").bind(source.id,source.name,runAt,status,httpStatus,itemsCount,error,Date.now()-started).run();
    sourceResults.push({id:source.id,name:source.name,status,http_status:httpStatus,items:itemsCount,error,latency_ms:Date.now()-started});
  }
  const message="RSS → D1 · "+published+" published ("+newPublished+" new) · max 3 new/run · "+groqErrors+" Groq/translation failures · "+errors+" errors";
  await env.DB.prepare("INSERT INTO publishing_logs(run_at,source_name,fetched,published,skipped,errors,message) VALUES(?,?,?,?,?,?,?)").bind(runAt,"ALL",fetched,published,skipped,errors,message).run();
  return{fetched,published,skipped,errors,groq_errors:groqErrors,sources:sources.length,run_at:runAt,source_results:sourceResults};
}
async function getArticles(env,u){
  await ensureSchema(env.DB);
  const limit=Math.min(Math.max(Number(u.searchParams.get("limit")||24),1),100);
  const page=Math.max(Number(u.searchParams.get("page")||1),1);
  const cat=u.searchParams.get("category"),city=u.searchParams.get("city"),q=u.searchParams.get("q");
  let where="WHERE status='published'",p=[];
  if(cat){where+=" AND category=?";p.push(cat)}
  if(city){where+=" AND city=?";p.push(city)}
  if(q){where+=" AND (title_gujarati LIKE ? OR title_english LIKE ? OR summary_gujarati LIKE ? OR summary_english LIKE ?)";const z="%"+q+"%";p.push(z,z,z,z)}
  const sql="SELECT * FROM articles "+where+" ORDER BY datetime(published_at) DESC,id DESC LIMIT ? OFFSET ?";
  const [totalRow,r]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) total FROM articles "+where).bind(...p).first(),
    env.DB.prepare(sql).bind(...p,limit,(page-1)*limit).all()
  ]);
  const total=Number(totalRow?.total||0);
  return{page,limit,count:r.results?.length||0,total,pages:Math.ceil(total/limit),articles:r.results||[]};
}
async function getCategories(env){await ensureSchema(env.DB);const r=await env.DB.prepare("SELECT * FROM categories WHERE enabled=1 ORDER BY sort_order,name").all();return r.results||[]}
async function getPublicStats(env){
  await ensureSchema(env.DB);
  const [articles,sources,categories,lastRun]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) published FROM articles").first(),
    env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) enabled FROM sources").first(),
    env.DB.prepare("SELECT COUNT(*) total FROM categories WHERE enabled=1").first(),
    env.DB.prepare("SELECT * FROM publishing_logs ORDER BY id DESC LIMIT 1").first()
  ]);
  return{articles:articles||{},sources:sources||{},categories:categories||{},last_run:lastRun||null};
}
async function saveCategory(req,env,id){const b=await body(req);const name=String(b.name||"").trim();if(!name)return json({ok:false,error:"Category name required"},400);const slug=slugify(name);if(!id){try{const r=await env.DB.prepare("INSERT INTO categories(name,slug,enabled,sort_order) VALUES(?,?,?,?)").bind(name,slug,b.enabled===false?0:1,Number(b.sort_order||0)).run();return json({ok:true,id:r.meta?.last_row_id})}catch(e){return json({ok:false,error:String(e?.message||e)},400)}}try{await env.DB.prepare("UPDATE categories SET name=?,slug=?,enabled=?,sort_order=? WHERE id=?").bind(name,slug,b.enabled===false?0:1,Number(b.sort_order||0),id).run();return json({ok:true})}catch(e){return json({ok:false,error:String(e?.message||e)},400)}}
async function getCollectorStatus(env){
  await ensureSchema(env.DB);
  const [lastRun,stats,sources,health,latest]=await Promise.all([
    env.DB.prepare("SELECT * FROM publishing_logs ORDER BY id DESC LIMIT 1").first(),
    env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) published,MAX(published_at) latest_published_at,MAX(fetched_at) latest_fetched_at FROM articles").first(),
    env.DB.prepare("SELECT id,name,enabled,feed_url FROM sources ORDER BY id").all(),
    env.DB.prepare("SELECT h.* FROM source_health h INNER JOIN (SELECT source_id,MAX(id) id FROM source_health GROUP BY source_id) x ON x.id=h.id ORDER BY h.name").all(),
    env.DB.prepare("SELECT id,source_name,title_gujarati,category,published_at,fetched_at,image_url FROM articles WHERE status='published' ORDER BY published_at DESC,id DESC LIMIT 5").all()
  ]);
  return {
    ok:true,
    last_run:lastRun||null,
    stats:stats||{},
    active_sources:(sources.results||[]).filter(x=>Number(x.enabled)===1).map(x=>({id:x.id,name:x.name})),
    source_health:health.results||[],
    latest_articles:latest.results||[]
  };
}
async function getAdminData(env){await ensureSchema(env.DB);const [stats,logs,articles,sources,health,lastRun]=await Promise.all([env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) published,SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) drafts,SUM(CASE WHEN image_url!='' THEN 1 ELSE 0 END) with_images FROM articles").first(),env.DB.prepare("SELECT * FROM publishing_logs ORDER BY id DESC LIMIT 50").all(),env.DB.prepare("SELECT * FROM articles ORDER BY id DESC LIMIT 100").all(),env.DB.prepare("SELECT * FROM sources ORDER BY name").all(),env.DB.prepare("SELECT h.* FROM source_health h INNER JOIN (SELECT source_id,MAX(id) id FROM source_health GROUP BY source_id) x ON x.id=h.id ORDER BY h.name").all(),env.DB.prepare("SELECT * FROM publishing_logs ORDER BY id DESC LIMIT 1").first()]);const categories=await getCategories(env);return{stats:stats||{},logs:logs.results||[],articles:articles.results||[],sources:sources.results||[],categories,source_health:health.results||[],last_run:lastRun||null}}
async function body(req){try{return await req.json()}catch{return{}}}
async function saveArticle(req,env,id){const b=await body(req);const fields=["title_gujarati","title_english","summary_gujarati","summary_english","content_gujarati","content_english","category","city","image_url","seo_title","seo_description","tags","status"];if(!id){if(!b.title_gujarati)return json({ok:false,error:"Gujarati title required"},400);const slug=slugify(b.title_english||b.title_gujarati)+"-"+Date.now();const r=await env.DB.prepare("INSERT INTO articles(source_name,source_url,title_original,title_gujarati,title_english,summary_gujarati,summary_english,content_gujarati,content_english,category,city,image_url,image_width,image_height,published_at,fetched_at,status,slug,seo_title,seo_description,tags) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind("GG Samachar Admin",b.source_url||"admin:"+Date.now(),b.title_gujarati,b.title_gujarati,b.title_english||b.title_gujarati,b.summary_gujarati||"",b.summary_english||"",b.content_gujarati||"",b.content_english||"",b.category||"Gujarat",b.city||"",b.image_url||"",1000,600,b.published_at||new Date().toISOString(),new Date().toISOString(),b.status||"published",slug,b.seo_title||b.title_english||b.title_gujarati,b.seo_description||b.summary_english||b.summary_gujarati||"",b.tags||"").run();return json({ok:true,id:r.meta?.last_row_id,slug})}const sets=[],vals=[];for(const f of fields)if(Object.prototype.hasOwnProperty.call(b,f)){sets.push(f+"=?");vals.push(b[f])}if(!sets.length)return json({ok:false,error:"No fields to update"},400);vals.push(id);await env.DB.prepare("UPDATE articles SET "+sets.join(", ")+" WHERE id=?").bind(...vals).run();return json({ok:true})}
async function checkHttp(url,options={},ms=7000){const started=Date.now();try{const r=await fetchWithTimeout(url,options,ms);return{ok:r.ok,status:r.status,latency_ms:Date.now()-started}}catch(e){return{ok:false,status:0,latency_ms:Date.now()-started,error:String(e?.message||e)}}}
async function diagnostics(env){await ensureSchema(env.DB);const db=await env.DB.prepare("SELECT 1 ok").first().then(()=>({ok:true})).catch(e=>({ok:false,error:String(e?.message||e)}));const groq=env.GROQ_API_KEY?await checkHttp("https://api.groq.com/openai/v1/models",{headers:{Authorization:"Bearer "+env.GROQ_API_KEY}},7000):{ok:false,error:"GROQ_API_KEY not configured"};const weather=await checkHttp("https://api.open-meteo.com/v1/forecast?latitude=23.0225&longitude=72.5714&current=temperature_2m&timezone=Asia%2FKolkata");const market=await checkHttp("https://snapdata.dev/api/v1/equity-indices");const cron=await env.DB.prepare("SELECT * FROM publishing_logs ORDER BY id DESC LIMIT 1").first();return{ok:db.ok,version:"3.2.1",time:new Date().toISOString(),services:{cloudflare_worker:true,d1:db,groq,weather,market},cron:cron||null}}
export default{async scheduled(event,env,ctx){ctx.waitUntil(collect(env))},async fetch(req,env){const u=new URL(req.url);if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});try{if(u.pathname==="/api/health"){
  if(!env.DB)return json({ok:false,service:"GG Samachar API",version:"3.2.0",bindings:{GROQ_API_KEY:!!env.GROQ_API_KEY,DB:false},error:"D1 binding DB missing"},500);
  const db=await env.DB.prepare("SELECT 1 AS ok").first().then(()=>true).catch(()=>false);
  return json({ok:db,service:"GG Samachar API",version:"3.2.0",bindings:{GROQ_API_KEY:!!env.GROQ_API_KEY,DB:true},database:{query_ok:db},endpoints:["/api/health","/api/articles","/api/article/:slug","/api/sources","/api/categories","/api/stats","/api/weather","/api/calendar","/api/market","/admin/data","/admin/articles","/admin/sources","/admin/categories","/admin/logs","/admin/diagnostics","/admin/test-groq","/admin/test-source","/admin/source-toggle","/admin/collect"]},db?200:503);
}if(!env.DB)return json({ok:false,error:"D1 binding DB missing"},500);if(u.pathname==="/api/articles")return json({ok:true,...await getArticles(env,u)});if(u.pathname.startsWith("/api/article/")){await ensureSchema(env.DB);const a=await env.DB.prepare("SELECT * FROM articles WHERE slug=? LIMIT 1").bind(decodeURIComponent(u.pathname.slice(13))).first();return a?json({ok:true,article:a}):json({ok:false,error:"Article not found"},404)}if(u.pathname==="/collect"){
  if(req.method!=="POST")return json({ok:false,error:"POST required"},405);
  const a=await requireAdmin(req,env);if(!a.ok)return json({ok:false,error:a.error},401);
  return json({ok:true,...await collect(env)});
}if(u.pathname==="/api/sources"){await ensureSchema(env.DB);const r=await env.DB.prepare("SELECT id,name,feed_url,homepage_url,enabled,notes FROM sources ORDER BY id").all();return json({ok:true,sources:r.results||[]})}
if(u.pathname==="/api/categories")return json({ok:true,categories:await getCategories(env)});
if(u.pathname==="/api/stats")return json({ok:true,...await getPublicStats(env)});if(u.pathname==="/api/collector-status")return json(await getCollectorStatus(env));if(u.pathname==="/admin/login"&&req.method==="POST"){try{const b=await req.json();const email=String(b.email||"").trim().toLowerCase();const password=String(b.password||"");if(!env.ADMIN_KEY)return json({ok:false,error:"Admin secret is not configured."},500);if(email!==ADMIN_EMAIL||password!==env.ADMIN_KEY)return json({ok:false,error:"Invalid email or password."},401);await ensureSchema(env.DB);const s=await createAdminSession(env);return json({ok:true,token:s.token,expires_at:s.expires,email:ADMIN_EMAIL})}catch(e){return json({ok:false,error:e.message},400)}}
if(u.pathname==="/admin/me"&&req.method==="GET"){const a=await requireAdmin(req,env);return a.ok?json({ok:true,email:ADMIN_EMAIL}):json({ok:false,error:a.error},401)}
if(u.pathname==="/admin/logout"&&req.method==="POST"){const a=await requireAdmin(req,env);if(a.ok&&a.sessionId)await env.DB.prepare("DELETE FROM admin_sessions WHERE id=?").bind(a.sessionId).run();return json({ok:true})}
if(u.pathname==="/admin/diagnostics"&&req.method==="GET"){const a=await requireAdmin(req,env);if(!a.ok)return json({ok:false,error:a.error},401);return json(await diagnostics(env))}
if(u.pathname==="/admin/test-groq"&&req.method==="POST"){const a=await requireAdmin(req,env);if(!a.ok)return json({ok:false,error:a.error},401);try{const out=await ai(env,{title:"GG Samachar test",description:"System test only"});return json({ok:true,model:env.AI_MODEL||"openai/gpt-oss-20b",result:out})}catch(e){return json({ok:false,error:String(e?.message||e)},502)}}
if(u.pathname==="/admin/test-source"&&req.method==="POST"){const a=await requireAdmin(req,env);if(!a.ok)return json({ok:false,error:a.error},401);const b=await body(req),row=await env.DB.prepare("SELECT * FROM sources WHERE id=?").bind(Number(b.id)).first();if(!row)return json({ok:false,error:"Source not found"},404);const started=Date.now();try{const rr=await fetchWithTimeout(row.feed_url,{headers:{"User-Agent":"GG-Samachar-Test/1.0"}},10000);const items=rr.ok?parseFeed(await rr.text(),row):[];return json({ok:rr.ok,name:row.name,status:rr.status,items:items.length,latency_ms:Date.now()-started})}catch(e){return json({ok:false,name:row.name,error:String(e?.message||e),latency_ms:Date.now()-started},502)}}
if(u.pathname==="/admin/source-toggle"&&req.method==="POST"){const a=await requireAdmin(req,env);if(!a.ok)return json({ok:false,error:a.error},401);const b=await body(req);await env.DB.prepare("UPDATE sources SET enabled=? WHERE id=?").bind(b.enabled?1:0,Number(b.id)).run();return json({ok:true})}
if(u.pathname==="/admin/categories"&&req.method==="GET"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);return json({ok:true,categories:await getCategories(env)})}
if(u.pathname==="/admin/categories"&&req.method==="POST"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);return saveCategory(req,env,null)}
if(u.pathname.match(/^\/admin\/categories\/\d+$/)&&["PUT","PATCH"].includes(req.method)){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);return saveCategory(req,env,Number(u.pathname.split("/").pop()))}
if(u.pathname.match(/^\/admin\/categories\/\d+$/)&&req.method==="DELETE"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);const id=Number(u.pathname.split("/").pop());const row=await env.DB.prepare("SELECT name FROM categories WHERE id=?").bind(id).first();if(!row)return json({ok:false,error:"Category not found"},404);const count=await env.DB.prepare("SELECT COUNT(*) n FROM articles WHERE category=?").bind(row.name).first();if(Number(count?.n||0)>0){await env.DB.prepare("UPDATE categories SET enabled=0 WHERE id=?").bind(id).run();return json({ok:true,disabled:true,message:"Category is used by articles, so it was disabled instead of deleted."})}await env.DB.prepare("DELETE FROM categories WHERE id=?").bind(id).run();return json({ok:true})}
if(u.pathname==="/admin/data"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);return json({ok:true,...await getAdminData(env)})}if(u.pathname==="/admin/collect"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);if(req.method!=="POST")return json({ok:false,error:"POST required"},405);return json({ok:true,...await collect(env)})}if(u.pathname==="/admin/articles"&&req.method==="POST"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);return saveArticle(req,env,null)}if(u.pathname.match(/^\/admin\/articles\/\d+$/)&&["PUT","PATCH"].includes(req.method)){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);return saveArticle(req,env,Number(u.pathname.split("/").pop()))}if(u.pathname.match(/^\/admin\/articles\/\d+$/)&&req.method==="DELETE"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);await env.DB.prepare("DELETE FROM articles WHERE id=?").bind(Number(u.pathname.split("/").pop())).run();return json({ok:true})}if(u.pathname==="/admin/sources"&&req.method==="POST"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);const b=await body(req);if(!b.name||!b.feed_url)return json({ok:false,error:"Name and feed URL required"},400);await env.DB.prepare("INSERT INTO sources(name,feed_url,homepage_url,enabled,notes) VALUES(?,?,?,?,?)").bind(b.name,b.feed_url,b.homepage_url||"",b.enabled===false?0:1,b.notes||"").run();return json({ok:true})}if(u.pathname==="/admin/sources"&&req.method==="DELETE"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);const b=await body(req);await env.DB.prepare("DELETE FROM sources WHERE id=?").bind(b.id).run();return json({ok:true})}if(u.pathname==="/admin/logs"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);const r=await env.DB.prepare("SELECT * FROM publishing_logs ORDER BY id DESC LIMIT 100").all();return json({ok:true,logs:r.results||[]})}if(u.pathname==="/api/weather"){const city=u.searchParams.get("city")||"Mumbai",c=CITIES[city]||CITIES.Ahmedabad,api=new URL("https://api.open-meteo.com/v1/forecast");api.searchParams.set("latitude",c[0]);api.searchParams.set("longitude",c[1]);api.searchParams.set("current","temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");api.searchParams.set("daily","temperature_2m_max,temperature_2m_min,precipitation_probability_max");api.searchParams.set("timezone","Asia/Kolkata");api.searchParams.set("forecast_days","7");const r=await fetch(api);return json({ok:r.ok,provider:"Open-Meteo",city,data:await r.json()},r.ok?200:502)}if(u.pathname==="/api/calendar"){
  const city=(u.searchParams.get("city")||"mumbai").toLowerCase().replace(/[^a-z-]/g,"");
  const date=u.searchParams.get("date");
  const endpoint=date
    ?"https://shastrapanchangam.com/api/v1/day/"+encodeURIComponent(city)+"/"+encodeURIComponent(date)+".json"
    :"https://shastrapanchangam.com/api/v1/today/"+encodeURIComponent(city)+".json";
  try{
    const r=await fetchWithTimeout(endpoint,{},8000);
    const data=await r.json();
    return json({ok:r.ok,provider:"Shastra Panchangam",city,date:date||"today",data},r.ok?200:502);
  }catch(e){return json({ok:false,error:"Calendar service unavailable"},502)}
}
if(u.pathname==="/collect-now"){
  if(req.method!=="POST")return json({ok:false,error:"POST required"},405);
  const a=await requireAdmin(req,env);if(!a.ok)return json({ok:false,error:a.error},401);
  return json({ok:true,...await collect(env)});
}if(u.pathname==="/api/market"){
  const q=(u.searchParams.get("q")||"").trim().toLowerCase();
  const idxUrl="https://snapdata.dev/api/v1/equity-indices/in/latest.json";
  const fxUrl="https://snapdata.dev/api/v1/fx/world/latest.json";
  const stockDate=new Date();
  let stockRows=[],usedDate="";
  for(let i=0;i<7;i++){
    const dt=new Date(stockDate);dt.setUTCDate(dt.getUTCDate()-i);
    const ds=dt.toISOString().slice(0,10);
    try{
      const r=await fetchWithTimeout("https://api.tejhq.dev/v1/snapshot/nse?date="+ds,{},8000);
      if(!r.ok)continue;
      const j=await r.json();
      if(Array.isArray(j.data)&&j.data.length){stockRows=j.data;usedDate=ds;break}
    }catch{}
  }
  const rows=stockRows.map(x=>{
    const last=Number(x.last??x.close),prev=Number(x.prev_close);
    const change=Number.isFinite(last)&&Number.isFinite(prev)&&prev!==0?((last-prev)/prev)*100:null;
    return {...x,last,prev_close:prev,change_pct:change};
  }).filter(x=>x.symbol&&Number.isFinite(x.last));
  const gainers=rows.filter(x=>x.change_pct>0).sort((a,b)=>b.change_pct-a.change_pct).slice(0,8);
  const losers=rows.filter(x=>x.change_pct<0).sort((a,b)=>a.change_pct-b.change_pct).slice(0,8);
  const active=[...rows].sort((a,b)=>Number(b.volume||0)-Number(a.volume||0)).slice(0,8);
  const search=q?[...rows].filter(x=>String(x.symbol+" "+x.name).toLowerCase().includes(q)).slice(0,12):[];
  let indices=[],fx=null;
  try{const r=await fetchWithTimeout(idxUrl,{},6000);if(r.ok){const j=await r.json();indices=(j.observations||[]).filter(x=>x.value!=null)}}catch{}
  try{const r=await fetchWithTimeout(fxUrl,{},6000);if(r.ok){const j=await r.json();fx=(j.observations||[]).find(x=>x.instrument_id==="USD.INR.RATE"&&x.value!=null)||null}}catch{}
  const byId=id=>indices.find(x=>x.instrument_id===id)||null;
  return json({ok:true,provider:"Snapdata + TejHQ",mode:"daily",date:indices[0]?.date||usedDate,
    indices:{nifty50:byId("NIFTY50.INR.IDX"),bankNifty:byId("NIFTYBANK.INR.IDX"),sensex:byId("SENSEX.INR.IDX")},
    usdInr:fx,gainers,losers,active,search,
    note:"Market figures are daily reference snapshots, not intraday trading quotes."});
}if(u.pathname==="/"){
  const assetUrl=new URL("/index.html",u.origin);
  return env.ASSETS.fetch(new Request(assetUrl.toString(),req));
}
return env.ASSETS.fetch(req)}catch(e){return json({ok:false,error:String(e?.message||e)},500)}}};