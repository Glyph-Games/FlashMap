import React, { useEffect, useState } from 'react';
import { ClipboardList, CalendarClock, Brain, Timer, Sparkles, Gamepad2, Library, ShieldCheck, SlidersHorizontal, Lock, ExternalLink, X, Heart } from 'lucide-react';
import analytics from '../utils/analytics';
import { ANSWERS, NO_REASONS, COMMENT_MAX_LENGTH, markSurveyAnswered, markSurveyLater } from '../utils/plusSurvey';

const PLUS_PAGE_URL = 'https://flashmap.app/about/plus';

const FEATURES = [
  { icon: CalendarClock, text: 'Des révisions calculées jusqu\'au jour du contrôle' },
  { icon: Brain, text: 'FSRS, un algorithme qui apprend votre mémoire' },
  { icon: Timer, text: 'Un coach de méthode et des sessions Pomodoro' },
  { icon: Sparkles, text: 'Magic Lessons avec Claude Sonnet 5, formules en TeX' },
  { icon: Gamepad2, text: 'Tous les modes de jeu, modes externes compris' },
  { icon: Library, text: 'La bibliothèque communautaire de leçons' },
  { icon: ShieldCheck, text: 'Hébergé en France, zéro exploitation des données' },
  { icon: SlidersHorizontal, text: 'Et bien plus\u00a0: des petits plus pratiques, des améliorations au quotidien et de quoi personnaliser FlashMap à votre goût' },
];

// Tarifs Quizlet relevés sur quizlet.com en septembre 2026 (cf. page FlashMap Plus)
const PRICES = [
  { name: 'Quizlet Plus', monthly: '6,93 €', annual: '31,46 €' },
  { name: 'Quizlet Plus Illimité', monthly: '8,66 €', annual: '39,32 €' },
  { name: 'FlashMap Plus', monthly: '2,40 €', annual: '24 €', highlight: true },
];

/**
 * Sondage FlashMap Plus : présente l'édition payante (encore en développement)
 * et demande si l'utilisateur serait prêt à la payer.
 * Gère lui-même la mémorisation de la réponse et l'envoi des analytics.
 */
export default function PlusSurveyModal({ onClose }) {
  // 'question' → ('why' si Non) → 'thanks'
  const [step, setStep] = useState('question');
  const [reason, setReason] = useState(null);
  const [comment, setComment] = useState('');

  const submitAnswer = (answer, answerReason = null, answerComment = '') => {
    markSurveyAnswered(answer);
    analytics.trackPlusSurveyAnswered(answer, answerReason, answerComment.trim());
    setStep('thanks');
  };

  const postpone = () => {
    const laterCount = markSurveyLater();
    analytics.trackPlusSurveyLater(laterCount);
    onClose();
  };

  // Fermer (croix, clic à côté, Échap) : « Plus tard » tant qu'on n'a pas répondu ;
  // à l'étape « Pourquoi », la réponse Non est enregistrée sans raison
  const dismiss = () => {
    if (step === 'question') {
      postpone();
    } else if (step === 'why') {
      markSurveyAnswered(ANSWERS.no);
      analytics.trackPlusSurveyAnswered(ANSWERS.no);
      onClose();
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plus-survey-title"
        className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-bounce-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'question' && (
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4 pr-8">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="font-semibold text-indigo-600">Sondage</span>
            </div>

            <h2 id="plus-survey-title" className="text-2xl font-bold text-gray-800 mb-2">
              Seriez-vous prêt à payer 2,40&nbsp;€ par mois pour FlashMap Plus&nbsp;?
            </h2>
            <p className="text-gray-500 text-sm mb-4">
              Ou 2&nbsp;€ par mois en facturation annuelle, soit 24&nbsp;€ par an.
            </p>
            <p className="text-gray-700 mb-5 leading-relaxed">
              Nous préparons FlashMap Plus, l'édition complète de FlashMap&nbsp;: tout ce que vous connaissez,
              et de quoi être prêt le jour du contrôle. FlashMap Community Edition, la version que vous
              utilisez, reste gratuite.
            </p>

            <ul className="space-y-2.5 mb-6">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-gray-700 text-sm">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 flex-shrink-0">
                    <Icon className="w-4 h-4 text-indigo-600" />
                  </span>
                  <span className="pt-1">{text}</span>
                </li>
              ))}
            </ul>

            <div className="mb-5 rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="text-left font-medium px-3 py-2">Face à Quizlet</th>
                    <th className="text-right font-medium px-3 py-2">Par mois</th>
                    <th className="text-right font-medium px-3 py-2">Par an</th>
                  </tr>
                </thead>
                <tbody>
                  {PRICES.map(({ name, monthly, annual, highlight }) => (
                    <tr
                      key={name}
                      className={highlight ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'border-t border-gray-100 text-gray-700'}
                    >
                      <td className="px-3 py-2">{name}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{monthly}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{annual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
                Quizlet Plus compte vos tests et vos sessions. FlashMap Plus n'a aucune limite pour réviser.
                Tarifs Quizlet relevés sur quizlet.com en septembre 2026.
              </p>
            </div>

            <a
              href={PLUS_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => analytics.trackPlusSurveyLinkClicked()}
              className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 font-medium text-sm mb-6"
            >
              Découvrir FlashMap Plus en détail
              <ExternalLink className="w-4 h-4" />
            </a>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => submitAnswer(ANSWERS.yesMonthly)}
                className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 font-medium"
              >
                Oui, à 2,40&nbsp;€ par mois
              </button>
              <button
                onClick={() => submitAnswer(ANSWERS.yesAnnual)}
                className="w-full px-6 py-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all transform hover:scale-105 font-medium"
              >
                Oui, à 24&nbsp;€ par an (2&nbsp;€ par mois)
              </button>
              <button
                onClick={() => setStep('why')}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all transform hover:scale-105 font-medium"
              >
                Non
              </button>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                <Lock className="w-3.5 h-3.5" />
                Réponse anonyme
              </span>
              <button onClick={postpone} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                Plus tard
              </button>
            </div>
          </div>
        )}

        {step === 'why' && (
          <div className="p-6 sm:p-8">
            <h2 id="plus-survey-title" className="text-2xl font-bold text-gray-800 mb-2 pr-8">
              Pourquoi&nbsp;?
            </h2>
            <p className="text-gray-500 text-sm mb-5">Facultatif, mais ça nous aide beaucoup.</p>

            <div className="flex flex-wrap gap-2 mb-5" role="radiogroup" aria-label="Raison">
              {NO_REASONS.map(({ id, label }) => (
                <button
                  key={id}
                  role="radio"
                  aria-checked={reason === id}
                  onClick={() => setReason(reason === id ? null : id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    reason === id
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label htmlFor="plus-survey-comment" className="block text-sm font-medium text-gray-700 mb-2">
              Dites-nous en plus (facultatif)
            </label>
            <textarea
              id="plus-survey-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={COMMENT_MAX_LENGTH}
              rows={3}
              placeholder="Qu'est-ce qui vous ferait changer d'avis ?"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none resize-none"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1 mb-6">
              <span>N'indiquez pas d'informations personnelles.</span>
              <span>{comment.length}/{COMMENT_MAX_LENGTH}</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => submitAnswer(ANSWERS.no)}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all transform hover:scale-105 font-medium"
              >
                Passer
              </button>
              <button
                onClick={() => submitAnswer(ANSWERS.no, reason, comment)}
                disabled={!reason && !comment.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all transform hover:scale-105 font-medium disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
              >
                Envoyer
              </button>
            </div>

            <p className="inline-flex items-center gap-1.5 text-xs text-gray-400 mt-4">
              <Lock className="w-3.5 h-3.5" />
              Réponse anonyme
            </p>
          </div>
        )}

        {step === 'thanks' && (
          <div className="p-6 sm:p-8 text-center">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-pink-100 to-purple-100 rounded-full">
              <Heart className="w-8 h-8 text-pink-600" />
            </div>
            <h2 id="plus-survey-title" className="text-2xl font-bold text-gray-800 mb-3">
              Merci pour votre réponse&nbsp;!
            </h2>
            <p className="text-gray-600 mb-6">
              FlashMap Plus est encore en développement. Vous pouvez suivre son avancée sur{' '}
              <a
                href={PLUS_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => analytics.trackPlusSurveyLinkClicked()}
                className="text-indigo-600 hover:text-indigo-700 font-medium"
              >
                flashmap.app/about/plus
              </a>.
            </p>
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all transform hover:scale-105 font-medium"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
