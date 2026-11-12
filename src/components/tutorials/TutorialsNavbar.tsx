import React from 'react';
import PublicNavbar from '../shared/PublicNavbar';

/** Kept as its own name so existing pages keep their imports; renders the shared public navbar. */
interface TutorialsNavbarProps {
  onBack: () => void;
  onRegisterClick?: () => void;
}

const TutorialsNavbar: React.FC<TutorialsNavbarProps> = ({ onRegisterClick }) => (
  <PublicNavbar onRegisterClick={onRegisterClick} />
);

export default TutorialsNavbar;
