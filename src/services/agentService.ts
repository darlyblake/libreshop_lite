import { agentConfig } from '../config/theme';

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
];

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

      let lastError: any = null;

      for (const modelName of CANDIDATE_MODELS) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
        try {
          const response = await fetch(url, {
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
            const errText = await response.text();
            lastError = new Error(`Gemini ${modelName} Error (${response.status}): ${errText}`);
            if (response.status === 404) {
              // Modèle non trouvé, essayer le suivant dans la liste
              continue;
            }
            throw lastError;
          }

          const data = await response.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return reply;
          }
        } catch (mErr: any) {
          lastError = mErr;
          if (mErr?.message?.includes('404')) {
            continue;
          }
          throw mErr;
        }
      }

      if (lastError) throw lastError;
      return "Service d'IA temporairement indisponible.";
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