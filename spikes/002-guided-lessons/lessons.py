"""Bounded authored lessons, reusing the read-only spike001 analytic renderer."""
from pathlib import Path
import base64
import hashlib
import html
import json
import os
import platform
import sys
import numpy as np

# Do not create bytecode in the read-only source spike.
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent
BASE = ROOT.parent / '001-projection-geometry'
sys.path.insert(0, str(BASE))
import geometry as g
import reference as ref

ANGLES = [0, 30, 45, 60, 90, 135]
CASES = [
    dict(id='c1', title='Look again',
         brief='Inspect the starting projection. Which additional view would clarify the distal end?',
         initialAngles=[0], tip=[0,15,18],
         revealTitle='Depth hidden in the starting view',
         takeaway='The distal cap is beyond the outer wall in this synthetic fixture. Its overlap at 0° hides that depth; rotating the acquisition exposes lateral separation.'),
    dict(id='c2', title='A second look at two views',
         brief='Two perpendicular projections are already available. Choose a different angle before making your judgement.',
         initialAngles=[0,90], tip=[10,10,18],
         revealTitle='Two overlaps can conceal a diagonal breach',
         takeaway='The distal cap lies beyond the outer wall despite overlapping its side silhouette at both 0° and 90°. At 45° the cap separates from that silhouette. Two overlapping projections do not prove containment.'),
    dict(id='c3', title='Test your interpretation',
         brief='Use another projection to test your interpretation of the distal region, then compare your judgement with the geometry.',
         initialAngles=[0], tip=[0,7,18],
         revealTitle='A contained counterexample',
         takeaway='The distal cap is inside the lumen by a finite-thickness geometric bound. Its projected overlap alone is not proof: the revealed geometry supplies the truth for this authored case.'),
]
FIDUCIALS = np.array([[-6.,-9.,11.], [4.,8.,-12.], [7.,-4.,3.], [-2.,12.,-7.]])


def truth_bounds(tip):
    f = g.FIXTURE
    return ref.tip_status(tip, f['wire_radius_mm'], f['inner_radius_mm'],
                          f['outer_radius_mm'], f['half_length_mm'])


def projection_evidence(camera, tip):
    """Enclose the cap by a sphere then a camera-aligned box, never a point tip.

    Exact perspective ratios over the enclosing box give interval bounds.
    Infinite cylinder tangent rays bound the side silhouette exactly; an
    inscribed vertical strip excludes finite-cylinder end-cap ambiguities.
    'overlap' means the entire cap bound is inside the projected outer outline,
    NOT that the cap is contained in the 3D lumen (or in projected shell pixels).
    """
    r, R, H = (g.FIXTURE[k] for k in ('wire_radius_mm','outer_radius_mm','half_length_mm'))
    delta = np.asarray(tip) - camera.source
    x, z, depth = delta @ camera.right, delta @ camera.up, delta @ camera.forward
    if depth <= r:
        raise ValueError('distal cap must be wholly in front of the source plane')
    scale = camera.sdd / camera.pixel_mm
    centre = camera.size/2-.5
    def interval(n):
        corners = [scale*a/b for a in (n-r,n+r) for b in (depth-r,depth+r)]
        return min(corners), max(corners)
    xlo, xhi = interval(x)
    zlo, zhi = interval(z)
    side = scale*R / np.sqrt(camera.sod**2-R**2)
    inside = min(side-xhi, xlo+side)
    outside = max(xlo-side, -side-xhi)
    end_margin = scale*H/(camera.sod+R) - max(abs(zlo),abs(zhi))
    evidence = 'borderline'
    if end_margin > 0:
        if outside > 0:
            evidence = 'beyond'
        elif inside > 0:
            evidence = 'overlap'
    return dict(evidence=evidence,
                cap_uv_bounds_px=[[centre+xlo,centre-zhi],[centre+xhi,centre-zlo]],
                side_silhouette_u_px=[centre-side,centre+side],
                overlap_margin_lower_bound_px=float(inside),
                beyond_margin_lower_bound_px=float(outside),
                end_exclusion_margin_lower_bound_px=float(end_margin),
                region='flat distal cap enclosed by radius-0.65-mm sphere; bounds are sufficient, not exact cap extrema')


def independent_project(angle, points, size=256, pixel_mm=.5, sod=800., sdd=1200.):
    """Separate homogeneous camera built from literal world-axis rotation.

    Does not consume Camera.source/right/up/forward or renderer projection.
    Its metadata parameters are intentionally the same acquisition parameters.
    """
    a = np.deg2rad(angle)
    rotation = np.array([[np.cos(a),-np.sin(a),0], [np.sin(a),np.cos(a),0], [0,0,1]])
    # Rotate world points back to the zero-degree camera: x right, y depth, z up.
    local = np.asarray(points) @ rotation
    depth = local[:,1]+sod
    factor = sdd/pixel_mm/depth
    return np.column_stack([size/2-.5+local[:,0]*factor, size/2-.5-local[:,2]*factor])


def camera_checks():
    checks = []
    for angle in ANGLES:
        camera = g.Camera(angle)
        uv = g.project_points(camera, FIDUCIALS)
        checks.append(dict(angle=angle,
            plane_solve_max_error_px=float(np.max(np.linalg.norm(uv-ref.project_by_plane_solve(camera,FIDUCIALS),axis=1))),
            independent_camera_max_error_px=float(np.max(np.linalg.norm(uv-independent_project(angle,FIDUCIALS),axis=1))),
            fiducial_centroid_errors_px=ref.fiducial_errors(camera,FIDUCIALS,1.1)))
    return checks


def raster_check(camera, tip, image, background):
    """Actual exported 8-bit contrast vs no-wire control, including distal 1 mm.

    Detector 2x and 4x sampling checks measure pixel-area integration changes,
    not volumetric renderer validation or perceptual recognition.
    """
    tip = np.asarray(tip, float)
    direction = tip - np.asarray(g.FIXTURE['wire_start_mm'])
    direction /= np.linalg.norm(direction)
    rays, distances = g.ray_bundle(camera)
    interval = g.cylinder_intervals(camera.source,rays,tip-direction,tip,
                                    g.FIXTURE['wire_radius_mm'],distances)
    distal = g.interval_length(*interval) > 1e-6
    pixels = g.display_pixels(image['total'])
    difference = pixels.astype(int)-g.display_pixels(background).astype(int)
    visible = distal & (difference >= 5)
    silhouette = projection_evidence(camera,tip)['side_silhouette_u_px']
    cols = np.indices(distal.shape)[1]
    outside = (cols < silhouette[0]) | (cols > silhouette[1])
    support = image['wire'] > 1e-6
    roi = support.copy()
    for axis in (0,1):
        roi |= np.roll(support,1,axis) | np.roll(support,-1,axis)
    sampled = []
    for factor in (2,4):
        c = g.Camera(camera.angle_deg,size=camera.size*factor,pixel_mm=camera.pixel_mm/factor)
        total = g.render_analytic(c,tip)['total']
        # Average transmission/8-bit response, not attenuation, for pixel-area comparison.
        response = 255*(1-np.exp(-total))
        sampled.append(response.reshape(camera.size,factor,camera.size,factor).mean(axis=(1,3)))
    refined2, refined4 = sampled
    return dict(distal_visible_pixels_delta_ge_5=int(visible.sum()),
                distal_peak_delta_8bit=int(difference[distal].max()) if distal.any() else 0,
                distal_visible_pixels_outside_side_silhouette=int((visible & outside).sum()),
                distal_wire_support_pixels=int(distal.sum()),
                base_roi_mae_vs4_8bit=float(np.abs(pixels-refined4)[roi].mean()),
                refined2_roi_mae_vs4_8bit=float(np.abs(refined2-refined4)[roi].mean()),
                roi_pixels=int(roi.sum())), refined2, refined4


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write_json(path, obj):
    Path(path).write_text(json.dumps(obj,indent=2,allow_nan=False)+'\n')


def contact_sheet(path, cases, assets):
    lines = ['<svg xmlns="http://www.w3.org/2000/svg" width="1650" height="990" viewBox="0 0 1650 990">',
             '<rect width="1650" height="990" fill="#101010"/>',
             '<g fill="#eeeeee" font-family="sans-serif">',
             '<text x="16" y="26" font-size="20">Guided lessons | synthetic analytic baseline | ANSWERS REVEALED | not clinical imaging</text>']
    for row, case in enumerate(cases):
        y = 70+row*300
        label = f"{case['id']}: {case['truth']} — {case['revealTitle']}"
        lines.append(f'<text x="16" y="{y-12}" font-size="16">{html.escape(label)}</text>')
        for col, frame in enumerate(case['frames']):
            x = 16+col*272
            encoded = base64.b64encode((assets/Path(frame['image']).name).read_bytes()).decode()
            lines.append(f'<image x="{x}" y="{y}" width="256" height="256" href="data:image/png;base64,{encoded}"/>')
            label = f"{frame['angle']}° | cap: {frame['evidence']}"
            lines.append(f'<text x="{x}" y="{y+277}" font-size="14">{label}</text>')
    lines.append('<text x="16" y="982" font-size="14">One fixed attenuation mapping. Overlap is projected geometry, not proof of 3D containment or learner perception.</text></g></svg>')
    path.write_text('\n'.join(lines)+'\n')


def generate(assets, evidence):
    assets, evidence = Path(assets), Path(evidence)
    assets.mkdir(parents=True,exist_ok=True)
    evidence.mkdir(parents=True,exist_ok=True)
    sources = {name:sha(BASE/name) for name in ('geometry.py','reference.py','run.py')}
    arrays, cases = {}, []
    checks = camera_checks()
    geometry = dict(fixture=g.FIXTURE,cameras=[g.Camera(a).metadata() for a in ANGLES])
    provenance = dict(source_directory='spikes/001-projection-geometry',source_sha256=sources,
                      generator_sha256=sha(__file__), tests_sha256=sha(ROOT/'test_lessons.py'))
    metadata = dict(**geometry, **provenance, units='mm',
        world='right handed; cylinder +Z; positive orbit about +Z; 0° source -Y, image +X/+Z',
        image='array[row=v,col=u]; u right, v down; integer coordinates are pixel centres',
        display_mapping='round(255 * (1 - exp(-line_integral)))',
        physics='idealised monoenergetic attenuation; wire replaces shell in overlap; no noise/scatter',
        authored_tips_mm={c['id']:c['tip'] for c in CASES},
        fiducial_centres_mm=FIDUCIALS.tolist(),fiducial_radius_mm=1.1,
        evidence_definition='Conservative finite distal cap projection against the outer-cylinder side silhouette; overlap never proves 3D containment.',
        raw_convention='cN-AAA_total/shell/wire/background: line integrals; _pixels: delivered uint8; _refined2/4: downsampled floating 8-bit detector response')
    for authored in CASES:
        case = dict(authored)
        case['truthBounds'] = truth_bounds(case['tip'])
        case['truth'] = case['truthBounds']['classification']
        case['frames'] = []
        for angle in ANGLES:
            camera = g.Camera(angle)
            key = f"{case['id']}-{angle:03d}"
            image = g.render_analytic(camera,case['tip'])
            background = g.render_analytic(camera,case['tip'],include_wire=False)['total']
            pixels = g.display_pixels(image['total'])
            g.write_png(assets/(key+'.png'),pixels)
            raster, refined2, refined4 = raster_check(camera,case['tip'],image,background)
            arrays.update({key+'_'+name:value for name,value in image.items()})
            arrays.update({key+'_background':background,key+'_pixels':pixels,
                           key+'_refined2':refined2,key+'_refined4':refined4})
            case['frames'].append(dict(angle=angle,image=f'assets/v2/{key}.png',raw_key=key,
                tip_uv_px=g.project_points(camera,[case['tip']])[0].tolist(),
                sha256=sha(assets/(key+'.png')),raster=raster,
                **projection_evidence(camera,case['tip'])))
        cases.append(case)
    np.savez_compressed(evidence/'raw.npz',**arrays)
    write_json(evidence/'geometry.json',metadata)
    manifest = dict(schemaVersion=2,geometry=geometry,angles=ANGLES,cases=cases,
                    provenance={**provenance,'raw_sha256':sha(evidence/'raw.npz'),
                                'geometry_sha256':sha(evidence/'geometry.json')})
    write_json(assets/'lesson.json',manifest)
    contact_sheet(evidence/'contact-sheet.svg',cases,assets)
    frames = [f for c in cases for f in c['frames']]
    diagonal = {f['angle']:f for f in cases[1]['frames']}
    gates = dict(
        finite_thickness_truth=[c['truth'] for c in cases]==['breached','breached','contained'],
        diagonal_cardinal_overlap=all(diagonal[a]['evidence']=='overlap' and diagonal[a]['overlap_margin_lower_bound_px']>3 for a in (0,90)),
        diagonal_45_separation=diagonal[45]['evidence']=='beyond' and diagonal[45]['beyond_margin_lower_bound_px']>3,
        independent_camera=max(c['independent_camera_max_error_px'] for c in checks)<1e-8,
        plane_solve=max(c['plane_solve_max_error_px'] for c in checks)<1e-8,
        asymmetric_raster_fiducials=max(max(c['fiducial_centroid_errors_px']) for c in checks)<.3,
        distal_raster_visibility=all(f['raster']['distal_visible_pixels_delta_ge_5']>2 and f['raster']['distal_peak_delta_8bit']>10 for f in frames),
        diagonal_45_raster_separation=diagonal[45]['raster']['distal_visible_pixels_outside_side_silhouette']>2,
        detector_sampling_refinement=all(f['raster']['refined2_roi_mae_vs4_8bit']<f['raster']['base_roi_mae_vs4_8bit'] for f in frames))
    common = Path(os.path.commonpath([assets,evidence]))
    artifacts = [assets/'lesson.json',*sorted(assets.glob('c?-*.png')),
                 evidence/'raw.npz',evidence/'geometry.json',evidence/'contact-sheet.svg']
    result = dict(verdict='GEOMETRY AND RASTER GATES PASS' if all(gates.values()) else 'GATE FAILURE',
        gates=gates,source_sha256=sources,provenance=provenance,
        runtime=dict(python=platform.python_version(),numpy=np.__version__,executable=sys.executable),
        artifact_hash_base=str(common),artifact_sha256={str(p.relative_to(common)):sha(p) for p in artifacts},
        camera_checks=checks,truth={c['id']:c['truthBounds'] for c in cases},
        frames={c['id']:c['frames'] for c in cases},
        limits=['No learner/perceptual validation or clinical guarantee.',
                'Analytic spike001 primitive renderer; no upstream DRR integration.',
                'Overlap of conservative cap bounds with projected outer outline is not containment.',
                'Refinement checks detector-area sampling, not volumetric numerical convergence or tip localisation.',
                'Raw point-sampled images are delivered unchanged; supersampling is verification only.',
                'Hashes bind artifacts and source, not scientific correctness. results.json excludes its own hash.'])
    write_json(evidence/'results.json',result)
    if not all(gates.values()):
        raise AssertionError(json.dumps(gates,indent=2))
    return result


if __name__ == '__main__':
    result = generate(ROOT.parents[1]/'demo/assets/v2',ROOT/'outputs')
    print(json.dumps({k:result[k] for k in ('verdict','gates','truth','runtime')},indent=2))
    for case, frames in result['frames'].items():
        for f in frames:
            print(case,f['angle'],f['evidence'], 'inside/beyond bounds px',
                  round(f['overlap_margin_lower_bound_px'],4),round(f['beyond_margin_lower_bound_px'],4),
                  'raster',f['raster'])
