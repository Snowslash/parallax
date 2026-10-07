"""Independent offline oracle: all-triangle plane crossings, 3D cross-product
barycentric inclusion and solid-angle interval midpoint membership. No candidate
BVH, shear intersection, signed-event pairing, or received scripts imported.
Not a second production renderer; bounded ray samples only.
"""
import hashlib
import json
from pathlib import Path
import platform
import time
import numpy as np

LENGTH_TOLERANCE_MM = 2e-6  # Declared in fixtures.mjs before candidate evaluation.
class UnresolvedReference(ValueError):
    pass

def read_obj(path):
    vertices, faces = [], []
    for raw in Path(path).read_text().splitlines():
        p = raw.split()
        if not p:
            continue
        if p[0] == 'v':
            vertices.append([float(v) for v in p[1:]])
        elif p[0] == 'f':
            faces.append([int(v.split('/')[0])-1 for v in p[1:]])
    return np.asarray(vertices, dtype=np.float64), np.asarray(faces, dtype=np.int64)

def solid_angle_membership(triangles, point):
    a,b,c = (triangles[:,i]-point for i in range(3))
    la,lb,lc = (np.linalg.norm(v,axis=1) for v in (a,b,c))
    numerator = np.einsum('ij,ij->i',a,np.cross(b,c))
    denominator = la*lb*lc + np.einsum('ij,ij->i',a,b)*lc + np.einsum('ij,ij->i',b,c)*la + np.einsum('ij,ij->i',c,a)*lb
    winding = np.arctan2(numerator,denominator).sum()/(2*np.pi)
    if abs(winding)<1e-6:
        return False
    if abs(winding-1)<1e-6:
        return True
    raise UnresolvedReference(f'interval membership winding={winding}')

def reference_length(vertices, faces, source, detector):
    s=np.asarray(source,dtype=np.float64)
    d=np.asarray(detector,dtype=np.float64)-s
    length=np.linalg.norm(d)
    if not length>0:
        raise ValueError('zero ray')
    d/=length
    tri=vertices[faces]
    a,b,c=(tri[:,i] for i in range(3))
    normal=np.cross(b-a,c-a)
    norm=np.linalg.norm(normal,axis=1)
    denominator=normal@d
    numerator=np.einsum('ij,ij->i',normal,a-s)
    parallel=np.abs(denominator)<=norm*1e-14
    if np.any(parallel & (np.abs(numerator)<=norm*1e-10)):
        # Conservative oracle rejection; coplanar infinite planes need no forced answer.
        raise UnresolvedReference('coplanar boundary plane')
    valid=~parallel
    plane_t=numerator[valid]/denominator[valid]
    aa,bb,cc,nn=(v[valid] for v in (a,b,c,normal))
    points=s+plane_t[:,None]*d
    denom=np.einsum('ij,ij->i',nn,nn)
    u=np.einsum('ij,ij->i',np.cross(bb-points,cc-points),nn)/denom
    v=np.einsum('ij,ij->i',np.cross(cc-points,aa-points),nn)/denom
    w=1-u-v
    crossing=plane_t[(u>=-1e-9)&(v>=-1e-9)&(w>=-1e-9)&(plane_t>0)&(plane_t<length)]
    knots=[0.]
    for t in np.sort(crossing):
        if t-knots[-1]>1e-8:
            knots.append(float(t))
    if length-knots[-1]>1e-8:
        knots.append(float(length))
    result=0.
    for lo,hi in zip(knots,knots[1:]):
        if solid_angle_membership(tri,s+d*((lo+hi)/2)):
            result+=hi-lo
    return result

def main():
    here=Path(__file__).resolve().parent
    samples=json.loads((here/'outputs/actual-ray-samples.json').read_text())
    meshes={}
    for name in ('outer','core'):
        path=here.parent.parent/'demo/mesh-spike/assets'/f'{name}.obj'
        actual_hash=hashlib.sha256(path.read_bytes()).hexdigest()
        if actual_hash != samples['assets'][name]['sha256']:
            raise ValueError('asset identity mismatch')
        meshes[name]=read_obj(path)
    begin=time.perf_counter()
    results=[]
    for ray in samples['rays']:
        row={'name':ray['name'],'source':ray['source'],'detector':ray['detector'],'candidate':ray['candidate']}
        try:
            outer=reference_length(*meshes['outer'],ray['source'],ray['detector'])
            core=reference_length(*meshes['core'],ray['source'],ray['detector'])
            reference={'outer':outer,'core':core,'shell':outer-core,'attenuation':.04*(outer-core)+.008*core}
            row['reference']=reference
            row['candidateValid']=ray['candidate']['valid']
            row['maxLengthErrorMm']=max(abs(reference[k]-ray['candidate'][k]) for k in ('outer','core','shell')) if row['candidateValid'] else None
            row['attenuationError']=abs(reference['attenuation']-ray['candidate']['attenuation']) if row['candidateValid'] else None
            row['pass']=bool(row['candidateValid'] and row['maxLengthErrorMm']<=LENGTH_TOLERANCE_MM)
        except UnresolvedReference as error:
            row['referenceUnresolved']=str(error)
            row['pass']=bool(ray['expected']=='explicit invalid' and not ray['candidate']['valid'])
        results.append(row)
    resolved=[r for r in results if r.get('candidateValid') and 'reference' in r]
    report={'method':__doc__,'python':platform.python_version(),'numpy':np.__version__,'assets':samples['assets'],'toleranceMm':LENGTH_TOLERANCE_MM,'rays':len(results),'resolvedComparisons':len(resolved),'explicitUnresolved':sum('referenceUnresolved' in r for r in results),'maxLengthErrorMm':max(r['maxLengthErrorMm'] for r in resolved),'maxAttenuationError':max(r['attenuationError'] for r in resolved),'pass':all(r['pass'] for r in results),'seconds':time.perf_counter()-begin,'results':results}
    (here/'outputs/independent-reference.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))
    if not report['pass']:
        print(json.dumps([r for r in results if not r['pass']],indent=2))
        raise SystemExit(1)
if __name__=='__main__':
    main()
