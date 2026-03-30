// api/webhook.js — Stripe Webhook
// Roda automaticamente quando pagamento é confirmado ou cancelado
// O Stripe chama esta URL com eventos em tempo real

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // chave de serviço (não a anon)
);

// Precisa do body RAW (não parseado) para validar assinatura
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,              // body RAW
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ==================== HANDLERS ====================

  switch (event.type) {

    // ✅ Pagamento confirmado — ativa Premium
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (userId) {
        await supabase
          .from('users')
          .update({
            is_premium: true,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            premium_since: new Date().toISOString(),
          })
          .eq('id', userId);
        console.log(`✅ Premium ativado para usuário ${userId}`);
      }
      break;
    }

    // ✅ Renovação mensal bem-sucedida — mantém Premium
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      await supabase
        .from('users')
        .update({ is_premium: true, premium_until: new Date(invoice.period_end * 1000).toISOString() })
        .eq('stripe_customer_id', invoice.customer);
      break;
    }

    // ❌ Pagamento falhou — mantém acesso por 3 dias depois cancela
    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`⚠️ Pagamento falhou para customer ${invoice.customer}`);
      // Stripe tenta novamente automaticamente. Se falhar 3x, dispara subscription.deleted
      break;
    }

    // ❌ Assinatura cancelada — remove Premium
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await supabase
        .from('users')
        .update({ is_premium: false, stripe_subscription_id: null })
        .eq('stripe_customer_id', sub.customer);
      console.log(`❌ Premium cancelado para customer ${sub.customer}`);
      break;
    }

    // ✅ Assinatura reativada
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const active = sub.status === 'active' || sub.status === 'trialing';
      await supabase
        .from('users')
        .update({ is_premium: active })
        .eq('stripe_customer_id', sub.customer);
      break;
    }

    default:
      console.log(`Evento ignorado: ${event.type}`);
  }

  res.status(200).json({ received: true });
};

// IMPORTANTE: desabilitar o body parser do Vercel para este endpoint
module.exports.config = { api: { bodyParser: false } };
