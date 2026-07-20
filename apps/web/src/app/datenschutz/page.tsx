import { Nav } from '@/components/nav'
import { Footer2 } from '@/components/footer2'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description: 'Datenschutzerklärung von uMedical - von Reyher Media UG (haftungsbeschränkt).',
}

const DatenschutzPage = () => {
  return (
    <>
      <Nav />
      <main className="container py-16">
        <div className="typeset typeset-docs max-w-[37em] mx-auto">
          <h1>Datenschutzerklärung</h1>

          <h2>Verantwortlicher</h2>
          <p>
            von Reyher Media UG (haftungsbeschränkt)
            <br />
            Nonnendamm 33-35
            <br />
            13627 Berlin
            <br />
            Deutschland
            <br />
            Vertreten durch: Carlo von Reyher
            <br />
            E-Mail: <a href="mailto:info@umedical.store">info@umedical.store</a>
          </p>

          <h2>Datenschutz</h2>
          <p>
            Die Nutzung unserer Webseite ist in der Regel ohne Angabe personenbezogener Daten
            möglich. Soweit auf unseren Seiten personenbezogene Daten (beispielsweise Name,
            Anschrift oder E-Mail-Adressen) erhoben werden, erfolgt dies, soweit möglich,
            stets auf freiwilliger Basis. Diese Daten werden ohne Ihre ausdrückliche
            Zustimmung nicht an Dritte weitergegeben.
          </p>
          <p>
            Wir weisen darauf hin, dass die Datenübertragung im Internet (z.B. bei der
            Kommunikation per E-Mail) Sicherheitslücken aufweisen kann. Ein lückenloser Schutz
            der Daten vor dem Zugriff durch Dritte ist nicht möglich.
          </p>
          <p>
            Der Nutzung von im Rahmen der Impressumspflicht veröffentlichten Kontaktdaten
            durch Dritte zur Übersendung von nicht ausdrücklich angeforderter Werbung und
            Informationsmaterialien wird hiermit ausdrücklich widersprochen. Die Betreiber der
            Seiten behalten sich ausdrücklich rechtliche Schritte im Falle der unverlangten
            Zusendung von Werbeinformationen, etwa durch Spam-Mails, vor.
          </p>

          <h2>Server-Logfiles</h2>
          <p>
            Beim Besuch der Website werden durch den Hosting-Anbieter automatisch technische
            Zugriffsdaten (z.B. IP-Adresse, Datum und Uhrzeit des Abrufs, aufgerufene Seite,
            User-Agent) in Server-Logfiles verarbeitet. Diese Verarbeitung erfolgt auf
            Grundlage von Art. 6 Abs. 1 lit. f DSGVO zum Zweck des sicheren und stabilen
            Betriebs der Website.
          </p>

          <h2>Google Analytics</h2>
          <p>
            Diese Website benutzt Google Analytics, einen Webanalysedienst der Google Inc.
            (&quot;Google&quot;). Google Analytics verwendet sog. &quot;Cookies&quot;,
            Textdateien, die auf Ihrem Computer gespeichert werden und die eine Analyse der
            Benutzung der Website durch Sie ermöglicht. Die durch den Cookie erzeugten
            Informationen über Ihre Benutzung dieser Website (einschließlich Ihrer IP-Adresse)
            wird an einen Server von Google in den USA übertragen und dort gespeichert. Google
            wird diese Informationen benutzen, um Ihre Nutzung der Website auszuwerten, um
            Reports über die Websiteaktivitäten für die Websitebetreiber zusammenzustellen und
            um weitere mit der Websitenutzung und der Internetnutzung verbundene
            Dienstleistungen zu erbringen. Auch wird Google diese Informationen gegebenenfalls
            an Dritte übertragen, sofern dies gesetzlich vorgeschrieben oder soweit Dritte
            diese Daten im Auftrag von Google verarbeiten. Google wird in keinem Fall Ihre
            IP-Adresse mit anderen Daten der Google in Verbindung bringen. Sie können die
            Installation der Cookies durch eine entsprechende Einstellung Ihrer Browser
            Software verhindern; wir weisen Sie jedoch darauf hin, dass Sie in diesem Fall
            gegebenenfalls nicht sämtliche Funktionen dieser Website voll umfänglich nutzen
            können. Durch die Nutzung dieser Website erklären Sie sich mit der Bearbeitung der
            über Sie erhobenen Daten durch Google in der zuvor beschriebenen Art und Weise und
            zu dem zuvor benannten Zweck einverstanden.
          </p>

          <h2>Google AdSense</h2>
          <p>
            Diese Website benutzt Google Adsense, einen Webanzeigendienst der Google Inc., USA
            (&quot;Google&quot;). Google Adsense verwendet sog. &quot;Cookies&quot;
            (Textdateien), die auf Ihrem Computer gespeichert werden und die eine Analyse der
            Benutzung der Website durch Sie ermöglicht. Google Adsense verwendet auch sog.
            &quot;Web Beacons&quot; (kleine unsichtbare Grafiken) zur Sammlung von
            Informationen. Durch die Verwendung des Web Beacons können einfache Aktionen wie
            der Besucherverkehr auf der Webseite aufgezeichnet und gesammelt werden. Die durch
            den Cookie und/oder Web Beacon erzeugten Informationen über Ihre Benutzung dieser
            Website (einschließlich Ihrer IP-Adresse) werden an einen Server von Google in den
            USA übertragen und dort gespeichert. Google wird diese Informationen benutzen, um
            Ihre Nutzung der Website im Hinblick auf die Anzeigen auszuwerten, um Reports über
            die Websiteaktivitäten und Anzeigen für die Websitebetreiber zusammenzustellen und
            um weitere mit der Websitenutzung und der Internetnutzung verbundene
            Dienstleistungen zu erbringen. Auch wird Google diese Informationen gegebenenfalls
            an Dritte übertragen, sofern dies gesetzlich vorgeschrieben oder soweit Dritte
            diese Daten im Auftrag von Google verarbeiten. Google wird in keinem Fall Ihre
            IP-Adresse mit anderen Daten der Google in Verbindung bringen. Das Speichern von
            Cookies auf Ihrer Festplatte und die Anzeige von Web Beacons können Sie
            verhindern, indem Sie in Ihren Browser-Einstellungen &quot;keine Cookies
            akzeptieren&quot; wählen; wir weisen Sie jedoch darauf hin, dass Sie in diesem
            Fall gegebenenfalls nicht sämtliche Funktionen dieser Website voll umfänglich
            nutzen können. Durch die Nutzung dieser Website erklären Sie sich mit der
            Bearbeitung der über Sie erhobenen Daten durch Google in der zuvor beschriebenen
            Art und Weise und zu dem zuvor benannten Zweck einverstanden.
          </p>

          <h2>Ihre Rechte</h2>
          <p>
            Sie haben nach der DSGVO das Recht auf Auskunft, Berichtigung, Löschung,
            Einschränkung der Verarbeitung, Datenübertragbarkeit sowie Widerspruch gegen die
            Verarbeitung Ihrer personenbezogenen Daten. Zudem besteht ein Beschwerderecht bei
            einer Datenschutz-Aufsichtsbehörde.
          </p>

          <h2>Hinweis zu Gesundheitsinformationen (Disclaimer)</h2>
          <p>
            Die auf uMedical bereitgestellten Informationen zu Arzneimitteln, Wirkstoffen und
            Unternehmen stammen aus öffentlich zugänglichen behördlichen Quellen und dienen
            ausschließlich der allgemeinen Information. Sie stellen keine medizinische oder
            pharmazeutische Beratung dar und ersetzen nicht die Konsultation von Ärztinnen und
            Ärzten oder Apothekerinnen und Apothekern. Für Richtigkeit, Vollständigkeit und
            Aktualität der Daten wird keine Gewähr übernommen; maßgeblich sind stets die
            offiziellen Veröffentlichungen der zuständigen Behörden (insbesondere der EMA).
          </p>

          <p>
            <small>© {new Date().getFullYear()} von Reyher Media UG (haftungsbeschränkt)</small>
          </p>
        </div>
      </main>
      <Footer2 />
    </>
  )
}

export default DatenschutzPage
