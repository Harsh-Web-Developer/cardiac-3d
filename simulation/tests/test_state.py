"""Tests for simulation.state — the cardiovascular state model."""

import json
import unittest

from simulation.state import (
    CardiacMetrics,
    ChamberState,
    CirculationState,
    SimulationState,
    ValveState,
    copy_state,
    create_initial_state,
    state_to_dict,
    validate_state,
)


class TestInitialStateCreation(unittest.TestCase):
    """Test 1: Initial state can be created without error."""

    def test_initial_state_creation(self):
        state = create_initial_state()
        self.assertIsInstance(state, SimulationState)
        self.assertEqual(len(state.chambers), 4)
        self.assertEqual(len(state.valves), 4)
        self.assertIsInstance(state.circulation, CirculationState)
        self.assertIsInstance(state.metrics, CardiacMetrics)


class TestBaselineHeartRate(unittest.TestCase):
    """Test 2: Baseline HR is approximately 72 bpm."""

    def test_baseline_heart_rate(self):
        state = create_initial_state()
        self.assertAlmostEqual(state.heart_rate_bpm, 72.0, delta=1.0)


class TestBaselineBloodVolume(unittest.TestCase):
    """Test 3: Baseline blood volume is approximately 5.2 L."""

    def test_baseline_blood_volume(self):
        state = create_initial_state()
        self.assertAlmostEqual(state.circulation.blood_volume_l, 5.2, delta=0.1)


class TestLVStrokeVolume(unittest.TestCase):
    """Test 4: LV EDV/ESV produce approximately the expected stroke volume."""

    def test_lv_stroke_volume(self):
        state = create_initial_state()
        expected_sv = 120.0 - 50.0  # 70 mL
        self.assertAlmostEqual(
            state.metrics.stroke_volume_ml, expected_sv, delta=1.0
        )
        # Also verify consistency: SV == EDV - ESV
        self.assertAlmostEqual(
            state.metrics.end_diastolic_volume_ml
            - state.metrics.end_systolic_volume_ml,
            state.metrics.stroke_volume_ml,
            places=6,
        )


class TestBaselineCardiacOutput(unittest.TestCase):
    """Test 5: Cardiac output is approximately 5 L/min."""

    def test_baseline_cardiac_output(self):
        state = create_initial_state()
        expected_co = 72.0 * 70.0 / 1000.0  # 5.04 L/min
        self.assertAlmostEqual(
            state.metrics.cardiac_output_l_min, expected_co, delta=0.1
        )


class TestDeepCopy(unittest.TestCase):
    """Test 6: Deep copying works."""

    def test_deep_copy_creates_new_object(self):
        original = create_initial_state()
        copied = copy_state(original)
        self.assertIsNot(original, copied)
        self.assertIsNot(original.chambers, copied.chambers)
        self.assertIsNot(original.valves, copied.valves)
        self.assertIsNot(original.circulation, copied.circulation)
        self.assertIsNot(original.metrics, copied.metrics)


class TestCopyIsolation(unittest.TestCase):
    """Test 7: Modifying a copied chamber does not modify the original."""

    def test_modifying_copy_does_not_affect_original(self):
        original = create_initial_state()
        copied = copy_state(original)

        # Mutate the copy's left ventricle
        copied.chambers["left_ventricle"].volume_ml = 999.0
        copied.chambers["left_ventricle"].pressure_mmhg = 999.0

        # Original must be untouched
        self.assertEqual(original.chambers["left_ventricle"].volume_ml, 120.0)
        self.assertEqual(original.chambers["left_ventricle"].pressure_mmhg, 8.0)


class TestInvalidStatesRejected(unittest.TestCase):
    """Test 8: Invalid states are rejected by validate_state."""

    def test_heart_rate_zero(self):
        state = create_initial_state()
        state.heart_rate_bpm = 0
        with self.assertRaises(ValueError):
            validate_state(state)

    def test_heart_rate_negative(self):
        state = create_initial_state()
        state.heart_rate_bpm = -10
        with self.assertRaises(ValueError):
            validate_state(state)

    def test_negative_chamber_volume(self):
        state = create_initial_state()
        state.chambers["left_ventricle"].volume_ml = -5.0
        with self.assertRaises(ValueError):
            validate_state(state)

    def test_negative_blood_volume(self):
        state = create_initial_state()
        state.circulation.blood_volume_l = -1.0
        with self.assertRaises(ValueError):
            validate_state(state)

    def test_negative_compliance(self):
        state = create_initial_state()
        state.chambers["right_ventricle"].compliance_ml_per_mmhg = -2.0
        with self.assertRaises(ValueError):
            validate_state(state)

    def test_negative_stroke_volume(self):
        state = create_initial_state()
        state.metrics.stroke_volume_ml = -10.0
        with self.assertRaises(ValueError):
            validate_state(state)

    def test_negative_cardiac_output(self):
        state = create_initial_state()
        state.metrics.cardiac_output_l_min = -1.0
        with self.assertRaises(ValueError):
            validate_state(state)

    def test_negative_contractility(self):
        state = create_initial_state()
        state.contractility = -0.5
        with self.assertRaises(ValueError):
            validate_state(state)


class TestSerialization(unittest.TestCase):
    """Test 9: Serialization produces JSON-compatible data."""

    def test_serialization_json_compatible(self):
        state = create_initial_state()
        d = state_to_dict(state)

        # Must round-trip through JSON without error
        json_str = json.dumps(d)
        restored = json.loads(json_str)

        # Spot-check key values survived the round-trip
        self.assertAlmostEqual(
            restored["heart_rate_bpm"], state.heart_rate_bpm, places=6
        )
        self.assertAlmostEqual(
            restored["circulation"]["blood_volume_l"],
            state.circulation.blood_volume_l,
            places=6,
        )
        self.assertEqual(
            restored["chambers"]["left_ventricle"]["volume_ml"],
            state.chambers["left_ventricle"].volume_ml,
        )

    def test_serialization_types(self):
        state = create_initial_state()
        d = state_to_dict(state)

        # Verify top-level types
        self.assertIsInstance(d, dict)
        self.assertIsInstance(d["chambers"], dict)
        self.assertIsInstance(d["valves"], dict)
        self.assertIsInstance(d["circulation"], dict)
        self.assertIsInstance(d["metrics"], dict)

        # Verify no unexpected types
        self.assertIsInstance(d["heart_rate_bpm"], float)
        self.assertIsInstance(d["time_s"], float)
        self.assertIsInstance(d["cardiac_phase"], str)
        self.assertIsInstance(d["contractility"], float)


if __name__ == "__main__":
    unittest.main()
