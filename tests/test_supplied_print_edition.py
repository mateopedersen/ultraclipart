"""Prevent a cached native-source proof from masking a changed print edition."""
import copy, hashlib, importlib.util, sys, tempfile, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('supplied',ROOT/'scripts/verify-supplied-package.py')
supplied=importlib.util.module_from_spec(spec);spec.loader.exec_module(supplied)

class PrintEditionCache(unittest.TestCase):
    def test_recipe_and_actual_print_bytes_are_part_of_cache_identity(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder).resolve();source=root/'print-source/example.webp'
            source.parent.mkdir();source.write_bytes(b'reviewed print-source fixture')
            digest=hashlib.sha256(source.read_bytes()).hexdigest()
            record=dict(printSource='print-source/example.webp',printSourceSha256=digest,
                        printMaxPixels=850,printDimensions=[850,750],printResampling='Pillow LANCZOS',
                        pdfExport=dict(sourceWebpSha256=digest))
            binding=supplied.print_edition_binding(root,record)
            for key,value in [('printMaxPixels',750),('printDimensions',[750,662]),('printResampling','other')]:
                changed=copy.deepcopy(record);changed[key]=value
                self.assertNotEqual(binding,supplied.print_edition_binding(root,changed))
            changed=copy.deepcopy(record);changed['pdfExport']['sourceWebpSha256']='0'*64
            with self.assertRaisesRegex(AssertionError,'different print source'):
                supplied.print_edition_binding(root,changed)
            source.write_bytes(b'replaced print pixels')
            with self.assertRaisesRegex(AssertionError,'changed after export'):
                supplied.print_edition_binding(root,record)

    def test_originals_have_no_print_exception_and_paths_cannot_escape(self):
        self.assertIsNone(supplied.print_edition_binding(Path('/tmp'),None))
        self.assertIsNone(supplied.print_edition_binding(Path('/tmp'),{}))
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(AssertionError,'escapes'):
                supplied.print_edition_binding(Path(folder).resolve(),{'printSource':'../elsewhere.webp'})

if __name__=='__main__':unittest.main()
