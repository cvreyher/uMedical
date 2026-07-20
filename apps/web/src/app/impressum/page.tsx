import { Nav } from '@/components/nav'
import { Footer2 } from '@/components/footer2'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Impressum',
  description: 'Impressum und Anbieterkennzeichnung von uMedical - von Reyher Media UG (haftungsbeschränkt).',
}

const ImpressumPage = () => {
  return (
    <>
      <Nav />
      <main className="container py-16">
        <div className="typeset typeset-docs max-w-[37em] mx-auto">
          <h1>Impressum</h1>
          <p>
            Vielen Dank für Ihr Interesse an unserer Website! Hier finden Sie alle relevanten
            Informationen zum Betreiber und den rechtlichen Hinweisen.
          </p>

          <h2>Angaben gemäß § 5 DDG</h2>
          <p>
            von Reyher Media UG (haftungsbeschränkt)
            <br />
            Nonnendamm 33-35
            <br />
            13627 Berlin
            <br />
            Deutschland
          </p>

          <h3>Vertreten durch</h3>
          <p>Carlo von Reyher</p>

          <h3>Kontakt</h3>
          <p>
            E-Mail: <a href="mailto:info@umedical.store">info@umedical.store</a>
          </p>

          <h3>Registereintrag</h3>
          <p>
            Eintragung im Handelsregister.
            <br />
            Registergericht: Amtsgericht Charlottenburg (Berlin)
            <br />
            Registernummer: HRB 264721 B
          </p>

          <h3>Umsatzsteuer-ID</h3>
          <p>Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: DE369232632</p>

          <h3>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h3>
          <p>
            von Reyher Media UG (haftungsbeschränkt)
            <br />
            Nonnendamm 33-35
            <br />
            13627 Berlin
          </p>

          <h2>Medizinischer Hinweis (Disclaimer)</h2>
          <p>
            Die auf uMedical bereitgestellten Inhalte stammen aus öffentlich zugänglichen
            Quellen der Europäischen Arzneimittel-Agentur (EMA) und weiterer
            Regulierungsbehörden und dienen ausschließlich der allgemeinen Information. Sie
            stellen keine medizinische, pharmazeutische oder rechtliche Beratung dar und
            ersetzen in keinem Fall die Beratung, Diagnose oder Behandlung durch Ärztinnen und
            Ärzte oder Apothekerinnen und Apotheker. Wenden Sie sich bei Fragen zu
            Arzneimitteln, Erkrankungen oder Behandlungen immer an medizinisches Fachpersonal.
            Treffen Sie keine Therapieentscheidungen auf Grundlage der hier dargestellten
            Informationen. Trotz sorgfältiger automatisierter Aufbereitung können die Daten
            unvollständig, veraltet oder fehlerhaft sein; maßgeblich sind stets die
            offiziellen Veröffentlichungen der zuständigen Behörden.
          </p>

          <h2>Haftungsausschluss</h2>

          <h3>Haftung für Inhalte</h3>
          <p>
            Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die
            Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine
            Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene
            Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8
            bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte
            oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu
            forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur
            Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen
            Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab
            dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei
            Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte
            umgehend entfernen.
          </p>

          <h3>Haftung für Links</h3>
          <p>
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir
            keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine
            Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige
            Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden
            zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige
            Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente
            inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte
            einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen
            werden wir derartige Links umgehend entfernen.
          </p>

          <h3>Urheberrecht</h3>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
            unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung,
            Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes
            bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen
            Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber
            erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden
            Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine
            Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden
            Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte
            umgehend entfernen.
          </p>

          <p>
            <small>
              Impressum vom Impressum Generator der Kanzlei Hasselbach, Bonn
              <br />© {new Date().getFullYear()} von Reyher Media UG (haftungsbeschränkt)
            </small>
          </p>
        </div>
      </main>
      <Footer2 />
    </>
  )
}

export default ImpressumPage
