import InfoPage, { Section } from '../components/InfoPage';

const ChildSafety = () => {
  return (
    <InfoPage
      title="Child Safety Standards & CSAM/CSAE Policy"
      subtitle="Published safety standards, prevention practices, and compliance contacts for Bideo."
      updated="August 1, 2026"
    >
      {/* Policy Header Card */}
      <div className="rounded-2xl border border-brand/20 bg-brand-50/50 p-6 text-ink">
        <h3 className="font-display text-lg font-bold text-brand">App & Organization Details</h3>
        <p className="mt-1 text-sm text-muted">
          App Name: <strong className="text-ink">Bideo — Video Platform & Short Videos</strong> | Developer: <strong className="text-ink">Bideo Team</strong>
        </p>
        <p className="mt-2 text-sm text-muted">
          In strict compliance with Google Play Store Child Safety policies, international child protection laws, and NCMEC guidelines, Bideo enforces a non-negotiable zero-tolerance policy regarding Child Sexual Abuse Material (CSAM) and Child Sexual Exploitation and Abuse (CSAE).
        </p>
      </div>

      {/* Section 1: Zero-Tolerance Policy */}
      <Section heading="1. Zero-Tolerance Policy Against CSAE & CSAM">
        <p>
          Bideo strictly prohibits any content, communication, or behavior that depicts, promotes, facilitates, or encourages Child Sexual Abuse Material (CSAM), Child Sexual Exploitation and Abuse (CSAE), child grooming, sexualization of minors, or any form of child endangerment.
        </p>
        <p>
          Any user found attempting to upload, share, solicit, or store CSAM/CSAE content will face immediate, permanent account termination, device bans, and reporting to relevant legal authorities.
        </p>
      </Section>

      {/* Section 2: Prevention & Moderation Practices */}
      <Section heading="2. CSAM Prevention Practices & Detection Systems">
        <p>
          To keep our platform safe for everyone, Bideo employs multi-layered prevention and moderation mechanisms:
        </p>
        <ul className="mt-3 space-y-2.5 list-disc pl-5 text-sm text-muted">
          <li>
            <strong className="text-ink">Automated Content Screening:</strong> Uploaded video files, thumbnails, user avatars, and text comments are screened using automated moderation filters and hash-matching technology to prevent known CSAM and explicit content from being published.
          </li>
          <li>
            <strong className="text-ink">24/7 Human Moderation Audit:</strong> A trained human moderation team continuously reviews reported videos, community posts, monetization applications, and channel profiles.
          </li>
          <li>
            <strong className="text-ink">Strict Account Restrictions:</strong> Minors cannot access monetized features or adult-oriented settings, and algorithmic recommendations strictly filter out age-inappropriate content.
          </li>
        </ul>
      </Section>

      {/* Section 3: Reporting Tools */}
      <Section heading="3. Reporting Mechanisms & Immediate Escalation">
        <p>
          Bideo provides intuitive, accessible reporting tools across every part of the application:
        </p>
        <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-muted">
          <li><strong>In-App Video Reporting:</strong> Users can tap the options menu on any video or short and select <em>Report Content &gt; Child Safety Concern</em>.</li>
          <li><strong>Comment & Post Flags:</strong> Comments and community posts can be flagged directly for swift review.</li>
          <li><strong>Priority Escalation (P0):</strong> Any report categorized under child safety is automatically assigned highest priority (P0) for immediate removal and review within 2 hours.</li>
        </ul>
      </Section>

      {/* Section 4: Law Enforcement Cooperation */}
      <Section heading="4. Law Enforcement & NCMEC Cooperation">
        <p>
          Bideo actively cooperates with law enforcement agencies and international child protection organizations to eradicate child exploitation:
        </p>
        <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-muted">
          <li><strong>NCMEC Reporting:</strong> Confirmed instances of CSAM/CSAE are reported to the <em>National Center for Missing & Exploited Children (NCMEC)</em> and relevant law enforcement bodies.</li>
          <li><strong>Data Preservation:</strong> Account logs, IP addresses, and uploaded media associated with CSAM offenses are preserved as required for official legal investigations.</li>
        </ul>
      </Section>

      {/* Section 5: Designated Point of Contact */}
      <Section heading="5. Designated Child Safety & Compliance Contact">
        <p>
          Google Play Store guidelines require a designated point of contact ready and authorized to address child safety compliance, CSAM prevention practices, and law enforcement inquiries:
        </p>

        <div className="mt-4 rounded-2xl border border-line bg-surface/60 p-6 space-y-2 text-sm text-ink">
          <p><strong>Designated Contact Role:</strong> Child Safety & CSAM Compliance Officer</p>
          <p><strong>Organization / App:</strong> Bideo Platform (Bideo Team)</p>
          <p><strong>Official Contact Email:</strong> <a className="font-semibold text-brand hover:underline" href="mailto:bideoapps@gmail.com">bideoapps@gmail.com</a></p>
          <p><strong>Recommended Subject Line:</strong> <code className="rounded bg-white px-2 py-0.5 text-xs text-brand font-mono border border-line">[Child Safety Escalation / CSAM Compliance]</code></p>
          <p className="text-muted text-xs mt-2">
            * Our Child Safety Compliance team responds to all urgent child safety reports and official law enforcement inquiries within 24 hours.
          </p>
        </div>
      </Section>
    </InfoPage>
  );
};

export default ChildSafety;
