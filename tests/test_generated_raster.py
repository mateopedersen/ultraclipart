"""Independent format adversaries for generated four-channel image PDFs."""
import importlib.util, io, sys, unittest
from pathlib import Path
from PIL import Image
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from raster_source import inspect_cmyk_image, decoded_alpha
spec=importlib.util.spec_from_file_location('producer',ROOT/'scripts/produce-raster-wave.py')
producer=importlib.util.module_from_spec(spec);spec.loader.exec_module(producer)

class GeneratedRasterContract(unittest.TestCase):
    def test_resume_survives_an_unrelated_deferred_item(self):
        plan={'wave':'wave_999','topic':'winter','method':'builtin-image-generation','research':'research.json','maxPdfBytes':980000,'minimumJpxQualityDb':48,'maximumWeightedCmykRmse':1.8,'items':[{'id':'one'},{'id':'two'}]}
        item={'id':'one','title':'Original title','source':'source.png'}
        before=producer.export_signature(plan,item,b'encoder-profile-research')
        plan['items']=[{'id':'one'}];plan['deferred']=[{'id':'two','reason':'quality gate'}]
        self.assertEqual(before,producer.export_signature(plan,item,b'encoder-profile-research'))
        for key,value in [('maxPdfBytes',970000),('minimumJpxQualityDb',50),('maximumWeightedCmykRmse',1.5),('research','different.json')]:
            self.assertNotEqual(before,producer.export_signature({**plan,key:value},item,b'encoder-profile-research'))
        self.assertNotEqual(before,producer.export_signature(plan,{**item,'title':'Changed title'},b'encoder-profile-research'))
        self.assertNotEqual(before,producer.export_signature(plan,item,b'changed-encoder-profile-research'))
    def test_near_opaque_native_alpha_is_preserved_without_normalizing(self):
        alpha=Image.new('L',(3,1));alpha.putdata([0,127,254]);before=alpha.tobytes()
        producer.validate_native_alpha(alpha)
        self.assertEqual(alpha.tobytes(),before)
        for values in ([1,127,254],[0,120,249],[0,0,0]):
            alpha.putdata(values)
            with self.assertRaises(AssertionError):producer.validate_native_alpha(alpha)
    def fixture(self,mode='CMYK',size=(31,27)):
        out=io.BytesIO();Image.new(mode,size,tuple([83]*len(mode))).save(out,'JPEG2000',irreversible=False)
        alpha=Image.new('L',(31,27));alpha.putdata([(i*37)%256 for i in range(31*27)])
        body=producer.pdf_bytes(out.getvalue(),alpha,'Format verification')
        reader=PdfReader(io.BytesIO(body),strict=True)
        image=reader.pages[0]['/Resources']['/XObject']['/Artwork'].get_object()
        return reader,image,alpha
    def test_actual_cmyk_and_exact_multilevel_alpha(self):
        reader,image,alpha=self.fixture()
        self.assertEqual(reader.pdf_header,'%PDF-1.7')
        info=inspect_cmyk_image(image,31,27,reader.trailer['/Root']['/OutputIntents'])
        self.assertEqual(info['components'],4)
        self.assertEqual(info['registeredCondition'],'CGATS TR 006')
        self.assertEqual(info['iccBytes'],0)
        self.assertEqual(decoded_alpha(image['/SMask'].get_object()),alpha.tobytes())
    def test_rgb_relabelled_device_cmyk_is_rejected(self):
        _,image,_=self.fixture('RGB')
        with self.assertRaises(AssertionError):inspect_cmyk_image(image,31,27)
    def test_wrong_encoded_dimensions_are_rejected(self):
        _,image,_=self.fixture(size=(30,27))
        with self.assertRaises(AssertionError):inspect_cmyk_image(image,31,27)
    def test_missing_output_condition_never_invents_a_profile(self):
        _,image,_=self.fixture()
        self.assertEqual(inspect_cmyk_image(image,31,27)['profile'],'Device CMYK (unprofiled)')

if __name__=='__main__':unittest.main()
