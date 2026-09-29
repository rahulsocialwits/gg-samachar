const SOURCES=[
  ["TV9 Gujarati","https://tv9gujarati.com/gujarat/feed"],
  ["Gujarat Samachar","https://www.gujaratsamachar.com/rss/top-stories"],
  ["Divya Bhaskar","https://www.divyabhaskar.co.in/rss-feed/1037/"],
  ["News18 World","https://www.news18.com/rss/world.xml"],
  ["The Hindu","https://www.thehindu.com/feeder/default.rss"],
  ["Indian Express","https://indianexpress.com/print/front-page/feed/"]
];
const clean=s=>String(s||"").replace(/<!\[CDATA\[/gi,"").replace(/\]\]>/gi,"").replace(/<[^>]+>/g," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&nbsp;/gi," ").replace(/\s+/g," ").trim();
const tag=(b,n)=>clean(b.match(new RegExp("<"+n+"(?:\\:[^ >]+)?[^>]*>([\\s\\S]*?)</"+n+">","i"))?.[1]||"");
const attr=(b,n)=>b.match(new RegExp(n+"\\s*=\\s*[\\"']([^\\"']+)[\\"']","i"))?.[1]||"";
function parse(xml,source){const blocks=xml.match(/<item\b[\s\S]*?<\/item>/gi)||xml.match(/<entry\b[\s\S]*?<\/entry>/gi)||[];return blocks.slice(0,12).map(b=>{const link=b.match(/<link\b[^>]*>/i)?.[0]||"";const media=b.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*>/i)?.[0]||"";return{source_name:source,url:tag(b,"link")||attr(link,"href")||attr(b,"href"),title:tag(b,"title"),summary:tag(b,"description")||tag(b,"summary")||tag(b,"content:encoded")||tag(b,"content"),published:tag(b,"pubDate")||tag(b,"published")||tag(b,"updated")||tag(b,"dc:date"),image_url:attr(media,"url")||attr(media,"href")}}).filter(x=>x.url&&x.title)}
function hash(s){let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h)+s.charCodeAt(i)|0;return Math.abs(h)}
function category(t){const x=t.toLowerCase();if(/world|america|china|pakistan|global|iran|israel|russia/.test(x))return"World";if(/tech|technology|ai|iphone|google|microsoft|software|cyber/.test(x))return"Technology";if(/india|delhi|mumbai|national|modi|supreme court/.test(x))return"India";return"Gujarat"}
const all=[];
for(const [name,url] of SOURCES){try{const r=await fetch(url,{headers:{"User-Agent":"GG-Samachar/1.0"}});if(r.ok)all.push(...parse(await r.text(),name))}catch{}}
const seen=new Set(),articles=[];
for(const x of all){if(seen.has(x.url))continue;seen.add(x.url);const d=x.published?new Date(x.published):new Date();articles.push({slug:"news-"+hash(x.url),source_name:x.source_name,source_url:x.url,title_gujarati:x.title,title_english:x.title,title:x.title,summary_gujarati:x.summary,summary_english:x.summary,summary:x.summary,content_gujarati:x.summary,content_english:x.summary,category:category(x.title),city:"",image_url:x.image_url||"",published_at:Number.isNaN(d.getTime())?new Date().toISOString():d.toISOString()})}
articles.sort((a,b)=>new Date(b.published_at)-new Date(a.published_at));
if(articles.length<3){
  try{const old=JSON.parse(await Bun.file("assets/data/news.json").text());if(Array.isArray(old.articles)&&old.articles.length>=3){console.log("RSS returned too few stories; preserving previous feed.");process.exit(0)}}catch{}
}
await Bun.write("assets/data/news.json",JSON.stringify({generated_at:new Date().toISOString(),source_count:SOURCES.length,article_count:articles.length,articles:articles.slice(0,80)},null,2));