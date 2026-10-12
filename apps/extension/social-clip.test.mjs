import { bundleTestScripts } from "./bundle-test-scripts.mjs";
import {expect,test} from 'bun:test';
import {createDocument} from '@mixmark-io/domino';
import {readFileSync} from 'node:fs';
import {platformTarget, socialPlatform} from './src/platform-clip.ts';
import {readSocial} from './src/social-clip.ts';
export const socialSamples={
 bluesky:{url:'https://bsky.app/profile/bsky.app/post/3mhgg5ja5gc2w',title:'v1.119 is live!',author:'Bluesky',images:1,text:"what's a bot and what's not."},
 facebook:{url:'https://www.facebook.com/NASA/posts/pfbid0dPToN66CzcAHGMoaNe3jszH4FfBKvqkE5gogCNJkTxXDPsSGYrGvcVwsLgByyMQQl',author:'NASA - National Aeronautics and Space Administration',images:1,text:'in the red cloud'},
 instagram:{url:'https://www.instagram.com/p/DeAYvsnn4la/',title:'Swipe for countless stars',author:'nasa',images:3,text:'#Stars'},
 threads:{url:'https://www.threads.com/@nasa/post/DZceA72Drjf',author:'nasa',images:4,text:'Artemis Art Show topic!'},
 linkedin:{url:'https://www.linkedin.com/posts/friends-of-nasa_nasa-space-astronomy-activity-7497764718095323136-NRvr',title:'Nancy Grace Roman Space Telescope: Launch Preparations | NASA Kennedy',author:'Friends of NASA',images:8,text:'144.47 MB'},
};
const fixture=n=>createDocument(readFileSync(new URL(`./fixtures/platforms/${n}.html`,import.meta.url),'utf8'));
const linkedinUgcUrl='https://www.linkedin.com/posts/nasa-space-astronomy-ugcPost-7497764716677758977-qmKO/';
test('Threads shortened visible links bind to the loaded caption without reading replies',()=>{
 const d=fixture('threads-short-link'),target=platformTarget('https://www.threads.com/@nasa/post/DeMqtuYgkaL');
 const r=readSocial(d,target);expect(r.ok).toBe(true);expect(r.clip.author).toBe('nasa');
 expect(r.clip.markdown).toContain('814GB');expect(r.clip.markdown).toContain('go.nasa.gov/Artemis2LunarScience');
 expect(r.clip.markdown.match(/!\[/g)).toHaveLength(1);
 const a=d.querySelector('a[href="http://go.nasa.gov/Artemis2LunarScience"]');a.setAttribute('href','https://example.test/unrelated');
 expect(readSocial(d,target)).toEqual({ok:false,reason:'unreadable'});
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
 expect(r.ok).toBe(true);expect(r.clip.title).toBe('a masterclass in alt text');expect(r.clip.markdown).toContain('Mr. Joshua');expect(r.clip.markdown).toContain('Lil bone people');expect(r.clip.markdown).not.toContain('minesweeper');expect(r.clip.publishedAt.precision).toBe('relative');
});
test('Bluesky feed retains the sampled Minesweeper link destination',()=>{
 const r=readSocial(fixture('bluesky-feed'),platformTarget('https://bsky.app/profile/mikelacher.bsky.social/post/3mxepywf4ec2j'));
 expect(r.ok).toBe(true);
 expect(r.clip.markdown).toContain('[minesweeper.mikelacher.com](https://minesweeper.mikelacher.com/)');
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
 for(const name of ['facebook','linkedin']){const d=fixture(name);if(name==='facebook')d.querySelector('[data-ad-preview="message"]').remove();else{d.querySelector('[data-test-id="main-feed-activity-card__commentary"]').remove();const s=d.querySelector('script'),j=JSON.parse(s.textContent);j.articleBody='';s.textContent=JSON.stringify(j);}const r=readSocial(d,platformTarget(socialSamples[name].url));expect(r.ok).toBe(true);expect(r.clip.markdown.match(/!\[/g).length).toBe(socialSamples[name].images);}
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
