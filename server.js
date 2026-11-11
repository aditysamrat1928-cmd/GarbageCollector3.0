const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function startServer(base, port) {
  const dataDir = path.join(base, 'data');
  const photosDir = path.join(base, 'photos');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(photosDir, { recursive: true });

  const dbFile = path.join(dataDir, 'db.json');
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ users: [], requests: [], payments: [] }, null, 2));
  }

  const read = () => JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  const write = d => fs.writeFileSync(dbFile, JSON.stringify(d, null, 2));

  const hash = (password, salt = crypto.randomBytes(16).toString('hex')) => ({
    salt,
    hash: crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex')
  });

  const verify = (password, user) => {
    const a = Buffer.from(crypto.pbkdf2Sync(password, user.salt, 120000, 32, 'sha256').toString('hex'));
    const b = Buffer.from(user.hash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  };

  const seed = read();
  if (!seed.users.some(u => u.role === 'manager')) {
    const h = hash('Manager@123');
    seed.users.push({
      id: crypto.randomUUID(),
      name: 'Manager',
      email: 'manager@garbagecollector.local',
      role: 'manager',
      ...h
    });
    write(seed);
  }

  const MAX_BODY = 40 * 1024 * 1024;
  const MIME = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

  // Saves data-URL images to the photos folder and returns their /photos/<name> paths.
  function savePhotos(list) {
    const out = [];
    for (const item of (Array.isArray(list) ? list : []).slice(0, 6)) {
      const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(item || ''));
      if (!m) continue;
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length || buf.length > 8 * 1024 * 1024) continue;
      const ext = m[1] === 'jpeg' ? '.jpg' : '.' + m[1];
      const name = crypto.randomUUID() + ext;
      fs.writeFileSync(path.join(photosDir, name), buf);
      out.push('/photos/' + name);
    }
    return out;
  }

  function send(res, status, obj) {
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(obj));
  }

  function body(req) {
    return new Promise((resolve, reject) => {
      let b = '';
      req.on('data', c => {
        b += c;
        if (b.length > MAX_BODY) { reject(new Error('Upload too large')); req.destroy(); }
      });
      req.on('end', () => {
        try { resolve(b ? JSON.parse(b) : {}); }
        catch (e) { reject(e); }
      });
    });
  }

  const srv = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }

    try {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (req.method === 'GET' && url.pathname.startsWith('/photos/')) {
        const name = path.basename(url.pathname);
        const ext = path.extname(name).toLowerCase();
        const file = path.join(photosDir, name);
        if (!MIME[ext] || !fs.existsSync(file)) return send(res, 404, { error: 'Photo not found' });
        res.writeHead(200, { 'Content-Type': MIME[ext], 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=86400' });
        return res.end(fs.readFileSync(file));
      }

      const d = read();

      if (req.method === 'GET' && url.pathname === '/api/requests') {
        return send(res, 200, { requests: d.requests });
      }

      if (req.method === 'POST' && url.pathname === '/api/signup') {
        const b = await body(req);
        if (!b.email || !b.password || !b.name) return send(res, 400, { error: 'Name, email and password are required' });
        if (d.users.some(x => x.email.toLowerCase() === b.email.toLowerCase())) {
          return send(res, 409, { error: 'Account already exists' });
        }
        const h = hash(b.password);
        const user = { id: crypto.randomUUID(), name: b.name, email: b.email, role: 'customer', ...h };
        d.users.push(user);
        write(d);
        return send(res, 200, { user: { id: user.id, name: user.name, email: user.email, role: user.role } });
      }

      if (req.method === 'POST' && url.pathname === '/api/login') {
        const b = await body(req);
        const user = d.users.find(x =>
          x.email.toLowerCase() === String(b.email || '').toLowerCase() &&
          x.role === b.role
        );
        if (!user || !verify(String(b.password || ''), user)) {
          return send(res, 401, { error: 'Invalid login details' });
        }
        return send(res, 200, { user: { id: user.id, name: user.name, email: user.email, role: user.role } });
      }

      if (req.method === 'POST' && url.pathname === '/api/request') {
        const b = await body(req);
        if (!b.customerId || !b.problem || !b.location) {
          return send(res, 400, { error: 'Problem and location are required' });
        }
        const r = {
          id: crypto.randomUUID(),
          customerId: b.customerId,
          customerName: b.customerName,
          customerEmail: b.customerEmail,
          problem: b.problem,
          location: b.location,
          description: b.description || '',
          photos: savePhotos(b.photos),
          afterPhotos: [],
          status: 'New',
          paymentStatus: 'Pending',
          amount: Number(b.amount || 0),
          createdAt: new Date().toISOString(),
          visitAt: null,
          completedAt: null
        };
        d.requests.unshift(r);
        write(d);
        return send(res, 200, { request: r });
      }

      // Manager uploads proof-of-work photos (only after the visit has started)
      let m = req.method === 'POST' && /^\/api\/request\/([^/]+)\/after-photos$/.exec(url.pathname);
      if (m) {
        const b = await body(req);
        const r = d.requests.find(x => x.id === m[1]);
        if (!r) return send(res, 404, { error: 'Request not found' });
        if (r.status !== 'Visit Planned') return send(res, 400, { error: 'Start the visit before uploading work photos' });
        const saved = savePhotos(b.photos);
        if (!saved.length) return send(res, 400, { error: 'Please choose at least one valid photo (JPG, PNG or WEBP)' });
        r.afterPhotos = (r.afterPhotos || []).concat(saved);
        write(d);
        return send(res, 200, { request: r });
      }

      m = req.method === 'POST' && /^\/api\/request\/([^/]+)$/.exec(url.pathname);
      if (m) {
        const b = await body(req);
        const r = d.requests.find(x => x.id === m[1]);
        if (!r) return send(res, 404, { error: 'Request not found' });
        if (b.status === 'Visit Planned') {
          if (r.status !== 'New') return send(res, 400, { error: 'Visit can only be started on a new request' });
          r.status = 'Visit Planned';
          r.visitAt = new Date().toISOString();
        } else if (b.status === 'Completed') {
          if (r.status !== 'Visit Planned') return send(res, 400, { error: 'Start the visit before completing' });
          if (!(r.afterPhotos || []).length) return send(res, 400, { error: 'Upload at least one work photo before completing' });
          r.status = 'Completed';
          r.completedAt = new Date().toISOString();
        } else if (b.status) {
          return send(res, 400, { error: 'Invalid status' });
        }
        if (b.amount !== undefined) r.amount = Number(b.amount);
        write(d);
        return send(res, 200, { request: r });
      }

      if (req.method === 'POST' && url.pathname === '/api/payment') {
        const b = await body(req);
        const r = d.requests.find(x => x.id === b.requestId);
        if (!r) return send(res, 404, { error: 'Request not found' });
        const payment = {
          id: crypto.randomUUID(),
          requestId: r.id,
          customerId: r.customerId,
          amount: Number(b.amount || r.amount || 0),
          method: b.method || 'UPI',
          status: 'Paid',
          transactionId: 'GC-' + Date.now(),
          paidAt: new Date().toISOString()
        };
        r.amount = payment.amount;
        r.paymentStatus = 'Paid';
        d.payments.unshift(payment);
        write(d);
        return send(res, 200, { payment, request: r });
      }

      if (req.method === 'GET' && url.pathname === '/api/payments') {
        return send(res, 200, { payments: d.payments });
      }

      return send(res, 404, { error: 'Not found' });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  });

  srv.listen(port, '0.0.0.0');
  return new Promise(resolve => srv.once('listening', () => resolve(srv)));
}

module.exports = { startServer };
