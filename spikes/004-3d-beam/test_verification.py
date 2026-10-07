"""Integration acceptance test: executes the real JS/Python comparison."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

HERE = Path(__file__).resolve().parent

class NumericVerification(unittest.TestCase):
    def test_experiment_passes_all_predeclared_gates(self):
        run = subprocess.run([sys.executable, '-B', str(HERE / 'verify.py')], capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stdout + run.stderr)
        report = json.loads((HERE / 'results/report.json').read_text())
        self.assertEqual(len(report['reference']), 6)
        self.assertEqual(len(report['transformed']), 3)
        self.assertTrue(all(report['gates'].values()), report['gates'])
        self.assertLess(report['fiducial_max_pixel_error'], 1e-9)
        self.assertLess(report['sphere_centroid_max_pixel_error'], .3)
        for item in report['reference']:
            self.assertLess(item['max_abs_integral_error'], 1e-7)
            self.assertEqual(item['pixel_mismatches'], 0)
        for item in report['transformed']:
            self.assertLess(item['fine_mae'], .002)
            self.assertLess(item['fine_mae'], item['coarse_mae'])
            self.assertGreater(item['wire_pixels'], 0)

if __name__ == '__main__':
    unittest.main()
