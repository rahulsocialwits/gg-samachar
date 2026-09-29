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
const ADMIN_EMAIL="rahulsocialwits@gmail.com";
async function sha256(value){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,"0")).join("")}
async function createAdminSession(env){const token=crypto.randomUUID()+"-"+crypto.randomUUID();const hash=await sha256(token);const expires=new Date(Date.now()+86400000).toISOString();await env.DB.prepare("INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)").bind(hash,expires).run();return{token,expires}}
async function requireAdmin(req,env){
  const auth=req.headers.get("Authorization")||"";
  if(auth.startsWith("Bearer ")){const token=auth.slice(7).trim();const hash=await sha256(token);const row=await env.DB.prepare("SELECT id,expires_at FROM admin_sessions WHERE token_hash=?").bind(hash).first();if(!row)return{ok:false,error:"Unauthorized"};if(new Date(row.expires_at).getTime()<=Date.now()){await env.DB.prepare("DELETE FROM admin_sessions WHERE id=?").bind(row.id).run();return{ok:false,error:"Session expired"}}return{ok:true,sessionId:row.id}}
  if(env.ADMIN_KEY&&req.headers.get("X-Admin-Key")===env.ADMIN_KEY)return{ok:true,legacy:true};
  return{ok:false,error:"Unauthorized"};
}
async function admin(req,env){return (await requireAdmin(req,env)).ok}
async function seedDemoArticles(db){
  const demos=[
    {
      source_url:"demo:gg-samachar-1",
      source_name:"GG Samachar Demo",
      title_original:"GG Samachar demo story",
      title_gujarati:"ગુજરાતમાં નવી સવાર: સ્થાનિક સમાચાર માટે GG Samachar હવે વધુ ઝડપી",
      title_english:"GG Samachar newsroom is now faster and easier to follow",
      summary_gujarati:"આ ડેમો સ્ટોરી માત્ર નવા ન્યૂઝરૂમનું લેઆઉટ અને કન્ટેન્ટ ફ્લો બતાવવા માટે છે. લાઇવ RSS સમાચાર આવતા જ આ જગ્યા વાસ્તવિક સમાચારોથી ભરાશે.",
      summary_english:"This demo story is shown while the newsroom is being populated. Live RSS stories will replace it as fresh news arrives.",
      content_gujarati:"આ ડેમો આર્ટિકલ GG Samacharના નવા newsroom layout માટે બનાવવામાં આવ્યો છે. લાઇવ સમાચાર સ્રોતોમાંથી મળતા લેખો આપમેળે આ ફીડમાં ઉમેરાશે. આ ડેમો સ્ટોરીને વાસ્તવિક સમાચાર તરીકે રજૂ કરવામાં આવતી નથી.",
      content_english:"This demo article exists only to demonstrate the GG Samachar newsroom layout. Live stories from configured news feeds will be added automatically. It is not presented as a real-world news report.",
      category:"Gujarat",city:"Ahmedabad",slug:"demo-gg-samachar-1"
    },
    {
      source_url:"demo:gg-samachar-2",
      source_name:"GG Samachar Demo",
      title_original:"GG Samachar demo story 2",
      title_gujarati:"ડિજિટલ ન્યૂઝરૂમમાં હવે તાજા સમાચાર માટે ઝડપી અપડેટ સિસ્ટમ",
      title_english:"A faster update system is powering the GG Samachar newsroom",
      summary_gujarati:"દર 30 મિનિટે સમાચાર સ્રોતો તપાસવાની automation સાથે homepage પર નવી stories લાવવાનું setup તૈયાર છે.",
      summary_english:"The newsroom is configured to check enabled sources every 30 minutes and surface fresh stories on the homepage.",
      content_gujarati:"GG Samacharનું publishing flow RSS sources, D1 database અને optional AI rewriting સાથે કામ કરે છે. દરેક scheduled run નવા links શોધે છે અને duplicate stories ફરીથી publish થતી અટકાવે છે.",
      content_english:"The GG Samachar publishing flow uses RSS sources, D1 and optional AI rewriting. Each scheduled run discovers new links and avoids republishing duplicates.",
      category:"Technology",city:"",slug:"demo-gg-samachar-2"
    },
    {
      source_url:"demo:gg-samachar-3",
      source_name:"GG Samachar Demo",
      title_original:"GG Samachar demo story 3",
      title_gujarati:"ગુજરાતી ભાષામાં સમાચાર વાંચવા માટે નવી સ્વચ્છ અને સરળ ડિઝાઇન",
      title_english:"A cleaner Gujarati-first design for reading the news",
      summary_gujarati:"નવી ડિઝાઇનમાં મુખ્ય સમાચાર, તાજા સમાચાર, ગુજરાત, ભારત અને વિશ્વ માટે અલગ sections સાથે mobile-first વાંચન અનુભવ છે.",
      summary_english:"The refreshed design separates featured, latest, Gujarat, India and world coverage for a cleaner mobile-first reading experience.",
      content_gujarati:"આ ડેમો સ્ટોરી નવા UIના content hierarchyનું ઉદાહરણ છે. રંગો, typography અને spacingને ગુજરાતી વાંચન માટે સુધારવામાં આવ્યા છે.",
      content_english:"This demo story demonstrates the new content hierarchy. Colors, typography and spacing have been tuned for Gujarati-first reading.",
      category:"Gujarat",city:"",slug:"demo-gg-samachar-3"
    }
  ];
  const now=new Date().toISOString();
  for(const d of demos){
    await db.prepare("INSERT OR IGNORE INTO articles(source_name,source_url,title_original,title_gujarati,title_english,summary_gujarati,summary_english,content_gujarati,content_english,category,city,image_url,image_width,image_height,published_at,fetched_at,status,slug,seo_title,seo_description,tags) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(d.source_name,d.source_url,d.title_original,d.title_gujarati,d.title_english,d.summary_gujarati,d.summary_english,d.content_gujarati,d.content_english,d.category,d.city,"",1000,600,now,now,"published",d.slug,d.title_english,d.summary_english,"demo,gg-samachar").run();
  }
}
async function ensureSchema(db){await db.batch([
  db.prepare("CREATE TABLE IF NOT EXISTS articles(id INTEGER PRIMARY KEY AUTOINCREMENT,source_name TEXT NOT NULL,source_url TEXT NOT NULL UNIQUE,source_article_id TEXT,title_original TEXT,title_gujarati TEXT NOT NULL,title_english TEXT,summary_gujarati TEXT,summary_english TEXT,content_gujarati TEXT,content_english TEXT,category TEXT,city TEXT,image_url TEXT,image_width INTEGER DEFAULT 1000,image_height INTEGER DEFAULT 600,published_at TEXT,fetched_at TEXT NOT NULL,status TEXT DEFAULT 'published',slug TEXT UNIQUE,seo_title TEXT,seo_description TEXT,tags TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
  db.prepare("CREATE TABLE IF NOT EXISTS sources(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE,feed_url TEXT,homepage_url TEXT,enabled INTEGER DEFAULT 1,notes TEXT)"),
  db.prepare("CREATE TABLE IF NOT EXISTS admin_sessions(id INTEGER PRIMARY KEY AUTOINCREMENT,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL)"),
  db.prepare("CREATE TABLE IF NOT EXISTS publishing_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,run_at TEXT NOT NULL,source_name TEXT,fetched INTEGER DEFAULT 0,published INTEGER DEFAULT 0,skipped INTEGER DEFAULT 0,errors INTEGER DEFAULT 0,message TEXT)"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC)"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category)"),
  db.prepare("CREATE INDEX IF NOT EXISTS idx_articles_city ON articles(city)")
]);for(const s of SOURCES)await db.prepare("INSERT INTO sources(name,feed_url,homepage_url,enabled) VALUES(?,?,?,1) ON CONFLICT(name) DO UPDATE SET feed_url=excluded.feed_url,homepage_url=excluded.homepage_url,enabled=1").bind(s.name,s.feed,s.home).run();for(const legacy of ["IAM Gujarat","Google News Gujarati","News18 Gujarati","ABP Asmita"])await db.prepare("UPDATE sources SET enabled=0 WHERE name=?").bind(legacy).run();await seedDemoArticles(db)}
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
          const img=item.image||await articleImage(item.url)||"";
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
export default{async scheduled(event,env,ctx){ctx.waitUntil(collect(env))},async fetch(req,env){const u=new URL(req.url);if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});try{if(!env.DB)return json({ok:false,error:"D1 binding DB missing"},500);if(u.pathname==="/health")return json({ok:true,service:"GG Samachar API",version:"2.5.0",bindings:{GROQ_API_KEY:!!env.GROQ_API_KEY,DB:!!env.DB},endpoints:["/health","/articles","/article/:slug","/collect","/sources","/weather","/market","/admin/data","/admin/articles","/admin/sources","/admin/logs"]});if(u.pathname==="/articles")return json({ok:true,...await getArticles(env,u)});if(u.pathname.startsWith("/article/")){await ensureSchema(env.DB);const a=await env.DB.prepare("SELECT * FROM articles WHERE slug=? LIMIT 1").bind(decodeURIComponent(u.pathname.slice(9))).first();return a?json({ok:true,article:a}):json({ok:false,error:"Article not found"},404)}if(u.pathname==="/collect"){if(req.method!=="POST")return json({ok:false,error:"POST required"},405);return json({ok:true,...await collect(env)})}if(u.pathname==="/sources")return json({ok:true,sources:SOURCES});if(u.pathname==="/admin/login"&&req.method==="POST"){try{const b=await req.json();const email=String(b.email||"").trim().toLowerCase();const password=String(b.password||"");if(!env.ADMIN_KEY)return json({ok:false,error:"Admin secret is not configured."},500);if(email!==ADMIN_EMAIL||password!==env.ADMIN_KEY)return json({ok:false,error:"Invalid email or password."},401);await ensureSchema(env.DB);const s=await createAdminSession(env);return json({ok:true,token:s.token,expires_at:s.expires,email:ADMIN_EMAIL})}catch(e){return json({ok:false,error:e.message},400)}}
if(u.pathname==="/admin/me"&&req.method==="GET"){const a=await requireAdmin(req,env);return a.ok?json({ok:true,email:ADMIN_EMAIL}):json({ok:false,error:a.error},401)}
if(u.pathname==="/admin/logout"&&req.method==="POST"){const a=await requireAdmin(req,env);if(a.ok&&a.sessionId)await env.DB.prepare("DELETE FROM admin_sessions WHERE id=?").bind(a.sessionId).run();return json({ok:true})}
if(u.pathname==="/admin/diagnostics"&&req.method==="GET"){const a=await requireAdmin(req,env);if(!a.ok)return json({ok:false,error:a.error},401);return json({ok:true,version:"2.5.0",d1:!!env.DB,groq_api_key:!!env.GROQ_API_KEY,admin_token:!!env.ADMIN_KEY,time:new Date().toISOString()})}
if(u.pathname==="/admin/data"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);return json({ok:true,...await getAdminData(env)})}if(u.pathname==="/admin/collect"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);if(req.method!=="POST")return json({ok:false,error:"POST required"},405);return json({ok:true,...await collect(env)})}if(u.pathname==="/admin/articles"&&req.method==="POST"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);return saveArticle(req,env,null)}if(u.pathname.match(/^\/admin\/articles\/\d+$/)&&["PUT","PATCH"].includes(req.method)){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);return saveArticle(req,env,Number(u.pathname.split("/").pop()))}if(u.pathname.match(/^\/admin\/articles\/\d+$/)&&req.method==="DELETE"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);await env.DB.prepare("DELETE FROM articles WHERE id=?").bind(Number(u.pathname.split("/").pop())).run();return json({ok:true})}if(u.pathname==="/admin/sources"&&req.method==="POST"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);const b=await body(req);if(!b.name||!b.feed_url)return json({ok:false,error:"Name and feed URL required"},400);await env.DB.prepare("INSERT INTO sources(name,feed_url,homepage_url,enabled,notes) VALUES(?,?,?,?,?)").bind(b.name,b.feed_url,b.homepage_url||"",b.enabled===false?0:1,b.notes||"").run();return json({ok:true})}if(u.pathname==="/admin/sources"&&req.method==="DELETE"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);const b=await body(req);await env.DB.prepare("DELETE FROM sources WHERE id=?").bind(b.id).run();return json({ok:true})}if(u.pathname==="/admin/logs"){if(!(await admin(req,env)))return json({ok:false,error:"Unauthorized"},401);const r=await env.DB.prepare("SELECT * FROM publishing_logs ORDER BY id DESC LIMIT 100").all();return json({ok:true,logs:r.results||[]})}if(u.pathname==="/weather"){const city=u.searchParams.get("city")||"Ahmedabad",c=CITIES[city]||CITIES.Ahmedabad,api=new URL("https://api.open-meteo.com/v1/forecast");api.searchParams.set("latitude",c[0]);api.searchParams.set("longitude",c[1]);api.searchParams.set("current","temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m");api.searchParams.set("daily","temperature_2m_max,temperature_2m_min,precipitation_probability_max");api.searchParams.set("timezone","Asia/Kolkata");api.searchParams.set("forecast_days","7");const r=await fetch(api);return json({ok:r.ok,provider:"Open-Meteo",city,data:await r.json()},r.ok?200:502)}if(u.pathname==="/calendar"){
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
if(u.pathname==="/collect-now"){if(req.method!=="POST")return json({ok:false,error:"POST required"},405);return json({ok:true,...await collect(env)})}if(u.pathname==="/market"){
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
}return json({ok:true,service:"GG Samachar API",version:"2.4.0",endpoints:["/health","/articles","/collect","/sources","/weather","/market","/admin/data","/admin/articles","/admin/sources","/admin/logs"]})}catch(e){return json({ok:false,error:String(e?.message||e)},500)}}};