import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — DailyWins",
  description:
    "DailyWins Privacy Policy: how we collect, use, store, and protect student data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f0]">
      {/* Header */}
      <header className="bg-[#2c3e50] text-white">
        <div className="mx-auto max-w-4xl px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            <span className="text-[#e07850]">Daily</span>
            <span className="text-[#3a7c6a]">Wins</span>
          </Link>
          <Link
            href="/"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            &larr; Back to app
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <article className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 md:p-12">
          <h1 className="text-3xl md:text-4xl font-bold text-[#2c3e50] mb-2">
            DailyWins Privacy Policy
          </h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 mb-8">
            <p>
              <strong>Effective Date:</strong> April 1, 2026
            </p>
            <p>
              <strong>Last Updated:</strong> March 31, 2026
            </p>
            <p>
              <strong>Website:</strong>{" "}
              <a
                href="https://dailywins.school"
                className="text-[#3a7c6a] hover:underline"
              >
                dailywins.school
              </a>
            </p>
          </div>

          <div className="prose prose-gray max-w-none [&_h2]:text-[#2c3e50] [&_h2]:text-xl [&_h2]:md:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:text-[#2c3e50] [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-3 [&_p]:text-gray-700 [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:text-gray-700 [&_ul]:mb-4 [&_ul]:pl-6 [&_li]:mb-2 [&_li]:leading-relaxed [&_a]:text-[#3a7c6a] [&_a]:underline [&_a]:hover:text-[#2c3e50] [&_strong]:text-gray-900">
            {/* 1. Introduction */}
            <h2>1. Introduction</h2>
            <p>
              DailyWins is a classroom behavior tracking application designed
              for use by K&ndash;12 educators. DailyWins allows teachers to
              record daily student behavior scores across customizable
              categories, generate progress reports, and share behavioral data
              with parents, guardians, and school administrators.
            </p>
            <p>
              This Privacy Policy describes how{" "}
              <strong>Sure Step Education</strong> (&ldquo;we,&rdquo;
              &ldquo;our,&rdquo; or &ldquo;us&rdquo;), the company behind
              DailyWins, collects, uses, stores, discloses, and protects student
              data and other personal information in connection with the
              DailyWins application and website (collectively, the
              &ldquo;Service&rdquo;).
            </p>
            <p>
              We are committed to protecting the privacy and security of student
              information and complying with all applicable federal and state
              laws, including the Family Educational Rights and Privacy Act
              (FERPA), the Children&rsquo;s Online Privacy Protection Act
              (COPPA), the California Student Online Personal Information
              Protection Act (SOPIPA, Cal. Bus. &amp; Prof. Code &sect; 22584),
              and California Education Code &sect; 49073.1 (AB 1584).
            </p>

            {/* 2. Definitions */}
            <h2>2. Definitions</h2>
            <ul>
              <li>
                <strong>Local Educational Agency (LEA):</strong> A school
                district, county office of education, or charter school that
                enters into a contract with DailyWins.
              </li>
              <li>
                <strong>Pupil Records:</strong> Any information directly related
                to a student that is maintained by the LEA or by DailyWins on
                behalf of the LEA. This includes behavior scores, attendance
                data, teacher notes, and any other personally identifiable
                information (PII).
              </li>
              <li>
                <strong>Personally Identifiable Information (PII):</strong>{" "}
                Information that can be used to distinguish or trace an
                individual student&rsquo;s identity, either alone or when
                combined with other information.
              </li>
              <li>
                <strong>Operator:</strong> Sure Step Education, doing business as
                DailyWins, as a provider of an online service designed and
                marketed for K&ndash;12 school purposes.
              </li>
              <li>
                <strong>Third Party / Provider:</strong> As defined in California
                Education Code &sect; 49073.1 (AB 1584), the provider of digital
                educational software or services for the digital storage,
                management, and retrieval of pupil records &mdash; in this case,
                Sure Step Education, operating the DailyWins application.
              </li>
            </ul>

            {/* 3. Information We Collect */}
            <h2>3. Information We Collect</h2>
            <p>
              DailyWins collects only the information necessary to provide the
              Service. We collect the following categories of information:
            </p>

            <h3>3.1 Student Information (Pupil Records)</h3>
            <ul>
              <li>Student name or initials (as entered by the teacher)</li>
              <li>
                Daily behavior scores across teacher-configured categories
                (e.g., Arrival, Compliance, Social, On-Task, Phone Away)
              </li>
              <li>
                Attendance and absence records (Present, Unexcused Absent,
                Excused Absent)
              </li>
              <li>
                Teacher-written notes associated with specific students, dates,
                and class periods
              </li>
              <li>
                Behavioral trend data (weekly, monthly, and annual aggregations)
              </li>
            </ul>

            <h3>3.2 Teacher / Staff Information</h3>
            <ul>
              <li>
                Name and email address (via Google OAuth single sign-on)
              </li>
              <li>School and district affiliation</li>
              <li>
                Configuration preferences (bell schedules, category settings,
                progress bar thresholds)
              </li>
            </ul>

            <h3>3.3 Technical Information</h3>
            <ul>
              <li>Browser type and version</li>
              <li>Device type (for responsive display purposes only)</li>
              <li>
                Authentication tokens (managed by Google OAuth; DailyWins does
                not store passwords)
              </li>
            </ul>

            {/* 4. How We Use Information */}
            <h2>4. How We Use Information</h2>
            <p>
              DailyWins uses collected information solely for the following
              educational purposes:
            </p>
            <ul>
              <li>
                To provide teachers with a tool for tracking and analyzing
                student behavior
              </li>
              <li>
                To generate progress reports (daily, weekly, monthly, annual) for
                use in parent conferences, IEP meetings, and administrative
                review
              </li>
              <li>
                To enable PDF and chart exports for teacher and school use
              </li>
              <li>To authenticate authorized users via Google OAuth</li>
              <li>
                To maintain and improve the functionality, security, and
                reliability of the Service
              </li>
            </ul>

            {/* 5. Prohibited Uses */}
            <h2>5. Prohibited Uses of Student Information</h2>
            <p>DailyWins will <strong>NEVER</strong>:</p>
            <ul>
              <li>
                Use personally identifiable information from pupil records to
                engage in targeted advertising directed at students, parents, or
                teachers.
              </li>
              <li>
                Use student information to create or amass a profile of a
                student for any purpose other than K&ndash;12 school purposes as
                authorized by the LEA.
              </li>
              <li>
                Sell, rent, or trade student personal information to any third
                party.
              </li>
              <li>
                Disclose student information to any third party except as
                required by law, authorized by the LEA, or as described in this
                Privacy Policy.
              </li>
              <li>
                Use student information for any commercial purpose unrelated to
                the provision of the Service.
              </li>
            </ul>

            {/* 6. Ownership */}
            <h2>6. Ownership and Control of Pupil Records</h2>
            <p>
              In accordance with California Education Code &sect; 49073.1 (AB
              1584), all pupil records provided to or generated within DailyWins
              remain the property of and under the control of the Local
              Educational Agency (LEA). DailyWins acts as a custodian of this
              data on behalf of the LEA and is considered a School Official with
              a legitimate educational interest under FERPA.
            </p>
            <p>
              The LEA retains full authority to direct DailyWins regarding the
              access, use, modification, and deletion of pupil records.
            </p>

            {/* 7. Data Storage and Security */}
            <h2>7. Data Storage and Security</h2>

            <h3>7.1 Where Data Is Stored</h3>
            <p>
              All student data is stored on Supabase (PostgreSQL) servers
              located in the United States (East US &mdash; Ohio region). Data
              is encrypted in transit using TLS 1.2+ and encrypted at rest using
              AES-256 encryption.
            </p>

            <h3>7.2 Security Measures</h3>
            <p>
              DailyWins implements and maintains reasonable security procedures
              appropriate to the nature of the student information collected,
              including:
            </p>
            <ul>
              <li>
                Row-Level Security (RLS) policies ensuring that each teacher can
                only access their own students&rsquo; data
              </li>
              <li>
                Google OAuth 2.0 for authentication (DailyWins never stores or
                handles user passwords)
              </li>
              <li>HTTPS encryption for all data in transit</li>
              <li>
                Access controls limiting data access to authorized personnel only
              </li>
              <li>
                Regular review of security practices and infrastructure
              </li>
            </ul>

            <h3>7.3 Designated Responsible Individual</h3>
            <p>
              DailyWins designates the following individual as responsible for
              ensuring the security and confidentiality of pupil records:
            </p>
            <p>
              <strong>Name:</strong> Devin Farren
              <br />
              <strong>Title:</strong> Co-Founder, Sure Step Education
              <br />
              <strong>Email:</strong>{" "}
              <a href="mailto:devin@surestepeducation.com">
                devin@surestepeducation.com
              </a>
            </p>

            {/* 8. Breach Notification */}
            <h2>8. Breach Notification</h2>
            <p>
              In the event of an unauthorized disclosure of pupil records,
              DailyWins will:
            </p>
            <ul>
              <li>
                Notify the affected LEA within 72 hours of discovering the
                breach
              </li>
              <li>
                Provide a description of the nature of the breach, the types of
                information involved, and the number of individuals affected
              </li>
              <li>
                Describe the steps DailyWins is taking to investigate and
                mitigate the breach
              </li>
              <li>
                Notify affected parents, legal guardians, or eligible pupils as
                directed by the LEA and in accordance with applicable law
              </li>
            </ul>

            {/* 9. Parental Rights */}
            <h2>9. Parental Rights: Access, Review, and Correction</h2>
            <p>
              In compliance with FERPA and AB 1584, parents, legal guardians, or
              eligible pupils (students 18 years of age or older) have the right
              to:
            </p>
            <ul>
              <li>
                <strong>Review</strong> their child&rsquo;s personally
                identifiable information stored in DailyWins by contacting their
                child&rsquo;s teacher or school administration.
              </li>
              <li>
                <strong>Request correction</strong> of erroneous information.
                Requests should be directed to the LEA, which will coordinate
                with DailyWins to make the correction.
              </li>
              <li>
                <strong>Request deletion</strong> of their child&rsquo;s data by
                contacting their school district.
              </li>
            </ul>
            <p>
              DailyWins will cooperate with the LEA in fulfilling all such
              requests in a timely manner.
            </p>

            {/* 10. Pupil-Generated Content */}
            <h2>10. Pupil-Generated Content</h2>
            <p>
              DailyWins does not currently collect pupil-generated content. All
              data in DailyWins is entered by teachers or school staff. Should a
              future version of DailyWins allow students to enter their own
              content, this policy will be updated to describe how students may
              retain possession and control of their pupil-generated content,
              including options to transfer such content to a personal account.
            </p>

            {/* 11. Data Retention and Deletion */}
            <h2>11. Data Retention and Deletion</h2>
            <p>
              DailyWins retains pupil records only for as long as necessary to
              fulfill the purposes described in this policy or as required by the
              LEA&rsquo;s contract.
            </p>
            <p>
              Upon termination or expiration of a contract with an LEA, or upon
              request by the LEA, DailyWins will:
            </p>
            <ul>
              <li>
                Return all pupil records to the LEA in a standard,
                machine-readable format (e.g., CSV or JSON)
              </li>
              <li>
                Delete all pupil records from DailyWins systems, including
                backups, within 60 days of the request or contract termination
              </li>
              <li>
                Provide written certification to the LEA confirming that all
                pupil records have been deleted and are no longer available to
                DailyWins
              </li>
            </ul>

            {/* 12. FERPA Compliance */}
            <h2>12. FERPA Compliance</h2>
            <p>
              DailyWins operates as a &ldquo;School Official&rdquo; with a
              legitimate educational interest under FERPA (34 CFR &sect;
              99.31(a)(1)). DailyWins and the LEA will jointly ensure compliance
              with FERPA by:
            </p>
            <ul>
              <li>
                Limiting access to student education records to authorized school
                personnel and DailyWins staff with a legitimate educational
                interest
              </li>
              <li>
                Maintaining appropriate administrative, technical, and physical
                safeguards to protect the confidentiality of student records
              </li>
              <li>
                Not redisclosing personally identifiable student information
                except as authorized by FERPA or directed by the LEA
              </li>
              <li>
                Cooperating with the LEA to respond to parental requests to
                inspect, review, or amend student records
              </li>
            </ul>

            {/* 13. SOPIPA Compliance */}
            <h2>13. SOPIPA Compliance</h2>
            <p>
              As an operator of an online service designed and marketed for
              K&ndash;12 school purposes, DailyWins complies with the California
              Student Online Personal Information Protection Act (SOPIPA, Cal.
              Bus. &amp; Prof. Code &sect; 22584) by:
            </p>
            <ul>
              <li>
                Not engaging in targeted advertising on the Service or using
                student information for advertising purposes
              </li>
              <li>
                Not using student information to amass profiles for
                non-educational purposes
              </li>
              <li>Not selling student information</li>
              <li>
                Not disclosing student information except for legitimate
                educational or authorized purposes
              </li>
              <li>
                Implementing and maintaining reasonable security procedures
                appropriate to the nature of the student information
              </li>
              <li>
                Deleting student information when no longer needed for its
                collected purpose or upon request
              </li>
            </ul>

            {/* 14. COPPA Compliance */}
            <h2>14. COPPA Compliance</h2>
            <p>
              DailyWins is designed for use by teachers and school staff, not
              directly by students. Teachers and staff are the sole users who
              enter data into the Service. DailyWins does not collect personal
              information directly from children under the age of 13.
            </p>
            <p>
              In the event that DailyWins introduces any student-facing features
              in the future, we will obtain verifiable parental consent or rely
              on the school consent exception under COPPA (16 CFR &sect;
              312.5(c)(1)) before collecting any information directly from
              students under 13.
            </p>

            {/* 15. Third-Party Services */}
            <h2>15. Third-Party Services and Subprocessors</h2>
            <p>
              DailyWins uses the following third-party services to operate:
            </p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-[#2c3e50] text-white">
                    <th className="text-left px-4 py-3 font-semibold">
                      Service
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">
                      Purpose
                    </th>
                    <th className="text-left px-4 py-3 font-semibold">
                      Data Processed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-3 font-medium">
                      Supabase (PostgreSQL)
                    </td>
                    <td className="px-4 py-3">
                      Database hosting and storage
                    </td>
                    <td className="px-4 py-3">
                      All student and teacher data
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td className="px-4 py-3 font-medium">Google OAuth 2.0</td>
                    <td className="px-4 py-3">User authentication</td>
                    <td className="px-4 py-3">
                      Teacher email address and name
                    </td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td className="px-4 py-3 font-medium">Vercel</td>
                    <td className="px-4 py-3">
                      Application hosting and delivery
                    </td>
                    <td className="px-4 py-3">
                      No student data stored; serves application code only
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              DailyWins does not share, sell, or disclose student information to
              any additional third parties beyond those listed above. We will
              update this list if additional subprocessors are added and will
              notify LEAs of material changes.
            </p>

            {/* 16. Changes to This Privacy Policy */}
            <h2>16. Changes to This Privacy Policy</h2>
            <p>
              DailyWins reserves the right to modify this Privacy Policy. If we
              make material changes that affect the handling of pupil records, we
              will notify all LEAs with active contracts at least 30 days prior
              to the changes taking effect. The updated policy will be posted at{" "}
              <a href="https://dailywins.school/privacy">
                https://dailywins.school/privacy
              </a>{" "}
              with the revised effective date.
            </p>

            {/* 17. Data Processing Agreements */}
            <h2>17. Data Processing Agreements</h2>
            <p>
              DailyWins is prepared to enter into a Data Processing Agreement
              (DPA) with any LEA as required by California Education Code &sect;
              49073.1 (AB 1584). We also support the California Student Data
              Privacy Agreement (CSDPA) template developed by CITE (California
              IT in Education, formerly CETPA) and the Student Data Privacy
              Consortium&rsquo;s National DPA template. LEAs may contact us to
              initiate the DPA process.
            </p>

            {/* 18. Contact Information */}
            <h2>18. Contact Information</h2>
            <p>
              For questions, concerns, or requests related to this Privacy Policy
              or DailyWins&rsquo; data practices, please contact:
            </p>
            <p>
              <strong>Sure Step Education</strong>
              <br />
              Devin Farren, Co-Founder
              <br />
              Email:{" "}
              <a href="mailto:devin@surestepeducation.com">
                devin@surestepeducation.com
              </a>
              <br />
              Website:{" "}
              <a href="https://dailywins.school">https://dailywins.school</a>
            </p>
          </div>
        </article>

        {/* Footer */}
        <footer className="mt-12 pb-8 text-center text-sm text-gray-500">
          <p>
            &copy; {new Date().getFullYear()} Sure Step Education. All rights
            reserved.
          </p>
        </footer>
      </main>
    </div>
  );
}
