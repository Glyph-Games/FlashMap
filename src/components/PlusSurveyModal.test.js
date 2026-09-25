import { render, screen, fireEvent } from '@testing-library/react';
import PlusSurveyModal from './PlusSurveyModal';
import analytics from '../utils/analytics';

jest.mock('../utils/analytics', () => ({
  __esModule: true,
  default: {
    trackPlusSurveyAnswered: jest.fn(),
    trackPlusSurveyLater: jest.fn(),
    trackPlusSurveyLinkClicked: jest.fn(),
  },
}));

const surveyState = () => JSON.parse(localStorage.getItem('flashmapPlusSurvey'));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

it('pose la question en titre et renvoie vers la page FlashMap Plus', () => {
  render(<PlusSurveyModal onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: /prêt à payer 2,40\s€ par mois/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Découvrir FlashMap Plus/ })).toHaveAttribute('href', 'https://flashmap.app/about/plus');
  expect(screen.getByText('Réponse anonyme')).toBeInTheDocument();
});

it('enregistre un Oui et remercie', () => {
  render(<PlusSurveyModal onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: /Oui, à 24\s€ par an/ }));
  expect(analytics.trackPlusSurveyAnswered).toHaveBeenCalledWith('yes_annual', null, '');
  expect(surveyState().status).toBe('answered');
  expect(screen.getByText(/Merci pour votre réponse/)).toBeInTheDocument();
});

it('demande pourquoi après un Non, avec raison et commentaire libre', () => {
  render(<PlusSurveyModal onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Non' }));
  expect(screen.getByRole('heading', { name: /Pourquoi/ })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: 'C\'est trop cher' }));
  fireEvent.change(screen.getByLabelText(/Dites-nous en plus/), { target: { value: '  Plutôt 1 €  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

  expect(analytics.trackPlusSurveyAnswered).toHaveBeenCalledWith('no', 'too_expensive', 'Plutôt 1 €');
  expect(surveyState()).toMatchObject({ status: 'answered', answer: 'no' });
});

it('« Plus tard » reporte le sondage et ferme le modal', () => {
  const onClose = jest.fn();
  render(<PlusSurveyModal onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
  expect(analytics.trackPlusSurveyLater).toHaveBeenCalledWith(1);
  expect(surveyState().status).toBe('later');
  expect(onClose).toHaveBeenCalled();
});

it('fermer à l\'étape « Pourquoi » enregistre le Non sans raison', () => {
  const onClose = jest.fn();
  render(<PlusSurveyModal onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Non' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
  expect(analytics.trackPlusSurveyAnswered).toHaveBeenCalledWith('no');
  expect(surveyState().status).toBe('answered');
  expect(onClose).toHaveBeenCalled();
});
