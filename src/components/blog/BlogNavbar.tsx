import React from 'react';
import PublicNavbar from '../shared/PublicNavbar';

/** Kept as its own name so existing pages keep their imports; renders the shared public navbar. */
interface BlogNavbarProps {
  onBack: () => void;
  onRegisterClick?: () => void;
}

const BlogNavbar: React.FC<BlogNavbarProps> = ({ onRegisterClick }) => (
  <PublicNavbar onRegisterClick={onRegisterClick} />
);

export default BlogNavbar;
