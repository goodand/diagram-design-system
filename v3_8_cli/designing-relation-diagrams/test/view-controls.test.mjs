// Author: chatgpt_gpt6. HTML composition contract; browser access tested separately.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {renderHtml} from '../scripts/lib/render.mjs';
for(const [type,expected] of [['Function_Definition',false],['Process_Summary_Linear',false],['Process_Core',true],['Process_Full',true]]){
 test(`${type}: viewport controls respect View scope and preserve input`,()=>{
  const source=JSON.stringify({diagram_type:type,nodes:[],edges:[]});
  const svg='<svg viewBox="0 0 100 100"><text>unchanged content</text></svg>';
  const html=renderHtml(svg,source);
  assert.equal(html.includes("button('100%'"),expected);
  assert.ok(html.includes(svg));assert.equal(JSON.parse(source).diagram_type,type);
 });
}
