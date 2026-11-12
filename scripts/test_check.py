"""Keep the aggregate gate serial and include the numerical oracle's own tests."""
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('package_check', Path(__file__).with_name('check.py'))
assert spec is not None and spec.loader is not None
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)
class RunnerContract(unittest.TestCase):
    def test_aggregate_node_gate_is_serial_and_includes_oracle_tests(self):
        commands = []
        with patch.object(sys, 'argv', ['check.py', '--skip-snapshot']), patch.object(check, 'inspect', return_value=[]), patch.object(check.shutil, 'which', return_value='/usr/bin/node'), patch.object(check, 'run', side_effect=lambda *args: commands.append(args)):
            self.assertEqual(check.main(), 0)
        self.assertIn('--test-concurrency=1', commands[0])
        self.assertIn('scripts/wasm/compare-frames.test.mjs', commands[0])
        self.assertIn('scripts/wasm/static-path.test.mjs', commands[0])
if __name__ == '__main__':
    unittest.main()
