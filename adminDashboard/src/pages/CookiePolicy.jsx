import InfoPage, { Section } from "../components/InfoPage";

const CookiePolicy = () => (
  <InfoPage
    title="Cookie Policy"
    subtitle="How cookies and similar technologies may be used."
    updated="July 4, 2026"
  >
    <Section heading="What cookies are">
      <p>
        Cookies and similar technologies help websites and apps remember choices,
        improve performance, secure sessions, measure usage, and support service
        reliability.
      </p>
    </Section>
    <Section heading="How Bideo may use them">
      <p>
        Bideo may use cookies or local storage for login status, security,
        preferences, analytics, fraud prevention, and service improvement.
      </p>
    </Section>
    <Section heading="Advertising and analytics">
      <p>
        If advertising or analytics tools are enabled, partners may use cookies or
        similar technologies to measure performance, prevent abuse, and provide
        relevant ads in accordance with their policies and applicable law.
      </p>
    </Section>
    <Section heading="Your controls">
      <p>
        You can manage cookies through your browser or device settings. Blocking
        some technologies may affect login, security, or app functionality.
      </p>
    </Section>
  </InfoPage>
);

export default CookiePolicy;
