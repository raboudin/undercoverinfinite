import { Injectable } from '@nestjs/common';

/**
 * Config LLM entièrement pilotée par l'environnement : `LLM_API_KEY`
 * (obligatoire), `LLM_MODEL` et `LLM_GATEWAY_URL` (optionnels, défauts
 * ci-dessous). Changer de modèle ou de fournisseur OpenAI-compatible ne
 * demande donc aucune modification de code.
 */
export const DEFAULT_GATEWAY_URL =
  'https://ai-gateway.vercel.sh/v1/chat/completions';
export const DEFAULT_MODEL = 'google/gemini-3.5-flash-lite';

/** Lit une variable d'env en traitant vide/espaces comme absente. */
function envOr(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

/**
 * Accès minimal à un endpoint `POST /chat/completions` OpenAI-compatible.
 *
 * Séparé de `WordsService` parce que deux contenus très différents passent
 * désormais par le même tuyau (paires de mots et défis) : le service se
 * concentre sur les prompts et le parsing, le client sur le transport.
 */
@Injectable()
export class LlmClient {
  /** Rend le contenu texte de la première complétion. */
  async complete(prompt: string): Promise<string> {
    const apiKey = process.env.LLM_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        'LLM_API_KEY manquante : impossible de générer du contenu',
      );
    }

    const response = await fetch(
      envOr('LLM_GATEWAY_URL', DEFAULT_GATEWAY_URL),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: envOr('LLM_MODEL', DEFAULT_MODEL),
          messages: [{ role: 'user', content: prompt }],
          temperature: 1,
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Le gateway LLM a répondu ${response.status} : ${detail.slice(0, 500)}`,
      );
    }

    return this.extractContent(await response.json());
  }

  /** Extrait `choices[0].message.content` d'une réponse OpenAI-compatible. */
  private extractContent(payload: unknown): string {
    if (typeof payload === 'object' && payload !== null) {
      const choices = (payload as Record<string, unknown>).choices;
      if (Array.isArray(choices) && choices.length > 0) {
        const first: unknown = choices[0];
        if (typeof first === 'object' && first !== null) {
          const message = (first as Record<string, unknown>).message;
          if (typeof message === 'object' && message !== null) {
            const content = (message as Record<string, unknown>).content;
            if (typeof content === 'string') return content;
          }
        }
      }
    }
    throw new Error('Réponse LLM sans contenu exploitable');
  }
}

/**
 * Les modèles emballent volontiers leur JSON dans des fences markdown malgré
 * la consigne : on les retire avant de parser plutôt que d'échouer dessus.
 */
export function parseJsonArray(content: string): unknown[] {
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(`Réponse LLM illisible : ${content.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Réponse LLM : un tableau JSON était attendu');
  }
  return parsed;
}
