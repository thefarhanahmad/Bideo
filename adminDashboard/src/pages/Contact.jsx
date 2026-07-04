import InfoPage, { Section } from "../components/InfoPage";

const Contact = () => (
  <InfoPage title="Contact Us" subtitle="Support, safety, and business enquiries.">
    <Section heading="User support">
      <p>
        For help with your account, uploads, login, or app experience, contact
        our support team.
      </p>
      <p>
        <a className="font-semibold text-brand hover:underline" href="mailto:bideoapps@gmail.com">
          bideoapps@gmail.com
        </a>
      </p>
    </Section>
    <Section heading="Safety and policy reports">
      <p>
        If you need to report unsafe content, policy violations, copyright issues,
        impersonation, or account abuse, use the in-app report tools when possible
        or email us with relevant links and details.
      </p>
      <p>
        <a className="font-semibold text-brand hover:underline" href="mailto:bideoapps@gmail.com">
          bideoapps@gmail.com
        </a>
      </p>
    </Section>
    <Section heading="Business and creators">
      <p>
        For partnerships, creator program enquiries, or brand enquiries, contact{" "}
        <a className="font-semibold text-brand hover:underline" href="mailto:bideoapps@gmail.com">
          bideoapps@gmail.com
        </a>
        . We do not promise creator income, paid placement, or monetization access.
      </p>
    </Section>
  </InfoPage>
);

export default Contact;
