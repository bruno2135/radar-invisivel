// api/auth.js — Login e Registro
// Usa Supabase Auth (já vem com email, Google OAuth, JWT)

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, email, password, name, area, city } = req.body;

  try {
    // ==================== REGISTRO ====================
    if (action === 'register') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, area, city }, // salvo nos metadados do usuário
        },
      });
      if (error) throw error;

      // Cria perfil na tabela 'users'
      await supabase.from('users').insert({
        id: data.user.id,
        email,
        name,
        area,
        city,
        is_premium: false,
        free_used_today: 0,
        created_at: new Date().toISOString(),
      });

      return res.status(200).json({
        user: data.user,
        session: data.session,
        message: 'Conta criada! Verifique seu email.',
      });
    }

    // ==================== LOGIN ====================
    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Busca perfil completo
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      return res.status(200).json({
        user: data.user,
        session: data.session,
        profile,
      });
    }

    // ==================== LOGOUT ====================
    if (action === 'logout') {
      await supabase.auth.signOut();
      return res.status(200).json({ message: 'Logout realizado' });
    }

    return res.status(400).json({ error: 'Ação inválida' });

  } catch (err) {
    console.error('Erro auth:', err.message);
    res.status(400).json({ error: err.message });
  }
};
