import { supabase } from '../lib/supabase';
import { agentConfig } from '../config/theme';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent';

export const agentService = {

  /**
   * Agent pour les vendeurs
   */
  async askAgent(question: string, context: string = '', sellerId?: string): Promise<string> {
    const apiKey = agentConfig.geminiApiKey;
    if (!apiKey) {
      console.warn("❌ GEMINI_API_KEY manquante. Vérifiez votre .env et app.config.js");
      return "Clé API Gemini non configurée. Contactez l'administrateur.";
    }

    const fullPrompt = `
Tu es un assistant ultra-simple, clair et bienveillant pour l'application LibreShop (côté vendeur).
Tu connais parfaitement : Dashboard, Commandes (En attente / Payées), Produits, Stats, et Caisse physique.
Réponds toujours en français, en maximum 3 phrases. Sois direct, utile et sans blabla.

Contexte des ventes du vendeur :
---
${context || 'Aucun contexte disponible'}
---

Question du vendeur : ${question}
`;

    try {
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }]
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status}`);
      }

      const data = await res.json();
      const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() 
        || "Désolé, je n'ai pas de réponse pour le moment.";

      // Log dans Supabase (en arrière-plan)
      if (sellerId && supabase) {
        supabase.from('agent_logs').insert({
          seller_id: sellerId,
          question,
          answer
        }).then(({ error }) => {
          if (error) console.warn('[agentService] Log non enregistré:', error.message);
        });
      }

      return answer;

    } catch (err: any) {
      console.error('[agentService] Error:', err);
      return "Erreur de connexion – veuillez réessayer dans quelques secondes.";
    }
  },

  /**
   * Agent pour l'administrateur
   */
  async askAdminAgent(question: string, context: string = ''): Promise<string> {
    const apiKey = agentConfig.geminiApiKey;
    if (!apiKey) {
      return "Clé API Gemini non configurée.";
    }

    const fullPrompt = `
Tu es l'assistant expert de l'administrateur de LibreShop.
Tu analyses les performances globales, les tendances et les questions des vendeurs.
Réponds en français de façon structurée et directe.

Contexte / Logs :
---
${context || 'Aucun contexte disponible'}
---

Question de l'admin : ${question}
`;

    try {
      const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }]
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() 
        || "Impossible d'analyser pour le moment.";

    } catch (err) {
      console.error('[agentService Admin] Error:', err);
      return "Erreur de connexion – réessaie plus tard.";
    }
  }
};