"""CARDIA Physiology Engine — Baseline Demo.

Runs a 30-second simulation from healthy resting conditions and prints
key cardiovascular metrics plus a sample of cardiac phase transitions.

Usage
-----
    python simulation/demo.py

or from the project root:

    python -m simulation.demo
"""

from __future__ import annotations

import sys
import os

# Allow running from project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from simulation.state import create_initial_state
from simulation.cardiovascular import simulate

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DURATION_S  = 30.0   # seconds
DT_S        = 0.01   # timestep


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("  CARDIA PHYSIOLOGY ENGINE  -  Baseline Demo")
    print("=" * 60)
    print(f"\nSimulation parameters:")
    print(f"  Duration  : {DURATION_S:.0f} s")
    print(f"  Timestep  : {DT_S*1000:.0f} ms")
    print(f"  Steps     : {int(DURATION_S / DT_S):,}")

    initial = create_initial_state()
    history = simulate(initial, DURATION_S, DT_S)

    # Take the final steady-state snapshot
    final = history[-1]

    print("\n" + "-" * 60)
    print("  STEADY-STATE METRICS  (end of simulation)")
    print("-" * 60)
    print(f"  Heart rate        : {final.heart_rate_bpm:7.1f} bpm")
    print(f"  EDV               : {final.metrics.end_diastolic_volume_ml:7.1f} mL")
    print(f"  ESV               : {final.metrics.end_systolic_volume_ml:7.1f} mL")
    print(f"  Stroke volume     : {final.metrics.stroke_volume_ml:7.1f} mL")
    print(f"  Cardiac output    : {final.metrics.cardiac_output_l_min:7.2f} L/min")
    print(f"  Systolic BP       : {final.metrics.systolic_bp_mmhg:7.1f} mmHg")
    print(f"  Diastolic BP      : {final.metrics.diastolic_bp_mmhg:7.1f} mmHg")
    print(f"  MAP               : {final.metrics.map_mmhg:7.1f} mmHg")
    print(f"  Blood volume      : {final.circulation.blood_volume_l:7.3f} L")
    print(f"  SVR               : {final.circulation.systemic_vascular_resistance:7.3f}  (x baseline)")
    print(f"  Contractility     : {final.contractility:7.3f}")
    print(f"  Aortic pressure   : {final.circulation.aortic_pressure_mmhg:7.1f} mmHg")
    print(f"  Venous pressure   : {final.circulation.venous_pressure_mmhg:7.1f} mmHg")
    print(f"  PA pressure       : {final.circulation.pulmonary_artery_pressure_mmhg:7.1f} mmHg")

    # -----------------------------------------------------------------------
    # Phase transition log — print every detected phase change
    # -----------------------------------------------------------------------
    print("\n" + "-" * 60)
    print("  CARDIAC PHASE TRANSITIONS  (first 10 s)")
    print("-" * 60)
    print(f"  {'Time (s)':>10}  {'Phase':<35}  {'LV Vol (mL)':>12}  {'LV P (mmHg)':>12}")
    print(f"  {'-'*10}  {'-'*35}  {'-'*12}  {'-'*12}")

    prev_phase = history[0].cardiac_phase
    transitions_shown = 0
    for s in history:
        if s.time_s > 10.0:
            break
        if s.cardiac_phase != prev_phase:
            lv = s.chambers["left_ventricle"]
            print(
                f"  {s.time_s:>10.3f}  {s.cardiac_phase:<35}"
                f"  {lv.volume_ml:>12.1f}  {lv.pressure_mmhg:>12.1f}"
            )
            prev_phase = s.cardiac_phase
            transitions_shown += 1

    if transitions_shown == 0:
        print("  (no transitions captured — check phase logic)")

    # -----------------------------------------------------------------------
    # Valve state at end of simulation
    # -----------------------------------------------------------------------
    print("\n" + "-" * 60)
    print("  VALVE STATE  (end of simulation)")
    print("-" * 60)
    for name, valve in final.valves.items():
        status = "OPEN" if valve.is_open else "CLOSED"
        print(f"  {name:<14} : {status:6}  flow={valve.flow_ml_per_s:7.1f} mL/s")

    # -----------------------------------------------------------------------
    # Blood volume conservation check
    # -----------------------------------------------------------------------
    initial_bv = initial.circulation.blood_volume_l
    final_bv   = final.circulation.blood_volume_l
    drift_ml   = (final_bv - initial_bv) * 1000.0
    print("\n" + "-" * 60)
    print("  CONSERVATION CHECK")
    print("-" * 60)
    print(f"  Initial blood volume : {initial_bv:.4f} L")
    print(f"  Final blood volume   : {final_bv:.4f} L")
    print(f"  Drift                : {drift_ml:+.2f} mL  (should be ~ 0)")

    print("\n" + "=" * 60)
    print("  Demo complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
