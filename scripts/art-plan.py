#!/usr/bin/env python3
"""Persist honest 5,500-design production targets and draft creative briefs.

A planned row is never counted as artwork. These briefs need creative review;
only ten source-backed pilot rows have actual exported files.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
STATES=['CREATIVE_BRIEF','DRAWN_SVG','STRUCTURAL_VALIDATION','ART_REVIEW','WEBP_EXPORT','PDF_EXPORT','FORMAT_PREFLIGHT','DUPLICATE_SCAN','METADATA_REVIEW','STAGING_R2','VERIFIED_R2','PUBLISHED']
contexts=[
('isolated botanical study','one subject with defining anatomy and balanced whitespace'),
('three-subject grouping','three different sizes arranged as a triangular cluster'),
('wreath centerpiece','subject woven into an asymmetrical leafy wreath'),
('arched garden entrance','subject framed by a simple wooden garden arch'),
('woodland stump still life','subject beside mushrooms on a cut tree stump'),
('cozy reading corner','subject paired with an open book and reading glasses'),
('handmade greeting envelope','subject emerging from an open paper envelope'),
('hanging ornament','subject suspended from a tied ribbon, designed as a hanging decoration'),
('picnic basket arrangement','subject interacting with an open wicker picnic basket'),
('nighttime lantern vignette','subject beside a small lantern under three stars'),
('rainy-day umbrella','subject sheltered beneath a dotted open umbrella'),
('window ledge vignette','subject on a windowsill with a small curtain'),
('tea-time gathering','subject beside a teapot and two contrasting cups'),
('wheelbarrow garden scene','subject with a rustic wheelbarrow and garden gloves'),
('framed specimen card','subject placed inside a scalloped paper specimen frame'),
('moonlit hill silhouette','subject in profile against one moon and a low hill'),
('corner flourish','subject anchors an L-shaped branch-and-leaf corner decoration'),
('round gift tag','subject within a circle with a hole and twisted string'),
('vertical bookmark','subject woven into a narrow climbing vine composition'),
('tabletop place setting','subject beside a folded napkin and blank place card'),
('patchwork quilt motif','subject reinterpreted as carefully outlined stitched fabric pieces'),
('wooden toy interpretation','subject constructed with visible wooden joints and wheels'),
('paper-fold sculpture','subject rendered as a folded paper object with distinct planar faces'),
('felt craft applique','subject composed of sewn felt pieces and button accents'),
('embroidered hoop','subject inside a stitch-detailed wooden embroidery hoop'),
('stained-glass medallion','subject divided into meaningful color panels in an oval frame'),
('chalkboard teaching diagram','subject on a small easel with clean explanatory pointer arrows'),
('counting set of five','five independently posed or shaped examples arranged in a readable row'),
('life-cycle teaching sequence','a fact-checked sequence of meaningful stages appropriate to the subject'),
('anatomy cutaway diagram','a fact-checked cross section or annotated costume study as appropriate'),
('circular character badge','a personified subject with hands and feet inside a decorative badge'),
('sleepy pillow vignette','a personified subject resting on a small pillow with a quilt'),
('curious explorer','a personified subject with a magnifying glass inspecting a tiny leaf'),
('musical performer','a personified subject playing a ukulele on a little stool'),
('friendly letter carrier','a personified subject delivering a sealed envelope to a mailbox'),
('painter at an easel','a personified subject painting a miniature landscape'),
('winter scarf portrait','a personified subject with knitted scarf and earmuffs'),
('sunhat gardener','a personified subject tending a potted plant with a watering can'),
('starry storybook border','subject repeats as distinct poses at four corners of an open border'),
('ribbon banner crest','subject above a folded blank ribbon with two supporting branches'),
('garden tools composition','subject accompanied by a small trowel, gloves and seed packet'),
('rain boot planter','subject arranged with a single patterned rain boot used as a planter'),
('woodland door knocker','subject reimagined as an ornament on a tiny arched woodland door'),
('hot-air balloon vignette','subject interpreted as a balloon shape carrying a small basket'),
('kite on a windy day','subject reimagined as a kite with tied fabric tail bows'),
('snow globe keepsake','subject within a glass dome on a decorated wooden base'),
('stage curtain vignette','subject in a storybook stage opening with gathered side curtains'),
('paper lantern silhouette','subject cut into a softly illuminated paper lantern design'),
('coloring page mandala','subject anchors a spacious radial arrangement with usable coloring regions'),
('educational compare-and-sort','two substantively different subject forms beside a sorting tray'),
]

def main():
 source=json.loads((ROOT/'data/topics.json').read_text());topics=source['topics'] if isinstance(source,dict) else source
 arts=json.loads((ROOT/'data/art.json').read_text());by={}
 for a in arts:by.setdefault(a['topic'],[]).append(a)
 briefdir=ROOT/'data/briefs';briefdir.mkdir(exist_ok=True)
 for topic,items in by.items():
  rows=[]
  for i,(label,composition) in enumerate(contexts):
   a=items[i] if i<len(items) else None
   rows.append({'briefId':f'{topic}-{i+1:03d}','title':a['title'] if a else f'{topic.title()} — {label}','composition':a['description'] if a else f'{topic.title()}: {composition}. Redraw subject and silhouette for this composition; no recolor-only variants.','audienceUse':['classroom worksheets','personal greeting cards','educational craft templates'][i%3],'visualVocabulary':'Clear contour, controlled highlights, plausible anatomy and generous negative space.','theme':label,'silhouette':'Independently drawn composition; no reused full subject paths.','lineStyle':'clean rounded contour' if i%5 else 'spacious black-only coloring contour','colorRange':'subject-appropriate restrained palette; independent colors remain editable','physicalProportions':'subject-appropriate and readable at 128px','background':'transparent','qaRisks':['Avoid clipping and accidental tangencies.','Check anatomy and educational accuracy.','Check no resemblance to protected branded characters.'],'status':'DRAWN_PILOT_AWAITING_ART_REVIEW' if a else 'DRAFT_BRIEF_REQUIRES_CREATIVE_REVIEW','artId':a['id'] if a else None})
  (briefdir/f'{topic}.json').write_text(json.dumps({'topic':topic,'note':'Draft planning, not completed artwork. Full briefs were recorded after initial pilot generation; future waves require approved briefs before drawing.','rows':rows},indent=2)+'\n')
 queue={'version':1,'states':STATES,'targetArtworkCount':5500,'generatedArtworkCount':len(arts),'qualityApprovedArtworkCount':0,'remainingToDraw':5500-len(arts),'nextAction':'Review 10 pilot designs and refine draft creative briefs before rendering any production minibatch.','topics':[],'generated':[]}
 for t in topics:
  items=by.get(t['slug'],[])
  queue['topics'].append({'topic':t['slug'],'keyword':t['keyword'],'wave':t['wave'],'target':50,'generated':len(items),'approved':0,'remainingToDraw':50-len(items),'briefStatus':'50_DRAFT_ROWS' if items else 'NOT_STARTED','briefPath':f'data/briefs/{t["slug"]}.json' if items else None})
 for a in arts:
  queue['generated'].append({'id':a['id'],'topic':a['topic'],'state':'ART_REVIEW','retryCount':0,'failReason':None,'checksCompleted':['DRAWN_SVG','STRUCTURAL_VALIDATION','WEBP_EXPORT','PDF_EXPORT','FORMAT_PREFLIGHT'],'artReview':'OWNER_REVIEW_REQUIRED','metadataReview':'OWNER_REVIEW_REQUIRED','publicationBlocked':True,'reason':'Automated export validation does not replace visual approval.','sha256':a['files']['svg']['sha256']})
 (ROOT/'data/production-queue.json').write_text(json.dumps(queue,indent=2)+'\n')
 print(f'Persisted {len(topics)} topic targets, {len(by)*50} draft creative brief rows, {len(arts)} actual pilot designs, {5500-len(arts)} not drawn.')
if __name__=='__main__':main()
