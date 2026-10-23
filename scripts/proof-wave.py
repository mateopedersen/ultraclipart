#!/usr/bin/env python3
"""Render each real CMYK PDF through Poppler, then assemble a screen proof.

This is a screen proof, not an approval from a print shop or a physical proof.
"""
import argparse, hashlib, json, os, shutil, subprocess
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
def main():
    cli = argparse.ArgumentParser()
    cli.add_argument('--wave', default='wave_001', choices=[p.stem for p in (ROOT/'scripts/waves').glob('wave_[0-9][0-9][0-9].py')])
    args = cli.parse_args(); stage = ROOT/'work/production'/args.wave
    report = json.loads((stage/'report.json').read_text()); rows = report['artworks']
    binary = os.environ.get('PDFTOPPM_BIN') or shutil.which('pdftoppm')
    if not binary: raise RuntimeError('Set PDFTOPPM_BIN to the Poppler pdftoppm executable')
    profile = ROOT/'public/color/print.icc'
    sheet = Image.new('RGB', (1000, ((len(rows)+3)//4)*300), '#F5F2E9')
    draw = ImageDraw.Draw(sheet); font = ImageFont.load_default(size=13); results = []
    for i, row in enumerate(rows):
        source = ROOT / row['files']['pdf']['path']
        assert hashlib.sha256(source.read_bytes()).hexdigest() == row['files']['pdf']['sha256']
        dest = stage / f'{row["id"]}-pdf-proof'
        subprocess.run([binary,'-f','1','-singlefile','-r','144','-defaultcmykprofile',str(profile),'-png',str(source),str(dest)],check=True,capture_output=True)
        with Image.open(dest.with_suffix('.png')) as proof:
            rgb=proof.convert('RGB'); difference=ImageChops.difference(rgb,Image.new('RGB',rgb.size,'white'))
            box=difference.getbbox(); assert box, 'PDF screen render is blank'
            assert min(box)>0 and box[2]<rgb.width and box[3]<rgb.height, 'PDF clips page edge'
            tile=rgb.crop(box); tile.thumbnail((226,252))
            x,y=i%4*250,i//4*300
            sheet.paste(tile,(x+(250-tile.width)//2,y+(258-tile.height)//2))
            draw.text((x+10,y+268),f'{i+1:02d} {row["title"][:31]}',font=font,fill='#394337')
            results.append({'id':row['id'],'sourcePdfSha256':row['files']['pdf']['sha256'],'renderPixels':list(rgb.size),'nonWhiteBounds':list(box),'profile':'GRACoL2006_Coated1v2','screenProofOnly':True})
    sheet.save(stage/'pdf-contact-sheet.png')
    (stage/'pdf-proofs.json').write_text(json.dumps({'pdfsRendered':len(results),'rows':results,'physicalPrintProof':False},indent=2)+'\n')
    print(f'Rendered {len(results)} actual CMYK PDF pages with the documented source print profile.')
if __name__=='__main__': main()
