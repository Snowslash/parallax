"""Read-back integration tests for real generated outputs (run export-evidence first)."""
import hashlib
import json
from pathlib import Path
import struct
import unittest
import zlib
import numpy as np

class ExportReadback(unittest.TestCase):
    def test_every_exported_frame_is_lossless_and_matches_its_fixed_configuration(self):
        out=Path(__file__).resolve().parent/'outputs'
        report=json.loads((out/'numerical-report.json').read_text())
        self.assertEqual(len(report['frames']),10)
        for frame in report['frames']:
            with self.subTest(frame=frame['prefix']):
                config=json.loads((out/(frame['prefix']+'.json')).read_text())
                size=config['size']
                self.assertEqual(config['FOV_MM'],320)
                self.assertEqual(config['camera']['pixelMm'],320/size)
                self.assertEqual(config['MU_SHELL'],.04)
                self.assertEqual(config['MU_CORE'],.008)
                self.assertEqual(config['invalidCount'],0)
                arrays={}
                for key in ('outer','core','shell','attenuation'):
                    entry=config['files'][key]
                    raw=(out/entry['file']).read_bytes()
                    self.assertEqual(hashlib.sha256(raw).hexdigest(),entry['sha256'])
                    self.assertEqual(len(raw),size*size*8)
                    arrays[key]=np.frombuffer(raw,dtype='<f8')
                    self.assertTrue(np.isfinite(arrays[key]).all())
                    self.assertTrue((arrays[key]>=0).all())
                np.testing.assert_allclose(arrays['shell'],arrays['outer']-arrays['core'],atol=0,rtol=0)
                np.testing.assert_allclose(arrays['attenuation'],.04*arrays['shell']+.008*arrays['core'],atol=0,rtol=0)
                entry=config['files']['image']
                png=(out/entry['file']).read_bytes()
                self.assertEqual(hashlib.sha256(png).hexdigest(),entry['sha256'])
                self.assertEqual(png[:8],b'\x89PNG\r\n\x1a\n')
                offset=8
                chunks=[]
                while offset<len(png):
                    n=struct.unpack_from('>I',png,offset)[0]
                    kind=png[offset+4:offset+8]
                    data=png[offset+8:offset+8+n]
                    crc=struct.unpack_from('>I',png,offset+8+n)[0]
                    self.assertEqual(zlib.crc32(kind+data),crc)
                    if kind==b'IDAT':
                        chunks.append(data)
                    offset+=12+n
                decoded=np.frombuffer(zlib.decompress(b''.join(chunks)),dtype=np.uint8).reshape(size,1+size*4)
                self.assertTrue((decoded[:,0]==0).all())
                pixels=decoded[:,1:].reshape(size*size,4)
                expected=np.floor(255*(1-np.exp(-arrays['attenuation']))+.5).astype(np.uint8)
                for channel in range(3):
                    np.testing.assert_array_equal(pixels[:,channel],expected)
                self.assertTrue((pixels[:,3]==255).all())
if __name__=='__main__':
    unittest.main()
