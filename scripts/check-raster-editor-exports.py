"""Independently verify exported CMYK images and screen-render their placement."""
import argparse,hashlib,json,os,shutil,subprocess
from pathlib import Path
from PIL import Image,ImageChops,ImageStat,ImageDraw,ImageFont
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
def images(reader):
    found=[];seen=set()
    def visit(resources):
        for ref in resources.get('/XObject',{}).values():
            obj=ref.get_object()
            if id(obj) in seen:continue
            seen.add(id(obj))
            if obj.get('/Subtype')=='/Form':visit(obj.get('/Resources',{}))
            elif obj.get('/Subtype')=='/Image':found.append(obj)
    for page in reader.pages:visit(page['/Resources'])
    return found
def signature(obj):
    cs=obj['/ColorSpace'];assert cs[0]=='/ICCBased'
    profile=cs[1].get_object();assert profile['/N']==4 and profile.get_data()[16:20]==b'CMYK'
    mask=obj['/SMask'].get_object() if '/SMask' in obj else None
    return {'width':obj['/Width'],'height':obj['/Height'],'imageSha256':hashlib.sha256(obj.get_data()).hexdigest(),'iccSha256':hashlib.sha256(profile.get_data()).hexdigest(),'alphaSha256':hashlib.sha256(mask.get_data()).hexdigest() if mask else None}
def main():
    cli=argparse.ArgumentParser();cli.add_argument('directory');args=cli.parse_args();folder=Path(args.directory)
    binary=os.environ.get('PDFTOPPM_BIN') or shutil.which('pdftoppm');assert binary
    art={a['id']:a for a in json.loads((ROOT/'data/art.json').read_text())};rows=[]
    for pdf in sorted(folder.glob('*-edited.pdf')):
        art_id=pdf.name.removesuffix('-edited.pdf');original=ROOT/'public'/art[art_id]['pdf'].lstrip('/')
        reader=PdfReader(pdf);assert len(reader.pages)==1 and pdf.stat().st_size<=1_000_000
        source=[signature(i) for i in images(PdfReader(original))];output=[signature(i) for i in images(reader)]
        assert output==source, f'Source image, alpha mask or embedded profile changed: {art_id}'
        project=json.loads((folder/f'{art_id}-project.json').read_text());crop=project['crop'] or project
        page=reader.pages[0];w,h=map(float,(page.mediabox.width,page.mediabox.height));margin=project['print']['margin']*72
        scale=min((w-2*margin)/crop['width'],(h-2*margin)/crop['height'])
        cw,ch=crop['width']*scale,crop['height']*scale;x,y=(w-cw)/2,(h-ch)/2
        dest=folder/f'{art_id}-proof'
        subprocess.run([binary,'-f','1','-singlefile','-r','144','-png',str(pdf),str(dest)],check=True,capture_output=True)
        image=Image.open(dest.with_suffix('.png')).convert('RGB');proof=image.crop(tuple(round(n*2)for n in [x,y,x+cw,y+ch])).resize((320,round(320*ch/cw)))
        web=Image.open(folder/f'{art_id}-edited.webp').convert('RGBA');background=Image.new('RGBA',web.size,'white');background.alpha_composite(web);web=background.convert('RGB').resize(proof.size)
        error=sum(ImageStat.Stat(ImageChops.difference(web,proof)).mean)/3
        assert error<18,f'PDF/WebP positioning or rendering differs: {art_id}: {error}'
        rows.append({'id':art_id,'status':'PASS','bytes':pdf.stat().st_size,'originalImageProfileAlphaPreserved':True,'image':output[0],'pdfWebpMeanDifference':round(error,4)})
    assert rows
    for offset in range(0,len(rows),10):
        sheet=Image.new('RGB',(1250,650),'#f2f3ef');draw=ImageDraw.Draw(sheet);font=ImageFont.load_default(size=12)
        for n,row in enumerate(rows[offset:offset+10]):
            image=Image.open(folder/f'{row["id"]}-proof.png').convert('RGB');image.thumbnail((240,294));x=n%5*250;y=n//5*325
            sheet.paste(image,(x+(250-image.width)//2,y));draw.text((x+6,y+300),f'{offset+n+1:02} edited CMYK PDF',font=font,fill='#263b3a')
        sheet.save(folder/f'proof-contact-{offset//10+1}.png')
    report={'status':'PASS','pdfs':len(rows),'maxPdfBytes':max(r['bytes']for r in rows),'sourceImageAndProfileUnchanged':True,'maxMeanRenderDifference':max(r['pdfWebpMeanDifference']for r in rows),'rows':rows}
    (folder/'preflight.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items()if k!='rows'}))
if __name__=='__main__':main()
