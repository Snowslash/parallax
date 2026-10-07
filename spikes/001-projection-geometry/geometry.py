"""Disposable NumPy baseline. Idealised line integrals, NOT a clinical DRR model.

World is right handed, mm, cylinder along +Z. At 0 degrees source is -Y,
image-right +X, image-up +Z. Positive orbit rotates source around +Z.
Array rows increase down; pixel centres have integer image coordinates.
"""
from dataclasses import dataclass
from pathlib import Path
import struct
import zlib

import numpy as np

FIXTURE = {
    'outer_radius_mm': 12., 'inner_radius_mm': 10., 'half_length_mm': 30.,
    'wire_radius_mm': .65, 'mu_shell_per_mm': .08, 'mu_wire_per_mm': .6,
    'wire_start_mm': [0., 0., -18.],
    'tips_mm': {'contained': [0., 7., 18.], 'breached': [0., 15., 18.]},
}


@dataclass(frozen=True)
class Camera:
    angle_deg: float
    size: int = 256
    pixel_mm: float = .5
    sod: float = 800.
    sdd: float = 1200.

    @property
    def right(self):
        a = np.deg2rad(self.angle_deg)
        return np.array([np.cos(a), np.sin(a), 0.])

    @property
    def up(self):
        return np.array([0., 0., 1.])

    @property
    def forward(self):
        a = np.deg2rad(self.angle_deg)
        return np.array([-np.sin(a), np.cos(a), 0.])

    @property
    def source(self):
        return -self.sod * self.forward

    @property
    def centre(self):
        return self.source + self.sdd * self.forward

    def metadata(self):
        return {**self.__dict__, 'source_mm': self.source.tolist(),
                'detector_centre_mm': self.centre.tolist(),
                'detector_right': self.right.tolist(), 'detector_up': self.up.tolist(),
                'forward': self.forward.tolist()}


def ray_bundle(camera):
    rows, cols = np.indices((camera.size, camera.size), dtype=float)
    x = (cols + .5 - camera.size / 2) * camera.pixel_mm
    y = (camera.size / 2 - rows - .5) * camera.pixel_mm
    targets = camera.centre + x[..., None] * camera.right + y[..., None] * camera.up
    vectors = targets - camera.source
    distances = np.linalg.norm(vectors, axis=-1)
    return vectors / distances[..., None], distances


def project_points(camera, points):
    vectors = np.asarray(points, dtype=float) - camera.source
    depth = vectors @ camera.forward
    scale = camera.sdd / depth / camera.pixel_mm
    centre = camera.size / 2 - .5
    return np.stack([centre + (vectors @ camera.right) * scale,
                     centre - (vectors @ camera.up) * scale], axis=-1)


def cylinder_intervals(source, directions, a, b, radius, max_t):
    """Ray parameter interval inside a finite, flat-capped solid cylinder.

    Directions are unit vectors, so parameters and returned lengths are mm.
    Supports parallel/tangent/miss rays without singular divisions.
    """
    a, b = np.asarray(a, float), np.asarray(b, float)
    axis = b - a
    length = np.linalg.norm(axis)
    axis = axis / length
    direction = np.asarray(directions, float)
    delta = np.asarray(source, float) - a
    axial_origin = delta @ axis
    axial_direction = direction @ axis
    radial_origin = delta - np.expand_dims(axial_origin, -1) * axis
    radial_direction = direction - axial_direction[..., None] * axis
    qa = np.sum(radial_direction ** 2, axis=-1)
    qb = 2 * np.sum(radial_direction * radial_origin, axis=-1)
    qc = np.sum(radial_origin ** 2, axis=-1) - radius ** 2
    disc = qb ** 2 - 4 * qa * qc
    parallel = qa < 1e-12
    valid_radial = np.where(parallel, qc <= 0, disc >= 0)
    root = np.sqrt(np.maximum(disc, 0))
    lo = np.divide(-qb - root, 2 * qa, out=np.full_like(qa, -np.inf), where=~parallel)
    hi = np.divide(-qb + root, 2 * qa, out=np.full_like(qa, np.inf), where=~parallel)
    axial_parallel = np.abs(axial_direction) < 1e-12
    t0 = np.divide(-axial_origin, axial_direction, out=np.full_like(qa, -np.inf), where=~axial_parallel)
    t1 = np.divide(length - axial_origin, axial_direction, out=np.full_like(qa, np.inf), where=~axial_parallel)
    axial_lo, axial_hi = np.minimum(t0, t1), np.maximum(t0, t1)
    valid_axial = ~axial_parallel | ((axial_origin >= 0) & (axial_origin <= length))
    lo = np.maximum(np.maximum(lo, axial_lo), 0)
    hi = np.minimum(np.minimum(hi, axial_hi), max_t)
    valid = valid_radial & valid_axial & (hi >= lo)
    return np.where(valid, lo, 0), np.where(valid, hi, 0)


def interval_length(lo, hi):
    return np.maximum(hi - lo, 0)


def render_analytic(camera, tip, include_wire=True):
    """Exact primitive chords. Wire REPLACES shell material where they intersect."""
    f = FIXTURE
    directions, distances = ray_bundle(camera)
    a, b = [0, 0, -f['half_length_mm']], [0, 0, f['half_length_mm']]
    outer = cylinder_intervals(camera.source, directions, a, b, f['outer_radius_mm'], distances)
    inner = cylinder_intervals(camera.source, directions, a, b, f['inner_radius_mm'], distances)
    shell_length = interval_length(*outer) - interval_length(*inner)
    wire_length = np.zeros_like(shell_length)
    if include_wire:
        wire = cylinder_intervals(camera.source, directions, f['wire_start_mm'], tip, f['wire_radius_mm'], distances)
        wire_length = interval_length(*wire)
        overlap_outer = interval_length(np.maximum(wire[0], outer[0]), np.minimum(wire[1], outer[1]))
        overlap_inner = interval_length(np.maximum(wire[0], inner[0]), np.minimum(wire[1], inner[1]))
        shell_length -= overlap_outer - overlap_inner
    shell = np.maximum(shell_length, 0) * f['mu_shell_per_mm']
    wire = wire_length * f['mu_wire_per_mm']
    return {'total': shell + wire, 'shell': shell, 'wire': wire}


def make_volume(tip, spacing_mm):
    """Sample geometry on a nodal grid; independent occupancy, no ray/chord helper.

    Stored layout is X,Y,Z. Trilinear interpolation of these nodal densities
    deliberately approximates sharp boundaries; refinement is measured.
    """
    lower = np.array([-20., -20., -34.])
    upper = np.array([20., 20., 34.])
    interval_counts = (upper - lower) / spacing_mm
    if not np.allclose(interval_counts, np.rint(interval_counts), atol=1e-9, rtol=0):
        raise ValueError('spacing_mm must divide all volume extents exactly')
    axes = [np.linspace(lo, hi, int(round(count)) + 1)
            for lo, hi, count in zip(lower, upper, interval_counts)]
    x, y, z = np.meshgrid(*axes, indexing='ij', sparse=True)
    r2 = x*x + y*y
    shell = (r2 <= FIXTURE['outer_radius_mm']**2) & (r2 >= FIXTURE['inner_radius_mm']**2) & (np.abs(z) <= FIXTURE['half_length_mm'])
    density = shell.astype(np.float32) * FIXTURE['mu_shell_per_mm']
    a, b = np.array(FIXTURE['wire_start_mm']), np.asarray(tip, float)
    axis = b - a
    length = np.linalg.norm(axis)
    axis /= length
    along = (x-a[0])*axis[0] + (y-a[1])*axis[1] + (z-a[2])*axis[2]
    radial2 = (x-a[0])**2 + (y-a[1])**2 + (z-a[2])**2 - along**2
    wire = (along >= 0) & (along <= length) & (radial2 <= FIXTURE['wire_radius_mm']**2)
    density[wire] = FIXTURE['mu_wire_per_mm']
    return {'density': density, 'lower': lower, 'upper': upper, 'spacing_mm': spacing_mm}


def render_sampled(camera, volume, step_mm, chunk=512):
    """Numerical ray integral through trilinearly interpolated nodal densities."""
    directions, max_t = ray_bundle(camera)
    directions = directions.reshape(-1, 3)
    max_t = max_t.ravel()
    lower, upper = volume['lower'], volume['upper']
    density, spacing = volume['density'], volume['spacing_mm']
    with np.errstate(divide='ignore', invalid='ignore'):
        ta = (lower - camera.source) / directions
        tb = (upper - camera.source) / directions
    entry = np.maximum(np.max(np.minimum(ta, tb), axis=-1), 0)
    exit_ = np.minimum(np.min(np.maximum(ta, tb), axis=-1), max_t)
    lengths = np.maximum(exit_ - entry, 0)
    output = np.zeros(len(directions))
    active = np.flatnonzero(lengths > 0)
    for start in range(0, len(active), chunk):
        ids = active[start:start+chunk]
        samples = max(1, int(np.ceil(lengths[ids].max() / step_mm)))
        fraction = (np.arange(samples) + .5) / samples
        t = entry[ids, None] + lengths[ids, None] * fraction
        points = camera.source + t[..., None] * directions[ids, None, :]
        grid = (points - lower) / spacing
        base = np.floor(grid).astype(int)
        base = np.clip(base, 0, np.array(density.shape) - 2)
        weight = np.clip(grid - base, 0, 1)
        values = np.zeros(t.shape)
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    w = ((weight[..., 0] if dx else 1-weight[..., 0]) *
                         (weight[..., 1] if dy else 1-weight[..., 1]) *
                         (weight[..., 2] if dz else 1-weight[..., 2]))
                    values += density[base[..., 0]+dx, base[..., 1]+dy, base[..., 2]+dz] * w
        output[ids] = values.mean(axis=-1) * lengths[ids]
    return output.reshape(camera.size, camera.size)


def display_pixels(line_integrals):
    """Single fixed map for ALL images: white attenuation, black air; no window fitting."""
    return np.rint(255 * (1 - np.exp(-np.asarray(line_integrals)))).astype(np.uint8)


def write_png(path, pixels):
    """Minimal lossless 8-bit grayscale/RGB PNG; no plotting-library dependency."""
    pixels = np.asarray(pixels, dtype=np.uint8)
    height, width = pixels.shape[:2]
    colour_type = 0 if pixels.ndim == 2 else 2
    def block(name, payload):
        return struct.pack('!I', len(payload)) + name + payload + struct.pack('!I', zlib.crc32(name + payload) & 0xffffffff)
    raw = b''.join(b'\x00' + row.tobytes() for row in pixels)
    data = (b'\x89PNG\r\n\x1a\n' + block(b'IHDR', struct.pack('!IIBBBBB', width, height, 8, colour_type, 0, 0, 0))
            + block(b'IDAT', zlib.compress(raw)) + block(b'IEND', b''))
    Path(path).write_bytes(data)
