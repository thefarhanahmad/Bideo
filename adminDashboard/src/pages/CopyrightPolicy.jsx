import InfoPage, { Section } from "../components/InfoPage";

const CopyrightPolicy = () => (
  <InfoPage
    title="Copyright and DMCA Policy"
    subtitle="How Bideo handles copyright concerns."
    updated="July 4, 2026"
  >
    <Section heading="Respect for intellectual property">
      <p>
        Bideo respects copyright and other intellectual property rights. Users
        must only upload content they created or content they have permission to
        use.
      </p>
    </Section>
    <Section heading="Prohibited uploads">
      <p>
        Do not upload copyrighted music, movies, TV shows, sports broadcasts,
        clips, images, or other protected works unless you have the rights or
        permission required by law.
      </p>
    </Section>
    <Section heading="Copyright complaints">
      <p>
        Rights holders may contact us with a copyright complaint that includes
        the copyrighted work, the Bideo content URL or identifier, contact
        information, a good-faith statement, and a statement that the information
        is accurate.
      </p>
      <p>
        Send notices to{" "}
        <a className="font-medium text-brand hover:underline" href="mailto:bideoapps@gmail.com">
          bideoapps@gmail.com
        </a>
        .
      </p>
    </Section>
    <Section heading="Counter-notices">
      <p>
        If you believe your content was removed by mistake, you may contact us
        with details explaining your rights to the content. We may request
        additional information before taking further action.
      </p>
    </Section>
    <Section heading="Repeat violators">
      <p>
        Accounts that repeatedly upload infringing content may be suspended or
        terminated.
      </p>
    </Section>
  </InfoPage>
);

export default CopyrightPolicy;
