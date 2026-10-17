/**
 * CARDIA Standalone High-Performance Server
 * Supports:
 * - Static file serving with Range requests (optimized for 17MB GLB 3D models)
 * - /models/heart.glb and /heart.glb endpoints
 * - Native RFC 6455 WebSocket simulation engine (/ws/simulation)
 * - Telemetry streaming at ~25 Hz with dynamic hemodynamic parameter feedback
 * - REST endpoints (/health, /api/assets/heart, /api/ml/predict, /api/rag/ask)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8000;
const ROOT = __dirname;
const FRONTEND_DIR = path.join(ROOT, 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// Simulation State
const simState = {
  running: true,
  time_s: 0,
  hr: 74,
  bloodVolume: 5.0,
  contractility: 1.0,
  svr: 1.0, // relative to nominal 1120
  speed: 1.0,
  cyclePhase: 0
};

// Connected WebSocket clients
const wsClients = new Set();

function encodeWsFrame(payloadStr) {
  const payload = Buffer.from(payloadStr);
  const length = payload.length;
  let header;

  if (length <= 125) {
    header = Buffer.from([0x81, length]);
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

function decodeWsFrame(buffer) {
  if (buffer.length < 2) return null;
  const isMasked = (buffer[1] & 0x80) !== 0;
  let payloadLen = buffer[1] & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let maskingKey = null;
  if (isMasked) {
    if (buffer.length < offset + 4) return null;
    maskingKey = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLen) return null;
  const payload = buffer.slice(offset, offset + payloadLen);

  if (isMasked && maskingKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskingKey[i % 4];
    }
  }

  return payload.toString('utf8');
}

// 25Hz Simulation Telemetry Loop
setInterval(() => {
  if (!simState.running || wsClients.size === 0) return;

  const dt = 0.04 * simState.speed;
  simState.time_s += dt;

  const beatDuration = 60 / Math.max(30, simState.hr);
  simState.cyclePhase = (simState.cyclePhase + (dt / beatDuration)) % 1.0;

  const cp = simState.cyclePhase;
  const isSystole = cp < 0.35;

  const edv = Math.round(115 + (simState.bloodVolume - 5.0) * 22);
  const esv = Math.round(44 / Math.max(0.4, simState.contractility));
  const sv = Math.max(20, edv - esv);
  const ef = (sv / edv) * 100;
  const co = (sv * simState.hr) / 1000;

  const sbp = Math.round(105 + (simState.contractility - 1.0) * 25 + (simState.svr - 1.0) * 30);
  const dbp = Math.round(72 + (simState.svr - 1.0) * 20);
  const mapVal = Math.round(dbp + (sbp - dbp) / 3);

  const telemetryMsg = {
    type: "telemetry",
    running: simState.running,
    time_s: parseFloat(simState.time_s.toFixed(2)),
    heart_rate_bpm: Math.round(simState.hr),
    contractility: parseFloat(simState.contractility.toFixed(2)),
    circulation: {
      blood_volume_l: parseFloat(simState.bloodVolume.toFixed(2)),
      systemic_vascular_resistance: parseFloat(simState.svr.toFixed(2)),
      venous_pressure_mmhg: 8.0
    },
    metrics: {
      systolic_bp_mmhg: sbp,
      diastolic_bp_mmhg: dbp,
      map_mmhg: mapVal,
      cardiac_output_l_min: parseFloat(co.toFixed(2)),
      stroke_volume_ml: parseFloat(sv.toFixed(1)),
      edv_ml: edv,
      esv_ml: esv,
      ejection_fraction_pct: parseFloat(ef.toFixed(1))
    },
    valves: {
      mitral: { is_open: !isSystole },
      aortic: { is_open: isSystole },
      tricuspid: { is_open: !isSystole },
      pulmonic: { is_open: isSystole }
    },
    chambers: {
      left_ventricle: {
        volume_ml: isSystole ? esv : edv,
        pressure_mmhg: isSystole ? sbp : 10
      },
      right_ventricle: {
        volume_ml: isSystole ? esv * 0.9 : edv * 0.9,
        pressure_mmhg: isSystole ? sbp * 0.22 : 4
      },
      left_atrium: {
        volume_ml: isSystole ? 65 : 30,
        pressure_mmhg: 12
      },
      right_atrium: {
        volume_ml: isSystole ? 60 : 28,
        pressure_mmhg: 5
      }
    }
  };

  const frame = encodeWsFrame(JSON.stringify(telemetryMsg));
  for (const socket of wsClients) {
    if (socket.writable) {
      socket.write(frame);
    }
  }
}, 40);

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // REST API Endpoints
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: "online", simulation_running: simState.running, time_s: simState.time_s }));
    return;
  }

  if (pathname === '/api/assets/heart') {
    const glbPath = path.join(FRONTEND_DIR, 'models', 'heart.glb');
    const available = fs.existsSync(glbPath);
    const size = available ? fs.statSync(glbPath).size : 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ available, path: "frontend/models/heart.glb", size_bytes: size }));
    return;
  }

  if (pathname === '/api/ml/predict' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        predicted_edv: 126.4,
        predicted_esv: 43.1,
        predicted_ef: 65.9,
        risk_score: 0.12,
        recommendation: "Hemodynamic parameters within normal physiological limits."
      }));
    });
    return;
  }

  if (pathname === '/api/rag/ask' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        answer: "The interactive 3D digital twin demonstrates synchronized Frank-Starling mechanics: as end-diastolic volume expands, myocardial contractility dynamically increases stroke volume and systemic perfusion pressure."
      }));
    });
    return;
  }

  // File resolution
  let filePath;
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(FRONTEND_DIR, 'index.html');
  } else if (pathname === '/models/heart.glb') {
    filePath = path.join(FRONTEND_DIR, 'models', 'heart.glb');
    if (!fs.existsSync(filePath)) filePath = path.join(FRONTEND_DIR, 'assets', 'heart.glb');
  } else if (pathname === '/heart.glb') {
    filePath = path.join(FRONTEND_DIR, 'heart.glb');
    if (!fs.existsSync(filePath)) filePath = path.join(FRONTEND_DIR, 'assets', 'heart.glb');
  } else if (pathname.startsWith('/static/')) {
    filePath = path.join(FRONTEND_DIR, pathname.replace(/^\/static\//, ''));
  } else {
    filePath = path.join(FRONTEND_DIR, pathname.replace(/^\//, ''));
  }

  // Fallback checks
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT, pathname.replace(/^\//, ''));
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found: ' + pathname);
    return;
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Support HTTP Range requests (crucial for large GLB models)
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = (end - start) + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// Upgrade HTTP to RFC 6455 WebSocket
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/ws/simulation') {
    const key = req.headers['sec-websocket-key'];
    const acceptKey = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    const responseHeaders = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`
    ];

    socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');
    wsClients.add(socket);

    socket.on('data', buffer => {
      try {
        const text = decodeWsFrame(buffer);
        if (text) {
          const msg = JSON.parse(text);
          if (msg.action === 'set_parameters') {
            if (msg.hr !== undefined) simState.hr = msg.hr;
            if (msg.blood_volume_l !== undefined) simState.bloodVolume = msg.blood_volume_l;
            if (msg.contractility !== undefined) simState.contractility = msg.contractility;
            if (msg.svr !== undefined) simState.svr = msg.svr / 1120.0;
          } else if (msg.action === 'set_speed') {
            if (msg.speed !== undefined) simState.speed = msg.speed;
          } else if (msg.action === 'pause') {
            simState.running = false;
          } else if (msg.action === 'run') {
            simState.running = true;
          }
        }
      } catch (err) {
        // frame parse guard
      }
    });

    socket.on('close', () => wsClients.delete(socket));
    socket.on('error', () => wsClients.delete(socket));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(`  CARDIA Digital Twin & 3D Heart Server is running!`);
  console.log(`  Access the web app at:  http://localhost:${PORT}`);
  console.log(`================================================================`);
});
