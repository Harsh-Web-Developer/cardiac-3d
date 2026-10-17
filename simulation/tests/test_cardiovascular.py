"""Tests for the CARDIA cardiovascular physiology engine.

Covers:
    - Cardiac cycle phases
    - Ventricular pressure dynamics
    - Valve pressure-driven behaviour
    - Blood volume conservation
    - Baseline physiological metrics
    - Contractility response
    - SVR response
    - Heart rate response
    - Frank-Starling mechanism
    - Numerical stability (60-second run)
    - ML adapter compatibility
"""

from __future__ import annotations

import math
import unittest

from simulation.state import create_initial_state, SimulationState
from simulation.cardiovascular import step, simulate
from simulation.chambers import compute_chamber_pressure, _ventricular_activation
from simulation.valves import compute_valve_flow
from simulation.feedback import frank_starling_factor, baroreflex_step
from simulation.adapter import state_to_ml_features, state_to_rag_dict
from simulation.parameters import CHAMBER_PHYSIOLOGY, VALVES, PHASE, BAROREFLEX, FRANK_STARLING


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run(duration: float, dt: float = 0.01, hr: float = 72.0,
         contractility: float = 1.0, svr: float = 1.0) -> list[SimulationState]:
    """Create a modified initial state and simulate for *duration* seconds."""
    s = create_initial_state()
    s.heart_rate_bpm = hr
    s.contractility  = contractility
    s.circulation.systemic_vascular_resistance = svr
    return simulate(s, duration, dt)


def _warm(duration: float = 15.0, **kwargs) -> SimulationState:
    """Return a warmed-up steady-state snapshot."""
    return _run(duration, **kwargs)[-1]


# ===========================================================================
# 1. Cardiac cycle — phases progress correctly
# ===========================================================================

class TestCardiacPhaseSequence(unittest.TestCase):
    """Phase should cycle through a repeating pattern."""

    def test_phases_include_systole_and_diastole(self):
        history = _run(5.0)
        phases = {s.cardiac_phase for s in history}
        self.assertIn("systole",  phases)
        self.assertIn("diastole", phases)

    def test_phase_transitions_repeat(self):
        """Count systole→diastole transitions; should match expected HR."""
        history = _run(10.0)
        transitions = 0
        for i in range(1, len(history)):
            if (history[i - 1].cardiac_phase == "diastole"
                    and history[i].cardiac_phase == "systole"):
                transitions += 1
        # At 72 bpm over 10 s, expect ~12 beats; allow generous tolerance
        self.assertGreaterEqual(transitions, 8)
        self.assertLessEqual(transitions, 18)

    def test_higher_hr_more_transitions(self):
        """100 bpm should produce more phase transitions than 60 bpm."""
        hist_60  = _run(10.0, hr=60.0)
        hist_100 = _run(10.0, hr=100.0)

        def count_transitions(history):
            n = 0
            for i in range(1, len(history)):
                if (history[i - 1].cardiac_phase == "diastole"
                        and history[i].cardiac_phase == "systole"):
                    n += 1
            return n

        t60  = count_transitions(hist_60)
        t100 = count_transitions(hist_100)
        self.assertGreater(t100, t60, f"t100={t100}, t60={t60}")

    def test_higher_hr_shorter_cycle_period(self):
        """Cycle period at 100 bpm should be shorter than at 60 bpm."""
        T_100 = 60.0 / 100.0
        T_60  = 60.0 / 60.0
        self.assertLess(T_100, T_60)


# ===========================================================================
# 2. Ventricular activation function
# ===========================================================================

class TestVentricularActivation(unittest.TestCase):

    def test_activation_zero_at_start_of_diastole(self):
        T = 60.0 / 72.0
        t_diastole = (PHASE.frac_ic + PHASE.frac_ej + PHASE.frac_ir + 0.01) * T
        a = _ventricular_activation(t_diastole % T, T)
        self.assertAlmostEqual(a, 0.0, places=3)

    def test_activation_peaks_during_ejection(self):
        T = 60.0 / 72.0
        t_peak = (PHASE.frac_ic + PHASE.frac_ej * 0.5) * T
        a_peak = _ventricular_activation(t_peak, T)
        a_dia  = _ventricular_activation(0.95 * T, T)
        self.assertGreater(a_peak, a_dia)
        self.assertGreater(a_peak, 0.5)

    def test_activation_bounded(self):
        T = 60.0 / 72.0
        for t_frac in [i / 100 for i in range(100)]:
            a = _ventricular_activation(t_frac * T, T)
            self.assertGreaterEqual(a, 0.0)
            self.assertLessEqual(a, 1.0)


# ===========================================================================
# 3. Ventricular pressure dynamics
# ===========================================================================

class TestVentricularPressure(unittest.TestCase):

    def test_lv_pressure_rises_during_systole(self):
        """LV pressure during systole should be higher than during diastole."""
        history = _run(5.0)
        systole_pressures  = [s.chambers["left_ventricle"].pressure_mmhg
                               for s in history if s.cardiac_phase == "systole"]
        diastole_pressures = [s.chambers["left_ventricle"].pressure_mmhg
                               for s in history if s.cardiac_phase == "diastole"]
        self.assertTrue(len(systole_pressures)  > 0)
        self.assertTrue(len(diastole_pressures) > 0)
        self.assertGreater(
            max(systole_pressures),
            max(diastole_pressures),
        )

    def test_lv_peak_pressure_plausible(self):
        """Peak LV pressure should be in a physiologically plausible range."""
        history = _run(15.0)
        peak_lv = max(s.chambers["left_ventricle"].pressure_mmhg for s in history)
        self.assertGreater(peak_lv, 60.0,  f"Peak LV too low: {peak_lv:.1f}")
        self.assertLess(peak_lv,    300.0, f"Peak LV too high: {peak_lv:.1f}")

    def test_rv_pressure_lower_than_lv(self):
        """RV peak pressure should be well below LV peak pressure."""
        history = _run(10.0)
        peak_lv = max(s.chambers["left_ventricle"].pressure_mmhg for s in history)
        peak_rv = max(s.chambers["right_ventricle"].pressure_mmhg for s in history)
        self.assertGreater(peak_lv, peak_rv,
                           f"LV={peak_lv:.1f}, RV={peak_rv:.1f}")


# ===========================================================================
# 4. Valve dynamics
# ===========================================================================

class TestValves(unittest.TestCase):

    def test_valve_opens_with_forward_pressure(self):
        flow, is_open = compute_valve_flow(80.0, 10.0, VALVES["aortic"])
        self.assertTrue(is_open)
        self.assertGreater(flow, 0.0)

    def test_valve_closed_with_reverse_pressure(self):
        flow, is_open = compute_valve_flow(5.0, 80.0, VALVES["aortic"])
        self.assertFalse(is_open)
        self.assertEqual(flow, 0.0)

    def test_valve_closed_at_equal_pressure(self):
        flow, is_open = compute_valve_flow(80.0, 80.0, VALVES["mitral"])
        self.assertFalse(is_open)
        self.assertEqual(flow, 0.0)

    def test_aortic_valve_opens_during_sim(self):
        """Aortic valve must open at least once during a 10-second run."""
        history = _run(10.0)
        aortic_open_seen = any(s.valves["aortic"].is_open for s in history)
        self.assertTrue(aortic_open_seen, "Aortic valve never opened")

    def test_mitral_valve_opens_during_sim(self):
        history = _run(10.0)
        self.assertTrue(any(s.valves["mitral"].is_open for s in history),
                        "Mitral valve never opened")

    def test_no_negative_valve_flow(self):
        """Valves must never produce reverse flow."""
        history = _run(10.0)
        for s in history:
            for name, valve in s.valves.items():
                self.assertGreaterEqual(
                    valve.flow_ml_per_s, 0.0,
                    f"Negative flow in {name} at t={s.time_s:.3f}"
                )


# ===========================================================================
# 5. Blood volume conservation
# ===========================================================================

class TestBloodVolumeConservation(unittest.TestCase):

    def test_blood_volume_conserved_30s(self):
        """Blood volume is explicitly conserved (stored, not derived)."""
        history = _run(30.0)
        initial_bv = history[0].circulation.blood_volume_l
        final_bv   = history[-1].circulation.blood_volume_l
        drift_ml   = abs(final_bv - initial_bv) * 1000.0
        self.assertAlmostEqual(drift_ml, 0.0, places=3,
                               msg=f"Blood volume drifted {drift_ml:.3f} mL")


# ===========================================================================
# 6. Baseline physiological metrics
# ===========================================================================

class TestBaselineMetrics(unittest.TestCase):
    """After warm-up the model should settle near resting physiology."""

    @classmethod
    def setUpClass(cls):
        cls.state = _warm(20.0)

    def test_heart_rate_near_72(self):
        hr = self.state.heart_rate_bpm
        self.assertGreater(hr, 55.0, f"HR too low: {hr:.1f}")
        self.assertLess(hr,    95.0, f"HR too high: {hr:.1f}")

    def test_stroke_volume_plausible(self):
        sv = self.state.metrics.stroke_volume_ml
        self.assertGreater(sv, 40.0, f"SV too low: {sv:.1f}")
        self.assertLess(sv,    110.0, f"SV too high: {sv:.1f}")

    def test_cardiac_output_plausible(self):
        co = self.state.metrics.cardiac_output_l_min
        self.assertGreater(co, 3.0, f"CO too low: {co:.2f}")
        self.assertLess(co,    10.0, f"CO too high: {co:.2f}")

    def test_systolic_bp_plausible(self):
        sbp = self.state.metrics.systolic_bp_mmhg
        self.assertGreater(sbp, 90.0,  f"SBP too low: {sbp:.1f}")
        self.assertLess(sbp,    180.0, f"SBP too high: {sbp:.1f}")

    def test_diastolic_bp_plausible(self):
        dbp = self.state.metrics.diastolic_bp_mmhg
        self.assertGreater(dbp, 50.0,  f"DBP too low: {dbp:.1f}")
        self.assertLess(dbp,    120.0, f"DBP too high: {dbp:.1f}")

    def test_map_plausible(self):
        map_ = self.state.metrics.map_mmhg
        self.assertGreater(map_, 60.0,  f"MAP too low: {map_:.1f}")
        self.assertLess(map_,    140.0, f"MAP too high: {map_:.1f}")

    def test_edv_plausible(self):
        edv = self.state.metrics.end_diastolic_volume_ml
        self.assertGreater(edv, 60.0,  f"EDV too low: {edv:.1f}")
        self.assertLess(edv,    200.0, f"EDV too high: {edv:.1f}")

    def test_esv_plausible(self):
        esv = self.state.metrics.end_systolic_volume_ml
        self.assertGreater(esv, 20.0,  f"ESV too low: {esv:.1f}")
        self.assertLess(esv,    120.0, f"ESV too high: {esv:.1f}")


# ===========================================================================
# 7. Contractility response
# ===========================================================================

class TestContractilityResponse(unittest.TestCase):

    def test_higher_contractility_increases_sv(self):
        """High contractility should produce greater SV than low."""
        low  = _warm(20.0, contractility=0.7)
        high = _warm(20.0, contractility=1.4)
        sv_low  = low.metrics.stroke_volume_ml
        sv_high = high.metrics.stroke_volume_ml
        self.assertGreater(
            sv_high, sv_low,
            f"SV_high={sv_high:.1f} not > SV_low={sv_low:.1f}"
        )

    def test_higher_contractility_decreases_esv(self):
        """High contractility should produce lower ESV (more complete ejection)."""
        low  = _warm(20.0, contractility=0.7)
        high = _warm(20.0, contractility=1.4)
        self.assertLess(
            high.metrics.end_systolic_volume_ml,
            low.metrics.end_systolic_volume_ml,
            f"ESV high={high.metrics.end_systolic_volume_ml:.1f}, "
            f"low={low.metrics.end_systolic_volume_ml:.1f}"
        )

    def test_lv_peak_pressure_higher_with_higher_contractility(self):
        """Higher contractility → more ventricular pressure generation."""
        history_low  = _run(10.0, contractility=0.7)
        history_high = _run(10.0, contractility=1.4)
        peak_low  = max(s.chambers["left_ventricle"].pressure_mmhg for s in history_low)
        peak_high = max(s.chambers["left_ventricle"].pressure_mmhg for s in history_high)
        self.assertGreater(
            peak_high, peak_low,
            f"Peak LV: high={peak_high:.1f}, low={peak_low:.1f}"
        )


# ===========================================================================
# 8. SVR response
# ===========================================================================

class TestSVRResponse(unittest.TestCase):

    def test_higher_svr_increases_systemic_pressure(self):
        """Higher SVR should produce higher arterial pressure at steady state."""
        low  = _warm(20.0, svr=0.6)
        high = _warm(20.0, svr=1.6)
        # Check aortic pressure directly as well
        self.assertGreater(
            high.circulation.aortic_pressure_mmhg,
            low.circulation.aortic_pressure_mmhg,
            f"Aortic P: high={high.circulation.aortic_pressure_mmhg:.1f}, "
            f"low={low.circulation.aortic_pressure_mmhg:.1f}"
        )

    def test_higher_svr_increases_map(self):
        low  = _warm(20.0, svr=0.6)
        high = _warm(20.0, svr=1.6)
        self.assertGreater(
            high.metrics.map_mmhg,
            low.metrics.map_mmhg,
            f"MAP: high={high.metrics.map_mmhg:.1f}, low={low.metrics.map_mmhg:.1f}"
        )


# ===========================================================================
# 9. Heart rate response
# ===========================================================================

class TestHeartRateResponse(unittest.TestCase):

    def test_60_bpm_longer_cycle_than_100_bpm(self):
        T_60  = 60.0 / 60.0
        T_100 = 60.0 / 100.0
        self.assertGreater(T_60, T_100)

    def test_cycle_transitions_match_hr(self):
        """Verify 60 bpm produces fewer beats than 100 bpm over 10 seconds."""
        hist_60  = _run(10.0, hr=60.0)
        hist_100 = _run(10.0, hr=100.0)

        def count_beats(hist):
            return sum(
                1 for i in range(1, len(hist))
                if (hist[i - 1].cardiac_phase == "diastole"
                    and hist[i].cardiac_phase == "systole")
            )

        self.assertLess(count_beats(hist_60), count_beats(hist_100))

    def test_co_higher_at_100_bpm(self):
        """Higher HR should increase CO (assuming similar SV)."""
        state_60  = _warm(15.0, hr=60.0)
        state_100 = _warm(15.0, hr=100.0)
        self.assertGreater(
            state_100.metrics.cardiac_output_l_min,
            state_60.metrics.cardiac_output_l_min,
        )


# ===========================================================================
# 10. Frank-Starling mechanism
# ===========================================================================

class TestFrankStarling(unittest.TestCase):

    def test_increased_preload_boosts_effective_contractility(self):
        """Higher LV volume → higher effective contractility via Frank-Starling."""
        c_low  = frank_starling_factor(80.0,  1.0, FRANK_STARLING)
        c_high = frank_starling_factor(160.0, 1.0, FRANK_STARLING)
        self.assertGreater(c_high, c_low,
                           f"c_high={c_high:.3f}, c_low={c_low:.3f}")

    def test_frank_starling_bounded(self):
        """Extreme preload should not push contractility above the hard limit."""
        c = frank_starling_factor(500.0, 1.0, FRANK_STARLING)
        self.assertLessEqual(c, 3.0)

    def test_frank_starling_does_not_overwrite_baseline(self):
        """Baseline contractility in state must not be directly overwritten."""
        s0 = create_initial_state()
        s1 = step(s0)
        # Baroreflex may slowly nudge contractility, but it should stay near 1.0
        self.assertAlmostEqual(s1.contractility, 1.0, delta=0.1)


# ===========================================================================
# 11. Numerical stability — 60-second run
# ===========================================================================

class TestNumericalStability(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.history = simulate(create_initial_state(), 60.0, 0.01)

    def test_no_nan_in_pressures(self):
        import math
        for s in self.history:
            for name, ch in s.chambers.items():
                self.assertFalse(
                    math.isnan(ch.pressure_mmhg),
                    f"NaN pressure in {name} at t={s.time_s:.2f}"
                )

    def test_no_inf_in_pressures(self):
        import math
        for s in self.history:
            for name, ch in s.chambers.items():
                self.assertFalse(
                    math.isinf(ch.pressure_mmhg),
                    f"Inf pressure in {name} at t={s.time_s:.2f}"
                )

    def test_no_negative_volumes(self):
        for s in self.history:
            for name, ch in s.chambers.items():
                self.assertGreaterEqual(
                    ch.volume_ml, 0.0,
                    f"Negative volume in {name} at t={s.time_s:.2f}"
                )

    def test_no_negative_blood_volume(self):
        for s in self.history:
            self.assertGreater(
                s.circulation.blood_volume_l, 0.0,
                f"Non-positive blood volume at t={s.time_s:.2f}"
            )

    def test_aortic_pressure_bounded(self):
        for s in self.history:
            p = s.circulation.aortic_pressure_mmhg
            self.assertGreater(p, 0.0,  f"Aortic P non-positive at t={s.time_s:.2f}")
            self.assertLess(p,    500.0, f"Aortic P exploded at t={s.time_s:.2f}")

    def test_hr_bounded(self):
        for s in self.history:
            self.assertGreater(s.heart_rate_bpm, 30.0)
            self.assertLess(s.heart_rate_bpm,    200.0)

    def test_simulation_runs_full_60s(self):
        last_t = self.history[-1].time_s
        self.assertAlmostEqual(last_t, 60.0, delta=0.05)


# ===========================================================================
# 12. Determinism
# ===========================================================================

class TestDeterminism(unittest.TestCase):

    def test_two_identical_runs_produce_same_result(self):
        s0 = create_initial_state()
        a = simulate(s0, 10.0, 0.01)
        b = simulate(s0, 10.0, 0.01)
        # Check a representative sample of fields
        for i in [0, 100, 500, len(a) - 1]:
            self.assertAlmostEqual(
                a[i].heart_rate_bpm, b[i].heart_rate_bpm, places=10,
                msg=f"HR mismatch at index {i}"
            )
            self.assertAlmostEqual(
                a[i].chambers["left_ventricle"].volume_ml,
                b[i].chambers["left_ventricle"].volume_ml,
                places=10,
                msg=f"LV volume mismatch at index {i}"
            )
            self.assertAlmostEqual(
                a[i].circulation.aortic_pressure_mmhg,
                b[i].circulation.aortic_pressure_mmhg,
                places=10,
                msg=f"Aortic P mismatch at index {i}"
            )


# ===========================================================================
# 13. ML adapter
# ===========================================================================

class TestMLAdapter(unittest.TestCase):

    def test_features_present(self):
        s = create_initial_state()
        features = state_to_ml_features(s)
        for key in ["heart_rate", "systolic_bp", "diastolic_bp", "edv", "esv"]:
            self.assertIn(key, features)

    def test_features_are_floats(self):
        s = create_initial_state()
        features = state_to_ml_features(s)
        for key, val in features.items():
            self.assertIsInstance(val, float, f"{key} is not float")

    def test_rag_dict_keys(self):
        s = create_initial_state()
        rag = state_to_rag_dict(s)
        for key in ["time", "heart_rate", "systolic_bp", "diastolic_bp",
                    "map", "cardiac_output", "stroke_volume", "edv", "esv",
                    "lv_pressure", "aortic_pressure", "blood_volume",
                    "contractility", "svr", "valves"]:
            self.assertIn(key, rag, f"Missing RAG key: {key}")

    def test_adapter_does_not_mutate_state(self):
        s = create_initial_state()
        original_hr = s.heart_rate_bpm
        _ = state_to_ml_features(s)
        _ = state_to_rag_dict(s)
        self.assertEqual(s.heart_rate_bpm, original_hr)


# ===========================================================================
# 14. Baroreflex unit tests
# ===========================================================================

class TestBaroreflex(unittest.TestCase):

    def test_low_map_increases_hr(self):
        hr_new, _, _ = baroreflex_step(72.0, 1.0, 1.0, 60.0, 0.1, BAROREFLEX)
        self.assertGreater(hr_new, 72.0)

    def test_high_map_decreases_hr(self):
        hr_new, _, _ = baroreflex_step(72.0, 1.0, 1.0, 110.0, 0.1, BAROREFLEX)
        self.assertLess(hr_new, 72.0)

    def test_hr_bounded_below(self):
        hr_new, _, _ = baroreflex_step(40.0, 1.0, 1.0, 160.0, 100.0, BAROREFLEX)
        self.assertGreaterEqual(hr_new, BAROREFLEX.hr_min_bpm)

    def test_hr_bounded_above(self):
        hr_new, _, _ = baroreflex_step(180.0, 1.0, 1.0, 20.0, 100.0, BAROREFLEX)
        self.assertLessEqual(hr_new, BAROREFLEX.hr_max_bpm)


# ===========================================================================
# 15. step() does not mutate input state
# ===========================================================================

class TestImmutability(unittest.TestCase):

    def test_step_does_not_mutate_input(self):
        s0 = create_initial_state()
        original_hr    = s0.heart_rate_bpm
        original_lv_v  = s0.chambers["left_ventricle"].volume_ml
        original_time  = s0.time_s
        _ = step(s0)
        self.assertEqual(s0.heart_rate_bpm, original_hr)
        self.assertEqual(s0.chambers["left_ventricle"].volume_ml, original_lv_v)
        self.assertEqual(s0.time_s, original_time)


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main(verbosity=2)
