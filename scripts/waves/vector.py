"""Small SVG vocabulary for explicitly composed original vector illustrations."""
import html

INK = '#394337'

def el(tag, **attrs):
    return '<' + tag + ' ' + ' '.join(f'{k.replace("_", "-")}="{html.escape(str(v), quote=True)}"' for k, v in attrs.items()) + '/>'

def p(d, fill='none', stroke=INK, w=3.5, **attrs):
    return el('path', d=d, fill=fill, stroke=stroke, stroke_width=w, **attrs)

def e(x, y, rx, ry, fill, stroke=INK, w=3.5, **attrs):
    return el('ellipse', cx=x, cy=y, rx=rx, ry=ry, fill=fill, stroke=stroke, stroke_width=w, **attrs)

def c(x, y, r, fill, stroke=INK, w=3.5, **attrs):
    return el('circle', cx=x, cy=y, r=r, fill=fill, stroke=stroke, stroke_width=w, **attrs)

def layer(label, body):
    return f'<g id="{label.lower().replace(" ", "-")}" data-label="{html.escape(label)}">{body}</g>'

def svg(art_id, title, layers):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-labelledby="{art_id}-title" stroke-linecap="round" stroke-linejoin="round"><title id="{art_id}-title">{html.escape(title)}</title>{"".join(layer(label, body) for label, body in layers)}</svg>'
