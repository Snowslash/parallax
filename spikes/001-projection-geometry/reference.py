"""Independent checks: linear-system detector intersection and sphere fiducials.

Does not call the analytic cylinder renderer or project_points. Camera metadata
is necessarily shared, so literal cardinal-orientation tests remain essential.
"""
import numpy as np


def project_by_plane_solve(camera, points):
    result = []
    for point in np.asarray(points):
        # C + du*right*spacing - dv*up*spacing = S + t*(P-S).
        basis = np.column_stack([camera.right * camera.pixel_mm,
                                 -camera.up * camera.pixel_mm,
                                 -(point - camera.source)])
        du, dv, _ = np.linalg.solve(basis, camera.source - camera.centre)
        result.append([du + camera.size/2 - .5, dv + camera.size/2 - .5])
    return np.array(result)


def tip_status(tip, radius, inner, outer, half_length):
    """Conservative bounding-sphere inequalities for the finite distal end cap.

    These are sufficient bounds, NOT exact nearest distances to an oblique cap.
    Tangency / wall contact / cylinder ends are deliberately indeterminate.
    """
    x, y, z = tip
    radial = float(np.hypot(x, y))
    lumen_clearance_lower_bound = inner - radial - radius
    sidewall_breach_lower_bound = radial - radius - outer
    away_from_ends = abs(z) + radius < half_length
    label = 'indeterminate'
    if away_from_ends and lumen_clearance_lower_bound > 0:
        label = 'contained'
    elif away_from_ends and sidewall_breach_lower_bound > 0:
        label = 'breached'
    return {'classification': label,
            'lumen_clearance_lower_bound_mm': lumen_clearance_lower_bound,
            'sidewall_breach_lower_bound_mm': sidewall_breach_lower_bound,
            'away_from_ends': bool(away_from_ends)}


def fiducial_errors(camera, points, radius_mm):
    """Rasterise independent solid spheres then measure their intensity centroids.

    Build rays locally rather than importing the renderer's ray generator.
    Finite spheres' perspective centroids need not equal their projected centres
    exactly; the tolerance is deliberately much larger than that small effect.
    """
    n = camera.size
    rows, cols = np.indices((n, n))
    positions = (camera.centre + (cols[..., None] + .5 - n/2) * camera.pixel_mm * camera.right
                 - (rows[..., None] + .5 - n/2) * camera.pixel_mm * camera.up)
    ray = positions - camera.source
    ray /= np.linalg.norm(ray, axis=-1)[..., None]
    expected = project_by_plane_solve(camera, points)
    errors = []
    for point, prediction in zip(points, expected):
        delta = camera.source - point
        dot = ray @ delta
        discriminant = dot*dot - (delta @ delta - radius_mm**2)
        values = 2 * np.sqrt(np.maximum(discriminant, 0))
        centroid = np.array([(values*cols).sum(), (values*rows).sum()]) / values.sum()
        errors.append(float(np.linalg.norm(centroid-prediction)))
    return errors
