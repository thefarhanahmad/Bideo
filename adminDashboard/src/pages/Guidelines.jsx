import InfoPage, { Section } from "../components/InfoPage";

const Guidelines = () => (
  <InfoPage
    title="Community Guidelines"
    subtitle="Rules for keeping Bideo safe, respectful, and advertiser-friendly."
    updated="July 4, 2026"
  >
    <Section heading="User responsibility">
      <p>
        Bideo is a user-generated content platform. You are responsible for the
        videos, shorts, comments, profile details, and other content you upload or
        share. Only post content that you have the legal right to use.
      </p>
    </Section>
    <Section heading="No sexual or explicit content">
      <p>
        Do not upload nudity, sexually explicit content, sexual exploitation,
        or content that sexualizes minors. Child safety violations may be reported
        to appropriate authorities.
      </p>
    </Section>
    <Section heading="No violence or dangerous content">
      <p>
        Do not post graphic violence, threats, instructions for harm, dangerous
        challenges, or content that encourages injury, self-harm, or illegal acts.
      </p>
    </Section>
    <Section heading="No hate, harassment, or abuse">
      <p>
        Hate speech, bullying, targeted harassment, threats, doxxing, and content
        attacking protected groups are not allowed.
      </p>
    </Section>
    <Section heading="No spam, scams, or misleading behavior">
      <p>
        Do not post scams, deceptive promotions, fake engagement schemes,
        misleading thumbnails or titles, impersonation, malware, phishing, or
        repetitive spam.
      </p>
    </Section>
    <Section heading="Respect copyright">
      <p>
        Upload only original content or content you are authorized to share. Do
        not upload copyrighted music, movies, TV clips, sports broadcasts, or
        other protected material without permission.
      </p>
    </Section>
    <Section heading="Reporting and enforcement">
      <p>
        Users can report content in the app. We may remove content, limit access,
        issue warnings, suspend accounts, or terminate repeat violators. Severe
        violations may result in immediate action.
      </p>
    </Section>
  </InfoPage>
);

export default Guidelines;
