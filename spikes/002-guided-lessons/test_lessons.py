"""Small geometry tests and medium offline export integration tests (no network)."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import numpy as np

ROOT = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('lessons', ROOT / 'lessons.py')
lesson = None
if (ROOT / 'lessons.py').exists():
    lesson = importlib.util.module_from_spec(SPEC)
    SPEC.loader.exec_module(lesson)


class GeometryTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(lesson, 'guided lesson generator is not implemented')

    def test_authored_cases_and_finite_thickness_truth(self):
        self.assertEqual(lesson.ANGLES, [0, 30, 45, 60, 90, 135])
        self.assertEqual([c['tip'] for c in lesson.CASES], [[0,15,18],[10,10,18],[0,7,18]])
        for c, expected in zip(lesson.CASES, ['breached','breached','contained']):
            b = lesson.truth_bounds(c['tip'])
            self.assertEqual(b['classification'], expected)
            self.assertTrue(b['away_from_ends'])
            margin = b['sidewall_breach_lower_bound_mm'] if expected == 'breached' else b['lumen_clearance_lower_bound_mm']
            self.assertGreater(margin, 1)
            self.assertNotIn(expected, (c['title'] + c['brief']).lower())
        self.assertEqual(lesson.CASES[1]['initialAngles'], [0,90])
        self.assertEqual(lesson.truth_bounds([10,0,18])['classification'], 'indeterminate')
        self.assertEqual(lesson.truth_bounds([0,0,30])['classification'], 'indeterminate')

    def test_diagonal_full_cap_bounds_overlap_cardinals_beyond_45(self):
        for angle in (0,90):
            b = lesson.projection_evidence(lesson.g.Camera(angle), [10,10,18])
            self.assertEqual(b['evidence'], 'overlap')
            self.assertGreater(b['overlap_margin_lower_bound_px'], 3)
        b = lesson.projection_evidence(lesson.g.Camera(45), [10,10,18])
        self.assertEqual(b['evidence'], 'beyond')
        self.assertGreater(b['beyond_margin_lower_bound_px'], 3)
        self.assertEqual(lesson.projection_evidence(lesson.g.Camera(0), [12,0,18])['evidence'], 'borderline')

    def test_cap_bounds_enclose_actual_oblique_cap(self):
        for case in lesson.CASES:
            tip = np.array(case['tip'], float)
            axis = tip - np.array([0,0,-18])
            axis /= np.linalg.norm(axis)
            e1 = np.cross(axis, [1,0,0]); e1 /= np.linalg.norm(e1)
            e2 = np.cross(axis, e1)
            theta = np.linspace(0, 2*np.pi, 1025)
            cap = tip + .65*(np.cos(theta)[:,None]*e1 + np.sin(theta)[:,None]*e2)
            for angle in lesson.ANGLES:
                camera = lesson.g.Camera(angle)
                b = lesson.projection_evidence(camera, tip)
                uv = lesson.g.project_points(camera, cap)
                self.assertTrue(np.all(uv >= np.array(b['cap_uv_bounds_px'])[0]-1e-10))
                self.assertTrue(np.all(uv <= np.array(b['cap_uv_bounds_px'])[1]+1e-10))

    def test_independent_oracle_and_asymmetric_new_angle_rasters(self):
        checks = lesson.camera_checks()
        self.assertEqual([c['angle'] for c in checks], lesson.ANGLES)
        for c in checks:
            self.assertLess(c['plane_solve_max_error_px'], 1e-8)
            self.assertLess(c['independent_camera_max_error_px'], 1e-8)
            self.assertLess(max(c['fiducial_centroid_errors_px']), .3)
        # Literal cardinal expectations guard shared convention errors.
        c0 = lesson.g.Camera(0)
        np.testing.assert_allclose(c0.source, [0,-800,0])
        np.testing.assert_allclose(lesson.g.project_points(c0, [[5,0,7]])[0], [142.5,106.5])
        c90 = lesson.g.Camera(90)
        np.testing.assert_allclose(c90.source, [800,0,0], atol=1e-10)
        np.testing.assert_allclose(lesson.g.project_points(c90, [[0,5,7]])[0], [142.5,106.5])


class ExportTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(lesson, 'guided lesson generator is not implemented')

    def test_real_export_hashes_raw_mapping_visibility_and_refinement(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as temporary:
            out = Path(temporary)
            result = lesson.generate(out/'assets', out/'evidence')
            manifest = json.loads((out/'assets/lesson.json').read_text())
            self.assertEqual(len(manifest['geometry']['cameras']), 6)
            self.assertEqual(len(list((out/'assets').glob('*.png'))), 18)
            self.assertEqual(len(manifest['cases']), 3)
            arrays = np.load(out/'evidence/raw.npz')
            for case in manifest['cases']:
                self.assertEqual([f['angle'] for f in case['frames']], lesson.ANGLES)
                for frame in case['frames']:
                    self.assertEqual(frame['image'], f"assets/v2/{case['id']}-{frame['angle']:03d}.png")
                    png = out/'assets'/Path(frame['image']).name
                    self.assertEqual(frame['sha256'], hashlib.sha256(png.read_bytes()).hexdigest())
                    key = frame['raw_key']
                    raw = arrays[key+'_total']
                    np.testing.assert_array_equal(arrays[key+'_pixels'], lesson.g.display_pixels(raw))
                    # Re-encode the actual raw array: proves the delivered PNG uses the fixed map.
                    lesson.g.write_png(out/'check.png', lesson.g.display_pixels(raw))
                    self.assertEqual(png.read_bytes(), (out/'check.png').read_bytes())
                    self.assertTrue(np.isfinite(raw).all())
                    self.assertGreater(frame['raster']['distal_visible_pixels_delta_ge_5'], 2)
                    self.assertGreater(frame['raster']['distal_peak_delta_8bit'], 10)
                    self.assertLess(frame['raster']['refined2_roi_mae_vs4_8bit'], frame['raster']['base_roi_mae_vs4_8bit'])
            c2f45 = manifest['cases'][1]['frames'][2]
            self.assertGreater(c2f45['raster']['distal_visible_pixels_outside_side_silhouette'], 2)
            for relative, digest in result['artifact_sha256'].items():
                self.assertEqual(hashlib.sha256((out/relative).read_bytes()).hexdigest(), digest)
            for filename, digest in result['source_sha256'].items():
                self.assertEqual(hashlib.sha256((lesson.BASE/filename).read_bytes()).hexdigest(), digest)
            self.assertIn('geometry.py', result['source_sha256'])
            self.assertIn('reference.py', result['source_sha256'])
            self.assertIn('run.py', result['source_sha256'])
            self.assertTrue((out/'evidence/contact-sheet.svg').exists())
            self.assertTrue(all(result['gates'].values()))


if __name__ == '__main__':
    unittest.main()
