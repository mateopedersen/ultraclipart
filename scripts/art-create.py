#!/usr/bin/env python3
"""Rebuild the ten original pilot vector masters. No remote artwork or raster tracing."""
from pathlib import Path
import json, html, math
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/masters'; OUT.mkdir(parents=True,exist_ok=True)
INK='#29354B'
def path(d,fill,stroke=INK,w=7,**kw): return el('path',d=d,fill=fill,stroke=stroke,stroke_width=w,**kw)
def el(tag,**attrs): return '<'+tag+' '+ ' '.join(f'{k.replace("_","-")}="{html.escape(str(v),quote=True)}"' for k,v in attrs.items())+'/>'
def ellipse(cx,cy,rx,ry,fill,stroke=INK,w=7,**kw):return el('ellipse',cx=cx,cy=cy,rx=rx,ry=ry,fill=fill,stroke=stroke,stroke_width=w,**kw)
def circle(cx,cy,r,fill,stroke=INK,w=7,**kw):return el('circle',cx=cx,cy=cy,r=r,fill=fill,stroke=stroke,stroke_width=w,**kw)
def group(name,body,**kw):return '<g id="'+name.lower().replace(' ','-')+'" data-label="'+name+'" '+ ' '.join(f'{k}="{v}"' for k,v in kw.items())+'>'+body+'</g>'
def spark(x,y,s=12,c='#F6C75D'):return path(f'M{x} {y-s} Q{x+2} {y-2} {x+s} {y} Q{x+2} {y+2} {x} {y+s} Q{x-2} {y+2} {x-s} {y} Q{x-2} {y-2} {x} {y-s} Z',c,'none',0)
arts=[]
def art(id,title,topic,desc,alt,color,groups,style='Color',orientation='Square'):
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-labelledby="{id}-title" stroke-linecap="round" stroke-linejoin="round"><title id="{id}-title">{html.escape(title)}</title>'+''.join(groups)+'</svg>'
 if style == 'Outline': svg=svg.replace(INK,'#202020')
 (OUT/f'{id}.svg').write_text(svg)
 (ROOT/'public/pilot'/f'{id}.svg').write_text(svg)
 arts.append(dict(id=id,title=title,topic=topic,description=desc,alt=alt,style=style,color=color,orientation=orientation,svg=f'/pilot/{id}.svg',webp=f'/pilot/{id}.webp',pdf=f'/pilot/{id}.pdf',thumb=f'/pilot/{id}-thumb.webp',width=2048,height=2048,provenance='Original code-drawn vector illustration, AI-assisted; no stock artwork or tracing.',productionMethod='original-code-drawn-ai-assisted',licenseStatus='OWNER_APPROVED_PERSONAL_EDUCATIONAL_ONLY',license='Free personal and educational use. Commercial use and resale as clipart are prohibited.',licenseApprovedAt='2026-10-23',reviewStatus='PILOT_REVIEW_REQUIRED',published=False,indexable=False,createdAt='2026-10-23'))
art('pumpkin-curly-vine','Pumpkin with a Curly Vine','pumpkin','A plump harvest pumpkin, a sweeping vine and a folded green leaf. Each painted shape is editable.','Round orange pumpkin with a curved stem, green leaf and curling vine.','Orange',[
 group('Curly vine',path('M285 172 C345 110 440 146 419 210 C407 248 367 229 383 203 C392 189 412 194 407 206','none','#5B8142',9)),
 group('Stem',path('M235 176 C225 149 238 102 251 79 L280 91 C260 120 258 145 273 176 Z','#77904A')),
 group('Pumpkin skin',path('M249 172 C191 134 106 161 79 234 C47 322 103 407 193 422 C215 428 240 426 258 420 C317 441 419 406 439 332 C463 245 414 170 350 162 C313 153 290 161 270 175 Z','#EE8636')),
 group('Pumpkin ribs',path('M209 178 C151 199 129 342 195 408 M289 178 C349 220 354 354 297 413 M250 190 C215 250 218 351 248 410','none','#BC591F',6)),
 group('Warm highlights',path('M135 212 C111 233 103 259 104 281 M172 194 L162 199 M301 192 C326 224 330 255 333 272','none','#FFC275',10)),
 group('Leaf',path('M269 163 C308 115 341 108 377 114 C371 151 342 183 306 182 Z','#82AB55')+path('M278 166 L354 129 M316 150 L317 128 M329 145 L352 151','none','#456A3A',4)),
 group('Ground accents',ellipse(125,428,16,5,'#DAB570','none',0)+ellipse(380,428,29,6,'#DAB570','none',0))])
art('ghost-teacup','Little Ghost with a Teacup','ghost','A friendly floating ghost holds a warm striped cup, with a tiny star and soft lavender folds.','Smiling white ghost holding a coral teacup with a curl of steam.','White',[
 group('Ghost silhouette',path('M148 303 C116 304 105 273 124 246 L160 203 C162 115 199 71 259 72 C323 74 359 122 355 199 C356 234 373 252 405 267 C423 277 418 300 401 308 C380 318 363 305 350 293 C358 341 378 388 356 410 C337 429 313 398 295 402 C280 406 278 426 258 431 C232 439 220 406 201 407 C180 409 160 432 143 414 C124 393 144 349 148 303 Z','#FFFDF6')),
 group('Lavender folds',path('M164 267 C154 335 159 357 143 399 C141 411 149 422 160 415 C181 405 190 394 203 402 C195 372 188 361 190 326 Z','#E4DEF1','none',0)+path('M338 228 C333 279 345 345 359 385 L353 408 C338 407 325 386 310 398 C303 363 298 346 304 323 C320 308 325 270 319 240 Z','#E4DEF1','none',0)),
 group('Eyes',ellipse(216,190,10,15,INK,'none',0)+ellipse(285,190,10,15,INK,'none',0)),
 group('Blush',ellipse(198,219,16,8,'#F5B5B3','none',0)+ellipse(305,219,16,8,'#F5B5B3','none',0)),
 group('Smile',path('M239 222 Q251 237 264 222','none',INK,5)),
 group('Cup handle',path('M293 267 C335 254 337 303 304 300 L293 292 Z','#F1A486',INK,6)),
 group('Teacup',path('M223 255 L301 255 L296 311 Q263 328 231 309 Z','#EE9073')+path('M241 267 L245 305 M278 266 L276 308','none','#FFE5C6',6)+path('M218 323 Q264 337 306 320','none',INK,5)),
 group('Steam',path('M278 244 C267 237 286 231 281 223','none','#AE97C6',5)),
 group('Stars',spark(390,121,16)+spark(103,167,10,'#AE97C6'))])
art('bat-crescent-flight','Bat in Crescent Flight','bat','An alert little bat spreads scalloped wings beneath a crescent moon. Separate wings, ears and face layers invite recoloring.','Purple bat with wide scalloped wings flying below a golden crescent moon.','Purple',[
 group('Moon',path('M367 65 C321 64 310 119 342 143 C365 160 395 152 408 131 C369 143 342 106 367 65 Z','#F9D571',INK,5)),
 group('Left wing',path('M226 245 C169 151 113 170 60 207 C110 217 88 266 91 287 C125 274 157 283 156 324 C176 313 204 326 227 352 Z','#9378BA')+path('M221 260 L93 209 M219 276 L117 280 M222 298 L163 312','none','#5D4C83',5)),
 group('Right wing',path('M288 246 C345 153 404 168 452 207 C400 216 426 268 420 286 C387 272 358 285 356 325 C330 313 309 329 288 351 Z','#9378BA')+path('M292 260 L417 209 M292 279 L394 281 M290 302 L352 313','none','#5D4C83',5)),
 group('Ears',path('M219 219 L205 148 Q228 151 244 193 L270 193 Q287 153 310 146 L293 222 Z','#6B5896')+path('M221 188 L226 208 M290 185 L284 207','none','#CFA2CB',8)),
 group('Body',path('M217 234 C204 200 234 186 257 190 C282 184 314 206 297 239 C323 284 310 373 259 390 C203 374 189 287 217 234 Z','#72619D')),
 group('Chest',ellipse(258,316,31,48,'#A58BBB','none',0)),
 group('Face',ellipse(233,234,6,10,INK,'none',0)+ellipse(282,234,6,10,INK,'none',0)+path('M245 255 Q258 267 271 253','none',INK,4)+path('M248 258 L251 270 L258 263 M263 263 L270 270 L270 256','#FFF9DE',INK,2)),
 group('Stars',spark(130,122,10)+spark(423,348,12)+spark(158,381,8))])
art('spider-thread-and-bow','Spider on a Silken Thread','spider','A cheerful eight-legged spider hangs from a fine thread, wearing a little ochre bow.','Smiling charcoal spider with eight curved legs, an ochre bow and a silken thread.','Black',[
 group('Thread',path('M257 53 L257 200','none','#A6ADB8',4)),
 group('Eight legs',path('M199 268 C161 230 126 222 93 237 M196 287 C146 264 109 279 86 306 M198 309 C146 309 119 342 116 373 M217 332 C173 354 169 386 181 413 M314 269 C351 229 383 225 420 237 M321 289 C369 261 405 282 429 306 M314 312 C365 312 393 343 399 377 M298 337 C340 356 346 393 332 416','none',INK,10)),
 group('Body',ellipse(258,291,75,79,'#566172')),
 group('Body shine',path('M207 275 C207 249 222 233 239 230','none','#A1ACB8',10)),
 group('Eyes',ellipse(232,285,15,20,'#FFF9EB',INK,3)+ellipse(280,285,15,20,'#FFF9EB',INK,3)+ellipse(236,289,6,9,INK,'none',0)+ellipse(276,289,6,9,INK,'none',0)),
 group('Smile',path('M243 319 Q258 338 276 318','none','#FFF5DF',5)),
 group('Bow',path('M259 212 C225 177 209 176 209 196 C205 226 239 230 258 215 C279 232 315 230 309 204 C307 185 285 184 259 212 Z','#EFAE52',INK,5)+circle(260,213,10,'#FFD080',INK,4)),
 group('Thread drops',circle(257,102,5,'#CED5E0','none',0)+circle(257,151,4,'#CED5E0','none',0))])
art('apple-orchard-cutaway','Orchard Apple and a Slice','apple','A glossy red orchard apple sits beside a fresh cut slice with two small seeds.','Red apple with a green leaf beside a cream-colored apple slice and two brown seeds.','Red',[
 group('Stem',path('M246 156 Q231 119 259 88 L275 100 Q252 132 265 154 Z','#82634A',INK,5)),
 group('Apple leaf',path('M266 140 Q286 82 352 100 Q347 158 284 159 Z','#81A561')+path('M279 148 L335 112','none','#436440',4)),
 group('Apple skin',path('M255 168 C207 122 133 154 112 214 C82 301 147 416 215 418 C235 420 250 408 265 412 C337 433 389 329 387 263 C386 184 324 128 275 166 Z','#D9594F')),
 group('Apple shadow',path('M334 174 C389 245 361 350 301 390 C286 401 271 407 251 408 C306 437 376 344 381 278 C387 230 366 191 334 174 Z','#B84040','none',0)),
 group('Apple shine',path('M171 187 C150 202 139 231 140 253 M163 284 L167 294','none','#F5A18A',12)),
 group('Apple slice',path('M293 306 C334 283 391 280 430 307 C422 364 385 411 337 435 C304 405 286 362 293 306 Z','#F5D9A7')+path('M306 316 Q353 298 416 314 C404 351 377 391 339 420 C318 389 308 351 306 316 Z','#FFF1CF','none',0)+path('M339 322 L344 367','none','#DDBB83',3)),
 group('Seeds',path('M332 356 Q311 373 330 386 Q341 378 332 356 Z','#70503C',INK,2)+path('M360 352 Q343 375 358 386 Q372 375 360 352 Z','#70503C',INK,2))])
art('sunflower-garden-stem','Sunflower on a Garden Stem','sunflower','A tall golden sunflower has an overlapping crown of petals, a seed-filled center and two generous leaves.','Golden sunflower with a brown seed center, long green stem and two pointed leaves.','Yellow',[
 group('Stem',path('M256 238 Q247 341 266 443','none','#557A42',15)),
 group('Left leaf',path('M255 363 C203 304 155 314 123 306 C137 365 174 393 255 363 Z','#719A54')+path('M145 324 L245 364','none','#43683D',4)),
 group('Right leaf',path('M263 409 C279 350 328 337 373 333 C355 386 332 415 263 409 Z','#8CAE64')+path('M281 396 L350 352','none','#547742',4)),
 group('Petal crown',''.join(path('M256 180 C218 146 223 91 256 62 C289 91 294 148 256 180 Z','#F6C14A' if i%2 else '#F5AE3C',INK,5,transform=f'rotate({i*30} 256 190)') for i in range(12))),
 group('Flower center',circle(256,190,65,'#80573C',INK,6)+circle(256,190,48,'#AF7847','none',0)),
 group('Sunflower seeds',''.join(ellipse(x,y,4,6,'#6A4938','none',0,transform=f'rotate({(x+y)%60-30} {x} {y})') for x,y in [(237,156),(258,153),(278,162),(220,177),(242,178),(266,176),(289,183),(223,201),(246,200),(270,199),(288,209),(239,224),(260,222),(272,219)]))])
art('acorn-oak-companions','Acorn and Oak Leaf','acorn','A textured acorn cap, chestnut shell and a lobed oak leaf form a compact woodland arrangement.','Brown acorn with a crosshatched cap resting in front of a green oak leaf.','Brown',[
 group('Oak leaf',path('M280 335 C280 304 334 304 325 285 C270 287 283 254 312 243 C265 231 290 203 323 197 C292 168 321 146 346 157 C338 124 365 105 388 123 C414 89 441 90 447 101 C444 129 427 146 412 151 C446 159 425 196 398 196 C422 219 395 241 374 240 C381 273 366 280 344 280 C343 314 314 342 280 335 Z','#8DA565')+path('M295 321 L427 120 M332 271 L338 230 M352 238 L393 218 M376 192 L379 156','none','#597543',5)),
 group('Acorn stem',path('M221 175 Q221 126 244 103','none','#695139',13)),
 group('Acorn shell',path('M137 239 C131 324 168 388 239 420 C302 391 341 328 336 244 Z','#B57A49')),
 group('Shell shadow',path('M285 251 C297 320 279 379 240 416 C300 391 337 328 331 251 Z','#8F5D3C','none',0)),
 group('Shell highlight',path('M166 279 C169 323 190 359 210 371','none','#DCA366',10)),
 group('Acorn cap',path('M129 247 C129 196 178 160 238 169 C305 159 348 208 343 252 C276 275 195 275 129 247 Z','#826049')+path('M152 231 L167 215 L183 235 L200 212 L219 239 L237 212 L258 238 L278 216 L296 236 L314 217 L328 235 M176 193 L191 207 L209 188 L227 207 L247 185 L268 204 L283 193','none','#B28B60',5))])
art('gift-ribbon-keepsake','Ribbon-Tied Keepsake Gift','gift','A cobalt gift box with a cream ribbon, generous bow and a little hanging gift tag.','Blue gift box tied with a golden cream bow and a blank hanging tag.','Blue',[
 group('Box',path('M129 243 L384 243 L384 416 L129 416 Z','#6F97BD')+path('M328 250 L384 243 L384 416 L328 416 Z','#507CA5','none',0)),
 group('Vertical ribbon',path('M230 243 L284 243 L284 416 L230 416 Z','#F5D58C')),
 group('Lid',path('M116 212 L397 212 L397 265 L116 265 Z','#91B2CB')+path('M230 212 L284 212 L284 265 L230 265 Z','#F9E1A8',INK,4)),
 group('Left bow',path('M256 211 C191 210 138 176 146 131 C151 101 184 114 206 132 C230 152 244 181 256 211 Z','#F5D58C')+path('M256 211 Q170 185 166 141','none','#C99D59',5)),
 group('Right bow',path('M257 212 C270 160 327 104 355 126 C389 159 330 208 257 212 Z','#F9E1A8')+path('M258 212 Q325 177 343 145','none','#C99D59',5)),
 group('Bow knot',ellipse(258,207,27,22,'#EBC679',INK,5)),
 group('Tag string',path('M276 212 Q319 238 325 292','none',INK,3)),
 group('Gift tag',path('M307 279 L326 270 L355 288 L348 336 L304 329 Z','#FFF4D7',INK,4)+circle(324,282,3,INK,'none',0)),
 group('Small glimmers',spark(87,139,10)+spark(421,335,14)+spark(363,82,7))])
art('snowman-knitted-scarf','Snowman in a Knitted Scarf','snowman','A smiling snowman wears a deep teal hat and coral scarf, holding a small winter twig.','Two-ball snowman with a teal hat, coral scarf, carrot nose and twig arms.','White',[
 group('Twig arms',path('M172 307 L94 249 L79 218 M106 258 L67 256 M344 300 L408 237 L409 206 M394 251 L438 241','none','#82634D',9)),
 group('Snow body',ellipse(261,352,107,90,'#F8F8EE')+path('M315 283 C360 345 321 407 213 422 C298 456 360 406 366 359 C370 324 347 296 315 283 Z','#DCE9E7','none',0)),
 group('Head',circle(253,220,73,'#F8F8EE')),
 group('Hat crown',path('M196 160 L196 101 Q253 80 295 108 L305 162 Z','#4C797A')),
 group('Hat band',path('M195 134 Q254 123 300 138 L305 164 L195 163 Z','#E19574',INK,4)),
 group('Hat brim',path('M167 165 Q250 145 329 168 Q338 179 328 186 Q249 174 167 183 Q153 173 167 165 Z','#41676F',INK,5)),
 group('Face',circle(229,216,5,INK,'none',0)+circle(277,215,5,INK,'none',0)+path('M253 229 L299 243 L252 249 Z','#E69A46',INK,3)+path('M228 254 Q240 267 254 265','none',INK,4)),
 group('Scarf',path('M181 276 Q251 303 323 276 L325 304 Q265 332 181 303 Z','#D77860')+path('M282 310 L321 307 L329 376 L285 383 Z','#E18B70')+path('M297 321 L303 371 M310 322 L316 368','none','#F6BA92',4)),
 group('Buttons',circle(254,342,6,'#46666F',INK,2)+circle(254,373,6,'#46666F',INK,2)+circle(254,401,6,'#46666F',INK,2)),
 group('Snowflakes',spark(114,140,13,'#ADCBD0')+spark(399,149,16,'#ADCBD0')+circle(103,382,7,'#C6DCE0','none',0)+circle(383,405,5,'#C6DCE0','none',0))])
art('pumpkin-botanical-outline','Botanical Pumpkin Coloring Page','pumpkin','A carefully spaced pumpkin outline with curling tendrils and two textured leaves, ready for coloring.','Black outline drawing of a ribbed pumpkin, curling vine and two autumn leaves.','Black',[
 group('Left leaf',path('M209 186 C169 168 121 115 149 90 C177 96 214 122 221 164 Z','white')+path('M158 106 L212 176 M181 132 L170 151 M192 146 L203 126','none',INK,4)),
 group('Stem',path('M238 182 C222 139 251 113 244 78 L270 72 C290 105 259 151 273 179 Z','white')+path('M254 168 C248 133 269 105 260 88','none',INK,4)),
 group('Pumpkin outline',path('M255 181 C218 153 150 157 111 197 C46 266 71 372 146 414 C179 433 221 428 253 416 C290 434 361 426 400 383 C459 321 443 226 382 183 C345 157 292 158 268 179 Z','white')),
 group('Contour ribs',path('M206 184 C137 226 129 365 198 415 M247 186 C205 239 202 353 250 407 M284 181 C346 211 360 358 297 415 M328 179 C398 221 409 330 364 394','none',INK,5)),
 group('Right leaf',path('M272 173 C289 138 335 96 375 117 L389 150 L357 153 L368 177 L332 173 L329 191 L291 185 Z','white')+path('M287 176 L363 132 M321 159 L319 134 M335 150 L350 165','none',INK,4)),
 group('Tendrils',path('M278 182 C310 202 337 243 374 229 C415 211 410 174 390 185 C367 199 399 215 401 193 M143 396 C104 428 64 390 91 378 C108 371 116 390 102 397','none',INK,5))],'Outline')
(ROOT/'data/art.json').write_text(json.dumps(arts,indent=2)+'\n')
print(f'Created {len(arts)} distinct original masters across {len(set(a["topic"] for a in arts))} topics; none marked approved or published.')
