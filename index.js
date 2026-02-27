export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET all leads or search
      if (path === '/api/leads' && method === 'GET') {
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || '';
        
        let query = 'SELECT * FROM leads WHERE 1=1';
        const params = [];
        
        if (search) {
          query += ' AND (name LIKE ? OR company LIKE ? OR email LIKE ?)';
          const searchTerm = `%${search}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        }
        
        if (status && status !== 'all') {
          query += ' AND status = ?';
          params.push(status);
        }
        
        query += ' ORDER BY created_date DESC';
        
        const stmt = env.DB.prepare(query);
        const result = await stmt.bind(...params).all();
        
        return new Response(JSON.stringify(result.results), { headers: corsHeaders });
      }

      // GET single lead
      if (path.startsWith('/api/leads/') && method === 'GET') {
        const id = path.split('/')[3];
        const stmt = env.DB.prepare('SELECT * FROM leads WHERE id = ?');
        const result = await stmt.bind(id).first();
        
        if (!result) {
          return new Response(JSON.stringify({ error: 'Lead not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }
        
        return new Response(JSON.stringify(result), { headers: corsHeaders });
      }

      // CREATE new lead
      if (path === '/api/leads' && method === 'POST') {
        const body = await request.json();
        const { name, company, email, phone, status, owner, ownerAvatar } = body;
        
        // Validate required fields
        if (!name || !company || !email || !phone || !status || !owner) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: corsHeaders
          });
        }
        
        const stmt = env.DB.prepare(
          'INSERT INTO leads (name, company, email, phone, status, owner, owner_avatar) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        
        const avatarInitials = ownerAvatar || owner.split(' ').map(n => n[0]).join('');
        
        try {
          const result = await stmt.bind(name, company, email, phone, status, owner, avatarInitials).run();
          
          // Get the newly created lead
          const newLead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?')
            .bind(result.meta.last_row_id)
            .first();
          
          return new Response(JSON.stringify(newLead), {
            status: 201,
            headers: corsHeaders
          });
        } catch (error) {
          return new Response(JSON.stringify({ error: 'Failed to create lead' }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // UPDATE existing lead
      if (path.startsWith('/api/leads/') && method === 'PUT') {
        const id = path.split('/')[3];
        const body = await request.json();
        const { name, company, email, phone, status, owner, ownerAvatar } = body;
        
        // Check if lead exists
        const existingLead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
        if (!existingLead) {
          return new Response(JSON.stringify({ error: 'Lead not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }
        
        const stmt = env.DB.prepare(
          'UPDATE leads SET name = ?, company = ?, email = ?, phone = ?, status = ?, owner = ?, owner_avatar = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?'
        );
        
        const avatarInitials = ownerAvatar || owner.split(' ').map(n => n[0]).join('');
        
        await stmt.bind(name, company, email, phone, status, owner, avatarInitials, id).run();
        
        // Get updated lead
        const updatedLead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
        
        return new Response(JSON.stringify(updatedLead), { headers: corsHeaders });
      }

      // DELETE lead
      if (path.startsWith('/api/leads/') && method === 'DELETE') {
        const id = path.split('/')[3];
        
        // Check if lead exists
        const existingLead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(id).first();
        if (!existingLead) {
          return new Response(JSON.stringify({ error: 'Lead not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }
        
        const stmt = env.DB.prepare('DELETE FROM leads WHERE id = ?');
        await stmt.bind(id).run();
        
        return new Response(JSON.stringify({ message: 'Lead deleted successfully' }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // 404 for unknown routes
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};
