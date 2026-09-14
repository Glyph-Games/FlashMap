import React from 'react';
import { Sparkles } from 'lucide-react';
import claudeIcon from '../assets/ai-icons/Claude.svg';
import geminiIcon from '../assets/ai-icons/Gemini.svg';
import chatgptIcon from '../assets/ai-icons/ChatGPT.svg';
import mistralIcon from '../assets/ai-icons/Mistral.svg';

// Signature ajoutée par le MCP FlashMap (champ `_generatedBy` de la leçon partagée).
// C'est une signature déclarative : elle ne sert qu'à l'affichage, pas de preuve.
const MCP_TOOL_ID = 'flashmap-mcp';
const SUPPORTED_SCHEMA_VERSION = 1;

// Fournisseurs reconnus, détectés à partir du nom du modèle (ou du client à défaut).
// `color` sert de couleur d'accent au modal.
const PROVIDERS = [
  { pattern: /claude|anthropic/, name: 'Claude', color: '#D36B50', icon: claudeIcon },
  { pattern: /gemini|gemma/, name: 'Gemini', color: '#2E83F7', icon: geminiIcon },
  { pattern: /gpt|chatgpt|openai|^o\d/, name: 'ChatGPT', color: '#000000', icon: chatgptIcon },
  { pattern: /mistral|codestral|magistral|devstral/, name: 'Mistral', color: '#FE7521', icon: mistralIcon },
];

const UNKNOWN_PROVIDER = { name: null, color: '#7C3AED', icon: null };

// "claude-sonnet-4-5-20250929" → "Claude Sonnet 4.5", "gemini-3.5-flash" → "Gemini 3.5 Flash"
function formatModelName(model) {
  const words = model
    .replace(/[-_]\d{8}$/, '')
    .split(/[-_\s]+/)
    .filter(Boolean);

  const merged = [];
  for (const word of words) {
    const previous = merged[merged.length - 1];
    if (previous && /^\d+(\.\d+)*$/.test(previous) && /^\d+$/.test(word)) {
      merged[merged.length - 1] = `${previous}.${word}`;
    } else {
      merged.push(word);
    }
  }

  return merged
    .map(word => (/^gpt$/i.test(word) ? 'GPT' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

/**
 * Retourne les infos d'affichage si la leçon a été générée via le MCP FlashMap, sinon null.
 * `tint` est la couleur d'accent à ~10 % d'opacité, pour les fonds.
 */
export function getAiLessonInfo(lesson) {
  const signature = lesson?._generatedBy;
  if (!signature || signature.tool !== MCP_TOOL_ID || signature.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    return null;
  }

  const model = typeof signature.model === 'string' ? signature.model.trim() : '';
  const clientName = typeof signature.client?.name === 'string' ? signature.client.name : '';
  const provider =
    PROVIDERS.find(p => p.pattern.test(model.toLowerCase())) ||
    PROVIDERS.find(p => p.pattern.test(clientName.toLowerCase())) ||
    UNKNOWN_PROVIDER;

  return {
    provider,
    color: provider.color,
    tint: `${provider.color}1A`,
    modelLabel: model ? formatModelName(model) : null,
  };
}

/**
 * En-tête des modals d'import pour une leçon générée par IA.
 */
export function AiLessonHeader({ info, subtitle }) {
  const { provider, color, tint, modelLabel } = info;

  return (
    <>
      {provider.icon ? (
        <img
          src={provider.icon}
          alt={provider.name}
          className="w-16 h-16 mx-auto mb-4 rounded-full object-cover shadow-md"
        />
      ) : (
        <div
          className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full"
          style={{ backgroundColor: tint }}
        >
          <Sparkles className="w-8 h-8" style={{ color }} />
        </div>
      )}
      <h2 className={`text-2xl font-bold text-gray-800 text-center ${modelLabel || subtitle ? 'mb-2' : 'mb-4'}`}>
        {provider.name ? `Leçon créée par ${provider.name}` : 'Leçon créée par IA'}
      </h2>
      {modelLabel && (
        <div className={`flex justify-center ${subtitle ? 'mb-3' : 'mb-4'}`}>
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: tint, color }}
          >
            {modelLabel}
          </span>
        </div>
      )}
      {subtitle && <p className="text-gray-600 mb-6 text-center">{subtitle}</p>}
    </>
  );
}
