"""Inspect actual CMYK image data without assigning an invented print profile."""
import hashlib,io,struct,zlib
from PIL import Image,ImageCms

def decoded_alpha(mask):
    """Decode PNG-predicted PDF masks using Pillow's independent native decoder.
    Only the container changes in memory; the exact compressed IDAT is reused.
    This avoids Python-level per-pixel prediction in large validation batches.
    """
    params=mask.get('/DecodeParms',{})
    if hasattr(params,'get_object'):params=params.get_object()
    if mask.get('/Filter')=='/FlateDecode' and params.get('/Predictor')==15:
        w,h=int(mask['/Width']),int(mask['/Height'])
        assert 0<w<=4096 and 0<h<=4096 and mask['/BitsPerComponent']==8 and mask['/ColorSpace']=='/DeviceGray'
        assert params.get('/Colors',1)==1 and params.get('/BitsPerComponent',8)==8 and params.get('/Columns')==w
        def chunk(kind,data):
            return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
        png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,0,0,0,0))+chunk(b'IDAT',mask._data)+chunk(b'IEND',b'')
        with Image.open(io.BytesIO(png)) as image:
            image.load();assert image.mode=='L' and image.size==(w,h)
            return image.tobytes()
    return mask.get_data()

def inspect_cmyk_image(image,width,height):
    assert image['/Width']==width and image['/Height']==height
    assert image['/BitsPerComponent']==8
    if '/SMask' in image:
        mask=image['/SMask'].get_object()
        assert mask['/Width']==width and mask['/Height']==height and mask['/ColorSpace']=='/DeviceGray' and mask['/BitsPerComponent']==8
        assert len(decoded_alpha(mask))==width*height
    cs=image['/ColorSpace'];data=image.get_data()
    base={'width':width,'height':height,'components':4,'alphaMask':bool(image.get('/SMask'))}
    filters=image.get('/Filter');filters=filters if isinstance(filters,list) else [filters]
    if any(f in ['/DCTDecode','/JPXDecode'] for f in filters):
        with Image.open(io.BytesIO(data)) as decoded:
            decoded.load();assert decoded.mode=='CMYK' and decoded.size==(width,height)
    else:
        assert len(data)==width*height*4, 'Image data must have four actual color components'
    if cs=='/DeviceCMYK':
        assert image.get('/Filter')=='/DCTDecode', 'Unprofiled source must contain independently decodable CMYK JPEG data'
        with Image.open(io.BytesIO(data)) as decoded:
            decoded.load();assert decoded.mode=='CMYK' and decoded.size==(width,height)
        base.update(profile='Device CMYK (unprofiled)',colorSpace='Device CMYK',iccBytes=0,iccSha256=None)
    else:
        assert isinstance(cs,list) and cs[0]=='/ICCBased'
        icc=cs[1].get_object();profile=icc.get_data()
        assert icc['/N']==4 and profile[16:20]==b'CMYK'
        base.update(profile=ImageCms.getProfileDescription(ImageCms.ImageCmsProfile(io.BytesIO(profile))).strip(),colorSpace='ICC-based CMYK',iccBytes=len(profile),iccSha256=hashlib.sha256(profile).hexdigest())
    return base
