import {
  DEFAULT_GATEWAY_URL,
  DEFAULT_MODEL,
  LlmClient,
  parseJsonArray,
} from './llm.client';

/** Réponse OpenAI-compatible telle que la renvoie le Vercel AI Gateway. */
function gatewayResponse(content: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content } }],
      }) as Promise<unknown>,
  } as Response;
}

describe('LlmClient', () => {
  let client: LlmClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    client = new LlmClient();
    fetchMock = jest.fn().mockResolvedValue(gatewayResponse('["ok"]'));
    global.fetch = fetchMock;
    process.env.LLM_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_GATEWAY_URL;
  });

  function lastCall() {
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    return {
      url,
      body: JSON.parse(init.body) as Record<string, unknown>,
    };
  }

  it('utilise le modèle et le gateway par défaut', async () => {
    await client.complete('prompt');

    const { url, body } = lastCall();
    expect(url).toBe(DEFAULT_GATEWAY_URL);
    expect(body.model).toBe(DEFAULT_MODEL);
  });

  it('honore LLM_MODEL et LLM_GATEWAY_URL', async () => {
    process.env.LLM_MODEL = 'openai/gpt-5-mini';
    process.env.LLM_GATEWAY_URL = 'https://autre-gateway.test/v1/chat';

    await client.complete('prompt');

    const { url, body } = lastCall();
    expect(url).toBe('https://autre-gateway.test/v1/chat');
    expect(body.model).toBe('openai/gpt-5-mini');
  });

  it('traite une variable vide comme absente', async () => {
    process.env.LLM_MODEL = '   ';

    await client.complete('prompt');

    expect(lastCall().body.model).toBe(DEFAULT_MODEL);
  });

  it('refuse de partir sans clé', async () => {
    delete process.env.LLM_API_KEY;

    await expect(client.complete('prompt')).rejects.toThrow(/LLM_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('remonte le statut du gateway en cas d’échec', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('rate limited'),
    });

    await expect(client.complete('prompt')).rejects.toThrow(/429/);
  });

  it('rejette une réponse sans contenu exploitable', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }) as Promise<unknown>,
    });

    await expect(client.complete('prompt')).rejects.toThrow(/sans contenu/);
  });
});

describe('parseJsonArray', () => {
  it('accepte un tableau nu', () => {
    expect(parseJsonArray('["a","b"]')).toEqual(['a', 'b']);
  });

  it('retire les fences markdown que les modèles ajoutent malgré la consigne', () => {
    expect(parseJsonArray('```json\n["a"]\n```')).toEqual(['a']);
  });

  it('rejette un JSON illisible', () => {
    expect(() => parseJsonArray('pas du json')).toThrow(/illisible/);
  });

  it('rejette un JSON valide qui n’est pas un tableau', () => {
    expect(() => parseJsonArray('{"a":1}')).toThrow(/tableau/);
  });
});
