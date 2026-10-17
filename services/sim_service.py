"""CARDIA Simulation Service.

Manages an active SimulationState instance and background simulation stepping loop.
Single source of truth for the cardiovascular system.
"""

from __future__ import annotations

import asyncio
import time
from typing import Set
from fastapi import WebSocket

from simulation.state import (
    SimulationState,
    create_initial_state,
    state_to_dict,
)
from simulation.cardiovascular import step
from simulation.adapter import state_to_ml_features, state_to_rag_dict


class SimulationService:
    def __init__(self):
        self.state: SimulationState = create_initial_state()
        self.running: bool = True
        self.speed: float = 1.0  # Time multiplier (0.5x, 1.0x, 2.0x)
        self.dt: float = 0.01    # Physical simulation step (100 Hz)
        self._lock = asyncio.Lock()
        self.active_websockets: Set[WebSocket] = set()
        self._task: asyncio.Task | None = None

    def start_loop(self):
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run_simulation())

    async def register_client(self, websocket: WebSocket):
        await websocket.accept()
        self.active_websockets.add(websocket)
        # Send initial snapshot immediately
        snapshot = self.get_telemetry_snapshot()
        await websocket.send_json(snapshot)

    def unregister_client(self, websocket: WebSocket):
        self.active_websockets.discard(websocket)

    async def _run_simulation(self):
        """Simulation loop running at dt = 0.01s, broadcasting at ~25 Hz."""
        last_broadcast = time.perf_counter()
        broadcast_interval = 0.04  # ~25 visual updates per second

        while True:
            try:
                loop_start = time.perf_counter()
                
                if self.running:
                    async with self._lock:
                        # Advance simulation step (immutable step pattern)
                        self.state = step(self.state, dt=self.dt)

                now = time.perf_counter()
                if now - last_broadcast >= broadcast_interval:
                    snapshot = self.get_telemetry_snapshot()
                    await self._broadcast(snapshot)
                    last_broadcast = now

                # Sleep to maintain physics time pacing
                # Base step is dt / speed
                elapsed = time.perf_counter() - loop_start
                target_delay = (self.dt / max(0.1, self.speed))
                sleep_time = max(0.001, target_delay - elapsed)
                await asyncio.sleep(sleep_time)

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in simulation loop: {e}")
                await asyncio.sleep(0.05)

    async def _broadcast(self, data: dict):
        if not self.active_websockets:
            return
        disconnected = []
        for ws in self.active_websockets:
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.active_websockets.discard(ws)

    def get_telemetry_snapshot(self) -> dict:
        """Returns the serialized state formatted for real-time telemetry rendering."""
        s = self.state
        m = s.metrics
        c = s.circulation

        # Extract chambers
        chambers_data = {}
        for name, ch in s.chambers.items():
            chambers_data[name] = {
                "name": ch.name,
                "volume_ml": round(ch.volume_ml, 2),
                "pressure_mmhg": round(ch.pressure_mmhg, 2),
                "compliance": round(ch.compliance_ml_per_mmhg, 2)
            }

        # Extract valves
        valves_data = {}
        for name, v in s.valves.items():
            valves_data[name] = {
                "name": v.name,
                "is_open": v.is_open,
                "flow_ml_per_s": round(v.flow_ml_per_s, 2)
            }

        return {
            "type": "telemetry",
            "time_s": round(s.time_s, 3),
            "running": self.running,
            "speed": self.speed,
            "heart_rate_bpm": round(s.heart_rate_bpm, 1),
            "cardiac_phase": s.cardiac_phase,
            "contractility": round(s.contractility, 3),
            "circulation": {
                "blood_volume_l": round(c.blood_volume_l, 3),
                "systemic_vascular_resistance": round(c.systemic_vascular_resistance, 3),
                "venous_pressure_mmhg": round(c.venous_pressure_mmhg, 2),
                "aortic_pressure_mmhg": round(c.aortic_pressure_mmhg, 2),
                "pulmonary_artery_pressure_mmhg": round(c.pulmonary_artery_pressure_mmhg, 2)
            },
            "metrics": {
                "edv_ml": round(m.end_diastolic_volume_ml, 1),
                "esv_ml": round(m.end_systolic_volume_ml, 1),
                "stroke_volume_ml": round(m.stroke_volume_ml, 1),
                "cardiac_output_l_min": round(m.cardiac_output_l_min, 2),
                "systolic_bp_mmhg": round(m.systolic_bp_mmhg, 1),
                "diastolic_bp_mmhg": round(m.diastolic_bp_mmhg, 1),
                "map_mmhg": round(m.map_mmhg, 1),
                "ejection_fraction_pct": round((m.stroke_volume_ml / max(1.0, m.end_diastolic_volume_ml)) * 100.0, 1)
            },
            "chambers": chambers_data,
            "valves": valves_data
        }

    async def handle_control_message(self, data: dict):
        action = data.get("action")
        async with self._lock:
            if action == "run":
                self.running = True
            elif action == "pause":
                self.running = False
            elif action == "reset":
                self.state = create_initial_state()
                self.running = True
            elif action == "set_speed":
                self.speed = float(data.get("speed", 1.0))
            elif action == "set_parameters":
                # Interventions on the state
                if "hr" in data:
                    self.state.heart_rate_bpm = float(data["hr"])
                if "blood_volume" in data:
                    self.state.circulation.blood_volume_l = float(data["blood_volume"])
                if "contractility" in data:
                    self.state.contractility = float(data["contractility"])
                if "svr" in data:
                    # Frontend slider may provide either relative or absolute dyn·s/cm5 (1120 baseline ~ 1.0)
                    svr_val = float(data["svr"])
                    if svr_val > 10.0:
                        svr_val = svr_val / 1120.0
                    self.state.circulation.systemic_vascular_resistance = svr_val

        # Immediate broadcast after control change
        snapshot = self.get_telemetry_snapshot()
        await self._broadcast(snapshot)

    def get_ml_features(self) -> dict:
        return state_to_ml_features(self.state)

    def get_rag_dict(self) -> dict:
        return state_to_rag_dict(self.state)


# Global singleton instance
sim_service = SimulationService()
