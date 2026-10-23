import type { EditorDocument } from './model';
export interface ColorLut { gridSize:number; values:number[]; profileName?:string; }
export function paperLayout(doc:EditorDocument){let pageWidth=doc.print.paper==='letter'?612:595.2756,pageHeight=doc.print.paper==='letter'?792:841.8898;if(doc.print.orientation==='landscape')[pageWidth,pageHeight]=[pageHeight,pageWidth];const margin=doc.print.margin*72,b=doc.crop||doc;const sx=(pageWidth-2*margin)/b.width,sy=(pageHeight-2*margin)/b.height;const scale=doc.print.scale==='actual'?.75:doc.print.scale==='fill'?Math.max(sx,sy):Math.min(sx,sy);const width=b.width*scale,height=b.height*scale;return{pageWidth,pageHeight,margin,scale,width,height,x:(pageWidth-width)/2,y:(pageHeight-height)/2};}
export function lookupCmyk(hex:string,lut:ColorLut):[number,number,number,number]{
 const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));if(channels[0]===channels[1]&&channels[1]===channels[2])return[0,0,0,1-channels[0]/255];
 const n=lut.gridSize,coords=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255*(n-1)),low=coords.map(Math.floor),high=low.map(v=>Math.min(v+1,n-1)),fraction=coords.map((v,i)=>v-low[i]);const out=[0,0,0,0];
 for(let r=0;r<2;r++)for(let g=0;g<2;g++)for(let b=0;b<2;b++){const ri=r?high[0]:low[0],gi=g?high[1]:low[1],bi=b?high[2]:low[2],weight=(r?fraction[0]:1-fraction[0])*(g?fraction[1]:1-fraction[1])*(b?fraction[2]:1-fraction[2]);const index=((ri*n+gi)*n+bi)*4;for(let k=0;k<4;k++)out[k]+=lut.values[index+k]*weight;}
 return out.map(v=>Math.max(0,Math.min(1,v))) as [number,number,number,number];
}
export type PathOp={op:'m'|'l'|'c'|'h';c:number[]};
export function parsePath(d:string):PathOp[]{
 const tokens=d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[];const ops:PathOp[]=[];let i=0,command='',x=0,y=0,mx=0,my=0,cx=0,cy=0,qx=0,qy=0,last='';const num=()=>{if(i>=tokens.length||/^[a-df-z]$/i.test(tokens[i]))throw new Error('The artwork contains an incomplete vector path.');const v=Number(tokens[i++]);if(!Number.isFinite(v))throw new Error('Invalid vector coordinate.');return v;};
 while(i<tokens.length){if(/^[a-z]$/i.test(tokens[i]))command=tokens[i++];if(!command)throw new Error('Invalid vector command.');const upper=command.toUpperCase(),relative=command!==upper,ox=relative?x:0,oy=relative?y:0;
  if(upper==='Z'){ops.push({op:'h',c:[]});x=mx;y=my;command='';}
  else if(upper==='M'||upper==='L'){x=num()+ox;y=num()+oy;ops.push({op:upper==='M'?'m':'l',c:[x,y]});if(upper==='M'){mx=x;my=y;command=relative?'l':'L';}}
  else if(upper==='H'){x=num()+ox;ops.push({op:'l',c:[x,y]});}
  else if(upper==='V'){y=num()+oy;ops.push({op:'l',c:[x,y]});}
  else if(upper==='C'){const x1=num()+ox,y1=num()+oy,x2=num()+ox,y2=num()+oy; x=num()+ox;y=num()+oy;ops.push({op:'c',c:[x1,y1,x2,y2,x,y]});cx=x2;cy=y2;}
  else if(upper==='S'){const x1=last==='C'||last==='S'?2*x-cx:x,y1=last==='C'||last==='S'?2*y-cy:y,x2=num()+ox,y2=num()+oy;x=num()+ox;y=num()+oy;ops.push({op:'c',c:[x1,y1,x2,y2,x,y]});cx=x2;cy=y2;}
  else if(upper==='Q'||upper==='T'){const px=x,py=y;if(upper==='Q'){qx=num()+ox;qy=num()+oy;}else{qx=last==='Q'||last==='T'?2*x-qx:x;qy=last==='Q'||last==='T'?2*y-qy:y;}x=num()+ox;y=num()+oy;ops.push({op:'c',c:[px+2/3*(qx-px),py+2/3*(qy-py),x+2/3*(qx-x),y+2/3*(qy-y),x,y]});}
  else throw new Error(`PDF export does not support vector command ${upper} in this artwork. Your edited WebP and saved project remain available.`);
  last=upper;
 }
 return ops;
}
