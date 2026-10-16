// Author: chatgpt_gpt6. Presentation-only viewport controls for Human views.
(function(){
 const host=document.getElementById('host');if(!host)return;
 let zoom=null;
 const controls=document.createElement('div');controls.className='dds-view-controls';
 controls.style.cssText='display:flex;gap:8px;padding:8px;flex:0 0 auto;background:white';
 const style=document.createElement('style');style.textContent='#host{overflow:auto}#host>svg{max-width:none;max-height:none}';document.head.append(style);
 function resize(){const svg=host.querySelector('svg');if(!svg)return;const box=svg.viewBox.baseVal;
  svg.style.width=zoom===null?'100%':Math.max(host.clientWidth,box.width*zoom)+'px';
  svg.style.height=zoom===null?'100%':box.height*zoom+'px';
 }
 function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;controls.append(b);}
 button('전체 맞춤',()=>{zoom=null;host.scrollTop=0;host.scrollLeft=0;resize()});
 button('100%',()=>{zoom=1;resize()});
 host.before(controls);new MutationObserver(resize).observe(host,{childList:true});new ResizeObserver(resize).observe(host);resize();
})();
