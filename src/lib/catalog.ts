import source from '../../data/topics.json';
import illustrations from '../../data/art.json';
export const topics = source.topics;
export const art = illustrations;
export const clusters = [...new Set(topics.map(t=>t.cluster))];
export const slugify = (s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const topicArt = (slug:string)=>art.filter(a=>a.topic===slug);
