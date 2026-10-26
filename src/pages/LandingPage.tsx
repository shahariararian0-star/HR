import React, { useEffect, Suspense } from 'react';
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import ProductPreviewSection from '../components/landing/ProductPreviewSection';
import WhyChooseSection from '../components/landing/WhyChooseSection';
import PricingSection from '../components/landing/PricingSection';
import ProofSection from '../components/landing/ProofSection';
import Footer from '../components/landing/Footer';
import { updatePageMeta, setJsonLd } from '../utils/seo';

const ShowcaseSection = React.lazy(() => import('../components/landing/ShowcaseSection'));
const FAQSection = React.lazy(() => import('../components/landing/FAQSection'));
const CTASection = React.lazy(() => import('../components/landing/CTASection'));

const SectionSkeleton = () => (
  <div className="py-20 flex justify-center">
    <div className="w-8 h-8 border-2 border-dl-teal/20 border-t-dl-teal rounded-full animate-spin" />
  </div>
);

interface LandingPageProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onLoginSuccess?: (user: any) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onRegisterClick, onLoginSuccess }) => {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';

    updatePageMeta(
      'StaffCove — Free Open-Source HR Management Software',
      'StaffCove is a free, open-source HR platform with attendance tracking, leave management, and employee directory. Get started today — no credit card required, completely free forever.',
      'https://staffcove.com/',
      'https://staffcove.com/img/screenshot-wide.png'
    );

    setJsonLd({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          name: 'StaffCove',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web, Android, iOS',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
          description: 'Free, open-source HR management system with attendance tracking, leave management, employee directory, and compliance tools.',
          url: 'https://staffcove.com',
          image: 'https://staffcove.com/img/screenshot-wide.png',
        },
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'What is StaffCove?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'StaffCove is a modern, open-source HR management platform that helps organizations manage attendance, leave, and employee records in one place. It works as a Progressive Web App (PWA) on any device.',
              },
            },
            {
              '@type': 'Question',
              name: 'Is StaffCove really free?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Yes — completely free. StaffCove is open-source software with no paywalls, no user limits, and no credit card required. The app is ad-supported. If you\'d like to support the project, you can make a small donation through Buy Me a Coffee.',
              },
            },
            {
              '@type': 'Question',
              name: 'How does selfie-based attendance work?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Employees check in by taking a selfie through the app. The system captures the photo along with GPS coordinates and timestamp, ensuring authentic and verifiable attendance records.',
              },
            },
            {
              '@type': 'Question',
              name: 'How do employees apply for leave?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Employees select their leave type, dates, and add an optional reason through the app. Managers receive a notification and can approve or reject with one click.',
              },
            },
          ],
        },
      ],
    });

    return () => {
      document.documentElement.style.scrollBehavior = '';
      setJsonLd(null);
    };
  }, []);

  return (
    <div className="sc-landing min-h-screen bg-dl-ground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-dl-sm focus:bg-dl-teal focus:text-dl-surface focus:font-semibold focus:shadow-dl-2"
      >
        Skip to content
      </a>
      <Navbar onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onLoginSuccess={onLoginSuccess} />
      <main id="main-content" className="dl-bands" data-advertising="eligible">
        {/* Section order follows the StaffCove home page design: explain the product, show it,
            say why it helps, price it, then back it up. Every claim stays verifiable — the
            Showcase lists only organizations whose admin opted in, and ProofSection points at
            public artefacts instead of testimonials. ContactSection lives only at /contact. */}
        <HeroSection onLoginClick={onLoginClick} onRegisterClick={onRegisterClick} onLoginSuccess={onLoginSuccess} />
        <Suspense fallback={null}><ShowcaseSection /></Suspense>
        <FeaturesSection />
        <ProductPreviewSection />
        <WhyChooseSection />
        <Suspense fallback={<SectionSkeleton />}><PricingSection onRegisterClick={onRegisterClick} /></Suspense>
        <ProofSection />
        <Suspense fallback={<SectionSkeleton />}><FAQSection /></Suspense>
        <Suspense fallback={<SectionSkeleton />}><CTASection onRegisterClick={onRegisterClick} /></Suspense>
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
