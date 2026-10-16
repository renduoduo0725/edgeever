import { platformText } from "./platform-clip";

const excluded = "pre,code,blockquote,li,td,th,figcaption,h1,h2,h3,h4,h5,h6";
const inlineFontSize = (node: Element | null): number => {
  for(let current=node;current;current=current.parentElement) {
    const value=(current as HTMLElement).style?.fontSize;
    if(!value) continue;
    const match=/^(\d+(?:\.\d+)?)(px|pt)$/.exec(value.trim());
    // Unknown relative units are not enough evidence to infer a heading.
    return match ? Number(match[1]) * (match[2] === "pt" ? 4/3 : 1) : 0;
  }
  return 0;
};

/** Restore headings encoded as publisher typography, before styles are stripped.
 * Operates only on the readable, detached WeChat article copy. */
export const restoreWechatHeadings = (body: Element) => {
  const paragraphs=Array.from(body.querySelectorAll("p")).filter(node=>
    !node.closest(excluded) && !node.querySelector("img,video,audio,iframe,table") && platformText(node));
  const sizes=new Map<Element,number[]>(), weights=new Map<number,number>();
  for(const paragraph of paragraphs) {
    const runs: number[]=[];
    const walker=body.ownerDocument.createTreeWalker(paragraph,4 /* SHOW_TEXT */);
    for(let text=walker.nextNode();text;text=walker.nextNode()) {
      const parent=text.parentElement, value=platformText(text);
      if(!parent || !value || parent.closest("script,style,template,button,code")) continue;
      const size=inlineFontSize(parent);runs.push(size);
      if(size) weights.set(size,(weights.get(size) || 0)+value.length);
    }
    sizes.set(paragraph,runs);
  }
  const bodySize=[...weights].sort((a,b)=>b[1]-a[1])[0]?.[0] || 0;
  const stepPattern=/^第([一二三四五六七八九十百零〇两]+|\d+)步[：:]\s*\S/;
  const stepCandidates=paragraphs.filter(node=>stepPattern.test(platformText(node)) && !/[。！？!?；;]/.test(platformText(node)));
  // A sequence of distinct step labels establishes section structure; a lone
  // instruction mentioning a first step remains an ordinary paragraph.
  const steps=new Set<Element>(new Set(stepCandidates.map(node=>stepPattern.exec(platformText(node))![1])).size > 1 ? stepCandidates : []);
  const styled=new Map<Element,number>();
  for(const paragraph of paragraphs) {
    const runs=sizes.get(paragraph)!;
    if(!steps.has(paragraph) && bodySize && runs.length && runs.every(size=>size >= bodySize*1.2)) styled.set(paragraph,Math.min(...runs));
  }
  const ranks=[...new Set(styled.values())].sort((a,b)=>b-a);
  let sectionLevel=1;
  for(const node of Array.from(body.querySelectorAll("h1,h2,h3,h4,h5,h6,p"))) {
    if(node.matches("h1,h2,h3,h4,h5,h6")) {
      if(!node.parentElement?.closest(excluded)) sectionLevel=Number(node.tagName[1]);
      continue;
    }
    const size=styled.get(node);
    const level=size ? Math.min(6,ranks.indexOf(size)+2) : steps.has(node) ? Math.min(6,sectionLevel+1) : 0;
    if(!level) continue;
    const heading=body.ownerDocument.createElement(`h${level}`);
    while(node.firstChild) heading.appendChild(node.firstChild);
    node.replaceWith(heading);
    if(size) sectionLevel=level;
  }
};
