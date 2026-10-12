import { useEffect } from "react";
import InfoPage, { Section } from "../components/InfoPage";
import { ShieldIcon, UsersIcon, SparkIcon } from "../components/Icons";

const Contact = () => {
  useEffect(() => {
    document.title = "Contact Us & Grievance Redressal — Bideo";
    window.scrollTo(0, 0);
  }, []);

  return (
    <InfoPage
      title="Contact Us & Grievance Redressal"
      subtitle="We are here to help. Reach our dedicated teams for user support, creator partnerships, or legal grievances."
      updated="October 2026"
    >
      {/* Contact Channels Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand">
              <UsersIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-ink">User Support</h3>
              <p className="text-xs text-muted">Account, login & app help</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted sm:text-sm">
            Having trouble with video playback, account verification, or uploads? Our support team is available 7 days a week.
          </p>
          <div className="mt-4">
            <a
              href="mailto:bideoapps@gmail.com?subject=User%20Support%20-%20Bideo"
              className="inline-flex items-center gap-1.5 font-semibold text-brand text-xs sm:text-sm hover:underline"
            >
              bideoapps@gmail.com →
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand">
              <SparkIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-ink">Creator & Partnerships</h3>
              <p className="text-xs text-muted">Brand & creator inquiries</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted sm:text-sm">
            Are you a content creator, influencer, or brand looking to collaborate, run promotional campaigns, or join our creator program?
          </p>
          <div className="mt-4">
            <a
              href="mailto:bideoapps@gmail.com?subject=Creator%20Partnership%20-%20Bideo"
              className="inline-flex items-center gap-1.5 font-semibold text-brand text-xs sm:text-sm hover:underline"
            >
              bideoapps@gmail.com →
            </a>
          </div>
        </div>
      </div>

      {/* Statutory Grievance Redressal (India IT Rules 2021) */}
      <Section heading="Statutory Grievance Redressal Mechanism">
        <div className="rounded-2xl border border-brand/20 bg-brand-50/30 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-sm">
              <ShieldIcon className="h-5 w-5" />
            </span>
            <div>
              <h4 className="font-display text-base font-bold text-ink sm:text-lg">
                Grievance Officer (IT Rules, 2021 Compliance)
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted sm:text-sm">
                In compliance with Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the details of the designated Grievance Officer for Bideo are published below:
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2.5 rounded-xl border border-line bg-white p-4 text-xs sm:text-sm">
            <p>
              <strong className="text-ink">Designation:</strong> Grievance Officer, Bideo Platform
            </p>
            <p>
              <strong className="text-ink">Email:</strong>{" "}
              <a href="mailto:bideoapps@gmail.com?subject=Legal%20Grievance%20Notice%20-%20IT%20Rules%202021" className="font-semibold text-brand hover:underline">
                bideoapps@gmail.com
              </a>
            </p>
            <p>
              <strong className="text-ink">Operating Country:</strong> India
            </p>
            <p>
              <strong className="text-ink">Acknowledgment Timeline:</strong> Within 24 hours of receipt of grievance.
            </p>
            <p>
              <strong className="text-ink">Resolution Timeline:</strong> Within 15 days from the date of receipt, or within 72 hours for court/government orders or intimate content removal.
            </p>
          </div>
        </div>
      </Section>

      {/* Safety & Copyright Section */}
      <Section heading="Copyright, Safety & Takedown Reports">
        <p>
          If you are a copyright owner or authorised agent and believe any user-generated content infringes upon your copyright, please send an official takedown notice to{" "}
          <a href="mailto:bideoapps@gmail.com" className="font-semibold text-brand hover:underline">
            bideoapps@gmail.com
          </a>{" "}
          including:
        </p>
        <ul className="mt-3 space-y-2 pl-4 text-xs text-muted sm:text-sm list-disc">
          <li>The direct Bideo URL of the infringing content (e.g., <code>https://bideo.in/v/video-id</code>).</li>
          <li>Proof of ownership or legal authorization to act on behalf of the owner.</li>
          <li>Your contact information (name, address, telephone number, and email).</li>
          <li>A statement of good faith belief that the use is not authorized by law.</li>
        </ul>
      </Section>
    </InfoPage>
  );
};

export default Contact;
