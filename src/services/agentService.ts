import { agentConfig } from '../config/theme';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export const agentService = {

  /**
   * Agent pour les vendeurs
   * Utilisé pour générer des conseils ou des réponses
   */
  async askAgent(question: string, context: string = '', sellerId?: string): Promise<string> {
    try {
    const key = agentConfig.geminiApiKey;
      if (!key) {
        console.warn("⚠️ EXPO_PUBLIC_GEMINI_API_KEY non configurée dans .env");
        return "Service d'IA temporairement indisponible. Clé API manquante.";
      }

      const response = await fetch(`${GEMINI_URL}?key=${key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${context ? `Contexte :\n${context}\n\n` : ''}${question}`
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini API Error (${response.status}): ${errBody}`);
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) {
        throw new Error("Réponse Gemini vide ou mal formée");
      }
      return reply;
    } catch (error) {
      console.error("❌ Erreur agentService.askAgent:", error);
      return "Service d'IA temporairement indisponible.";
    }
  },

  /**
   * Agent pour l'administrateur
   */
  async askAdminAgent(question: string, context: string = ''): Promise<string> {
    return this.askAgent(question, context);
  }
};