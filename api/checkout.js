// api/checkout.js — Vercel Serverless Function
// Cria sessão de pagamento no Stripe

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  // Permite chamadas do seu frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const { userId, email } = req.body;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [{
        price: process.env.STRIPE_PRICE_ID, // ID do preço criado no Stripe
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?premium=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_URL}/dashboard?canceled=true`,
      metadata: { userId },
      subscription_data: {
        trial_period_days: 7, // 7 dias grátis (opcional)
      },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Erro no checkout:', err.message);
    res.status(500).json({ error: err.message });
  }
};
