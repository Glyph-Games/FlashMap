import { getAiLessonInfo } from './AiGeneratedLesson';

const signature = (overrides = {}) => ({
  schemaVersion: 1,
  tool: 'flashmap-mcp',
  toolVersion: '1.0.0',
  model: 'claude-opus-5',
  client: { name: 'claude-ai', version: '0.1.0' },
  sourceDocument: 'Chapitre 3 - La Révolution.pdf',
  generatedAt: '2026-09-14T15:53:26.316Z',
  ...overrides,
});

describe('getAiLessonInfo', () => {
  it('ignore les leçons sans signature valide', () => {
    expect(getAiLessonInfo(null)).toBeNull();
    expect(getAiLessonInfo({ name: 'Leçon' })).toBeNull();
    expect(getAiLessonInfo({ _generatedBy: signature({ tool: 'autre-outil' }) })).toBeNull();
    expect(getAiLessonInfo({ _generatedBy: signature({ schemaVersion: 2 }) })).toBeNull();
  });

  it('détecte Claude et formate le modèle', () => {
    const info = getAiLessonInfo({ _generatedBy: signature() });
    expect(info.provider.name).toBe('Claude');
    expect(info.modelLabel).toBe('Claude Opus 5');
  });

  it('formate les noms de modèles avec version et date', () => {
    const label = model => getAiLessonInfo({ _generatedBy: signature({ model }) }).modelLabel;
    expect(label('claude-sonnet-4-5-20250929')).toBe('Claude Sonnet 4.5');
    expect(label('gemini-3.5-flash')).toBe('Gemini 3.5 Flash');
    expect(label('gpt-5')).toBe('GPT 5');
  });

  it('reconnaît les autres fournisseurs', () => {
    const provider = model => getAiLessonInfo({ _generatedBy: signature({ model, client: null }) }).provider.name;
    expect(provider('gemini-3.5-flash')).toBe('Gemini');
    expect(provider('gpt-5')).toBe('ChatGPT');
    expect(provider('o3-mini')).toBe('ChatGPT');
    expect(provider('mistral-large')).toBe('Mistral');
  });

  it('se rabat sur le client, puis sur une IA générique', () => {
    const fromClient = getAiLessonInfo({ _generatedBy: signature({ model: null, client: { name: 'claude-code' } }) });
    expect(fromClient.provider.name).toBe('Claude');
    expect(fromClient.modelLabel).toBeNull();

    const unknown = getAiLessonInfo({ _generatedBy: signature({ model: null, client: { name: 'cursor' } }) });
    expect(unknown.provider.name).toBeNull();
  });
});
