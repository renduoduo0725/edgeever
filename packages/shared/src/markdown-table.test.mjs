import { expect, test } from "bun:test";
import { docToMarkdown, markdownToDoc } from "./content.ts";

test("only attribute-free table cell br tokens become hard breaks, preserving the HTML boundary",()=>{
  const source='Outside <br> stays text.\n\n| Header<br>line | Other |\n| --- | --- |\n| **bold<br/>line** &lt;br&gt; `<br>` | <br onclick="bad()"><script>bad()</script> |';
  const doc=markdownToDoc(source),nodes=[];
  const walk=node=>{nodes.push(node);(node.content || []).forEach(walk);};walk(doc);
  expect(nodes.filter(node=>node.type==='hardBreak')).toHaveLength(2);
  expect(nodes.filter(node=>node.type==='text').map(node=>node.text).join('')).toContain('Outside <br> stays text.');
  expect(nodes.filter(node=>node.type==='text').map(node=>node.text).join('')).toContain('<br onclick="bad()"><script>bad()</script>');
  expect(nodes.find(node=>node.text==='<br>' && node.marks?.some(mark=>mark.type==='code'))).toBeDefined();
  const again=markdownToDoc(docToMarkdown(doc)),breaks=[];const collect=node=>{if(node.type==='hardBreak')breaks.push(node);(node.content || []).forEach(collect);};collect(again);
  expect(breaks).toHaveLength(2);
});
