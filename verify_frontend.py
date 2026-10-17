import urllib.request

resp = urllib.request.urlopen('http://127.0.0.1:8000/')
content = resp.read().decode()

checks = [
    'btn-open-ml',
    'modal-ml',
    'rag-input-text',
    'btn-send-rag',
    'rag-chat-messages',
    'connectSimulationWebSocket',
    'ws/simulation',
    '/api/ml/predict',
    '/api/rag/ask',
    'btn-run-ml',
    'btn-close-ml',
    'ml-inf-vol',
    'ml-inf-contract',
    'ml-inf-svr',
    'hud-edv',
    'hud-ef',
    'canvas-ecg',
    'canvas-pv',
    'canvas-pressure-flow',
    'canvas-cardiac-3d',
    'drawer-ask-why',
    'modal-fork',
    'btn-run',
    'btn-pause',
    'preset-btn',
    'slider-hr',
    'slider-vol',
    'slider-contract',
    'slider-svr',
]

ok = 0
miss = 0
for check in checks:
    found = check in content
    status = 'OK' if found else 'MISSING'
    print(f'[{status}] {check}')
    if found:
        ok += 1
    else:
        miss += 1

print(f'\nTotal: {ok} OK / {miss} MISSING | Page: {len(content)} bytes')
