"""Small deterministic geometry/renderer tests; no network or optional DRR libraries."""
import importlib
import tempfile
import unittest
from pathlib import Path

import numpy as np

try:
    g = importlib.import_module("geometry")
    ref = importlib.import_module("reference")
except ModuleNotFoundError:
    g = ref = None


class GeometryTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(g, "geometry implementation does not exist yet")
        self.assertIsNotNone(ref, "independent reference does not exist yet")

    def test_zero_view_known_pixel_positions(self):
        camera = g.Camera(0)
        points = np.array([[0, 0, 0], [10, 0, 0], [0, 0, 10], [10, -400, 0]])
        expected = np.array([[127.5, 127.5], [157.5, 127.5], [127.5, 97.5], [187.5, 127.5]])
        np.testing.assert_allclose(g.project_points(camera, points), expected, atol=1e-10)

    def test_positive_orbit_exposes_positive_y_to_image_right(self):
        camera = g.Camera(90)
        np.testing.assert_allclose(camera.source, [800, 0, 0], atol=1e-10)
        actual = g.project_points(camera, np.array([[0, 10, 0], [0, 0, 10]]))
        np.testing.assert_allclose(actual, [[157.5, 127.5], [127.5, 97.5]], atol=1e-10)

    def test_independent_plane_intersection_matches_oblique_projection(self):
        points = np.array([[-7, -5, 9], [3, 11, -4], [8, -12, 15], [1, 4, 2]])
        for angle in [-35, 0, 30, 60, 90, 180]:
            camera = g.Camera(angle)
            np.testing.assert_allclose(g.project_points(camera, points), ref.project_by_plane_solve(camera, points), atol=1e-9)

    def test_detector_pixel_centres_roundtrip(self):
        camera = g.Camera(33, size=16)
        directions, distances = g.ray_bundle(camera)
        points = camera.source + directions.reshape(-1, 3) * distances.reshape(-1, 1)
        uv = g.project_points(camera, points).reshape(16, 16, 2)
        rows, cols = np.indices((16, 16))
        np.testing.assert_allclose(uv[:, :, 0], cols, atol=1e-9)
        np.testing.assert_allclose(uv[:, :, 1], rows, atol=1e-9)

    def test_finite_cylinder_chords_miss_tangent_and_parallel(self):
        starts = np.array([[0, -10, 0], [3, -10, 0], [2, -10, 0], [0, 0, -10], [3, 0, -10]])
        directions = np.array([[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 0, 1]])
        lo, hi = g.cylinder_intervals(starts, directions, [0, 0, -5], [0, 0, 5], 2, 30)
        np.testing.assert_allclose(g.interval_length(lo, hi), [4, 0, 0, 10, 0], atol=1e-9)

    def test_oblique_cylinder_axis_ray_hits_both_flat_caps(self):
        a = np.array([1., 2., 3.]); b = np.array([4., 6., 3.])
        direction = (b - a) / 5
        lo, hi = g.cylinder_intervals(a - direction * 10, direction, a, b, 1, 30)
        self.assertAlmostEqual(float(g.interval_length(lo, hi)), 5)

    def test_shell_central_ray_has_two_walls(self):
        camera = g.Camera(0, size=1)
        image = g.render_analytic(camera, g.FIXTURE['tips_mm']['contained'], include_wire=False)
        self.assertAlmostEqual(float(image['total'][0, 0]), .32)

    def test_tip_truth_accounts_for_radius_and_wall_contact(self):
        self.assertEqual(ref.tip_status([0, 7, 18], .65, 10, 12, 30)['classification'], 'contained')
        self.assertEqual(ref.tip_status([0, 15, 18], .65, 10, 12, 30)['classification'], 'breached')
        self.assertEqual(ref.tip_status([0, 11.7, 18], .65, 10, 12, 30)['classification'], 'indeterminate')
        self.assertEqual(ref.tip_status([0, 15, 30], .65, 10, 12, 30)['classification'], 'indeterminate')

    def test_separate_sphere_rasterizer_matches_plane_solve_fiducials(self):
        points = np.array([[-6, -9, 11], [4, 8, -12], [7, -4, 3]])
        for angle in [0, 30, 90, 180]:
            camera = g.Camera(angle)
            errors = ref.fiducial_errors(camera, points, radius_mm=1.1)
            self.assertLess(max(errors), .25)

    def test_pair_has_close_initial_tips_but_separated_quarter_turn_tips(self):
        tips = np.array(list(g.FIXTURE['tips_mm'].values()))
        initial = g.project_points(g.Camera(0), tips)
        quarter = g.project_points(g.Camera(90), tips)
        self.assertLess(float(np.linalg.norm(initial[0] - initial[1])), 1)
        self.assertGreater(float(np.linalg.norm(quarter[0] - quarter[1])), 15)

    def test_nodal_grid_rejects_spacing_that_would_distort_world_coordinates(self):
        with self.assertRaisesRegex(ValueError, 'divide.*extents'):
            g.make_volume(g.FIXTURE['tips_mm']['breached'], spacing_mm=.3)

    def test_numerical_volume_matches_analytic_away_from_boundaries(self):
        tip = g.FIXTURE['tips_mm']['breached']
        camera = g.Camera(0, size=9, pixel_mm=2)
        volume = g.make_volume(tip, spacing_mm=.5)
        sampled = g.render_sampled(camera, volume, step_mm=.25)
        analytic = g.render_analytic(camera, tip)['total']
        self.assertLess(float(np.mean(np.abs(sampled - analytic))), .12)
        self.assertTrue(np.isfinite(sampled).all())

    def test_png_writer_emits_actual_png(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'test.png'
            g.write_png(path, np.zeros((3, 4), dtype=np.uint8))
            data = path.read_bytes()
            self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n')
            self.assertTrue(data.endswith(b'IEND\xaeB`\x82'))


if __name__ == '__main__':
    unittest.main()
