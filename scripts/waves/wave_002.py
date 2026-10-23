"""Winter objects composed individually from reviewed winter briefs.

Internal stitches and material marks repeat within one object. Every catalog
entry has its own silhouette, construction and arrangement.
"""
from vector import p, e, c, svg
import math
def stitches(points, color, width):
    marks=[]
    for (x1,y1),(x2,y2) in zip(points,points[1:]):
        length=math.hypot(x2-x1,y2-y1)
        for step in range(0,int(length),8):
            a,b=step/length,min(step+3,length)/length
            marks.append(f'M{x1+(x2-x1)*a:.3f} {y1+(y2-y1)*a:.3f} L{x1+(x2-x1)*b:.3f} {y1+(y2-y1)*b:.3f}')
    return p(' '.join(marks),stroke=color,w=width)
ART=[]
def add(art_id,title,use,alt,layers):
    ART.append(dict(id=art_id,title=title,topic='winter',use=use,alt=alt,
                    source=svg(art_id,title,layers),layerLabels=[name for name,_ in layers]))

add('winter-ribbed-pompom-beanie','Ribbed Pom-Pom Beanie',
    'Cold-weather wardrobe worksheets, personal winter cards and cozy journal labels.',
    'A burgundy knitted winter hat with a textured pom-pom, ribbed folded cuff and small cream label.',[
    ('Wool pom pom',p('M230 103 L222 89 L228 76 L224 64 L239 59 L246 45 L261 49 L273 43 L282 55 L297 58 L298 74 L308 85 L300 98 L302 110 L285 116 L278 129 L262 124 L251 130 L241 118 L227 116 Z','#B45F65')),
    ('Pom pom fibers',p('M240 71 L252 86 M275 62 L267 86 M290 85 L276 96 M256 111 L263 98 M241 103 L251 97',stroke='#DB9293',w=3)),
    ('Knitted crown',p('M119 317 C122 226 149 164 209 132 C238 117 275 118 306 133 C367 163 394 235 395 318 Q262 355 119 317 Z','#9B4C58')),
    ('Crown light',p('M135 300 C143 211 173 162 225 139 Q251 128 268 133 C201 179 184 233 180 310 Z','#B96970','none',0)),
    ('Crown shadow',p('M317 141 C370 180 390 244 395 318 L354 330 C354 252 343 194 317 141 Z','#783E4B','none',0)),
    ('Crown ribbing',''.join(p(d,stroke='#773E4A',w=3)for d in ['M151 304 Q157 203 217 145','M186 312 Q189 209 237 137','M224 317 Q224 209 251 134','M264 321 L266 135','M304 319 Q299 217 280 137','M343 313 Q338 214 300 143','M375 305 Q368 225 324 158'])),
    ('Soft yarn stitches',''.join(p(f'M{x} {y} l5 5 l5 -5',stroke='#D28A8D',w=1.6)for x,y in [(170,240),(164,263),(159,286),(208,231),(205,254),(203,277),(244,242),(244,266),(245,289),(282,239),(284,264),(286,289),(321,252),(326,279)])),
    ('Rolled cuff',p('M118 303 Q254 330 394 303 L408 372 Q407 393 382 400 Q257 426 130 400 Q107 396 106 378 Z','#B96B72')),
    ('Cuff lower shadow',p('M108 372 Q244 407 407 371 L407 382 Q401 396 382 400 Q257 426 130 400 Q110 396 108 384 Z','#9B4F5D','none',0)),
    ('Cuff rib stitches',''.join(p(f'M{x} {308+int(13*(1-((x-256)/150)**2))} l-2 68',stroke='#82414F',w=2.4)for x in range(126,396,16))),
    ('Woven label',p('M304 350 L350 346 L354 379 L307 384 Z','#EFE2C8','#765E55',2)+p('M311 356 L344 353 M314 377 L348 372',stroke='#C4B397',w=1.5)),
])

add('winter-fleece-earmuffs','Padded Fleece Earmuffs',
    'Winter clothing vocabulary cards, weather charts and personal ski-trip checklists.',
    'Two cream fleece earmuff pads joined by a curved teal padded headband, with one pad turned slightly outward.',[
    ('Headband outer arc',p('M122 286 C91 146 148 69 246 69 C348 69 401 162 375 306 L350 301 C373 180 326 103 246 102 C168 100 122 164 147 280 Z','#497A79')),
    ('Headband inner padding',p('M137 278 C117 171 160 111 243 113 C321 112 359 190 340 292 L355 298 C378 174 325 96 244 96 C160 94 113 165 127 279 Z','#91B6A8','none',0)),
    ('Headband seam',p('M118 232 C109 131 169 81 241 82 C325 80 379 154 369 258',stroke='#B5CFC1',w=3)),
    ('Left swivel bracket',p('M127 249 L148 247 L160 307 L140 317 Z','#B7C2B8')+c(143,283,8,'#ECEADF',w=2)),
    ('Right swivel bracket',p('M344 269 L368 272 L361 324 L336 319 Z','#A7B7AD')+c(351,297,8,'#ECEADF',w=2)),
    ('Left shell',e(148,343,59,89,'#355D61',w=3,transform='rotate(-13 148 343)')),
    ('Left fleece pad',p('M127 265 Q147 253 160 267 Q178 262 185 282 Q201 289 198 307 Q210 320 202 339 Q208 358 195 371 Q197 391 179 398 Q169 418 151 411 Q132 420 120 405 Q101 404 99 385 Q86 372 94 355 Q83 338 94 324 Q88 304 104 294 Q105 275 127 265 Z','#E7DAC0')),
    ('Right shell',e(350,359,60,85,'#315960',w=3,transform='rotate(14 350 359)')),
    ('Right fleece pad',p('M336 283 Q354 275 369 291 Q388 292 392 311 Q405 325 396 340 Q407 355 397 372 Q400 390 383 400 Q377 422 356 418 Q342 432 326 419 Q305 421 299 402 Q281 394 287 374 Q276 360 286 343 Q280 323 297 312 Q300 291 319 294 Z','#F2E7CF')),
    ('Fleece loops',p('M121 293 q-9 8 -3 17 M153 281 q11 -1 14 10 M181 318 q8 8 1 17 M120 372 q-4 11 8 17 M158 394 q12 4 17 -5 M315 317 q-10 5 -6 15 M348 302 q10 -3 16 5 M380 353 q9 9 0 18 M313 389 q3 12 15 10 M355 407 q13 0 17 -9',stroke='#C5B89E',w=2.5)),
    ('Soft pad light',p('M129 321 Q119 344 130 361 M341 330 Q327 355 338 377',stroke='#FFF7E4',w=8)),
])

add('winter-plaid-fringed-scarf','Plaid Fringed Scarf',
    'Cozy journal labels, winter clothing displays and personal greeting cards.',
    'A folded forest-green plaid scarf with overlapping uneven ends, gold woven stripes and cream fringes.',[
    ('Back hanging end',p('M245 131 L358 146 L333 407 L225 394 Z','#547A66')),
    ('Back end edge shadow',p('M339 143 L358 146 L333 407 L314 404 Z','#345B4F','none',0)),
    ('Back plaid bands',p('M269 137 L260 398 M309 143 L295 401',stroke='#B8B780',w=14)+p('M240 219 L350 232 M234 282 L344 294 M228 345 L338 357',stroke='#9CA36F',w=14)),
    ('Back fine weave',p('M283 139 L273 399 M319 144 L306 403 M241 242 L348 254 M232 309 L341 320 M227 372 L335 384',stroke='#E0CE93',w=2)),
    ('Scarf front end',p('M154 128 Q211 114 265 140 L238 366 L126 351 Z','#77917A')),
    ('Scarf side fold',p('M153 130 L174 128 L148 354 L126 351 Z','#3E6556','none',0)),
    ('Front plaid bands',p('M190 130 L164 357 M229 135 L202 362',stroke='#C4BD85',w=13)+p('M148 185 L258 199 M140 248 L250 263 M132 312 L242 327',stroke='#B7AF79',w=13)),
    ('Front fine weave',p('M202 131 L177 359 M240 138 L215 364 M146 209 L255 223 M138 274 L247 289 M129 338 L239 353',stroke='#F3DEAB',w=2)),
    ('Folded neck loop',p('M154 129 Q166 85 221 83 Q287 77 358 146 L310 187 Q264 153 215 155 Q180 153 154 129 Z','#8FA38A')+p('M164 128 Q215 107 310 173 M197 94 Q251 100 334 159',stroke='#B9C2A1',w=4)),
    ('Fold crease',p('M159 131 Q208 150 258 143 M259 145 Q288 153 309 179',stroke='#3C5F50',w=3)),
    ('Front fringe',''.join(p(f'M{x} {351+(x-129)*.13:.1f} q-6 17 -4 34',stroke='#D7C79E',w=5)for x in range(132,237,10))),
    ('Back fringe',''.join(p(f'M{x} {394+(x-225)*.12:.1f} q-2 17 -7 31',stroke='#D7C79E',w=5)for x in range(230,331,10))),
])

add('winter-wool-sock-pair','Wool Socks with Reinforced Heels',
    'Getting-dressed sequence activities, winter vocabulary cards and personal cozy-season crafts.',
    'Two warm wool socks lean in opposite directions, with ribbed cuffs, cream toes and reinforced heels.',[
    ('Back sock',p('M287 88 L362 107 L328 267 Q321 292 345 314 L390 354 Q413 375 399 398 Q385 419 359 408 L284 376 Q250 363 247 327 Q242 302 252 271 Z','#B77D70')),
    ('Back heel',p('M249 299 Q272 306 283 331 Q286 352 274 369 Q249 355 247 327 Z','#E6CAA8')),
    ('Back toe',p('M370 336 L390 354 Q413 375 399 398 Q385 419 359 408 L347 402 Q369 381 370 336 Z','#ECD3B2')),
    ('Back knit ribs',p('M296 129 L268 273 M319 136 L292 282 M343 143 L316 288',stroke='#8E6058',w=2)+p('M291 180 L335 191 M283 221 L327 233 M275 261 L320 273',stroke='#D49E8B',w=3)),
    ('Back ribbed cuff',p('M282 80 L368 100 L360 142 L273 121 Z','#DDAD90')+''.join(p(f'M{x} {85+(x-288)*.23:.1f} l-7 33',stroke='#A57965',w=2)for x in range(290,363,10))),
    ('Front sock',p('M146 96 L224 84 L253 267 Q256 292 237 309 L182 363 Q151 396 121 381 Q98 369 106 345 Q111 329 139 313 L173 285 Q184 273 179 252 Z','#6F8B87')),
    ('Front side light',p('M151 132 L168 128 L201 257 Q208 280 190 297 L134 343 Q122 353 119 367 Q109 357 117 344 L160 306 Q191 284 182 254 Z','#9EB2A3','none',0)),
    ('Front heel',p('M215 287 Q226 266 252 266 Q256 292 237 309 L218 327 Q201 308 215 287 Z','#D8C9A6')),
    ('Front toe',p('M141 315 Q167 323 175 370 Q150 394 121 381 Q98 369 106 345 Q113 327 141 315 Z','#EAD9B7')),
    ('Front knit rows',p('M179 151 L229 143 M184 188 L234 181 M192 226 L240 219 M199 261 L247 254 M166 316 L183 333 M185 299 L203 317',stroke='#C3CEC0',w=2.4)),
    ('Front folded cuff',p('M138 88 L224 74 L233 121 L147 136 Z','#AEC0AC')+''.join(p(f'M{x} {94-(x-147)*.16:.1f} l7 32',stroke='#66877D',w=2.2)for x in range(148,224,10))),
    ('Toe seams',p('M117 345 Q134 338 146 351 M369 362 Q383 367 390 385',stroke='#BAA887',w=2)),
])

add('winter-laced-snow-boot','Laced Winter Snow Boot',
    'Winter safety worksheets, outdoor packing lists and cold-weather clothing cards.',
    'A tan lace-up snow boot in side view with a thick cream collar, stitched leather panels and dark rubber tread.',[
    ('Boot upper silhouette',p('M160 112 L270 109 L273 228 Q274 267 304 282 L378 312 Q415 326 421 360 L414 380 L105 382 Q93 355 110 324 Q126 300 139 266 L153 170 Z','#B38B5C')),
    ('Leather heel panel',p('M158 158 L196 165 L186 294 L145 332 L110 335 Q125 304 138 271 Z','#94734E')),
    ('Leather toe panel',p('M306 284 L378 312 Q410 324 420 353 Q368 347 315 357 Q316 318 306 284 Z','#C7A377')),
    ('Padded ankle tongue',p('M208 141 L252 137 L270 260 L239 291 L206 270 Z','#DDC09A')),
    ('Side ankle panel',p('M185 179 L207 179 L219 273 L269 304 L248 348 L151 348 L161 303 Z','#CAA578')),
    ('Leather seam stitches',stitches([(169,187),(153,276),(124,328)],'#EEE0B8',2)+stitches([(190,198),(176,299),(165,333),(237,333)],'#EEE0B8',2)+stitches([(321,304),(330,321),(334,340)],'#EEE0B8',2)),
    ('Eyelets',''.join(c(x,y,5,'#6B6150','#4D4B3E',1.5)for x,y in [(215,174),(249,168),(221,202),(255,196),(227,230),(262,224),(234,257),(269,249)])),
    ('Crossed laces',p('M216 174 L255 196 L227 230 L269 249 M249 168 L221 202 L262 224 L234 257',stroke='#F3E3BD',w=4)+p('M233 257 Q213 274 210 264 Q211 251 233 257 Q259 269 259 257 Q252 246 233 257 M233 257 L228 285 M235 259 L252 280',stroke='#F3E3BD',w=3)),
    ('Fleece collar',p('M154 114 Q162 102 174 109 Q187 96 199 105 Q212 95 224 103 Q240 96 250 104 Q267 99 275 112 L274 151 Q261 161 251 152 Q237 164 225 154 Q212 164 201 156 Q185 165 174 156 Q160 163 151 150 Z','#EADBC0')),
    ('Collar texture',p('M162 126 q8 -6 13 2 M187 118 q7 -6 13 1 M214 126 q8 -7 14 0 M244 117 q7 -5 14 2 M174 143 q8 -5 14 1 M232 144 q8 -5 14 0',stroke='#C6B599',w=2)),
    ('Rubber mudguard',p('M108 343 Q201 366 312 350 Q373 339 420 356 L426 379 Q269 407 105 386 Z','#55625B')+p('M114 357 Q252 383 413 368',stroke='#899186',w=3)),
    ('Treaded sole',p('M104 379 Q259 403 426 375 L426 397 L402 403 L399 414 L378 416 L373 407 L349 410 L344 420 L322 422 L316 414 L290 416 L285 425 L263 425 L258 418 L231 416 L226 423 L205 421 L200 413 L174 410 L168 418 L146 414 L143 404 L121 402 L117 409 L101 403 Z','#374840')),
])

add('winter-white-figure-skate','White Leather Figure Skate',
    'Personal ice-skating invitations, winter sports worksheets and equipment vocabulary cards.',
    'A white figure skate with pale leather panels, crossed laces, a raised heel and a silver blade with a toothed toe pick.',[
    ('Rear blade support',p('M141 354 L171 353 L175 396 L144 396 Z','#879D9D')),
    ('Front blade support',p('M321 352 L343 351 L337 397 L315 398 Z','#A6B9B7')),
    ('Steel blade',p('M104 387 Q231 405 366 383 L390 376 L394 384 L383 390 L391 397 L378 401 L384 409 L370 414 L372 420 L350 421 Q214 438 102 412 Z','#B6C8C5')+p('M108 406 Q236 428 353 409',stroke='#F3F6EA',w=3)),
    ('Raised leather heel',p('M123 333 L188 335 L177 377 L136 377 Z','#8C7D69')+p('M139 347 L181 349 M140 359 L177 361',stroke='#C1AA89',w=3)),
    ('Boot leather',p('M158 89 L247 90 L246 222 Q250 252 279 270 L356 305 Q391 321 393 343 Q392 362 372 364 L121 350 Q105 328 121 301 Q137 276 143 248 Z','#F2EDDC')),
    ('Boot shadow panel',p('M160 111 L185 112 L175 245 Q173 280 146 313 L151 343 L121 350 Q105 328 121 301 Q137 276 143 248 Z','#C7CFC3','none',0)),
    ('Leather toe',p('M302 280 L356 305 Q391 321 393 343 Q364 349 321 347 Q325 316 302 280 Z','#E5E1CF')),
    ('Ankle reinforcement',p('M170 137 Q183 127 195 139 L220 243 L265 277 L245 316 L166 322 Q155 293 175 265 Z','#E3E5D7')+p('M182 153 L197 240 Q204 268 238 284',stroke='#B5C2B5',w=2)),
    ('Tongue',p('M206 103 L238 103 L245 221 L270 255 L244 279 L220 239 Z','#D5DDD0')),
    ('Lace eyelets',''.join(c(x,y,4,'#7D9189','none',0)for x,y in [(207,137),(240,134),(212,165),(242,162),(217,192),(244,188),(222,219),(249,215),(233,244),(263,238)])),
    ('Cotton laces',p('M207 137 L242 162 L217 192 L249 215 L233 244 M240 134 L212 165 L244 188 L222 219 L263 238',stroke='#FFFFF3',w=3.7)+p('M246 248 Q216 250 223 266 Q235 272 246 248 Q270 250 266 267 Q255 269 246 248 M245 249 L240 288 M249 252 L266 282',stroke='#F5F1DE',w=3)),
    ('Stitched seams',stitches([(168,103),(158,246)],'#A6B8AC',1.7)+stitches([(174,313),(240,307)],'#A6B8AC',1.7)+stitches([(316,292),(332,315),(337,338)],'#A6B8AC',1.7)),
    ('Leather sole',p('M122 341 Q248 354 391 341 L395 357 Q255 373 122 355 Z','#8D9C8D')+p('M131 349 Q258 363 384 350',stroke='#D7DBC7',w=2)),
])

add('winter-wooden-runner-sled','Wooden Runner Sled',
    'Snow-day activity sheets, personal winter cards and outdoor-play story prompts.',
    'A slatted wooden sled with curved red runners and a loose pulling rope, shown in three-quarter view.',[
    ('Far red runner',p('M167 301 L353 209 Q382 192 385 173 Q385 156 373 151 M155 318 L363 217 Q398 198 399 172',stroke='#994C44',w=9)),
    ('Far runner supports',p('M190 253 L195 294 M300 198 L308 237',stroke='#A45A4D',w=7)),
    ('Under deck crossbars',p('M127 281 L240 341 L372 273 L263 216 Z','#795B3D')+p('M165 221 L269 278 L328 249 L227 193 Z','#866546')),
    ('Left deck slat',p('M128 259 L287 176 Q299 169 310 179 L320 190 L161 277 Z','#CFA36C')),
    ('Middle deck slat',p('M162 280 L322 195 L343 212 L184 298 Z','#DDB57B')),
    ('Right deck slat',p('M187 302 L346 217 L367 235 L209 320 Z','#CFA36C')),
    ('Wood grain',p('M153 257 L289 186 M184 279 L320 205 M210 299 L344 228 M241 253 q13 -14 25 -13 M264 240 q-6 11 -16 11',stroke='#9E754D',w=2)),
    ('Slat end thickness',p('M128 259 L161 277 L161 288 L128 270 Z M162 280 L184 298 L184 309 L162 291 Z M187 302 L209 320 L209 331 L187 313 Z','#A27A50')),
    ('Deck fasteners',''.join(c(x,y,3,'#5E5C4B','none',0)for x,y in [(170,245),(204,267),(229,288),(285,185),(318,207),(343,229)])),
    ('Near runner supports',p('M213 326 L222 369 M334 266 L343 310',stroke='#A8584C',w=8)),
    ('Near curved runner',p('M139 399 Q179 405 215 386 L389 296 Q429 275 426 238 Q425 212 403 211 Q388 212 387 228',stroke='#AD584C',w=11)+p('M144 395 Q178 398 212 382 L387 291 Q421 273 421 246',stroke='#E49B74',w=3)),
    ('Pulling rope',p('M302 178 C311 134 363 104 402 123 C441 146 417 197 373 228',stroke='#C5B28C',w=5)+p('M301 176 l9 8 M369 225 l9 8',stroke='#756447',w=3)),
])

add('winter-crossed-skis-poles','Crossed Skis and Poles',
    'Winter sports matching games, personal ski-trip stationery and equipment checklists.',
    'Two crossed red and blue skis with individual bindings, beside slim poles with wrist straps and snow baskets.',[
    ('Left ski',p('M143 66 Q145 46 158 51 Q168 56 174 79 L322 421 Q326 436 313 443 Q300 449 292 433 Z','#B46654')),
    ('Right ski',p('M339 64 Q348 44 361 52 Q373 61 364 86 L214 435 Q207 450 194 444 Q182 439 187 424 Z','#5C8586')),
    ('Ski top highlights',p('M154 71 L307 428 M352 72 L202 429',stroke='#D9C8A1',w=3)),
    ('Ski tip markings',p('M164 101 L185 148 M345 100 L323 151',stroke='#E8DABB',w=10)),
    ('Left binding plate',p('M222 245 L245 234 L272 295 L248 306 Z','#424F4A')+p('M225 249 L239 243 L248 265 L234 271 Z','#B4B6A8')+p('M248 280 L261 274 L268 292 L255 298 Z','#C7C4AF')),
    ('Right binding plate',p('M262 239 L286 250 L259 312 L236 302 Z','#3E4C49')+p('M267 245 L280 251 L270 274 L257 268 Z','#CACAB6')+p('M249 285 L263 291 L255 307 L242 301 Z','#A8B6AD')),
    ('Left pole shaft',p('M112 133 L193 411',stroke='#8EAAA4',w=4)),
    ('Right pole shaft',p('M402 137 L320 413',stroke='#8EAAA4',w=4)),
    ('Pole handles',p('M105 104 L116 101 L131 153 L119 157 Z','#3E514C')+p('M402 104 L414 108 L398 160 L386 156 Z','#3E514C')),
    ('Wrist straps',p('M109 108 Q81 89 88 132 Q91 150 120 150 M407 111 Q433 95 432 125 Q430 147 400 152',stroke='#B38B64',w=3)),
    ('Snow baskets',e(183,379,20,7,'#556960',w=2,transform='rotate(-17 183 379)')+e(329,382,20,7,'#556960',w=2,transform='rotate(17 329 382)')),
    ('Metal tips',p('M189 399 L196 423 M324 401 L317 424',stroke='#596B65',w=3)),
])
