"""Run the isolated offline analytic/numerical feasibility experiment."""
from pathlib import Path
from datetime import datetime, timezone
import base64
import hashlib
import json
import platform
import shutil
import subprocess
import sys
import time

import numpy as np

import geometry as g
import reference as ref

ANGLES = (0, 30, 60, 90)
ROOT = Path(__file__).resolve().parent


def contact_sheet(output, frames):
    """Labelled SVG is portable; installed ffmpeg optionally labels the PNG too."""
    canvas = np.full((752, 1104), 16, dtype=np.uint8)
    labels = [(16, 20, 26, 'FIND THE VIEW | offline geometry spike'),
              (16, 62, 15, 'Synthetic analytic baseline - answers revealed - NOT clinical imaging'),
              (16, 120, 18, 'Contained distal tip'),
              (16, 410, 18, 'Breached distal tip'),
              (16, 720, 14, 'Same geometry, exposure mapping and scale across views. No per-image normalisation.')]
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1104" height="752" viewBox="0 0 1104 752">',
           '<rect width="1104" height="752" fill="#101010"/>']
    for col, angle in enumerate(ANGLES):
        labels.append((16 + col*272, 92, 16, f'Orbit {angle} deg'))
    for frame in frames:
        row = 0 if frame['state'] == 'contained' else 1
        col = ANGLES.index(frame['angle_deg'])
        x, y = 16 + col*272, 150 + row*290
        image = frame['_pixels']
        canvas[y:y+256, x:x+256] = image
        data = base64.b64encode((output/frame['png']).read_bytes()).decode()
        svg.append(f'<image x="{x}" y="{y}" width="256" height="256" href="data:image/png;base64,{data}"/>')
    for x, y, size, text in labels:
        svg.append(f'<text x="{x}" y="{y+size}" fill="#eaeaea" font-family="sans-serif" font-size="{size}">{text}</text>')
    svg.append('</svg>')
    (output/'contact-sheet.svg').write_text('\n'.join(svg))
    g.write_png(output/'contact-sheet-raw.png', canvas)
    ffmpeg = shutil.which('ffmpeg')
    font = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    if ffmpeg and font.exists():
        filters = ','.join(f"drawtext=fontfile='{font}':text='{text}':x={x}:y={y}:fontsize={size}:fontcolor=white" for x, y, size, text in labels)
        subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(output/'contact-sheet-raw.png'),
                        '-vf', filters, '-frames:v', '1', str(output/'contact-sheet.png')], check=True, timeout=30)
        return 'PNG text added by pre-existing ffmpeg; SVG always includes labels'
    shutil.copyfile(output/'contact-sheet-raw.png', output/'contact-sheet.png')
    return 'PNG unlabelled (row contained/breached, columns 0/30/60/90); use labelled SVG'


def run_experiment(output):
    started = time.perf_counter()
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    arrays, frames, analytic = {}, [], {}
    cameras = [g.Camera(angle) for angle in ANGLES]
    for state, tip in g.FIXTURE['tips_mm'].items():
        for camera in cameras:
            image = g.render_analytic(camera, tip)
            key = f'{state}_{camera.angle_deg:03d}'
            arrays[key] = image['total']
            arrays[key+'_wire'] = image['wire']
            analytic[(state, camera.angle_deg)] = image
            pixels = g.display_pixels(image['total'])
            filename = key + '.png'
            g.write_png(output/filename, pixels)
            frames.append({'key': key, 'state': state, 'angle_deg': camera.angle_deg,
                           'png': filename, 'tip_uv_px': g.project_points(camera, np.array([tip]))[0].tolist(),
                           '_pixels': pixels})
    png_label_method = contact_sheet(output, frames)
    for frame in frames:
        del frame['_pixels']
    points = np.array([[-6., -9., 11.], [4., 8., -12.], [7., -4., 3.], [-2., 12., -7.]])
    geometry_checks = []
    for angle in (-35, 0, 30, 60, 90, 180):
        camera = g.Camera(angle)
        discrepancy = float(np.max(np.linalg.norm(g.project_points(camera, points)-ref.project_by_plane_solve(camera, points), axis=1)))
        errors = ref.fiducial_errors(camera, points, 1.1)
        geometry_checks.append({'angle_deg': angle, 'point_oracle_max_error_px': discrepancy,
                                'raster_sphere_centroid_errors_px': errors})
    truth = {state: ref.tip_status(tip, g.FIXTURE['wire_radius_mm'], g.FIXTURE['inner_radius_mm'],
                                  g.FIXTURE['outer_radius_mm'], g.FIXTURE['half_length_mm'])
             for state, tip in g.FIXTURE['tips_mm'].items()}
    tip_pair = np.array(list(g.FIXTURE['tips_mm'].values()))
    tip_separation = {str(angle): float(np.linalg.norm(np.diff(g.project_points(g.Camera(angle), tip_pair), axis=0))) for angle in ANGLES}
    image0 = analytic[('contained', 0)]
    image1 = analytic[('breached', 0)]
    support = (image0['wire'] > .01) | (image1['wire'] > .01)
    difference = np.abs(g.display_pixels(image0['total']).astype(float)-g.display_pixels(image1['total']).astype(float))
    initial_difference = {'wire_support_pixels': int(support.sum()),
                          'wire_roi_mae_8bit': float(difference[support].mean()),
                          'whole_image_mae_8bit': float(difference.mean()),
                          'max_difference_8bit': float(difference.max()),
                          'note': 'Descriptive only. Not a perceptual equivalence test; wire brightness/foreshortening can differ.'}
    numerical_checks = []
    for state, tip in g.FIXTURE['tips_mm'].items():
        for name, spacing, step in [('coarse', .5, .5), ('fine', .25, .125)]:
            volume = g.make_volume(tip, spacing)
            for angle in (0, 90):
                camera = g.Camera(angle)
                sample = g.render_sampled(camera, volume, step)
                exact = analytic[(state, angle)]['total']
                region = exact > .01
                error = np.abs(sample-exact)
                key = f'{state}_{angle:03d}_{name}'
                arrays[key] = sample
                g.write_png(output/(key+'.png'), g.display_pixels(sample))
                numerical_checks.append({'state': state, 'angle_deg': angle, 'grid': name,
                                         'spacing_mm': spacing, 'ray_step_max_mm': step,
                                         'roi_mae_line_integral': float(error[region].mean()),
                                         'roi_p95_abs_error': float(np.quantile(error[region], .95)),
                                         'whole_image_mae': float(error.mean()),
                                         'all_finite': bool(np.isfinite(sample).all())})
            del volume
    coarse = [x['roi_mae_line_integral'] for x in numerical_checks if x['grid'] == 'coarse']
    fine = [x['roi_mae_line_integral'] for x in numerical_checks if x['grid'] == 'fine']
    refinement_pass = bool(np.mean(fine) < np.mean(coarse) and all(x['all_finite'] for x in numerical_checks))
    max_oracle = max(x['point_oracle_max_error_px'] for x in geometry_checks)
    max_centroid = max(max(x['raster_sphere_centroid_errors_px']) for x in geometry_checks)
    # Conservative first-90-degree clearance against the most magnified point
    # anywhere on the outer cylinder, not just a centre-plane silhouette.
    camera = g.Camera(90)
    generous_silhouette_u = camera.size/2-.5 + camera.sdd/(camera.sod-g.FIXTURE['outer_radius_mm'])*g.FIXTURE['outer_radius_mm']/camera.pixel_mm
    radius_px_bound = camera.sdd/(camera.sod-g.FIXTURE['outer_radius_mm'])*g.FIXTURE['wire_radius_mm']/camera.pixel_mm
    breached_u = g.project_points(camera, np.array([g.FIXTURE['tips_mm']['breached']]))[0, 0]
    breach_margin = float(breached_u-radius_px_bound-generous_silhouette_u)
    gates = {
        'geometry': bool(max_oracle < 1e-6 and max_centroid < 1),
        'analytic_truth': truth['contained']['classification'] == 'contained' and truth['breached']['classification'] == 'breached',
        'initial_tip_separation_under_one_pixel': tip_separation['0'] < 1,
        'decisive_breach_margin_over_three_pixels': breach_margin > 3,
        'sampling_refinement': refinement_pass,
        'human_perceptual_ambiguity': 'NOT TESTED',
        'sampled_image_tip_boundary_localisation': 'NOT TESTED',
        'upstream_renderer_integration': 'NOT TESTED',
    }
    manifest = {'units': 'mm', 'world': 'right handed; cylinder +Z',
                'orbit': 'degrees; positive rotation about +Z; 0° source -Y, 90° source +X',
                'image': 'u right, v down; array[row=v,col=u]; integer coordinates at pixel centres',
                'display_mapping': 'round(255 * (1 - exp(-line_integral)))',
                'physics': 'idealised monoenergetic piecewise-constant attenuation; wire replaces shell in overlap; no noise/scatter',
                'fixture': g.FIXTURE, 'cameras': [camera.metadata() for camera in cameras],
                'fiducial_centres_mm': points.tolist(), 'fiducial_radius_mm': 1.1,
                'volume_layout': 'nodal X,Y,Z density grid, trilinear interpolation, midpoint quadrature',
                'source_sha256': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'geometry.py', ROOT/'reference.py', ROOT/'run.py']}}
    np.savez_compressed(output/'raw.npz', **arrays)
    (output/'geometry.json').write_text(json.dumps(manifest, indent=2)+'\n')
    result = {'verdict': 'PARTIAL', 'generated_utc': datetime.now(timezone.utc).isoformat(),
              'runtime': {'python': platform.python_version(), 'numpy': np.__version__, 'executable': sys.executable},
              'upstream_renderers_executed': [], 'learner_validated': False,
              'frames': frames, 'truth': truth, 'geometry_checks': geometry_checks,
              'tip_separation_px': tip_separation, 'initial_image_difference': initial_difference,
              'breached_tip_90deg_margin_lower_bound_px': breach_margin,
              'numerical_checks': numerical_checks,
              'mean_coarse_roi_error': float(np.mean(coarse)), 'mean_fine_roi_error': float(np.mean(fine)),
              'gates': gates, 'png_label_method': png_label_method,
              'elapsed_seconds': time.perf_counter()-started}
    (output/'results.json').write_text(json.dumps(result, indent=2)+'\n')
    lines = [
        '# Offline projection-geometry result', '', '**Verdict: PARTIAL.**', '',
        'This is an executed analytic NumPy baseline, not a nanodrr, DiffDRR or DeepDRR test.',
        'No patient data, network access, package installs or application UI are used.', '',
        '## Measured result', '',
        f"- Initial projected distal-centre separation: **{tip_separation['0']:.4f} px**.",
        f"- At 90°: **{tip_separation['90']:.4f} px**.",
        f'- Conservative breached-tip edge clearance beyond an overbounding cylinder silhouette: **{breach_margin:.4f} px**.',
        f'- Independent point projection maximum discrepancy: **{max_oracle:.3g} px**.',
        f'- Rasterised asymmetric sphere centroid maximum discrepancy: **{max_centroid:.4f} px**.',
        f"- Initial-image mean absolute difference inside combined wire support: **{initial_difference['wire_roi_mae_8bit']:.3f}/255**; maximum difference **{initial_difference['max_difference_8bit']:.0f}/255**.",
        f'- Mean numerical line-integral ROI error: coarse **{np.mean(coarse):.6f}**, fine **{np.mean(fine):.6f}**.', '',
        'The first images are not pixel-identical. Close tip locations do not prove perceptual ambiguity.',
        'Wire obliquity changes projected thickness/path length; no post-hoc image normalisation is applied.', '',
        '## Gates', '', '| Check | Observed result |', '|---|---|',
        *[f'| {key} | {value} |' for key, value in gates.items()], '',
        '## Interpretation and limits', '',
        '- Truth uses conservative bounding spheres around the distal end cap; reported clearances are lower bounds, not exact oblique-cap surface distances.',
        '- Wire has flat end caps and constant radius. The fixture is not a bone, surgical trajectory or device.',
        '- Material coefficients are illustrative; no soft tissue, scatter, spectrum, detector response, noise or metal artefacts.',
        '- Analytic cylinder intersections are compared with independently constructed nodal-density volumes and numerical ray integration. Shared scene parameters remain intentional.',
        '- The numeric gate only establishes improving mean attenuation error; it does NOT establish one-pixel tip localisation, topology preservation everywhere or perceptual invariance.',
        '- The geometry gate covers camera projection and a separate sphere rasterizer, not end-to-end validation of the analytic cylinder renderer.',
        '- Sampled/analytic comparisons share the ray generator and cover 0°/90° only. They do not independently validate all oblique views or shell replacement.',
        '- Cardinal direction tests supplement point-oracle agreement because both formulations consume the same camera metadata.',
        '- Upstream integration, a learner-facing interaction and learner validation remain untested.',
        '- No claim that 90° is always the best clinical view or that two projections prove safety.', '',
        '## Artefacts', '',
        '- `contact-sheet.svg`: labelled, self-contained sheet; answers intentionally revealed.',
        '- `contact-sheet.png`: PNG copy; see label method below.',
        '- `<state>_<angle>.png`: eight exact analytic baseline images.',
        '- `*_coarse.png`, `*_fine.png`: numerical approximation images at 0° and 90°.',
        '- `raw.npz`: raw line integrals, wire-only reference channels and sampled arrays.',
        '- `geometry.json`: fixture/cameras/display mapping/fiducials/source hashes.',
        '- `results.json`: full measured evidence, versions and gates.', '',
        f'PNG label method: {png_label_method}.', '',
        f'Elapsed: {result["elapsed_seconds"]:.2f}s. Python {platform.python_version()}, NumPy {np.__version__}.',
    ]
    (output/'report.md').write_text('\n'.join(lines)+'\n')
    return result


if __name__ == '__main__':
    result = run_experiment(ROOT/'outputs')
    print(json.dumps({key: result[key] for key in ['verdict', 'gates', 'tip_separation_px', 'initial_image_difference', 'breached_tip_90deg_margin_lower_bound_px', 'mean_coarse_roi_error', 'mean_fine_roi_error', 'elapsed_seconds']}, indent=2))
    print('Outputs:', ROOT/'outputs')
