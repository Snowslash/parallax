import unittest
import numpy as np
try:
    from independent_reference import reference_length, read_obj, UnresolvedReference
except ImportError:
    reference_length = None

# A deliberately asymmetric tetrahedron: x/4+y/6+z/8<=1, x/y/z>=0.
V = np.array([[0.,0,0],[4,0,0],[0,6,0],[0,0,8]])
F = np.array([[0,2,1],[0,1,3],[0,3,2],[1,2,3]])
class IndependentControls(unittest.TestCase):
    def setUp(self):
        self.assertTrue(callable(reference_length), 'independent numerical reference missing')
    def test_finite_axis_ray(self):
        self.assertAlmostEqual(reference_length(V,F,[-2,1,1],[9,1,1]), 4*(1-1/6-1/8), places=10)
    def test_inside_finite_clipping(self):
        self.assertAlmostEqual(reference_length(V,F,[.2,1,1],[1.2,1,1]),1,places=10)
        self.assertAlmostEqual(reference_length(V,F,[1,1,1],[9,1,1]),4*(1-1/6-1/8)-1,places=10)
    def test_empty(self):
        self.assertEqual(reference_length(V,F,[-2,9,1],[9,9,1]),0)
    def test_shared_vertex_crossing(self):
        expected=(1/(1/4+1/6+1/8))*np.sqrt(3)
        self.assertAlmostEqual(reference_length(V,F,[-2,-2,-2],[10,10,10]),expected,places=10)
    def test_coplanar_is_unresolved(self):
        with self.assertRaises(UnresolvedReference):
            reference_length(V,F,[-2,0,0],[9,0,0])
    def test_scale_translation(self):
        v=V*3+[13,-7,41]
        self.assertAlmostEqual(reference_length(v,F,np.array([-2,1,1])*3+[13,-7,41],np.array([9,1,1])*3+[13,-7,41]),12*(1-1/6-1/8),places=10)
if __name__ == '__main__': unittest.main()
