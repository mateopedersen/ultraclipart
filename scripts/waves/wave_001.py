"""Twenty-one independently composed illustrations. No recolor-only catalog variants.

Paths describe distinct silhouettes and arrangements; repeated petals, kernels,
stitches and cone scales are within-object construction, not extra artwork.
"""
import math
from vector import p, e, c, svg

ART = []
def add(art_id, title, topic, use, alt, layers):
    ART.append(dict(id=art_id, title=title, topic=topic, use=use, alt=alt,
                    source=svg(art_id, title, layers), layerLabels=[name for name, _ in layers]))

add('pumpkin-seed-cross-section', 'Pumpkin Half with Seeds', 'pumpkin',
    'Harvest worksheets, seed observation activities and personal recipe cards.',
    'Cut orange pumpkin half showing a pale rind, fibrous seed cavity and separate cream seeds beside the stem.', [
    ('Curved stem', p('M236 127 C226 104 231 79 249 63 L273 75 C253 93 252 111 257 130 Z', '#7B8050') + p('M245 110 L256 83', stroke='#AFAD70', w=4)),
    ('Outer rind', p('M251 129 C177 103 94 153 74 247 C52 348 134 434 251 440 C371 445 458 363 440 258 C427 159 341 105 267 130 Z', '#C76E32')),
    ('Cut flesh', p('M252 145 C181 123 110 173 93 255 C75 343 144 417 253 423 C359 425 436 353 423 262 C412 181 339 127 269 145 Z', '#EBA351')),
    ('Flesh contour', p('M136 233 C121 275 124 325 146 355 M378 223 C401 276 393 332 369 365', stroke='#F8C77D', w=10)),
    ('Seed cavity', p('M250 190 C207 163 161 197 156 263 C147 336 199 386 252 390 C307 386 365 336 358 267 C354 202 305 163 268 191 Z', '#C87935', '#AA602B', 3)),
    ('Fibrous center', p('M236 210 C208 250 273 262 242 308 C218 346 263 367 276 346 M284 206 C312 243 266 267 292 310 M189 248 C219 262 186 306 216 327 M323 246 C296 275 332 301 305 331', stroke='#E9B76A', w=5)),
    ('Cream seeds', ''.join(p(d, '#FFF1CA', '#9D6939', 2.2) for d in ['M202 228 Q180 244 197 260 Q217 252 202 228 Z','M282 226 Q271 205 263 228 Q268 245 282 226 Z','M325 261 Q303 252 305 277 Q320 289 325 261 Z','M223 283 Q204 269 202 291 Q212 309 223 283 Z','M279 298 Q259 308 276 329 Q291 321 279 298 Z','M241 344 Q221 330 222 352 Q232 371 241 344 Z'])),
    ('Loose seeds', p('M104 414 Q77 421 94 438 Q119 438 104 414 Z', '#FFF1CA', '#9D6939', 2.2)+p('M400 408 Q374 409 387 430 Q410 432 400 408 Z', '#FFF1CA', '#9D6939', 2.2)),
])

add('pumpkin-low-ribbed-heirloom', 'Low Ribbed Harvest Pumpkin', 'pumpkin',
    'Autumn labels, harvest displays and personal greeting cards.',
    'Wide flattened ochre pumpkin with deep vertical ribs, a woody bent stem and one green leaf.', [
    ('Woody stem', p('M242 178 C231 150 247 107 272 94 L294 113 C269 126 265 149 269 178 Z', '#81704B')+p('M255 158 Q252 137 278 113', stroke='#B0A06E', w=4)),
    ('Outer silhouette', p('M248 180 C194 153 116 172 82 225 C43 289 76 366 149 391 C213 415 301 414 367 393 C440 369 472 295 435 235 C403 181 328 158 273 180 Z', '#D59A4D')),
    ('Left side shade', p('M169 180 C106 229 107 342 173 399 C100 389 59 333 74 273 C85 224 119 194 169 180 Z', '#B47C3C', 'none', 0)),
    ('Right side shade', p('M348 180 C408 224 410 347 346 400 C421 384 460 323 436 261 C419 220 389 190 348 180 Z', '#B47C3C', 'none', 0)),
    ('Sculpted ribs', p('M197 184 C151 229 148 336 199 400 M224 188 C202 247 204 344 231 405 M282 189 C305 245 306 347 280 405 M311 186 C357 231 359 339 311 402', stroke='#A56D36', w=4)),
    ('Warm rib light', p('M182 224 C169 258 171 309 183 333 M240 229 L240 271 M328 224 C344 252 344 289 339 310', stroke='#EDBE77', w=8)),
    ('Leaf blade', p('M274 174 L289 144 L305 149 L316 122 L329 140 L355 137 L346 158 L360 170 L335 175 L327 194 L305 180 Z', '#7B9B56')),
    ('Leaf veins', p('M279 173 L337 153 M306 163 L307 149 M321 158 L328 175', stroke='#4E713E', w=2.6)),
])

add('apple-branch-two-fruits', 'Two Apples on a Leafy Branch', 'apple',
    'Orchard-themed teaching resources, lunch labels and personal stationery.',
    'Two differently shaped red and green apples hanging from a woody branch with pointed green leaves.', [
    ('Branch', p('M94 129 C179 143 314 121 424 76 L433 94 C325 140 209 160 104 150 Z', '#896347')+p('M172 144 L183 192 M330 126 L320 181', stroke='#654C36', w=8)),
    ('Upper leaves', p('M181 141 C148 108 154 79 124 56 C175 57 204 88 195 130 Z', '#789950')+p('M284 137 C286 84 325 61 362 63 C351 103 322 131 284 137 Z', '#A4B568')),
    ('Leaf veins', p('M187 132 L142 76 M293 127 L345 77', stroke='#4D6F3E', w=2.6)),
    ('Red apple', p('M181 201 C145 173 93 195 81 245 C65 308 106 378 145 380 C162 381 175 371 188 375 C234 395 275 330 272 267 C270 209 220 174 191 200 Z', '#C95F49')),
    ('Red apple shade', p('M229 204 C269 259 237 343 192 371 C237 384 270 317 267 267 C265 239 252 217 229 204 Z', '#AB4739', 'none', 0)),
    ('Apple highlights', p('M121 218 C101 235 97 260 100 277 M116 303 L120 310', stroke='#F4AB83', w=9)),
    ('Green apple', p('M320 192 C290 164 253 188 251 240 C246 303 284 347 319 349 C333 349 341 342 351 344 C391 357 432 306 429 253 C426 194 382 164 344 190 Q332 199 320 192 Z', '#A8B35C')),
    ('Green apple shade', p('M390 192 C432 243 405 309 356 342 C397 344 429 295 425 251 C423 223 408 203 390 192 Z', '#879749', 'none', 0)),
    ('Green apple light', p('M287 205 C273 222 269 244 272 261', stroke='#D9D98E', w=8)),
    ('Lower leaf', p('M331 184 C354 145 386 142 409 146 C395 177 370 193 342 191 Z', '#6D914D')+p('M344 183 L391 154', stroke='#4C6C3C', w=2.5)),
])

add('apple-sliced-on-board', 'Apple Slices on a Small Board', 'apple',
    'Snack worksheets, personal recipe cards and kitchen labels.',
    'Three red-skinned apple wedges with cream flesh and brown seeds on a small wooden cutting board.', [
    ('Board silhouette', p('M94 226 Q91 209 110 205 L362 166 Q380 162 385 181 L425 373 Q430 393 410 396 L157 437 Q138 439 135 420 L119 346 L85 353 Q70 356 67 337 L59 300 Q56 284 75 280 L105 275 Z', '#C99F70')),
    ('Wood grain', p('M133 232 L361 194 M155 401 L395 364 M115 311 L135 307 M167 385 Q272 342 389 346', stroke='#AB7F55', w=2.5)+e(84,314,6,10,'#F6F1DF','#8E6847',2)),
    ('Left wedge rind', p('M142 230 C151 296 199 344 259 359 L282 252 Q224 208 142 230 Z', '#B95042')),
    ('Left wedge flesh', p('M150 234 C165 291 202 333 255 349 L273 254 Q221 219 150 234 Z', '#F9E9BB', '#B49B6F', 2.2)),
    ('Right wedge rind', p('M277 210 C334 219 372 269 376 323 L276 338 Q240 283 277 210 Z', '#CD624B')),
    ('Right wedge flesh', p('M280 220 C328 230 361 271 367 317 L281 330 Q250 278 280 220 Z', '#FFF0C9', '#B49B6F', 2.2)),
    ('Front wedge rind', p('M175 353 C230 327 302 332 347 361 C321 402 240 422 190 395 Z', '#D96D50')),
    ('Front wedge flesh', p('M184 356 Q265 330 337 363 C302 396 245 410 197 388 Z', '#FFF1CE', '#B49B6F', 2.2)),
    ('Seed cores', p('M225 259 L244 311 M286 262 L302 294 M256 359 L268 385', stroke='#D6BE8B', w=3)),
    ('Brown seeds', p('M231 279 Q214 285 224 300 Q238 299 231 279 Z','#79533D',w=1.8)+p('M303 265 Q289 277 302 287 Q314 280 303 265 Z','#79533D',w=1.8)+p('M270 362 Q255 372 268 382 Q281 376 270 362 Z','#79533D',w=1.8)),
])

add('maple-five-lobed-study', 'Five-Lobed Maple Leaf', 'maple',
    'Autumn craft templates, leaf comparison activities and personal cards.',
    'One red-orange five-lobed maple leaf with a long petiole and a branching vein network.', [
    ('Leaf silhouette', p('M258 75 L278 133 L302 111 L304 161 L350 139 L340 186 L385 174 L365 220 L438 221 L401 259 L425 277 L370 293 L377 325 L312 322 L284 358 L276 401 L249 432 L237 419 L260 389 L260 357 L218 331 L162 341 L169 308 L110 299 L133 276 L81 241 L148 232 L130 184 L172 198 L169 155 L214 173 L215 121 L240 143 Z', '#CF7646')),
    ('Lower warm plane', p('M260 357 L218 331 L162 341 L169 308 L110 299 L133 276 L260 245 Z', '#E69D58','none',0)),
    ('Right darker plane', p('M260 245 L385 174 L365 220 L438 221 L401 259 L425 277 L370 293 L377 325 L312 322 L284 358 L276 401 L260 389 Z', '#B95C3E','none',0)),
    ('Main vein and petiole', p('M249 429 L269 387 L260 116', stroke='#7C613A', w=5)),
    ('Left veins', p('M261 257 L170 206 M261 283 L130 248 M264 308 L181 313 M259 208 L228 157', stroke='#F1B169', w=3.6)),
    ('Right veins', p('M260 236 L327 170 M262 269 L401 241 M265 308 L355 309 M263 192 L285 150', stroke='#F1B169', w=3.6)),
    ('Fine veins', p('M216 231 L208 205 M198 267 L173 251 M218 319 L210 299 M308 257 L328 232 M315 309 L336 288', stroke='#E8A165', w=2)),
])

add('oak-leaves-crossed-pair', 'Crossed Oak Leaves', 'leaves',
    'Leaf crafts, woodland classroom displays and personal seasonal stationery.',
    'Two lobed oak leaves, one olive green and one russet, crossing at their long stems.', [
    ('Russet leaf', p('M275 348 C239 323 234 307 246 294 C210 289 191 269 207 250 C172 240 169 211 193 204 C160 185 161 160 186 156 C160 127 174 105 198 112 C202 83 225 77 238 107 C260 91 281 111 267 136 C297 139 309 166 280 183 C309 196 304 226 276 230 C304 249 296 278 270 276 C290 305 277 330 275 348 Z', '#B46B43', transform='rotate(17 250 270)')),
    ('Russet vein', p('M273 359 Q238 240 215 112 M239 219 L198 184 M246 259 L272 231 M232 178 L256 153',stroke='#E2A36A',w=3,transform='rotate(17 250 270)')),
    ('Green leaf', p('M229 368 C198 358 169 336 188 316 C154 315 135 293 153 275 C121 261 122 235 149 231 C116 206 128 178 154 184 C139 154 163 133 186 151 C195 118 222 120 230 150 C258 130 280 155 262 177 C293 180 299 210 270 223 C299 245 286 269 262 266 C281 292 267 319 244 311 C252 335 242 353 229 368 Z', '#8A9D5C')),
    ('Green leaf shadow', p('M229 368 Q220 272 207 166 C247 149 269 161 262 177 C293 180 299 210 270 223 C299 245 286 269 262 266 C281 292 267 319 244 311 C252 335 242 353 229 368 Z', '#72844B','none',0)),
    ('Green leaf veins', p('M231 379 L207 166 M220 266 L163 241 M224 308 L185 283 M217 233 L254 205 M227 337 L251 296',stroke='#C6C78B',w=3)),
    ('Crossed stems', p('M232 367 Q248 398 298 427 M288 352 Q282 393 242 433',stroke='#765B3B',w=6)),
    ('Stem light', p('M240 384 L287 419 M278 387 L255 418',stroke='#BA9560',w=2)),
])

add('wheat-three-tied-ears', 'Three Tied Wheat Ears', 'wheat',
    'Harvest displays, grain-themed worksheets and personal kitchen labels.',
    'Three ripe wheat ears with paired golden grains, slender awns and a loose twine tie around the stalks.', [
    ('Stalks', p('M250 425 L168 150 M254 425 L257 102 M260 425 L343 161',stroke='#B49152',w=5)),
    ('Left grains', ''.join(p(f'M{180+i*7} {199+i*24} Q{142+i*7} {199+i*24} {147+i*7} {177+i*24} Q{174+i*7} {176+i*24} {180+i*7} {199+i*24} Z','#DDBA70',w=2.4)+p(f'M{180+i*7} {199+i*24} Q{203+i*7} {180+i*24} {187+i*7} {162+i*24} Q{165+i*7} {178+i*24} {180+i*7} {199+i*24} Z','#EACB83',w=2.4) for i in range(5))),
    ('Center grains', ''.join(p(f'M257 {150+i*27} Q222 {136+i*27} 229 {115+i*27} Q255 {121+i*27} 257 {150+i*27} Z','#E2C07A',w=2.4)+p(f'M257 {150+i*27} Q290 {138+i*27} 283 {116+i*27} Q259 {123+i*27} 257 {150+i*27} Z','#D1AB60',w=2.4) for i in range(6))),
    ('Right grains', ''.join(p(f'M{331-i*7} {209+i*24} Q{307-i*7} {185+i*24} {320-i*7} {168+i*24} Q{343-i*7} {184+i*24} {331-i*7} {209+i*24} Z','#E6C57C',w=2.4)+p(f'M{331-i*7} {209+i*24} Q{365-i*7} {211+i*24} {367-i*7} {189+i*24} Q{343-i*7} {188+i*24} {331-i*7} {209+i*24} Z','#D4AD60',w=2.4) for i in range(5))),
    ('Fine awns', p('M168 164 L147 119 M257 118 L257 63 M343 166 L366 120 M228 116 L214 84 M283 116 L297 83 M320 168 L321 134 M367 189 L392 164',stroke='#BA9655',w=1.8)),
    ('Strap leaves', p('M244 380 Q170 351 153 300 Q200 317 244 380 Z','#A5A16B',w=2.5)+p('M269 379 Q321 324 373 312 Q343 356 269 379 Z','#B9B57D',w=2.5)),
    ('Twine tie', p('M228 377 Q254 390 279 374 M231 383 Q256 394 279 382',stroke='#8E6847',w=4)+p('M250 384 C217 353 196 365 218 385 Q232 392 250 384 C281 353 305 364 280 383 Q266 390 250 384 M250 386 L232 414 M254 386 L281 407',stroke='#8E6847',w=3)),
])

add('corn-open-husk-ear', 'Corn Ear in an Open Husk', 'corn',
    'Harvest worksheets, produce labels and personal recipe illustrations.',
    'A golden ear of corn with rows of kernels, fine silk and three folded green husk leaves.', [
    ('Back husk', p('M263 420 C177 369 119 256 137 134 C197 169 239 286 263 420 Z','#7D9A58')+p('M263 422 C338 354 395 252 380 160 C320 201 286 297 263 422 Z','#A3AD6D')),
    ('Corn cob', p('M218 324 C194 250 202 113 250 75 C296 110 312 246 289 325 Q258 346 218 324 Z','#DCA64A')),
    ('Kernel rows', ''.join(e(224+j*17+(i%2)*1.5,132+i*19,7.7,10.1,'#EFC465' if (i+j)%3 else '#F6D584','#BC8B37',1.6) for i in range(10) for j in range(4) if (i>1 or j in (1,2)) and not(i>7 and j in (0,3)))),
    ('Corn silk', p('M247 108 C233 72 260 59 244 43 M260 107 C265 74 289 64 280 45 M253 106 C250 85 272 69 260 50',stroke='#BDA46E',w=2)),
    ('Left folded husk', p('M263 422 C174 370 127 297 115 238 C173 255 233 333 263 422 Z','#90AA67')+p('M130 256 Q195 324 254 405',stroke='#C5C98C',w=3)),
    ('Front folded husk', p('M263 422 C288 356 344 299 408 282 C381 346 331 406 263 422 Z','#749452')+p('M273 411 Q322 348 391 299',stroke='#B3BD7D',w=3)),
    ('Stem end', p('M251 414 L259 449 L277 445 L274 416 Z','#99A369',w=2.7)),
])

add('cranberries-wooden-scoop', 'Cranberries in a Wooden Scoop', 'cranberry',
    'Recipe cards, harvest place cards and personal pantry labels.',
    'Deep red cranberries piled in a pale wooden scoop with a small trailing leafy sprig.', [
    ('Trailing sprig', p('M110 376 Q74 283 114 206',stroke='#667F4D',w=4)+p('M97 298 Q61 276 74 251 Q108 265 97 298 Z','#8CA16B',w=2.4)+p('M97 271 Q111 238 133 246 Q125 278 97 271 Z','#A4B680',w=2.4)+p('M104 235 Q82 210 95 195 Q118 212 104 235 Z','#8CA16B',w=2.4)),
    ('Scoop handle', p('M325 231 L400 109 Q415 86 436 101 Q453 112 438 137 L355 258 Z','#B68E62')+p('M412 113 L424 121',stroke='#F0D1A4',w=6)),
    ('Scoop bowl', p('M143 260 C180 221 278 210 340 241 C393 267 389 341 344 386 C305 429 201 435 153 394 C114 363 107 297 143 260 Z','#C6A074')),
    ('Scoop inner surface', e(248,291,113,58,'#987450',w=3)),
    ('Back berry row', ''.join(c(x,y,r,'#A64949' if i%2 else '#BC5750','#713B37',2.5)+p(f'M{x-5} {y-r+7} L{x} {y-r+10} L{x+5} {y-r+6}',stroke='#743B39',w=1.8) for i,(x,y,r) in enumerate([(165,275,25),(205,255,26),(249,249,26),(295,260,28),(333,281,26)]))),
    ('Front berry row', ''.join(c(x,y,r,'#B94E49' if i%2 else '#C9685D','#713B37',2.5)+p(f'M{x-10} {y-8} Q{x-8} {y-15} {x-1} {y-16}',stroke='#E89C87',w=4) for i,(x,y,r) in enumerate([(180,310,28),(227,298,27),(275,298,27),(317,318,27),(228,341,28),(275,342,27)]))),
    ('Front wood rim', p('M136 312 C163 388 321 398 363 314 L365 342 C330 415 168 416 139 345 Z','#CBA77B')+p('M165 370 Q246 415 331 370',stroke='#E6C99B',w=3)),
    ('Loose berries', c(113,417,23,'#AF4D49','#713B37',2.5)+c(385,414,21,'#C46759','#713B37',2.5)+p('M105 404 L112 408 L116 403 M377 401 L383 406 L388 402',stroke='#713B37',w=2)),
])

add('sunflower-open-and-bud', 'Sunflower with a Side Bud', 'sunflower',
    'Garden journals, classroom plant displays and personal note cards.',
    'Open golden sunflower and a side bud on branching green stems with two broad pointed leaves.', [
    ('Branching stems', p('M246 449 C244 337 250 250 255 184 M247 345 Q330 315 365 229',stroke='#597746',w=9)),
    ('Left leaf', p('M246 354 C208 290 137 289 104 269 C107 329 167 388 246 354 Z','#86A466')+p('M122 290 Q171 322 236 350',stroke='#4E713F',w=2.5)),
    ('Right leaf', p('M247 422 C265 365 312 354 349 337 C347 395 301 432 247 422 Z','#A7BB7B')+p('M260 412 L330 357',stroke='#5D7D4B',w=2.5)),
    ('Back petals', ''.join(p('M255 158 C224 138 231 99 255 73 C276 103 288 137 255 158 Z','#DEA43E',w=2.6,transform=f'rotate({i*30+15} 255 184)') for i in range(12))),
    ('Front petals', ''.join(p('M255 162 C236 139 242 103 255 89 C274 114 280 142 255 162 Z','#F0C35B',w=2.6,transform=f'rotate({i*30} 255 184)') for i in range(12))),
    ('Seed disk', c(255,184,49,'#76533B',w=3)+c(255,184,36,'#9C7346','none',0)),
    ('Seed pattern', ''.join(e(255+math.cos(i*2.39996)*math.sqrt(i)*5.2,184+math.sin(i*2.39996)*math.sqrt(i)*5.2,2.1,2.8,'#563E31','none',0) for i in range(43))),
    ('Green side bud', p('M365 232 C337 226 329 191 349 173 L356 151 L368 163 L389 157 L389 178 C412 203 399 228 365 232 Z','#718E54')+p('M349 183 Q364 176 382 181 M360 165 L367 217 M389 179 L379 218',stroke='#B6BC78',w=2.5)),
])

add('rose-open-bloom-and-bud', 'Rose Bloom with a Small Bud', 'rose',
    'Personal greeting cards, floral labels and paper craft arrangements.',
    'Dusty pink rose with overlapping folded petals, a smaller closed bud and serrated green leaves.', [
    ('Stems', p('M251 450 L258 232 M254 366 Q331 322 347 262',stroke='#657D4D',w=7)),
    ('Left leaves', p('M252 381 L221 352 L219 338 L197 335 L198 317 L180 308 L184 294 L169 277 C221 275 249 311 252 381 Z','#8FA06D')+p('M248 369 L187 293',stroke='#526C42',w=2.5)),
    ('Right leaf', p('M256 421 L284 383 L300 383 L302 366 L320 368 L329 353 L345 357 L361 342 C352 400 312 431 256 421 Z','#748A56')+p('M270 415 L343 363',stroke='#B9BE82',w=2.5)),
    ('Back petals', p('M192 237 C151 219 150 178 171 158 C151 130 173 96 206 98 C221 66 264 65 281 92 C320 77 349 106 339 137 C373 158 366 200 340 213 C328 247 281 264 249 247 C227 260 204 252 192 237 Z','#CE8790')),
    ('Front petal folds', p('M182 164 C170 119 230 108 256 132 C282 100 328 117 326 153 C358 185 321 228 284 225 C258 256 205 237 200 209 C174 205 171 185 182 164 Z','#E6A3AA')+p('M182 164 C209 156 237 170 247 198 C231 207 212 211 200 209 M256 132 C273 153 280 183 265 206 M326 153 C301 153 278 170 265 206 C291 219 312 215 331 195',stroke='#A75D6E',w=2.7)),
    ('Inner petals', p('M220 159 C214 141 238 131 252 147 C273 132 296 148 285 170 C292 190 266 207 252 190 C230 196 215 180 220 159 Z','#CF7D8C')+p('M229 157 Q249 149 267 168 Q256 186 242 175 Q235 167 247 161',stroke='#975064',w=2.5)),
    ('Petal light', p('M187 130 Q211 112 232 126 M288 129 Q307 121 316 137 M207 221 Q230 238 251 227',stroke='#F4C2C4',w=4)),
    ('Closed bud', p('M344 269 C317 246 324 202 348 197 C373 196 389 240 363 266 Z','#D9909A')+p('M348 203 Q332 227 349 255 M351 214 L367 231',stroke='#AA6476',w=2.6)),
    ('Bud sepals', p('M342 269 L325 244 L344 251 L350 232 L360 250 L379 241 L363 269 Z','#6D8651',w=2.6)),
])

add('pinecone-open-scales', 'Pinecone with Open Scales', 'pinecone',
    'Woodland worksheets, winter craft arrangements and personal stationery.',
    'A brown pinecone with overlapping open scales, a short twig and two sprays of pine needles.', [
    ('Twig', p('M244 376 L256 443 L275 442 L265 369 Z','#8A6548')),
    ('Needle stems', p('M260 422 L112 350 M268 419 L390 318',stroke='#526E48',w=4)),
    ('Pine needles', ''.join(p(f'M{130+i*18} {358+i*9} L{107+i*20} {310+i*9} M{130+i*18} {358+i*9} L{101+i*20} {374+i*9}',stroke='#728E59',w=2.4) for i in range(6))+''.join(p(f'M{286+i*17} {403-i*14} L{287+i*20} {365-i*17} M{286+i*17} {403-i*14} L{322+i*18} {402-i*17}',stroke='#728E59',w=2.4) for i in range(5))),
    ('Cone silhouette', p('M251 73 C210 107 158 180 157 265 C156 339 205 389 257 390 C312 387 358 330 355 262 C351 175 297 100 268 76 Z','#71513B')),
    ('Back scale rows', ''.join(p(f'M{x} {y} Q{x-34} {y-12} {x-34} {y-42} Q{x} {y-50} {x+34} {y-42} Q{x+32} {y-12} {x} {y} Z','#A77A52' if (i+j)%2 else '#BA8A5D','#604932',2.5) for i,(y,n) in enumerate([(150,2),(183,3),(216,4),(249,4),(282,4),(315,4),(348,3),(378,2)]) for j in range(n) for x in [256+(j-(n-1)/2)*43])),
    ('Lower scales', p('M197 350 Q225 335 250 352 Q246 378 222 382 Q202 376 197 350 Z','#B5855C',w=2.5)+p('M250 353 Q280 336 310 348 Q306 375 282 385 Q259 379 250 353 Z','#9F704B',w=2.5)),
    ('Scale edge light', ''.join(p(f'M{x-23} {y-40} Q{x} {y-46} {x+23} {y-40}',stroke='#D6AC7B',w=2) for y,n in [(150,2),(183,3),(216,4),(249,4),(282,4),(315,4),(348,3),(378,2)] for j in range(n) for x in [256+(j-(n-1)/2)*43])),
])

add('acorns-twin-on-twig', 'Two Acorns on an Oak Twig', 'acorn',
    'Woodland labels, autumn crafts and personal nature journal decorations.',
    'Two warm brown acorns in textured caps attached to a forked twig, with one small lobed oak leaf.', [
    ('Forked twig', p('M268 90 Q242 154 206 186 M264 100 Q306 145 321 188',stroke='#796140',w=8)),
    ('Left nut', p('M133 230 C130 301 166 348 200 357 C242 336 260 289 252 228 Z','#BE8A51')),
    ('Left nut shadow', p('M218 232 Q246 300 200 357 C242 336 260 289 252 228 Z','#9A683C','none',0)),
    ('Right nut', p('M279 245 C270 312 297 374 329 391 C368 366 393 308 381 246 Z','#CDA26A')),
    ('Right nut shadow', p('M352 245 Q382 320 329 391 C368 366 393 308 381 246 Z','#AA7A48','none',0)),
    ('Acorn caps', p('M126 226 C123 197 153 173 193 172 C232 171 261 194 261 224 Q203 250 126 226 Z','#8B7951')+p('M272 244 C269 210 294 185 331 185 C369 185 394 209 390 243 Q337 266 272 244 Z','#8B7951')),
    ('Cap scale texture', ''.join(p(f'M{x-8} {y} L{x} {y+7} L{x+8} {y}',stroke='#BAA16E',w=2) for x,y in [(154,203),(179,191),(204,190),(230,201),(146,218),(174,214),(201,216),(229,217),(298,219),(324,205),(350,210),(372,222),(299,239),(326,231),(354,238)])),
    ('Nut highlights', p('M157 259 Q155 294 179 320 M301 278 Q296 316 313 342',stroke='#E2BC81',w=6)),
    ('Small oak leaf', p('M274 145 C249 137 235 122 248 112 C225 107 218 87 235 80 C220 61 241 48 256 59 C266 39 289 47 285 69 C307 58 323 77 305 90 C328 97 321 117 301 116 C308 135 292 147 274 145 Z','#90A364')+p('M274 143 L267 70 M270 100 L244 87 M272 122 L299 105',stroke='#596F43',w=2.4)),
])

add('holly-berries-three-leaves', 'Holly Sprig with Red Berries', 'holly',
    'Winter paper crafts, personal gift tags and seasonal stationery.',
    'Three glossy green spiny holly leaves around a cluster of five red berries.', [
    ('Branch', p('M257 288 Q252 361 230 430',stroke='#65714A',w=7)),
    ('Left leaf', p('M252 294 L204 293 L190 309 L171 279 L149 282 L146 253 L118 242 L136 215 L124 189 L155 190 L174 162 L194 187 L226 182 L226 213 L250 226 L238 250 L260 274 Z','#547B56')),
    ('Left leaf light', p('M252 294 L166 214 L124 189 L155 190 L174 162 L194 187 L226 182 L226 213 L250 226 L238 250 L260 274 Z','#729264','none',0)),
    ('Right leaf', p('M277 303 L284 272 L271 247 L301 234 L305 201 L334 210 L360 189 L369 218 L397 224 L381 250 L397 275 L365 283 L354 312 L329 297 L306 315 Z','#5D855A')),
    ('Top leaf', p('M255 262 L226 226 L208 218 L216 191 L198 170 L222 153 L216 124 L245 119 L260 93 L279 118 L309 122 L302 150 L323 171 L301 191 L306 216 L280 225 Z','#759363')),
    ('Leaf veins', p('M250 292 L158 214 M284 299 L372 237 M258 252 L261 128 M219 262 L213 236 M324 271 L332 240 M259 190 L284 164',stroke='#BAC391',w=2.6)),
    ('Red berry cluster', ''.join(c(x,y,r,col,'#70423A',2.5) for x,y,r,col in [(237,279,23,'#C26855'),(278,273,24,'#AF4B43'),(256,309,24,'#CA6552'),(303,308,22,'#BA5649'),(277,338,21,'#A84B43')])),
    ('Berry detail', ''.join(p(f'M{x-8} {y-9} L{x-3} {y-13}',stroke='#F0B09B',w=4)+c(x+5,y+7,2.3,'#75433C','none',0) for x,y in [(237,279),(278,273),(256,309),(303,308),(277,338)])),
])

add('winter-bells-linen-bow', 'Two Brass Bells with a Linen Bow', 'bell',
    'Personal gift tags, winter invitations and paper craft decorations.',
    'Two differently tilted brass handbells hanging beneath a cream linen bow with long ribbon tails.', [
    ('Ribbon tails', p('M244 158 L194 306 L226 296 L243 325 L269 173 Z','#D7C39A')+p('M270 159 L331 304 L341 273 L374 281 L295 147 Z','#E9DABC')),
    ('Left bell handle', p('M188 255 L192 204 Q204 191 217 204 L221 254 Z','#AD8D4F')+c(205,204,10,'#D8BD79',w=2.5)),
    ('Left bell shell', p('M189 247 C159 257 153 302 150 325 L129 351 Q178 386 235 360 L217 329 C220 297 220 261 208 251 Z','#C9A45B')),
    ('Left bell light', p('M175 267 Q164 292 165 320',stroke='#EDD898',w=8)),
    ('Left bell rim and clapper', e(182,352,56,16,'#8D7043',w=3,transform='rotate(5 182 352)')+c(183,362,10,'#B78D4D',w=2.5)),
    ('Right bell handle', p('M302 258 L286 218 Q294 204 307 211 L323 251 Z','#B79756')+c(297,217,10,'#E0C78B',w=2.5)),
    ('Right bell shell', p('M305 249 C278 266 285 303 290 329 L280 361 Q338 383 390 345 L364 322 C353 286 337 251 322 248 Z','#D9B873')),
    ('Right bell highlight', p('M316 270 Q337 278 347 306',stroke='#F5E0A5',w=8)),
    ('Right rim and clapper', e(335,353,56,16,'#9E7C47',w=3,transform='rotate(-9 335 353)')+c(338,363,10,'#BF9B5A',w=2.5)),
    ('Linen bow', p('M262 158 C220 112 164 111 164 151 C165 190 220 196 262 163 C310 191 367 175 354 138 C343 107 297 120 262 158 Z','#EDE0BE')+p('M182 147 Q219 145 252 159 M274 159 Q312 144 337 141',stroke='#C8B68D',w=3)+p('M249 145 Q264 139 278 148 L279 175 Q263 183 248 172 Z','#CDB78E',w=2.7)),
])

add('stocking-patchwork-cuff', 'Patchwork Christmas Stocking', 'stocking',
    'Personal holiday cards, classroom craft sheets and gift tag designs.',
    'A red patchwork stocking with a cream folded cuff, a green heel and visible sewn seams.', [
    ('Hanging loop', p('M194 127 C169 96 188 76 202 84 L217 112',stroke='#75906B',w=12)+p('M194 125 C176 102 189 91 199 92',stroke='#C2CFAC',w=3)),
    ('Stocking silhouette', p('M186 129 L331 133 L313 314 C346 307 393 312 404 342 C425 393 376 426 323 430 L206 421 C166 417 141 391 153 354 L178 280 Z','#B95B50')),
    ('Stocking side shade', p('M303 153 L331 133 L313 314 C348 307 393 312 404 342 Q416 366 403 386 C393 351 348 350 303 359 Q283 364 279 346 Z','#97483F','none',0)),
    ('Green heel', p('M166 326 C199 328 220 363 207 421 C170 418 142 391 153 354 Z','#82956A')),
    ('Toe patch', p('M362 318 C381 320 400 327 404 342 C424 393 377 423 343 427 Q352 375 362 318 Z','#D9BE8C')),
    ('Central fabric patches', p('M201 203 L258 209 L250 271 L193 261 Z','#CD8A68',w=2.4)+p('M251 276 L300 283 L291 333 L245 328 Z','#D1AD79',w=2.4)),
    ('Patch stitches', p('M209 210 L216 211 M227 212 L234 213 M245 214 L251 215 M202 250 L209 251 M220 253 L227 254 M258 285 L264 286 M276 288 L283 289 M254 318 L261 319 M273 321 L280 322',stroke='#F4DFC0',w=2.2)),
    ('Folded cuff', p('M174 118 Q251 109 342 129 L339 190 Q253 173 176 181 Z','#F1E4C9')+p('M183 165 Q254 158 330 175',stroke='#D3C6A5',w=3)),
    ('Cuff cable stitches', p('M206 127 L210 148 L203 164 M245 128 L248 149 L241 164 M286 133 L289 153 L282 168 M321 138 L323 156 L317 173',stroke='#C0B592',w=2.2)),
])

add('snowflake-six-branch-crystal', 'Six-Branch Snow Crystal', 'snowflake',
    'Winter worksheets, cut-paper guides and personal seasonal cards.',
    'A pale blue snowflake with exactly six radial branches, forked tips and a small hexagonal center.', [
    ('Six main crystal branches', ''.join(p('M256 256 L256 67',stroke='#85A8B3',w=16,transform=f'rotate({i*60} 256 256)') for i in range(6))),
    ('Inner branch pairs', ''.join(p('M256 183 L226 157 M256 183 L286 157',stroke='#85A8B3',w=12,transform=f'rotate({i*60} 256 256)') for i in range(6))),
    ('Outer branch pairs', ''.join(p('M256 119 L219 86 M256 119 L293 86',stroke='#85A8B3',w=12,transform=f'rotate({i*60} 256 256)') for i in range(6))),
    ('Main branch light', ''.join(p('M256 248 L256 68',stroke='#D0E5E9',w=6,transform=f'rotate({i*60} 256 256)') for i in range(6))),
    ('Fork highlights', ''.join(p('M256 183 L226 157 M256 183 L286 157 M256 119 L219 86 M256 119 L293 86',stroke='#C1DDE3',w=4,transform=f'rotate({i*60} 256 256)') for i in range(6))),
    ('Hexagonal center', p('M256 221 L286 238 L286 274 L256 291 L226 274 L226 238 Z','#B1CFD8','#779CAA',3)+p('M256 236 L273 246 L273 266 L256 276 L239 266 L239 246 Z','#DFEDF0','#779CAA',2)),
])

add('cocoa-enamel-mug', 'Cocoa in an Enamel Mug', 'cocoa',
    'Personal recipe cards, cozy reading posters and winter stationery.',
    'Sage enamel mug filled with cocoa and three marshmallows, with a cinnamon stick resting across the rim.', [
    ('Mug handle', p('M337 211 C424 184 445 300 369 325 L350 298 C400 286 391 232 348 244 Z','#9AAE9D')+p('M362 221 C407 212 426 281 374 305',stroke='#C5D0B6',w=6)),
    ('Enamel mug body', p('M133 188 L348 188 L338 353 Q332 394 249 397 Q163 395 150 356 Z','#8FA79A')),
    ('Enamel body shade', p('M313 196 L348 188 L338 353 Q332 394 249 397 Q317 378 313 327 Z','#6D8E81','none',0)),
    ('Mug rim', e(240,191,108,31,'#F0E9D6',w=4)),
    ('Cocoa surface', e(240,193,95,23,'#76503C','#A39378',2)),
    ('Marshmallows', p('M184 181 Q194 170 214 178 L220 193 Q210 204 191 198 Z','#FCF4DD','#C7B796',2)+p('M231 195 Q240 182 257 188 L263 202 Q249 214 235 207 Z','#FCF4DD','#C7B796',2)+p('M278 177 Q292 170 306 179 L305 195 Q290 202 278 192 Z','#FCF4DD','#C7B796',2)),
    ('Cinnamon stick', p('M181 205 L341 153 L350 173 L190 224 Z','#A4714C')+p('M190 211 L341 163',stroke='#D4A270',w=3)+e(346,163,6,10,'#8A573B',w=2,transform='rotate(-18 346 163)')),
    ('Steam curls', p('M194 139 C172 118 216 109 194 83 M266 129 C248 108 284 100 268 76',stroke='#B7B9A8',w=4)),
    ('Enamel highlight', p('M165 248 L170 314 M175 335 L178 345',stroke='#CDDAC4',w=8)),
    ('Mug foot', p('M173 378 Q250 408 324 380',stroke='#536F64',w=5)),
])

add('gingerbread-house-cookie', 'Iced Gingerbread House Cookie', 'gingerbread',
    'Personal baking labels, seasonal recipe cards and paper gift tags.',
    'A house-shaped gingerbread cookie decorated with white piped icing, a rounded door and two small windows.', [
    ('Cookie silhouette', p('M101 220 L242 83 Q254 72 266 84 L412 220 Q427 237 407 248 L383 251 L383 411 Q383 432 363 432 L148 432 Q128 432 128 412 L128 252 L105 249 Q86 240 101 220 Z','#B78251')),
    ('Baked edge', p('M140 251 L140 411 Q140 419 150 419 L363 419 Q371 419 371 410 L371 252',stroke='#96633E',w=4)),
    ('Roof icing', p('M117 233 L252 99 L397 235 M146 242 Q159 268 173 242 Q186 268 199 242 Q212 269 225 242 Q239 268 253 242 Q266 268 280 242 Q293 268 307 242 Q321 268 334 242 Q348 268 361 242',stroke='#FFF0CF',w=9)),
    ('Door icing', p('M221 419 L221 354 C219 314 286 312 286 354 L286 419',stroke='#FFF0CF',w=7)+c(272,365,4,'#F6D3A2','none',0)),
    ('Left window icing', p('M164 281 L202 281 L202 320 L164 320 Z M183 282 L183 318 M165 300 L200 300',stroke='#FFF0CF',w=5)),
    ('Right window icing', p('M310 281 L348 281 L348 320 L310 320 Z M329 282 L329 318 M312 300 L346 300',stroke='#FFF0CF',w=5)),
    ('Roof window', c(254,187,22,'#98633E','#FFF0CF',6)+p('M254 167 L254 207 M235 187 L274 187',stroke='#FFF0CF',w=4)),
    ('Icing dots', ''.join(c(x,y,4,'#FFF0CF','none',0) for x,y in [(159,354),(177,367),(164,386),(195,399),(320,366),(344,353),(338,390),(315,402)])),
])

add('winter-cable-knit-mittens', 'Pair of Cable-Knit Mittens', 'winter',
    'Winter clothing worksheets, personal cards and cozy classroom labels.',
    'Two teal knitted mittens with ribbed cuffs, raised cable patterns and a loose connecting cord.', [
    ('Connecting cord', p('M161 376 C96 427 157 465 244 431 C307 407 362 449 371 393',stroke='#B99064',w=5)),
    ('Left mitten', p('M131 332 L112 196 C101 130 167 92 200 137 C212 154 216 176 217 207 C251 163 282 202 253 241 L219 285 L225 326 Z','#729794')),
    ('Left mitten shade', p('M200 137 C212 154 216 176 217 207 C251 163 282 202 253 241 L219 285 L225 326 L206 328 Q199 288 208 256 Q222 224 240 213 C220 217 211 249 196 245 Q210 189 200 137 Z','#537B7B','none',0)),
    ('Left cable knit', p('M155 161 C180 180 143 193 168 213 C192 232 156 248 180 268 C200 284 172 303 190 319 M169 154 C144 178 181 190 156 212 C132 233 174 246 151 268 C133 286 170 303 154 323',stroke='#AAC4B7',w=4)),
    ('Left cuff', p('M126 328 L226 321 L233 374 L135 385 Z','#B3BDA2')+p('M143 335 L149 375 M161 334 L167 373 M179 333 L185 371 M197 332 L203 370 M215 330 L220 368',stroke='#7D9280',w=3)),
    ('Right mitten', p('M297 343 L278 280 L250 247 C227 212 262 188 284 218 L294 231 C285 180 302 131 337 132 C380 131 401 175 387 228 L362 350 Z','#84A9A2')),
    ('Right mitten shade', p('M362 144 Q398 177 381 232 L357 342 L339 344 Q365 268 366 217 Q375 171 362 144 Z','#638D88','none',0)),
    ('Right cable knit', p('M324 167 C350 189 312 206 338 225 C364 244 324 263 349 282 C368 297 336 320 350 340 M340 163 C314 185 350 205 325 226 C303 246 343 261 318 282 C298 301 334 317 321 338',stroke='#B8D0BF',w=4)),
    ('Right cuff', p('M294 340 L364 347 L357 398 L285 390 Z','#B7C1A7')+p('M304 351 L299 383 M320 353 L315 385 M337 355 L332 387 M353 357 L348 390',stroke='#809783',w=3)),
])

add('gift-kraft-parcel-twine', 'Kraft Parcel with Twine', 'gift',
    'Personal gift tags, parcel labels and celebration cards.',
    'A rectangular kraft-paper parcel tied with crossed twine and a loose bow, with a blank cream tag.', [
    ('Parcel front', p('M113 208 L330 231 L330 412 L113 383 Z','#BE9E78')),
    ('Parcel side', p('M330 231 L410 180 L408 354 L330 412 Z','#A58664')),
    ('Parcel top', p('M113 208 L194 152 L410 180 L330 231 Z','#D8BD94')),
    ('Paper folds', p('M114 210 L157 252 L157 379 M408 184 L370 231 L370 373 M118 378 L151 359 M334 403 L367 370',stroke='#9E805F',w=2.5)),
    ('Vertical twine', p('M220 221 L220 397 M220 221 L300 165',stroke='#6D6547',w=5)+p('M225 223 L225 396 M224 218 L305 166',stroke='#E4D7B2',w=2)),
    ('Horizontal twine', p('M113 286 L330 312 L409 261',stroke='#6D6547',w=5)+p('M113 290 L330 316 L409 265',stroke='#E4D7B2',w=2)),
    ('Twine bow', p('M260 195 C213 155 194 190 229 202 Q243 207 260 195 C307 157 327 188 292 202 Q276 207 260 195 M260 198 L239 236 M264 198 L294 224',stroke='#716549',w=4)),
    ('Tag string', p('M264 201 Q295 219 296 259',stroke='#786C4D',w=2.5)),
    ('Blank tag', p('M275 248 L311 248 L328 268 L328 324 L277 324 L277 267 Z','#F0E5C7',w=2.5)+c(301,261,4,'#B99E73',w=1.5)),
])

assert len(ART) == 21
