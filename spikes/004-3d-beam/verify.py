"""Offline cross-language and independent occupancy verification; NumPy only.

Reference equality reuses old analytic code. Transformed-camera checks do NOT:
rotation matrices, plane solves and direct volume occupancy quadrature are
independent of JS chord intersection and its camera construction.
"""
import hashlib
import json
import platform
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE.parent / '001-projection-geometry'))
import geometry as legacy
import reference

OUT = HERE / 'results'
ANGLES = [0, 30, 45, 60, 90, 135]
POSES = [dict(orbit=17.3, tilt=23.7, x=3.2, y=-7.1, z=2.6),
         dict(orbit=113.65, tilt=-36.2, x=-4.7, y=8.3, z=-3.1),
         dict(orbit=257.15, tilt=51.4, x=5.9, y=-2.4, z=6.7)]
FIDUCIALS = [[-9,-11,-13], [8,14,7], [3,-16,19], [-7,6,15], [12,-3,-8]]


def independent_camera(pose, size):
    t, f = np.deg2rad([pose['orbit'], pose['tilt']])
    rz = np.array([[np.cos(t),-np.sin(t),0],[np.sin(t),np.cos(t),0],[0,0,1]])
    rx = np.array([[1,0,0],[0,np.cos(f),-np.sin(f)],[0,np.sin(f),np.cos(f)]])
    rotation = rz @ rx
    pivot = np.array([pose['x'],pose['y'],pose['z']])
    return SimpleNamespace(source=pivot + rotation @ [0,-800,0],
                           centre=pivot + rotation @ [0,400,0],
                           right=rotation[:,0], forward=rotation[:,1], up=rotation[:,2],
                           size=size, pixel_mm=128/size, sdd=1200)


def occupancy_integral(camera, step):
    """Midpoint quadrature of exact binary volume occupancy, no chord solver.

    Bound sample interval by a 45mm origin-centred sphere's axial slab: the
    entire fixture fits inside this sphere. Only quadrature resolution changes.
    No JS ray/camera metadata feeds this independent rendering.
    """
    row, col = np.indices((camera.size,camera.size))
    targets = (camera.centre + (col[...,None]+.5-camera.size/2)*camera.pixel_mm*camera.right
               - (row[...,None]+.5-camera.size/2)*camera.pixel_mm*camera.up)
    rays = (targets-camera.source).reshape(-1,3)
    distance = np.linalg.norm(rays,axis=1)
    rays /= distance[:,None]
    centre_t = -rays @ camera.source
    count = int(np.ceil(90/step))
    offsets = -45 + (np.arange(count)+.5)*(90/count)
    output = {key:np.zeros(len(rays)) for key in ['total','shell','wire']}
    start = np.array([0.,0.,-18.])
    axis = np.array([0.,15.,36.]); length=np.linalg.norm(axis); axis/=length
    for lo in range(0,len(rays),64):
        ray = rays[lo:lo+64]
        ts = centre_t[lo:lo+64,None]+offsets
        p = camera.source + ts[...,None]*ray[:,None,:]
        within = (ts>=0)&(ts<=distance[lo:lo+64,None])
        radial = p[...,0]**2+p[...,1]**2
        shell = (radial<=144)&(radial>=100)&(np.abs(p[...,2])<=30)&within
        q=p-start; axial=q@axis
        radial_wire = np.sum(np.cross(q,axis)**2,axis=-1)
        wire = (axial>=0)&(axial<=length)&(radial_wire<=.65**2)&within
        sh=.08*(shell&~wire).sum(axis=1)*(90/count)
        w=.6*wire.sum(axis=1)*(90/count)
        output['shell'][lo:lo+64]=sh; output['wire'][lo:lo+64]=w; output['total'][lo:lo+64]=sh+w
    return output


def main():
    OUT.mkdir(exist_ok=True)
    cases = [dict(id=f'ref-{a}',pose=dict(orbit=a),size=256) for a in ANGLES]
    cases += [dict(id=f'pose-{i}',pose=p,size=64) for i,p in enumerate(POSES)]
    request = dict(cases=cases,fiducials=FIDUCIALS)
    (OUT/'request.json').write_text(json.dumps(request,indent=2)+'\n')
    subprocess.run(['node',str(HERE/'export.mjs')],input=json.dumps(request),text=True,check=True)
    meta=json.loads((OUT/'js-metadata.json').read_text())
    report=dict(python=platform.python_version(),numpy=np.__version__,node=meta['node'],
                reference=[],transformed=[],fiducial_max_pixel_error=0.,sphere_centroid_max_pixel_error=0.)
    camera_error=0.
    for record in meta['records']:
        id=record['id']; size=record['size']
        raw={key:np.fromfile(OUT/f'{id}-{key}.f64',dtype='<f8') for key in ['total','shell','wire']}
        camera=independent_camera(record['pose'],size)
        for key in ['source','centre','right','up','forward']:
            camera_error=max(camera_error,float(np.max(np.abs(getattr(camera,key)-record['camera'][key]))))
        solved=reference.project_by_plane_solve(camera,FIDUCIALS)
        error=float(np.max(np.abs(solved-record['fiducialPixels'])))
        report['fiducial_max_pixel_error']=max(report['fiducial_max_pixel_error'],error)
        # Raster spheres at 256px, even for the coarse occupancy comparisons.
        sphere_camera=independent_camera(record['pose'],256)
        centroid=max(reference.fiducial_errors(sphere_camera,FIDUCIALS,1.2))
        report['sphere_centroid_max_pixel_error']=max(report['sphere_centroid_max_pixel_error'],centroid)
        if id.startswith('ref'):
            expected=legacy.render_analytic(legacy.Camera(record['pose']['orbit']),[0,15,18])
            np.savez_compressed(OUT/f'{id}-numpy.npz',**expected)
            max_error=max(float(np.max(np.abs(raw[key]-expected[key].ravel()))) for key in raw)
            rgba=np.fromfile(OUT/f'{id}.rgba',np.uint8).reshape(-1,4)
            mismatch=int(np.count_nonzero(rgba[:,0]!=legacy.display_pixels(expected['total']).ravel()))
            report['reference'].append(dict(angle=record['pose']['orbit'],max_abs_integral_error=max_error,pixel_mismatches=mismatch,node_ms=record['nodeMs']))
        else:
            errors=[]
            for step in [.4,.1,.025]:
                numeric=occupancy_integral(camera,step)
                np.savez_compressed(OUT/f'{id}-occupancy-{step}.npz',**numeric)
                error=np.abs(numeric['total']-raw['total'])
                errors.append(dict(step_mm=step,mae=float(error.mean()),max_abs=float(error.max()),
                                   shell_mae=float(np.abs(numeric['shell']-raw['shell']).mean()),
                                   wire_mae=float(np.abs(numeric['wire']-raw['wire']).mean())))
            report['transformed'].append(dict(pose=record['pose'],size=size,refinement=errors,coarse_mae=errors[0]['mae'],fine_mae=errors[-1]['mae'],wire_pixels=int(np.count_nonzero(raw['wire'])),node_ms=record['nodeMs']))
    report['camera_max_abs_error']=camera_error
    report['gates']=dict(reference_raw=all(r['max_abs_integral_error']<1e-7 for r in report['reference']),
        reference_pixels=all(r['pixel_mismatches']==0 for r in report['reference']),
        independent_camera=camera_error<1e-9,plane_solve=report['fiducial_max_pixel_error']<1e-9,
        sphere_centroids=report['sphere_centroid_max_pixel_error']<.3,
        occupancy_refinement=all(r['fine_mae']<r['coarse_mae'] and r['fine_mae']<.002 for r in report['transformed']),
        wire_visible=all(r['wire_pixels']>0 for r in report['transformed']))
    sources=[ROOT/'demo/beam-geometry.mjs',ROOT/'demo/tests/beam-geometry.test.mjs',HERE/'verify.py',HERE/'export.mjs',HERE/'test_verification.py',HERE.parent/'001-projection-geometry/geometry.py',HERE.parent/'001-projection-geometry/reference.py']
    report['source_sha256']={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
    (OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    if not all(report['gates'].values()): raise SystemExit('Numerical gate failed')

if __name__=='__main__': main()
