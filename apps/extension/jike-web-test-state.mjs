import { readFileSync } from "node:fs";
import { createDocument } from "@mixmark-io/domino";

// HTML snapshots cannot serialize React host props. Restore the same post's
// independent public share-page data rather than deriving it from the Web DOM.
export const prepareJikeWebDetail = (doc, id = "64c9dd9a2edae6abdc610605") => {
 const grid=id==='6715e824d9dc81724c2ec74d',name=grid?'jike-grid':'jike-long';
 const share=createDocument(readFileSync(new URL(`./fixtures/platforms/${name}.html`,import.meta.url),'utf8'));
 const post=JSON.parse(share.querySelector('#__NEXT_DATA__').textContent).props.pageProps.post;
 const card=doc.querySelector('[data-clickable-feedback][class*="_postCard_"]');
 const username=grid?'af47ed7e-38d4-4798-acd6-04e3cc8d131c':'5e6497e7-a69f-422b-af6e-baf0fc07b512';
 card.__reactProps$fixture={children:{props:{data:{...post,id,type:"ORIGINAL_POST",user:{username}}}}};
 return card;
};
