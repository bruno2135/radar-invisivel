// api/ai.js — Proxy seguro para a API Anthropic
// Fica no servidor — a chave NUNCA vai para o browser

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Valida token do usuário via Supabase (segurança)
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Não autorizado' });

  try {
    const { prompt, type } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

    // Limita o uso gratuito (pode adicionar lógica de rate-limit aqui)
    const systemPrompts = {
      career:      'Você é um assistente especialista em carreira e mercado de trabalho brasileiro. Responda de forma concisa e prática (máximo 150 palavras).',
      message:     'Você gera mensagens profissionais curtas para LinkedIn. Máximo 3 frases. Responda APENAS com a mensagem, sem explicações.',
      opportunity: 'Você identifica oportunidades de emprego invisíveis. Responda APENAS com JSON válido.',
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompts[type] || systemPrompts.career,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.content.map(c => c.text || '').join('');
    res.status(200).json({ text });

  } catch (err) {
    console.error('Erro na IA:', err.message);
    res.status(500).json({ error: err.message });
  }
};
