import source from '../../data/topics.json';
import illustrations from '../../data/art.json';
export const topics = source.topics;
const mediaBase = import.meta.env.PUBLIC_ASSET_BASE?.replace(/\/$/,'');
export const art = illustrations.map(item => ({...item,...Object.fromEntries(['svg','webp','pdf','thumb'].map(key=>[key,mediaBase ? mediaBase+'/'+String(item[key as 'svg']).split('/').pop() : item[key as 'svg']]))}));
export const clusters = [...new Set(topics.map(t=>t.cluster))];
export const slugify = (s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const topicArt = (slug:string)=>art.filter(a=>a.topic===slug);
