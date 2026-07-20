import { cn } from "@workspace/ui/lib/utils";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  className?: string;
}

interface Faq1Props {
  heading?: string;
  items?: FaqItem[];
  className?: string;
}

const defaultItems: FaqItem[] = [
  {
    id: "faq-1",
    question: "Was ist uMedical?",
    answer:
      "uMedical ist die erste kostenlose Open-Source Suchmaschine für in der EU zugelassene Arzneimittel. Wir aggregieren und strukturieren öffentlich verfügbare Daten der Europäischen Arzneimittel-Agentur (EMA) zu einer vereinheitlichten, universellen Sicht auf Medikamenteninformationen - von der Zulassung über Wirkstoffe bis zu Unternehmensprofilen. Das \"u\" steht dabei für universal, unified und understanding: eine offene Datenquelle, die komplexe regulatorische Informationen verständlich macht.",
  },
  {
    id: "faq-2",
    question: "Woher stammen die Daten?",
    answer:
      "Alle Daten stammen aus offiziellen, öffentlich zugänglichen Quellen der Europäischen Arzneimittel-Agentur (EMA). Wir importieren und verarbeiten diese Daten automatisiert, um sie in einem benutzerfreundlichen Format darzustellen.",
  },
  {
    id: "faq-3",
    question: "Ist MedikamentenProfil.de kostenlos?",
    answer:
      "Ja, MedikamentenProfil.de ist vollständig kostenlos und wird es auch bleiben. Als Open-Source Projekt ist unser gesamter Quellcode öffentlich auf GitHub verfügbar.",
  },
  {
    id: "faq-4",
    question: "Für wen ist diese Plattform gedacht?",
    answer:
      "Die Plattform richtet sich an alle, die Informationen über EU-zugelassene Medikamente suchen - von medizinischem Fachpersonal über Forscher bis hin zu interessierten Bürgern. Die Daten dienen ausschließlich Informationszwecken.",
  },
  {
    id: "faq-5",
    question: "Wie kann ich zum Projekt beitragen?",
    answer:
      "Als Open-Source Projekt freuen wir uns über Beiträge! Besuchen Sie unser GitHub-Repository, um Bugs zu melden, Features vorzuschlagen oder direkt zum Code beizutragen. Jede Form der Unterstützung ist willkommen.",
  },
  {
    id: "faq-6",
    question: "Wie aktuell sind die Daten?",
    answer:
      "Wir aktualisieren unsere Datenbank regelmäßig mit den neuesten Informationen der EMA. Da es sich um ein laufendes Projekt handelt, kann es zu Verzögerungen kommen. Das Datum der letzten Aktualisierung wird bei den jeweiligen Einträgen angezeigt.",
  },
];

const Faq1 = ({
  heading = "Häufig gestellte Fragen",
  items = defaultItems,
  className,
}: Faq1Props) => {
  return (
    <section className={cn("py-16 sm:py-24", className)}>
      <div className="container max-w-3xl">
        <h2 className="mb-4 text-2xl font-semibold md:mb-8 md:text-3xl">
          {heading}
        </h2>
        <Accordion type="single" collapsible>
          {items.map((item, index) => (
            <AccordionItem key={item.id} value={`item-${index}`}>
              <AccordionTrigger className="font-medium hover:no-underline text-left">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export { Faq1 };
