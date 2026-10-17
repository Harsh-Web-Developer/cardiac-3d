"""Final integration E2E verification for all CARDIA backend endpoints."""
import urllib.request
import json
import asyncio
import websockets

BASE = "http://127.0.0.1:8000"

def test_ml():
    req = urllib.request.Request(
        f"{BASE}/api/ml/predict",
        data=json.dumps({}).encode(),
        headers={"Content-Type": "application/json"}
    )
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    assert data["status"] == "success"
    p = data["inferred_parameters"]
    assert "blood_volume_l" in p
    assert "contractility" in p
    assert "systemic_vascular_resistance" in p
    print(f"[OK] ML /api/ml/predict -> Blood Vol: {p['blood_volume_l']}L, Contractility: {p['contractility']}, SVR: {p['systemic_vascular_resistance']}")

def test_rag():
    req = urllib.request.Request(
        f"{BASE}/api/rag/ask",
        data=json.dumps({"question": "What happens to cardiac output during hemorrhagic shock?"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    assert data["status"] == "success"
    assert len(data["explanation"]) > 50
    print(f"[OK] RAG /api/rag/ask -> {len(data['explanation'])} char explanation, confidence: {data['confidence']}")

async def test_ws():
    uri = "ws://127.0.0.1:8000/ws/simulation"
    async with websockets.connect(uri) as ws:
        msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
        data = json.loads(msg)
        assert data["type"] == "telemetry"
        assert "metrics" in data
        assert "valves" in data
        assert "chambers" in data
        m = data["metrics"]
        print(f"[OK] WS /ws/simulation -> HR: {data['heart_rate_bpm']} bpm, SBP: {m['systolic_bp_mmhg']} mmHg, CO: {m['cardiac_output_l_min']} L/min, EF: {m['ejection_fraction_pct']}%")

        # Test a control command
        await ws.send(json.dumps({"action": "set_parameters", "hr": 90.0}))
        # Drain a few messages
        for _ in range(3):
            try:
                await asyncio.wait_for(ws.recv(), timeout=1.0)
            except asyncio.TimeoutError:
                break
        print("[OK] WS control command 'set_parameters' sent successfully")

def main():
    print("=" * 60)
    print("CARDIA Backend Integration Verification")
    print("=" * 60)
    print()

    try:
        test_ml()
    except Exception as e:
        print(f"[FAIL] ML test: {e}")

    try:
        test_rag()
    except Exception as e:
        print(f"[FAIL] RAG test: {e}")

    try:
        asyncio.run(test_ws())
    except Exception as e:
        print(f"[FAIL] WebSocket test: {e}")

    print()
    print("=" * 60)
    print("All CARDIA system checks completed.")
    print("Open http://127.0.0.1:8000 in your browser to use the cockpit.")
    print("=" * 60)

if __name__ == "__main__":
    main()
