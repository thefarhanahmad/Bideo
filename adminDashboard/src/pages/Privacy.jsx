import InfoPage, { Section } from "../components/InfoPage";

const Privacy = () => (
  <InfoPage
    title="Privacy Policy"
    subtitle="How Bideo collects, uses, and protects information."
    updated="July 4, 2026"
  >
    <Section heading="1. Information we collect">
      <p>
        We may collect account information such as name, phone number, email,
        profile details, uploaded content, comments, likes, follows, reports,
        device information, app activity, and approximate usage data needed to
        operate and protect Bideo.
      </p>
    </Section>
    <Section heading="2. How we use information">
      <p>
        We use information to provide the service, personalize feeds, process
        uploads, support accounts, improve performance, detect abuse, enforce
        policies, respond to reports, and comply with legal obligations.
      </p>
    </Section>
    <Section heading="3. Media and service providers">
      <p>
        Uploaded videos and images may be stored and delivered through service
        providers such as cloud hosting, media delivery, analytics, security, and
        infrastructure partners. These providers process information only as
        needed to support Bideo.
      </p>
    </Section>
    <Section heading="4. Advertising and analytics">
      <p>
        If ads or analytics are enabled, Bideo and its partners may process
        limited device, usage, and interaction data to measure performance,
        prevent fraud, and support advertiser-friendly experiences. We do not
        sell personal information.
      </p>
    </Section>
    <Section heading="5. User-generated content">
      <p>
        Content you upload, profile details, comments, and public interactions
        may be visible to other users depending on your settings and platform
        features. Do not upload private information you do not want others to see.
      </p>
    </Section>
    <Section heading="6. Your choices">
      <p>
        You may update your profile, delete your content where available, and
        request account deletion. Some information may be retained when required
        for security, fraud prevention, legal compliance, dispute handling, or
        policy enforcement.
      </p>
    </Section>
    <Section heading="7. Contact">
      <p>
        For privacy questions, contact{" "}
        <a className="font-medium text-brand hover:underline" href="mailto:bideoapps@gmail.com">
          bideoapps@gmail.com
        </a>
        .
      </p>
    </Section>
  </InfoPage>
);

export default Privacy;
