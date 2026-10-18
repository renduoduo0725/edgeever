import { bundleTestScripts } from "./bundle-test-scripts.mjs";
import {expect,test} from 'bun:test';
import {createDocument} from '@mixmark-io/domino';
import {readFileSync} from 'node:fs';
import {platformTarget, socialPlatform} from './src/platform-clip.ts';
import {readSocial,socialPostCard} from './src/social-clip.ts';
import {docToText,markdownToDoc} from '../../packages/shared/src/content.ts';
export const socialSamples={
 bluesky:{url:'https://bsky.app/profile/bsky.app/post/3mhgg5ja5gc2w',title:'v1.119 is live!',author:'Bluesky',images:1,text:"what's a bot and what's not."},
 facebook:{url:'https://www.facebook.com/NASA/posts/pfbid0dPToN66CzcAHGMoaNe3jszH4FfBKvqkE5gogCNJkTxXDPsSGYrGvcVwsLgByyMQQl',author:'NASA - National Aeronautics and Space Administration',images:1,text:'in the red cloud'},
 instagram:{url:'https://www.instagram.com/p/DeAYvsnn4la/',title:'Swipe for countless stars',author:'nasa',images:3,text:'#Stars'},
 threads:{url:'https://www.threads.com/@nasa/post/DZceA72Drjf',author:'nasa',images:4,text:'Artemis Art Show topic!'},
 linkedin:{url:'https://www.linkedin.com/posts/friends-of-nasa_nasa-space-astronomy-activity-7497764718095323136-NRvr',title:'Nancy Grace Roman Space Telescope: Launch Preparations | NASA Kennedy',author:'Friends of NASA',images:8,text:'144.47 MB'},
};
const fixture=n=>createDocument(readFileSync(new URL(`./fixtures/platforms/${n}.html`,import.meta.url),'utf8'));
export const linkedinPersonUrl='https://www.linkedin.com/posts/maddyahmad_softwareengineering-artificialintelligence-share-7456582751698190336-6NVK/';
const linkedinUgcUrl='https://www.linkedin.com/posts/nasa-space-astronomy-ugcPost-7497764716677758977-qmKO/';

for(const name of ['facebook','bluesky','linkedin']) test(`${name}: a preceding nested post cannot replace the original body`,()=>{
 const doc=fixture(name),target=platformTarget(socialSamples[name].url),card=socialPostCard(doc,target);
 if(name==='linkedin') {doc.querySelectorAll('script,[data-test-id="feed-images-content__overlay"]').forEach(node=>node.remove());}
 const before=readSocial(doc,target);expect(before.ok).toBe(true);
 const nested=card.cloneNode(true),selector={facebook:'[data-ad-preview="message"]',bluesky:'[data-testid="postText"], [data-word-wrap="1"]',linkedin:'[data-test-id="main-feed-activity-card__commentary"]'}[name];
 nested.querySelector(selector).textContent='COMMENT BODY SENTINEL';
 if(name==='linkedin') nested.setAttribute('data-activity-urn','urn:li:activity:123456789');
 else for(const link of Array.from(nested.querySelectorAll('a[href]'))) if(platformTarget(link.href)?.url===target.url) link.setAttribute('href',name==='facebook'?'https://www.facebook.com/NASA/posts/123456789':'https://bsky.app/profile/bsky.app/post/3mxhdhodv222n');
 card.insertBefore(nested,card.firstChild);
 const result=readSocial(doc,target);expect(result.ok).toBe(true);
 expect(result.clip.markdown).toContain(socialSamples[name].text);
 expect(result.clip.markdown).not.toContain('COMMENT BODY SENTINEL');
 expect(result.clip.title).toBe(before.clip.title);
});

test('the target script ignores hidden header permalinks when binding Facebook and Bluesky cards',async()=>{
 const {createContext,runInContext}=await import('node:vm'),{createWindow}=await import('@mixmark-io/domino');
 const [source]=bundleTestScripts(['social-target']);
 for(const name of ['facebook','bluesky']) {
  const sample=socialSamples[name],url=name==='bluesky'?'https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l':sample.url;
  const w=createWindow(readFileSync(new URL(`./fixtures/platforms/${name==='bluesky'?'bluesky-feed':name}.html`,import.meta.url),'utf8'),url),target=platformTarget(url),card=socialPostCard(w.document,target);
  const before=readSocial(w.document,target);expect(before.ok).toBe(true);
  const bogus=w.document.createElement('a');bogus.setAttribute('href',name==='facebook'?'https://www.facebook.com/NASA/posts/123456789':'https://bsky.app/profile/bsky.app/post/3mxhdhodv222n');bogus.style.display='none';card.insertBefore(bogus,card.firstChild);
  runInContext(source,createContext({document:w.document,location:w.location,Element:w.Element,Node:w.Node,URL}));
  const event=w.document.createEvent('MouseEvents');event.initMouseEvent('contextmenu',true,true,w,0,0,0,0,0,false,false,false,false,2,null);
  card.querySelector(name==='facebook'?'[data-ad-preview="message"]':'[data-testid="postText"], [data-word-wrap="1"]').dispatchEvent(event);
  expect(card.getAttribute('data-edgeever-social-target')).toBe(target.url);
  const result=readSocial(w.document,target);expect(result.ok).toBe(true);expect(result.clip.url).toBe(target.url);expect(result.clip.markdown).toBe(before.clip.markdown);
 }
});
test('Threads shortened visible links bind to the loaded caption without reading replies',()=>{
 const d=fixture('threads-short-link'),target=platformTarget('https://www.threads.com/@nasa/post/DeMqtuYgkaL');
 const r=readSocial(d,target);expect(r.ok).toBe(true);expect(r.clip.author).toBe('nasa');
 expect(r.clip.markdown).toContain('814GB');expect(r.clip.markdown).toContain('go.nasa.gov/Artemis2LunarScience');
 expect(r.clip.markdown.match(/!\[/g)).toHaveLength(1);
 const a=d.querySelector('a[href="http://go.nasa.gov/Artemis2LunarScience"]');a.setAttribute('href','https://example.test/unrelated');
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
});
test('Threads wrapped short links bind only the visible card to the full caption',()=>{
 const target=platformTarget('https://www.threads.com/@nasa/post/DeMqtuYgkaL');
 const read=href=>{
  const d=fixture('threads-short-link');
  d.querySelector('a[href="http://go.nasa.gov/Artemis2LunarScience"]').setAttribute('href',href);
  return readSocial(d,target);
 };
 const destination='http://go.nasa.gov/Artemis2LunarScience';
 const wrapped='https://l.threads.com/?u='+encodeURIComponent(destination)+'&h=site-tracking';
 const r=read(wrapped);expect(r.ok).toBe(true);
 expect(r.clip.author).toBe('nasa');expect(r.clip.markdown).toContain('go.nasa.gov/Artemis2LunarScience');
 expect(r.clip.markdown).not.toContain('site-tracking');expect(r.clip.markdown.match(/!\[/g)).toHaveLength(1);
 for(const href of [
  'https://l.threads.com/?u='+encodeURIComponent('https://example.test/unrelated'),
  'https://l.threads.com/?u='+encodeURIComponent('javascript:alert(1)'),
  'https://l.threads.com/',
  'https://l.threads.com.example.test/?u='+encodeURIComponent(destination),
  'https://l.threads.com/other?u='+encodeURIComponent(destination),
 ]) expect(read(href)).toEqual({ok:false,reason:'unreadable'});
 const truncated=fixture('threads-short-link');
 const a=truncated.querySelector('a[href="http://go.nasa.gov/Artemis2LunarScience"]');
 a.setAttribute('href',wrapped);a.parentElement.firstElementChild.textContent='Truncated body…';
 expect(readSocial(truncated,target)).toEqual({ok:false,reason:'unreadable'});
});
test('LinkedIn signed-in and guest cards share identical body formatting and link destinations',()=>{
 const target=platformTarget(linkedinUgcUrl);
 const signed=readSocial(fixture('linkedin-ugc'),target),guest=readSocial(fixture('linkedin-ugc-guest'),target);
 expect(signed.ok).toBe(true);expect(guest.ok).toBe(true);
 const body=r=>r.clip.markdown.split(/\n\n!\[/)[0];
 expect(body(signed)).toBe(body(guest));
 expect(body(guest)).toContain('[FriendsofNASA.org](http://friendsofnasa.org/)');
 expect(body(guest)).not.toContain('/signup/');expect(body(guest)).not.toContain('trk=');
 const truncated=fixture('linkedin-ugc-guest');truncated.querySelector('[data-test-id="main-feed-activity-card__commentary"]').textContent='Nancy Grace Roman Space Telescope…';
 const fallback=readSocial(truncated,target);expect(fallback.ok).toBe(true);expect(fallback.clip.markdown).toContain('144.47 MB');expect(fallback.clip.markdown).toContain('#Education');
});
test('LinkedIn guest UGC URL reads the card-declared activity alias and its full JSON-LD',()=>{
 const d=fixture('linkedin-ugc-guest'),target=platformTarget(linkedinUgcUrl);
 const r=readSocial(d,target);expect(r.ok).toBe(true);expect(r.clip.id).toBe(target.id);expect(r.clip.url).toBe(target.url);
 expect(r.clip.author).toBe('Friends of NASA');expect(r.clip.markdown).toContain('144.47 MB');expect(r.clip.markdown.match(/!\[/g)).toHaveLength(8);
 expect(r.clip.markdown).toStartWith('Nancy Grace Roman Space Telescope:');
 expect(r.clip.markdown).not.toContain('21,268 位关注者');
 d.querySelector('[data-test-id="main-feed-activity-card__commentary"]').insertAdjacentHTML('beforeend','<p>21,268 位关注者 is part of this post.</p>');
 const schema=d.querySelector('script'),data=JSON.parse(schema.textContent);data.articleBody+='\n\n21,268 位关注者 is part of this post.';schema.textContent=JSON.stringify(data);
 expect(readSocial(d,target).clip.markdown).toContain('21,268 位关注者 is part of this post.');
 expect(r.clip.publishedAt.precision).toBe('datetime');
 const card=d.querySelector('[data-activity-urn]');card.removeAttribute('data-attributed-urn');
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
 const a=d.createElement('a');a.href=linkedinUgcUrl;d.querySelector('[data-test-id="main-feed-activity-card__commentary"]').appendChild(a);
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
 card.setAttribute('data-attributed-urn','urn:li:ugcPost:7497764716677758978');
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
});
test('LinkedIn signed-in UGC card keeps full body, actor, relative time and all eight images',()=>{
 const r=readSocial(fixture('linkedin-ugc'),platformTarget(linkedinUgcUrl));
 expect(r.ok).toBe(true);expect(r.clip.author).toBe('Friends of NASA');
 expect(r.clip.title).toBe('Nancy Grace Roman Space Telescope: Launch Preparations | NASA Kennedy');
 expect(r.clip.markdown).toContain('144.47 MB');expect(r.clip.markdown).toContain('#Education');
 expect(r.clip.markdown.match(/!\[/g)).toHaveLength(8);
 expect(r.clip.publishedAt).toEqual({value:'1 个月前 • 已编辑',precision:'relative'});
 expect(r.clip.markdown).not.toContain('/safety/go/');
});
test('LinkedIn UGC cards reject missing images, stale identities, hidden roots and comment identities',()=>{
 const target=platformTarget(linkedinUgcUrl);
 const missing=fixture('linkedin-ugc');missing.querySelector('[data-testid="carousel-child-container"]').remove();
 expect(readSocial(missing,target)).toEqual({ok:false,reason:'incomplete'});
 const d=fixture('linkedin-ugc');const card=d.querySelector('[role="listitem"]');
 expect(readSocial(d,platformTarget(linkedinUgcUrl.replace('7497764716677758977','7497764716677758978')))).toEqual({ok:false,reason:'unreadable'});
 card.setAttribute('aria-hidden','true');expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});card.removeAttribute('aria-hidden');
 const commentary=d.querySelector('[id^="translatable-commentary-"]');commentary.id=commentary.id.replace('contentUrnCommentUrn=null','contentUrnCommentUrn=123');
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
});
test('LinkedIn safety links are unwrapped without keeping tracking or active protocols',()=>{
 const d=fixture('linkedin-ugc'),body=d.querySelector('[data-testid="expandable-text-box"]');
 const a=d.createElement('a');a.href='https://www.linkedin.com/safety/go/?url=https%3A%2F%2Fexample.test%2Farticle&mt=private-tracking';a.textContent='Article';body.appendChild(a);
 const r=readSocial(d,platformTarget(linkedinUgcUrl));expect(r.ok).toBe(true);expect(r.clip.markdown).toContain('[Article](https://example.test/article)');expect(r.clip.markdown).not.toContain('private-tracking');
 a.href='https://www.linkedin.com/safety/go/?url=javascript%3Aalert(1)';
 expect(readSocial(d,platformTarget(linkedinUgcUrl)).clip.markdown).not.toContain('javascript:');
});
test('Instagram per-slide captions identify the visible mixed carousel and retain all 20 covers',()=>{
 const d=fixture('instagram-slide-captions'),target=platformTarget('https://www.instagram.com/p/DeKe6teEpya/');
 const data=JSON.parse(d.querySelector('script').textContent);
 for(const index of [0,1,19]) {
  d.querySelector('article p').textContent=data.carousel_media[index].caption.text;
  const r=readSocial(d,target);expect(r.ok).toBe(true);expect(r.clip.author).toBe('google');
  expect(r.clip.markdown).toContain('what is cosmic dust and how is it so thick');
  expect(r.clip.markdown.match(/!\[/g)).toHaveLength(20);
 }
 d.querySelector('article p').textContent='An unrelated caption';
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
 d.querySelector('article p').textContent=data.carousel_media[0].caption.text;
 d.querySelector('article').setAttribute('aria-hidden','true');
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
 d.querySelector('article').removeAttribute('aria-hidden');
 data.carousel_media.pop();d.querySelector('script').textContent=JSON.stringify(data);
 expect(readSocial(d,target)).toEqual({ok:false,reason:'incomplete'});
});
for(const[name,sample]of Object.entries(socialSamples)){
 test(`${name}: sampled public post keeps complete text, author, publication and all images`,()=>{
  const r=readSocial(fixture(name),platformTarget(sample.url));expect(r.ok).toBe(true);
  expect(r.clip.author).toBe(sample.author);expect(r.clip.publishedAt.precision).toBe('datetime');
  if(sample.title)expect(r.clip.title).toBe(sample.title);
  expect(r.clip.markdown).toContain(sample.text);expect(r.clip.tags).toEqual(['web-clip',name]);
  expect(r.clip.markdown.match(/!\[/g)?.length).toBe(sample.images);
  expect(r.clip.markdown).not.toContain('That eight-pronged diffraction pattern');
  expect(r.clip.markdown).not.toContain('donRolando.com');
 });
 test(`${name}: login, removed content and another post never capture the whole page`,()=>{
  const target=platformTarget(sample.url);
  expect(readSocial(createDocument('<main>Log in <p>Unrelated feed text</p></main>'),target).ok).toBe(false);
  const bad={...target,id:target.id.replace(/.$/,'9'),url:target.url.replace(/.$/,'9')};
  expect(readSocial(fixture(name),bad).ok).toBe(false);
 });
}
test('social addresses retain post identity and reject malicious lookalike hosts',()=>{
 for(const[name,s]of Object.entries(socialSamples)){expect(platformTarget(s.url+'?utm_source=share#comment').platform).toBe(name);expect(socialPlatform(s.url)).toBe(name);expect(socialPlatform(s.url.replace(new URL(s.url).host,new URL(s.url).host+'.evil.test'))).toBeNull();}
 expect(platformTarget('https://www.instagram.com/nasa/p/DeAYvsnn4la/').url).toBe(socialSamples.instagram.url);
 expect(platformTarget('https://www.threads.net/@NASA/post/DZceA72Drjf').url).toBe(socialSamples.threads.url);
 expect(platformTarget('https://www.facebook.com/permalink.php?story_fbid=123&id=456')).toEqual({platform:'facebook',id:'123',url:'https://www.facebook.com/456/posts/123'});
 for(const url of ['https://www.instagram.com/nasa/','https://bsky.app/profile/bsky.app','https://www.linkedin.com/feed/','https://www.facebook.com/permalink.php?story_fbid=123&id=456&id=789'])expect(platformTarget(url)).toBeNull();
});
test('Instagram and Threads never archive a carousel whose remaining items are absent',()=>{
 for(const name of ['instagram','threads']){const d=fixture(name),s=d.querySelector('script'),j=JSON.parse(s.textContent);j.carousel_media_count=j.carousel_media.length;j.carousel_media.pop();s.textContent=JSON.stringify(j);expect(readSocial(d,platformTarget(socialSamples[name].url))).toEqual({ok:false,reason:'incomplete'});}
});
test('Meta captions stay escaped text and active image protocols are never preserved',()=>{
 const d=fixture('instagram'),s=d.querySelector('script'),j=JSON.parse(s.textContent);
 j.caption.text='<script>alert(1)</script> **literal**';const p=d.createElement('p');p.textContent=j.caption.text;d.body.firstElementChild.appendChild(p);j.carousel_media[0].image_versions2.candidates=[{url:'javascript:alert(1)',width:99999,height:99999}];
 s.textContent=JSON.stringify(j);const r=readSocial(d,platformTarget(socialSamples.instagram.url));
 expect(r.ok).toBe(true);expect(r.clip.markdown).not.toContain('javascript:');
 j.carousel_media[0].image_versions2.candidates=[{url:'https://images.example.test/safe.png',width:100,height:100}];s.textContent=JSON.stringify(j);
 const good=readSocial(d,platformTarget(socialSamples.instagram.url));expect(good.ok).toBe(true);expect(good.clip.markdown).not.toContain('<script>');expect(good.clip.markdown).toContain('\\*\\*literal\\*\\*');
});
test('Facebook must expand the target message before returning a complete clip',()=>{
 const d=fixture('facebook');const btn=d.createElement('button');btn.textContent='展开';d.querySelector('[data-ad-preview="message"]').appendChild(btn);
 expect(readSocial(d,platformTarget(socialSamples.facebook.url))).toEqual({ok:false,reason:'incomplete'});
});
test('LinkedIn JSON-LD identity rejects a stale post even when another card remains visible',()=>{
 const d=fixture('linkedin'),s=d.querySelector('script'),j=JSON.parse(s.textContent);j['@id']=socialSamples.linkedin.url.replace('7497764718095323136','7497764718095323137');s.textContent=JSON.stringify(j);
 const body=d.querySelector('[data-test-id="main-feed-activity-card__commentary"]');body.innerHTML='';
 expect(readSocial(d,platformTarget(socialSamples.linkedin.url)).ok).toBe(false);
});

test('a reused feed card cannot satisfy its old right-click marker',()=>{
 const d=fixture('linkedin');const card=d.querySelector('[data-activity-urn]');const target=platformTarget(socialSamples.linkedin.url);
 card.setAttribute('data-edgeever-social-target',target.url);card.setAttribute('data-activity-urn','urn:li:activity:7497764718095323137');
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
});
test('Meta preload alone and hidden captions never count as readable content',()=>{
 for(const name of ['instagram','threads']){const d=fixture(name);d.body.innerHTML='<main>Log in</main>';expect(readSocial(d,platformTarget(socialSamples[name].url))).toEqual({ok:false,reason:'unreadable'});}
});
test('a LinkedIn carousel must account for the visible images and its +3 remainder',()=>{
 const d=fixture('linkedin'),s=d.querySelector('script'),j=JSON.parse(s.textContent);j.image=j.image.slice(0,1);s.textContent=JSON.stringify(j);
 expect(readSocial(d,platformTarget(socialSamples.linkedin.url))).toEqual({ok:false,reason:'incomplete'});
});
test('LinkedIn expanded text remains readable when the toggle becomes See less',()=>{
 const d=fixture('linkedin');d.querySelector('script').remove();d.querySelector('[data-test-id="feed-images-content__overlay"]').remove();const card=d.querySelector('[data-activity-urn]');
 const button=d.createElement('button');button.className='feed-shared-inline-show-more-text__see-more-less-toggle';button.textContent='See less';button.setAttribute('aria-expanded','true');card.appendChild(button);
 expect(readSocial(d,platformTarget(socialSamples.linkedin.url)).ok).toBe(true);
});

test('Bluesky feed uses the visible exact post and keeps the sampled quote and its image without SEO JSON',()=>{
 const d=fixture('bluesky-feed');const r=readSocial(d,platformTarget('https://bsky.app/profile/bsky.app/post/3mxhdhodv222n'));
 expect(r.ok).toBe(true);expect(r.clip.title).toBe('a masterclass in alt text');expect(docToText(markdownToDoc(r.clip.markdown))).toContain('Mr. Joshua');expect(r.clip.markdown).toContain('Lil bone people');expect(r.clip.markdown).not.toContain('minesweeper');expect(r.clip.publishedAt.precision).toBe('relative');
});
test('Bluesky feed retains the sampled Minesweeper link destination',()=>{
 const r=readSocial(fixture('bluesky-feed'),platformTarget('https://bsky.app/profile/mikelacher.bsky.social/post/3mxepywf4ec2j'));
 expect(r.ok).toBe(true);
 expect(r.clip.markdown).toContain('[minesweeper.mikelacher.com](https://minesweeper.mikelacher.com/)');
});
test('Bluesky feed quote link preview remains a parsed image and link in the stored document',()=>{
 const d=fixture('bluesky-feed-preview'),before=d.body.innerHTML;
 const r=readSocial(d,platformTarget('https://bsky.app/profile/bsky.app/post/3mxzez2m7wk2r'));expect(r.ok).toBe(true);
 const parsed=markdownToDoc(r.clip.markdown),images=[],links=[];
 const visit=n=>{if(n.type==='image')images.push(n.attrs.src);for(const m of n.marks||[])if(m.type==='link')links.push(m.attrs.href);for(const c of n.content||[])visit(c)};visit(parsed);
 expect(images).toHaveLength(1);expect(images[0]).toContain('/img/feed_fullsize/');
 expect(links).toContain('https://thenpw.ghost.io/bluesky-wants-more-pro-wrestling-fans/');
 expect(docToText(parsed)).toContain('interviewed Bluesky\'s Harry Packer about pro wrestling.');
 expect(docToText(parsed)).toContain('Fans "You want a place');
 expect(docToText(parsed)).not.toContain('![');expect(docToText(parsed)).not.toContain('](');expect(d.body.innerHTML).toBe(before);
});
test('Bluesky rendered links keep full destinations and line breaks with or without SEO text',()=>{
 for(const seo of [true,false]) {
  const d=fixture('bluesky');if(!seo)Array.from(d.querySelectorAll('script')).forEach(n=>n.remove());
  const body=d.querySelector('[data-word-wrap="1"]');
  body.innerHTML='First line\n\nRead <a href="https://example.test/complete-article?id=123">example.test/complete...</a>\n<a href="javascript:alert(1)">Unsafe link</a>';
  body.appendChild(d.createTextNode('\nLiteral <script>alert(1)</script> **words**'));
  const original=body.outerHTML,r=readSocial(d,platformTarget(socialSamples.bluesky.url));
  expect(r.ok).toBe(true);expect(r.clip.title).toBe('First line');
  expect(r.clip.markdown).toContain('[example.test/complete...](https://example.test/complete-article?id=123)');
  expect(r.clip.markdown).toContain('First line\n\nRead');
  expect(r.clip.markdown).toContain('Unsafe link');expect(r.clip.markdown).not.toContain('javascript:');
  expect(r.clip.markdown).not.toContain('<script>');expect(r.clip.markdown).toContain('\\*\\*words\\*\\*');
  expect(body.outerHTML).toBe(original);
 }
});
test('Bluesky hidden descendants stay out of both title and body with or without SEO text',()=>{
 for(const seo of [true,false]) {
  const d=fixture('bluesky');if(!seo)Array.from(d.querySelectorAll('script')).forEach(n=>n.remove());
  const body=d.querySelector('[data-word-wrap="1"]');
  body.innerHTML='<span hidden>HIDDEN TITLE SECRET</span><p>Visible text.</p><div aria-hidden="true"><span>HIDDEN BODY SECRET</span><a href="https://example.test/hidden">Hidden link</a></div>';
  const original=body.outerHTML,r=readSocial(d,platformTarget(socialSamples.bluesky.url));
  expect(r.ok).toBe(true);expect(r.clip.title).toBe('Visible text.');
  expect(r.clip.markdown).toContain('Visible text.');expect(r.clip.markdown).not.toContain('SECRET');
  expect(r.clip.markdown).not.toContain('https://example.test/hidden');expect(body.outerHTML).toBe(original);
 }
});
test('Bluesky hidden-only text does not become readable through SEO fallback',()=>{
 const d=fixture('bluesky'),script=d.querySelector('script'),schema=JSON.parse(script.textContent);
 schema.image=[];script.textContent=JSON.stringify(schema);Array.from(d.querySelectorAll('img')).forEach(n=>n.remove());
 d.querySelector('[data-word-wrap="1"]').innerHTML='<span hidden>Hidden text.</span><span aria-hidden="true">Also hidden.</span>';
 expect(readSocial(d,platformTarget(socialSamples.bluesky.url))).toEqual({ok:false,reason:'unreadable'});
});
test('fragment and empty links cannot impersonate the target post',()=>{
 const d=fixture('bluesky');const target=platformTarget('https://bsky.app/profile/other.test/post/3mhgg5ja5gc2w');
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
});
test('Facebook public slug and numeric link resolves to the sampled post identity',()=>{
 const d=fixture('facebook');const url='https://www.facebook.com/NASA/posts/brewing-up-baby-stars-nasas-james-webb-space-telescopes-unique-view-reveals-many/1652244896270880/';
 expect(readSocial(d,platformTarget(url)).ok).toBe(true);
});
test('Facebook and LinkedIn photo-only posts remain valid without a text body',()=>{
 for(const name of ['facebook','linkedin']){const d=fixture(name);if(name==='facebook'){d.querySelector('[data-ad-preview="message"]').remove();d.querySelector('script').remove();}else{d.querySelector('[data-test-id="main-feed-activity-card__commentary"]').remove();const s=d.querySelector('script'),j=JSON.parse(s.textContent);j.articleBody='';s.textContent=JSON.stringify(j);}const r=readSocial(d,platformTarget(socialSamples[name].url));expect(r.ok).toBe(true);expect(r.clip.markdown.match(/!\[/g).length).toBe(socialSamples[name].images);}
});

test('body references cannot impersonate Facebook or Bluesky post identity',()=>{
 for(const name of ['facebook','bluesky']) {
  const d=fixture(name),url=name==='facebook'?'https://www.facebook.com/OtherUser/posts/123456789':'https://bsky.app/profile/other.test/post/3mhgg5ja5gc2w';
  const a=d.createElement('a');a.href=url;a.textContent='Referenced post';
  d.querySelector(name==='facebook'?'[data-ad-preview="message"]':'[data-testid="postText"], [data-word-wrap="1"]').appendChild(a);
  expect(readSocial(d,platformTarget(url)).ok).toBe(false);
  expect(readSocial(d,platformTarget(socialSamples[name].url)).ok).toBe(true);
 }
});
test('LinkedIn professional metadata alone is not post content',()=>{
 const d=fixture('linkedin');d.querySelectorAll('[data-test-id="main-feed-activity-card__commentary"], [data-test-id="feed-images-content"]').forEach(n=>n.remove());
 const s=d.querySelector('script'),j=JSON.parse(s.textContent);j.articleBody='';j.image=[];s.textContent=JSON.stringify(j);
 expect(readSocial(d,platformTarget(socialSamples.linkedin.url))).toEqual({ok:false,reason:'unreadable'});
});

test('actual target script selects own header permalinks, ignoring body references and cleared markers',async()=>{
 const {createContext,runInContext}=await import('node:vm'),{createWindow}=await import('@mixmark-io/domino');
 const [source]=bundleTestScripts(["social-target"]);
 for(const [name,sample] of Object.entries(socialSamples)) {
  const w=createWindow(readFileSync(new URL(`./fixtures/platforms/${name==='bluesky'?'bluesky-feed':name}.html`,import.meta.url),'utf8'),sample.url);
  const expected=name==='bluesky'?'https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l':platformTarget(sample.url).url;
  const selector={facebook:'[data-ad-preview="message"]',bluesky:'[data-testid="postText"], [data-word-wrap="1"]',instagram:'time[datetime]',threads:'time[datetime]',linkedin:'[data-test-id="main-feed-activity-card__commentary"]'}[name];
  const e=w.document.querySelector(selector);expect(e).not.toBeNull();
  const bogus=w.document.createElement('a');bogus.href=sample.url.replace(platformTarget(sample.url).id.split('/').pop(),'Other123');bogus.textContent='Referenced post';
  if(name==='instagram'||name==='threads') { const caption=Array.from(w.document.querySelectorAll('span')).find(n=>n.textContent.startsWith(name==='instagram'?'Swipe for countless':'This is the second week'));caption?.appendChild(bogus); }
  else if(name!=='linkedin') e.appendChild(bogus);
  const c=createContext({document:w.document,location:{href:sample.url},Element:w.Element,Node:w.Node,URL});runInContext(source,c);
  const event=w.document.createEvent('MouseEvents');event.initMouseEvent('contextmenu',true,true,w,0,0,0,0,0,false,false,false,false,2,null);e.dispatchEvent(event);
  const marked=w.document.querySelector('[data-edgeever-social-target]');expect(marked?.getAttribute('data-edgeever-social-target')).toBe(expected);
  const outside=w.document.createEvent('MouseEvents');outside.initMouseEvent('contextmenu',true,true,w,0,0,0,0,0,false,false,false,false,2,null);w.document.body.dispatchEvent(outside);
  expect(w.document.querySelector('[data-edgeever-social-target]') || null).toBeNull();
 }
 const w=createWindow(readFileSync(new URL('./fixtures/platforms/linkedin-ugc.html',import.meta.url),'utf8'),linkedinUgcUrl);
 const c=createContext({document:w.document,location:{href:linkedinUgcUrl},Element:w.Element,Node:w.Node,URL});runInContext(source,c);
 const event=w.document.createEvent('MouseEvents');event.initMouseEvent('contextmenu',true,true,w,0,0,0,0,0,false,false,false,false,2,null);
 w.document.querySelector('[data-testid="expandable-text-box"]').dispatchEvent(event);
 expect(w.document.querySelector('[data-edgeever-social-target]')?.getAttribute('data-edgeever-social-target')).toBe(platformTarget(linkedinUgcUrl).url);
});

test('Meta hidden card roots cannot establish readable content',()=>{
 for(const name of ['instagram','threads']) for(const attribute of ['hidden','aria-hidden="true"']) {
  const d=fixture(name),j=JSON.parse(d.querySelector('script').textContent),target=platformTarget(socialSamples[name].url);
  d.body.textContent='';const card=d.createElement('div');if(attribute==='hidden')card.hidden=true;else card.setAttribute('aria-hidden','true');
  const a=d.createElement('a');a.href=target.url;const time=d.createElement('time');time.setAttribute('datetime','2026-01-01T00:00:00Z');a.appendChild(time);card.appendChild(a);
  const p=d.createElement('p');p.textContent=j.caption.text;card.appendChild(p);d.body.appendChild(card);
  expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
 }
});

test('Bluesky archives full-size CDN images and keeps quote images only once',()=>{
 const detail=readSocial(fixture('bluesky'),platformTarget(socialSamples.bluesky.url));expect(detail.ok).toBe(true);expect(detail.clip.markdown).toContain('/img/feed_fullsize/');expect(detail.clip.markdown).not.toContain('/img/feed_thumbnail/');
 const d=fixture('bluesky-feed');const card=Array.from(d.querySelectorAll('[data-testid^="feedItem-by-"]')).find(n=>n.querySelector('[role="link"][aria-label^="Post by "]'));
 const url=Array.from(card.querySelectorAll('a[href]')).map(a=>a.getAttribute('href')).find(href=>/^\/profile\/[^/]+\/post\/[^/]+$/.test(href));const r=readSocial(d,platformTarget('https://bsky.app'+url));
 expect(r.ok).toBe(true);expect(r.clip.markdown.match(/!\[/g)).toHaveLength(1);expect(r.clip.markdown).toContain('/img/feed_fullsize/');
});

test('Substack Note binds the exact header and keeps full paragraphs, source time and one attachment',()=>{
 const url='https://substack.com/@tedgioia/note/c-357811021';
 const target=platformTarget(url+'?utm_source=share#reply');
 expect(target).toEqual({platform:'substack-note',id:'tedgioia/c-357811021',url});
 expect(platformTarget(url.replace('substack.com','substack.com.evil.test'))).toBeNull();
 const d=fixture('substack-note');
 // A recommendation card for the same note can precede its complete detail.
 const preview=d.querySelector('[class*="feedPermalinkUnit-"]').cloneNode(true);
 preview.className='';preview.setAttribute('data-entity-key','c-357811021');preview.querySelector('.ProseMirror').textContent='Truncated recommendation…';d.body.insertBefore(preview,d.body.firstChild);
 const r=readSocial(d,target);
 expect(r.ok).toBe(true);expect(r.clip.author).toBe('Ted Gioia');
 expect(r.clip.publishedAt).toEqual({value:'2026-10-11T04:19:19+08:00',precision:'datetime'});
 expect(r.clip.markdown).toContain('thousands and thousands of these hot takes based on total conjecture');
 expect(r.clip.markdown).toContain('experienced on a large screen');expect(r.clip.markdown).toContain('**P.S.:**');
 expect(r.clip.markdown.match(/!\[/g)).toHaveLength(1);
 for(const noise of ['登录或注册','头像','The Honest Broker','更多选项','7h'])expect(r.clip.markdown).not.toContain(noise);
});

test('Substack Note rejects wrong identities, body-only references, hidden content and truncated text',()=>{
 const url='https://substack.com/@tedgioia/note/c-357811021',target=platformTarget(url);
 expect(readSocial(fixture('substack-note'),platformTarget(url.replace('tedgioia','someoneelse'))).ok).toBe(false);
 const d=fixture('substack-note'),card=d.querySelector('[class*="feedPermalinkUnit-"]');
 card.setAttribute('hidden','');expect(readSocial(d,target).ok).toBe(false);card.removeAttribute('hidden');
 const body=card.querySelector('.ProseMirror');body.setAttribute('aria-hidden','true');expect(readSocial(d,target).ok).toBe(false);body.removeAttribute('aria-hidden');
 const link=card.querySelector('a[href*="/note/"]');body.appendChild(link);
 expect(readSocial(d,target).ok).toBe(false);
 const truncated=fixture('substack-note');truncated.querySelector('.ProseMirror p').textContent='I saw and enjoyed…';
 expect(readSocial(truncated,target)).toEqual({ok:false,reason:'incomplete'});
 const stale=fixture('substack-note');stale.querySelector('[class*="feedPermalinkUnit-"]').setAttribute('data-entity-key','c-357811022');
 expect(readSocial(stale,target).ok).toBe(false);
 const image=fixture('substack-note');image.querySelector('img:not([alt])')?.removeAttribute('src');
 // The attachment has an empty alt attribute, unlike the profile avatar.
 image.querySelector('img[alt=""]')?.removeAttribute('src');
 expect(readSocial(image,target)).toEqual({ok:false,reason:'incomplete'});
});

test('Substack Note CSS-hidden cards and bodies cannot borrow readability from metadata',()=>{
 const target=platformTarget('https://substack.com/@tedgioia/note/c-357811021');
 for(const selector of ['[class*="feedPermalinkUnit-"]','.ProseMirror']) for(const style of ['display:none','visibility:hidden']) {
  const d=fixture('substack-note');d.querySelector(selector).setAttribute('style',style);
  expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
 }
 const d=fixture('substack-note');d.querySelector('.ProseMirror p').setAttribute('style','display:none');
 expect(readSocial(d,target)).toEqual({ok:false,reason:'incomplete'});
 for(const bodyOnly of [false,true]) {
  const duplicate=fixture('substack-note'),card=duplicate.querySelector('[class*="feedPermalinkUnit-"]'),hidden=card.cloneNode(true);
  (bodyOnly?hidden.querySelector('.ProseMirror'):hidden).setAttribute('style','display:none');card.parentNode.insertBefore(hidden,card);
  expect(readSocial(duplicate,target).ok).toBe(true);
 }
});

test('Substack Note excludes CSS-hidden text, media and controls on a detached copy',()=>{
 const target=platformTarget('https://substack.com/@tedgioia/note/c-357811021'),d=fixture('substack-note');
 d.querySelector('script[type="application/ld+json"]').remove();
 d.querySelector('.ProseMirror').insertAdjacentHTML('beforeend','<p style="display:none">HIDDEN BODY SECRET</p><div style="visibility:hidden">HIDDEN WRAPPER SECRET<span style="visibility:visible">Visible restored text.</span></div>');
 d.querySelector('img[alt=""]').setAttribute('style','display:none');
 d.querySelector('[class*="feedPermalinkUnit-"]').insertAdjacentHTML('beforeend','<button data-testid="read-more" style="display:none">Read more</button>');
 const original=d.body.outerHTML,r=readSocial(d,target);
 expect(r.ok).toBe(true);expect(r.clip.markdown).toContain('Visible restored text.');
 expect(r.clip.markdown).not.toContain('HIDDEN');expect(r.clip.markdown).not.toContain('![');
 expect(d.body.outerHTML).toBe(original);
});

test('Instagram saves the final slide text and cannot borrow readability from a sibling article',()=>{
 const d=fixture('instagram-slide-captions'),target=platformTarget('https://www.instagram.com/p/DeKe6teEpya/');
 const data=JSON.parse(d.querySelector('script').textContent);
 const r=readSocial(d,target);expect(r.ok).toBe(true);
 expect(r.clip.markdown).toContain('how do astronomers turn raw space data into breathtaking images');
 const article=d.querySelector('article');article.querySelector('p').textContent='Unrelated';
 const sibling=d.createElement('article'),p=d.createElement('p');p.textContent=data.carousel_media[0].caption.text;sibling.appendChild(p);article.parentElement.appendChild(sibling);
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
 data.caption.text='Independent parent introduction';d.querySelector('script').textContent=JSON.stringify(data);article.querySelector('p').textContent=data.carousel_media[0].caption.text;
 const distinct=readSocial(d,target);expect(distinct.ok).toBe(true);expect(distinct.clip.markdown).toContain('Independent parent introduction');expect(distinct.clip.markdown).toContain('how do astronomers turn raw space data into breathtaking images');
});

test('Bluesky ordinary fractions do not imply missing images',()=>{
 const d=fixture('bluesky');Array.from(d.querySelectorAll('script')).forEach(n=>n.remove());
 d.querySelector('[data-testid="postText"], [data-word-wrap="1"]').textContent='The experiment passed 1 / 2 cases.';
 const r=readSocial(d,platformTarget(socialSamples.bluesky.url));expect(r.ok).toBe(true);expect(r.clip.markdown).toContain('1 / 2');
});

for(const [name,selector] of [['facebook','[data-ad-preview="message"], [data-ad-comet-preview="message"]'],['bluesky','[data-testid="postText"], [data-word-wrap="1"]'],['linkedin','[data-test-id="main-feed-activity-card__commentary"], .feed-shared-text']]) {
 for(const attr of ['hidden','aria-hidden']) for(const ancestor of [false,true]) test(`${name}: hidden ${ancestor?'body ancestor':'body'} rejects metadata fallback (${attr})`,()=>{
  const d=fixture(name),body=d.querySelector(selector);expect(body).not.toBeNull();
  (ancestor?body.parentElement:body).setAttribute(attr,attr==='hidden'?'':'true');
  expect(readSocial(d,platformTarget(socialSamples[name].url))).toEqual({ok:false,reason:'unreadable'});
 });
}

for(const name of ['instagram','threads']) test(`${name}: plain div siblings and body references cannot establish a post card`,()=>{
 const d=fixture(name),sample=socialSamples[name],target=platformTarget(sample.url);
 const data=JSON.parse(d.querySelector('script[type="application/json"]').textContent);
 const find=(value)=>{if(value&&typeof value==='object'){if(value.code===target.id.split('/').pop()&&value.caption)return value;for(const child of Object.values(value)){const found=find(child);if(found)return found;}}};
 const caption=find(data).caption.text;
 d.body.innerHTML=`<div><div><a href="${sample.url}"><time datetime="2026-10-01T00:00:00Z">Date</time></a>Unavailable</div><div></div></div>`;
 d.body.lastChild.lastChild.textContent=caption;
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
 d.body.innerHTML=`<article><a href="${sample.url}">Referenced post</a><p></p></article>`;d.querySelector('p').textContent=caption;
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
});

test('Threads nested quotation timestamps neither reject the parent nor prove its body readable',()=>{
 const d=fixture('threads'),target=platformTarget(socialSamples.threads.url),script=d.querySelector('script');
 const data=JSON.parse(script.textContent),caption=data.caption.text;
 data.text_post_app_info={share_info:{quoted_post:{code:'Quote123',user:{username:'esa'},caption:{text:'Quoted science.'},media_type:19}}};script.textContent=JSON.stringify(data);
 d.body.innerHTML=`<article><a href="${target.url}"><time datetime="2026-10-01T00:00:00Z">Parent</time></a><p></p><article><a href="https://www.threads.com/@esa/post/Quote123"><time datetime="2026-09-01T00:00:00Z">Quote</time></a><p>Quoted science.</p></article></article>`;
 d.querySelector('article > p').textContent=caption;
 const r=readSocial(d,target);expect(r.ok).toBe(true);expect(r.clip.markdown).toContain('Quoted science.');
 d.querySelector('article > p').setAttribute('hidden','');d.querySelector('article article p').textContent=caption;
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
});

test('Threads profile markers accept the supported threads.net domain alias',()=>{
 const d=fixture('threads'),target=platformTarget(socialSamples.threads.url),caption=JSON.parse(d.querySelector('script').textContent).caption.text;
 d.body.innerHTML=`<div><a href="${target.url}"><time datetime="2026-10-01T00:00:00Z">Date</time></a><a href="https://www.threads.net/@nasa/">NASA</a><p></p><button>Like</button><button>Reply</button><button>Share</button></div>`;d.querySelector('p').textContent=caption;
 expect(readSocial(d,target).ok).toBe(true);
 d.querySelector('a[href="https://www.threads.net/@nasa/"]').setAttribute('href','https://unrelated.example/@nasa/');
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
});

for(const [name,sample] of Object.entries(socialSamples)) test(`${name}: CSS-hidden page and post never become a complete capture`,()=>{
 const d=fixture(name);d.body.style.display='none';
 expect(readSocial(d,platformTarget(sample.url)).ok).toBe(false);
});
test('Facebook excludes CSS-hidden descendants from both body and note title',()=>{
 const d=fixture('facebook'),body=d.querySelector('[data-ad-preview="message"]');
 body.insertAdjacentHTML('afterbegin','<span style="display:none">HIDDEN TITLE SENTINEL</span>');
 const r=readSocial(d,platformTarget(socialSamples.facebook.url));expect(r.ok).toBe(true);
 expect(r.clip.title).not.toContain('SENTINEL');expect(r.clip.markdown).not.toContain('SENTINEL');
});
test('P1 DOM bodies cannot be restored solely from loaded SEO data',()=>{
 for(const [name,selector] of [['facebook','[data-ad-preview="message"]'],['bluesky','[data-word-wrap="1"]'],['linkedin','[data-test-id="main-feed-activity-card__commentary"]']]) {
  const d=fixture(name);d.querySelector(selector).remove();expect(readSocial(d,platformTarget(socialSamples[name].url)).ok).toBe(false);
 }
});
test('P1 missing and mismatched declared attachments cannot be saved as complete',()=>{
 const f=fixture('facebook');Array.from(f.querySelectorAll('img[src*="/v/"]')).forEach(n=>n.remove());
 expect(readSocial(f,platformTarget(socialSamples.facebook.url))).toEqual({ok:false,reason:'incomplete'});
 const l=fixture('linkedin'),s=l.querySelector('script'),data=JSON.parse(s.textContent);data.image[0].url='';s.textContent=JSON.stringify(data);
 expect(readSocial(l,platformTarget(socialSamples.linkedin.url))).toEqual({ok:false,reason:'incomplete'});
 const b=fixture('bluesky'),bs=b.querySelector('script'),bd=JSON.parse(bs.textContent);bd.image[0]='https://example.test/wrong.png';bs.textContent=JSON.stringify(bd);
 expect(readSocial(b,platformTarget(socialSamples.bluesky.url))).toEqual({ok:false,reason:'incomplete'});
});
test('Facebook and LinkedIn preserve literal HTML as escaped post text',()=>{
 for(const [name,selector] of [['facebook','[data-ad-preview="message"]'],['linkedin','[data-test-id="main-feed-activity-card__commentary"]']]) {
  const d=fixture(name),literal='Literal <script>alert(1)</script> and <img src="https://example.test/unintended.png">';d.querySelector(selector).textContent=literal;
  if(name==='linkedin'){const s=d.querySelector('script'),v=JSON.parse(s.textContent);v.articleBody=literal;s.textContent=JSON.stringify(v);}
  const r=readSocial(d,platformTarget(socialSamples[name].url));expect(r.ok).toBe(true);
  expect(r.clip.markdown).not.toContain('<script>');expect(r.clip.markdown).toContain('&lt;script&gt;');expect(r.clip.markdown.match(/!\[/g)).toHaveLength(socialSamples[name].images);
 }
});
for(const name of ['instagram','threads']) test(`${name}: optional publication metadata does not gate readable posts`,()=>{
 const d=fixture(name),s=d.querySelector('script'),v=JSON.parse(s.textContent);
 const visit=x=>{if(x&&typeof x==='object'){delete x.taken_at;Object.values(x).forEach(visit)}};visit(v);s.textContent=JSON.stringify(v);
 const r=readSocial(d,platformTarget(socialSamples[name].url));expect(r.ok).toBe(true);expect(r.clip.publishedAt).toBeUndefined();
});

test('Bluesky literal tags are escaped once and render without extra backslashes',async()=>{
 const {marked}=await import('marked'),d=fixture('bluesky'),literal='Literal <script>alert(1)</script> and <img src="https://example.test/unintended.png">';d.querySelector('[data-word-wrap="1"]').textContent=literal;
 const r=readSocial(d,platformTarget(socialSamples.bluesky.url));expect(r.ok).toBe(true);const rendered=createDocument(marked.parse(r.clip.markdown));expect(rendered.body.textContent).toContain(literal);expect(rendered.body.textContent).not.toContain('\\<');expect(rendered.querySelector('script')).toBeFalsy();
});
for(const name of ['instagram','threads']) test(`${name}: missing optional author metadata keeps readable post content`,()=>{
 const d=fixture(name),s=d.querySelector('script'),data=JSON.parse(s.textContent);const visit=v=>{if(v&&typeof v==='object'){if(v.user)delete v.user.username;Object.values(v).forEach(visit)}};visit(data);s.textContent=JSON.stringify(data);expect(readSocial(d,platformTarget(socialSamples[name].url)).ok).toBe(true);
});
test('Facebook empty caption container is valid for a declared photo-only post',()=>{
 const d=fixture('facebook'),s=d.querySelector('script'),data=JSON.parse(s.textContent);d.querySelector('[data-ad-preview="message"]').textContent='';const visit=v=>{if(v&&typeof v==='object'){if(v.message&&typeof v.message.text==='string')v.message.text='';Object.values(v).forEach(visit)}};visit(data);s.textContent=JSON.stringify(data);expect(readSocial(d,platformTarget(socialSamples.facebook.url)).ok).toBe(true);
});

test('LinkedIn complete visible body remains readable after hidden UI is removed',()=>{
 const d=fixture('linkedin');d.querySelector('[data-test-id="main-feed-activity-card__commentary"]').insertAdjacentHTML('beforeend','<span style="display:none">HIDDEN CONTROL LABEL</span>');
 const r=readSocial(d,platformTarget(socialSamples.linkedin.url));expect(r.ok).toBe(true);expect(r.clip.markdown).not.toContain('HIDDEN CONTROL');
});
test('LinkedIn declared carousel requires usable image URLs, retaining valid delayed URLs',()=>{
 const d=fixture('linkedin-ugc'),img=d.querySelector('[data-testid="carousel-child-container"] img'),src=img.getAttribute('src');img.removeAttribute('src');
 expect(readSocial(d,platformTarget(linkedinUgcUrl))).toEqual({ok:false,reason:'incomplete'});img.setAttribute('data-delayed-url',src);
 const r=readSocial(d,platformTarget(linkedinUgcUrl));expect(r.ok).toBe(true);expect(r.clip.markdown.match(/!\[/g)).toHaveLength(8);
});

test('Bluesky keeps every rendered main-post image when optional SEO lists fewer',()=>{
 const d=fixture('bluesky'),img=d.querySelector('img[src*="/img/feed_thumbnail/"]'),second=img.cloneNode(true);second.setAttribute('src',img.getAttribute('src')+'/second-rendered-photo');img.parentElement.appendChild(second);
 const r=readSocial(d,platformTarget(socialSamples.bluesky.url));expect(r.ok).toBe(true);expect(r.clip.markdown.match(/!\[/g)).toHaveLength(2);expect(r.clip.markdown).toContain('second-rendered-photo');
});

test('shared Markdown text preserves leading angle brackets and literal HTML entities',async()=>{
 const {platformHtmlMarkdown}=await import('./src/platform-clip.ts'),{marked}=await import('marked');
 for(const literal of ['> quoted','&lt;script&gt;','<script>alert(1)</script>','A & B']) {
  const d=createDocument('<p></p>');d.querySelector('p').textContent=literal;
  expect(createDocument(marked.parse(platformHtmlMarkdown(d.body,'https://example.test/'))).body.textContent.trim()).toBe(literal);
 }
 const d=createDocument('<p><code>&lt;script&gt; &amp;lt;</code></p><pre><code>&lt;script&gt; &amp;lt;</code></pre>');
 const output=platformHtmlMarkdown(d.body,'https://example.test/');expect(output).toContain('`<script> &lt;`');expect(output).toContain('```\n<script> &lt;\n```');
});


test('LinkedIn personal share keeps the name, professional headline and its own time separately',()=>{
 const target=platformTarget(linkedinPersonUrl),doc=fixture('linkedin-person');
 expect(target.id).toBe('share:7456582751698190336');
 expect(target.url).toBe('https://www.linkedin.com/feed/update/urn:li:share:7456582751698190336/');
 expect(platformTarget(target.url)).toEqual(target);
 const r=readSocial(doc,target);expect(r.ok).toBe(true);
 expect(r.clip.author).toBe('Mohammad Ahmed');
 expect(r.clip.authorHeadline).toBe('Technical Lead - Backend at Dizzaract');
 expect(r.clip.publishedAt).toEqual({value:'5 个月前',precision:'relative'});
 expect(r.clip.markdown).toContain('What technology are you focusing on in 2026');
 expect(r.clip.markdown).not.toContain('Dizzaract');
 expect(r.clip.author).not.toContain('3 度');
});

test('LinkedIn missing professional metadata never shifts a name, role or connection degree into publication time',()=>{
 for(const remove of ['headline','time','both']) {
  const d=fixture('linkedin-person');
  const ps=Array.from(d.querySelectorAll('p'));
  if(remove!=='time') ps.find(n=>n.textContent.includes('Dizzaract')).remove();
  if(remove!=='headline') ps.find(n=>n.textContent.trim()==='5 个月前').remove();
  const r=readSocial(d,platformTarget(linkedinPersonUrl));expect(r.ok).toBe(true);
  expect(r.clip.author).toBe('Mohammad Ahmed');
  expect(r.clip.authorHeadline).toBe(remove==='time'?'Technical Lead - Backend at Dizzaract':undefined);
  expect(r.clip.publishedAt).toEqual(remove==='headline'?{value:'5 个月前',precision:'relative'}:undefined);
 }
 for(const name of ['linkedin','linkedin-ugc','linkedin-ugc-guest']) {
  const r=readSocial(fixture(name),platformTarget(name==='linkedin'?socialSamples.linkedin.url:linkedinUgcUrl));
  expect(r.ok).toBe(true);expect(r.clip.authorHeadline).toBeUndefined();
 }
});

for(const time of ['5mo','5 months ago','5か月前','5 mies. temu']) test(`LinkedIn professional headline stays separate from ${time}`,()=>{
 const d=fixture('linkedin-person');Array.from(d.querySelectorAll('p')).find(n=>n.textContent.trim()==='5 个月前').textContent=time;
 const r=readSocial(d,platformTarget(linkedinPersonUrl));expect(r.ok).toBe(true);
 expect(r.clip.authorHeadline).toBe('Technical Lead - Backend at Dizzaract');
 expect(r.clip.publishedAt).toEqual({value:time,precision:'relative'});
});

test('LinkedIn share identities reject stale cards, comments and quoted nested cards',()=>{
 const target=platformTarget(linkedinPersonUrl);
 for(const change of ['id','comment','nested']) {
  const d=fixture('linkedin-person'),body=d.querySelector('[id^="translatable-commentary-"]');
  if(change==='id') body.id=body.id.replace('7456582751698190336','7456582751698190337');
  if(change==='comment') body.id=body.id.replace('contentUrnCommentUrn=null','contentUrnCommentUrn=123');
  if(change==='nested') {const nested=d.createElement('div');nested.setAttribute('data-urn','urn:li:activity:123');body.replaceWith(nested);nested.appendChild(body);}
  expect(readSocial(d,target).ok).toBe(false);
 }
});


for(const placement of ['card','header']) test(`LinkedIn personal metadata cannot come from a nested ${placement} card`,()=>{
 const d=fixture('linkedin-person'),card=d.querySelector('[role="listitem"]');
 (placement==='header'?card.firstElementChild:card).insertAdjacentHTML('afterbegin','<div data-urn="urn:li:activity:123"><div class="update-components-actor"><a href="https://www.linkedin.com/in/other/"><span class="update-components-actor__title">COMMENT AUTHOR</span></a><p class="update-components-actor__description">OTHER ROLE</p><time datetime="1999-01-01T00:00:00Z">1999</time></div></div>');
 const r=readSocial(d,platformTarget(linkedinPersonUrl));expect(r.ok).toBe(true);
 expect(r.clip.author).toBe('Mohammad Ahmed');expect(r.clip.authorHeadline).toBe('Technical Lead - Backend at Dizzaract');
 expect(r.clip.publishedAt).toEqual({value:'5 个月前',precision:'relative'});
 Array.from(d.querySelectorAll('p')).find(n=>n.textContent.trim()==='5 个月前').remove();
 expect(readSocial(d,platformTarget(linkedinPersonUrl)).clip.publishedAt).toBeUndefined();
});

for (const invalid of [null, "different-post", "different-route", "invalid-alias"]) test(`Facebook permalink dialog alias ${invalid || "preserves the current post and metadata"}`, () => {
 const d=fixture('facebook'),target=platformTarget(socialSamples.facebook.url);
 const alias='pfbid02hCQ2Dyn2D7bjf8FnAL1moEL4JZpzzhvrt25T4UvzYjpryGmgGcMNRSnajxUhBnaNl';
 for(const a of d.querySelectorAll('a[href]'))a.setAttribute('href',a.getAttribute('href').replaceAll(target.id,alias));
 const script=d.querySelector('script');const story=JSON.parse(script.textContent.replaceAll(target.id,alias));
 const route={canonicalRouteName:invalid==='different-route'?'anotherRoute':'comet.fbweb.CometSinglePostDialogRoute',url:invalid==='different-post'?'/NASA/posts/123':new URL(target.url).pathname,params:{page_token:'NASA',story_token:invalid==='invalid-alias'?'not-a-post':alias}};
 script.textContent=JSON.stringify(story);
 const routeScript=d.createElement("script");routeScript.type="application/json";routeScript.textContent=JSON.stringify(route);d.head.appendChild(routeScript);
 const result=readSocial(d,target);
 if(invalid){expect(result).toEqual({ok:false,reason:'unreadable'});return;}
 expect(result.ok).toBe(true);expect(result.clip.url).toBe(target.url);
 expect(result.clip.author).toBe(socialSamples.facebook.author);
 expect(result.clip.markdown).toContain(socialSamples.facebook.text);
 expect(result.clip.markdown.match(/!\[/g)).toHaveLength(1);
 expect(result.clip.publishedAt).toEqual({value:new Date(story.creation_time*1000).toISOString(),precision:'datetime'});
});

for(const label of ['收起','See less'])test(`Facebook expanded body excludes its ${label} control but keeps literal content`,()=>{
 const d=fixture('facebook'),body=d.querySelector('[data-ad-preview="message"]');
 body.appendChild(d.createTextNode(`Literal ${label}`));const button=d.createElement('span');button.setAttribute('role','button');button.textContent=label;body.appendChild(button);
 const r=readSocial(d,platformTarget(socialSamples.facebook.url));expect(r.ok).toBe(true);
 expect(r.clip.markdown).toContain(`Literal ${label}`);expect(r.clip.markdown.split(label)).toHaveLength(2);
});

test('Bluesky quote image alt badges are UI while alt descriptions and prose survive',()=>{
 const d=fixture('bluesky-feed'),target=platformTarget('https://bsky.app/profile/bsky.app/post/3mxhdhodv222n');
 const card=socialPostCard(d,target),quote=card.querySelector('[role="link"][aria-label^="Post by "]'),button=quote.querySelector('button:has(img)');
 const holder=d.createElement('div');button.replaceWith(holder);holder.appendChild(button);
 const badge=d.createElement('div');badge.style.position='absolute';badge.innerHTML='<div>替代文本</div>';holder.appendChild(badge);
 const prose=d.createElement('p');prose.textContent='正文中的替代文本与 ALT 需要保留。';quote.appendChild(prose);
 const before=d.body.innerHTML,r=readSocial(d,target);expect(r.ok).toBe(true);
 const parsed=markdownToDoc(r.clip.markdown),text=docToText(parsed);expect(text).toContain('正文中的替代文本与 ALT 需要保留。');expect(text.match(/替代文本/g)).toHaveLength(1);
 expect(r.clip.markdown).toContain('Lil bone people');expect(r.clip.markdown).toContain('/img/feed_fullsize/');expect(d.body.innerHTML).toBe(before);
});

test('Threads native pressable quote stays inside the parent boundary and cannot substitute its caption',()=>{
 const d=fixture('threads'),target=platformTarget(socialSamples.threads.url),script=d.querySelector('script'),data=JSON.parse(script.textContent),caption=data.caption.text;
 data.text_post_app_info={share_info:{quoted_post:{code:'Quote123',user:{username:'esa'},caption:{text:'Quoted science.'},media_type:19}}};script.textContent=JSON.stringify(data);
 const state=script.cloneNode(true);d.body.innerHTML=`<div data-pressable-container="true"><div><a href="${target.url}"><time datetime="2026-10-01T00:00:00Z">Parent</time></a><a href="/@nasa">NASA</a><p></p><div data-pressable-container="true"><a href="https://www.threads.com/@esa/post/Quote123"><time datetime="2026-09-01T00:00:00Z">Quote</time></a><p>Quoted science.</p><button>Like quote</button><button>Reply quote</button><button>Share quote</button></div><button>Like</button><button>Reply</button><button>Share</button></div></div><div data-pressable-container="true"><a href="/@other/post/Other123"><time datetime="2026-10-01T00:00:00Z">Neighbor</time></a><p>Neighbor sentinel</p></div>`;d.body.appendChild(state);
 d.querySelector('p').textContent=caption;const r=readSocial(d,target);expect(r.ok).toBe(true);expect(r.clip.markdown).toContain('Quoted science.');expect(r.clip.markdown).not.toContain('Neighbor sentinel');
 d.querySelector('p').setAttribute('hidden','');d.querySelector('[data-pressable-container] [data-pressable-container] p').textContent=caption;expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
});
