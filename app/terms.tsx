/**
 * app/terms.tsx — Terms of Service screen.
 *
 * For beta. Real copy needs to be drafted by counsel before public launch.
 * Includes the standard clauses required for App Store / Play Store
 * approval of a UGC app — content rules + reporting + termination.
 */

import { LegalDocument } from '@/components';

export default function TermsScreen() {
  return (
    <LegalDocument
      title="Terms of Service"
      lastUpdated="2026-06-09"
      webUrl="https://rankrapp.com/terms"
      sections={[
        {
          heading: 'Acceptance',
          body: 'By using Rankr you agree to these terms. If you don\'t agree, don\'t use the app. We may update these terms; we\'ll notify you in-app of material changes.',
        },
        {
          heading: 'Your account',
          body: 'You must be at least 13 years old. You\'re responsible for your account and the content you post. Don\'t impersonate someone else or use the app on behalf of another person without their permission.',
        },
        {
          heading: 'Your content',
          body: 'You own the lists, rankings, posts, comments, and photos you create. By posting Public content you grant Rankr a non-exclusive license to display it to other users inside the app. You can delete your content at any time, which revokes that license going forward.',
        },
        {
          heading: 'Content rules',
          body: 'No hate speech, harassment, threats, sexual content involving minors, or content that infringes others\' intellectual property. No spam, fake accounts, or automated posting. We reserve the right to remove content and suspend accounts that violate these rules, with or without notice.',
        },
        {
          heading: 'Reporting & blocking',
          body: 'You can report any user, list, post, or comment that violates these rules. You can block any user to hide their content and prevent them from interacting with you. We review reports and act on them on a best-effort basis.',
        },
        {
          heading: 'Third-party content',
          body: 'Rankr displays metadata about movies, TV shows, games, music, and books sourced from third-party APIs (TMDB, RAWG, iTunes, Google Books). Rights to that metadata belong to the respective providers. We do not host the underlying media.',
        },
        {
          heading: 'Termination',
          body: 'You can delete your account at any time from Profile > Settings > Delete account. We can suspend or terminate accounts that violate these terms, with or without notice depending on severity.',
        },
        {
          heading: 'Disclaimers',
          body: 'Rankr is provided "as is" without warranties. We work hard to keep the app available and secure but we don\'t guarantee uninterrupted service or data integrity. To the extent permitted by law, our liability for any claim arising from the app is limited.',
        },
        {
          heading: 'Contact',
          body: 'Questions about these terms? Email support@rankrapp.com.',
        },
      ]}
    />
  );
}
