import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function legacyDatabasePlugin() {
  let cache = null;
  const loadCache = () => {
    if (!cache) {
      try {
        const cachePath = path.resolve('public/data/legado_cache.json');
        if (fs.existsSync(cachePath)) {
          cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        }
      } catch (err) {
        console.error('Failed to load legacy cache in Vite:', err);
      }
    }
    return cache;
  };

  return {
    name: 'legacy-database-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/api/consulta_historico.php') {
          const db = loadCache();
          if (!db) return next();

          const action = url.searchParams.get('action') || 'search';
          if (action === 'status') {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            return res.end(JSON.stringify({
              success: true,
              connected: true,
              database: 'legado_local',
              totalRegistros: db.stats?.total || 32204,
              counts: db.stats || {}
            }));
          }

          const q = (url.searchParams.get('q') || '').trim().toLowerCase();
          const digits = q.replace(/\D/g, '');
          const tipo = url.searchParams.get('tipo') || 'todas';
          const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
          const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10)));
          const offset = (page - 1) * limit;

          const filterItem = (item) => {
            if (!q) return true;
            for (const [k, v] of Object.entries(item)) {
              if (!v) continue;
              const str = String(v).toLowerCase();
              if (str.includes(q)) return true;
              if (digits.length >= 3) {
                const itemDigits = str.replace(/\D/g, '');
                if (itemDigits && itemDigits.includes(digits)) return true;
              }
            }
            return false;
          };

          const tables = ['marketing', 'vendas', 'vouchers', 'parcelas', 'estoque'];
          const filtered = {};
          const counts = {};

          for (const t of tables) {
            if (tipo === 'todas' || tipo === t) {
              const list = db[t] || [];
              filtered[t] = q ? list.filter(filterItem) : list;
              counts[t] = filtered[t].length;
            } else {
              filtered[t] = [];
              counts[t] = (db[t] || []).length;
            }
          }

          const activeTotal = tipo === 'todas'
            ? Object.values(counts).reduce((a, b) => a + b, 0)
            : (counts[tipo] || 0);

          const totalPages = Math.max(1, Math.ceil(activeTotal / limit));

          const results = {};
          for (const t of tables) {
            if (tipo === 'todas' || tipo === t) {
              results[t] = filtered[t].slice(offset, offset + limit);
            } else {
              results[t] = [];
            }
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(JSON.stringify({
            success: true,
            query: q,
            tipo,
            page,
            limit,
            total: activeTotal,
            totalPages,
            counts,
            results
          }));
        }

        if (url.pathname === '/api/salvar_pos_venda.php') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const db = loadCache();
              if (db && parsed.table && parsed.id) {
                const list = db[parsed.table] || [];
                const idx = list.findIndex(item => item.id === parsed.id || String(item.os) === String(parsed.os));
                if (idx !== -1) {
                  list[idx] = { ...list[idx], ...parsed };
                }
              }
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: true, message: 'Gravado com sucesso no cache local!' }));
            } catch (e) {
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, error: e.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), legacyDatabasePlugin()],
  base: '/',
  build: {
    target: ['es2020', 'safari14', 'chrome87', 'firefox78', 'edge88'],
  },
})
