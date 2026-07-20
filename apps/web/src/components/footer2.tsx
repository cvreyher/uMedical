import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { PillIcon } from "lucide-react";

interface MenuItem {
  title: string;
  links: {
    text: string;
    url: string;
  }[];
}

interface Footer2Props {
  className?: string;
  tagline?: string;
  menuItems?: MenuItem[];
  copyright?: string;
  bottomLinks?: {
    text: string;
    url: string;
  }[];
}

const Footer2 = ({
  className,
  tagline = "Transparente Medikamenteninformationen für Europa.",
  menuItems = [
    {
      title: "Datenbank",
      links: [
        { text: "Medikamente", url: "/medikamente" },
        { text: "Wirkstoffe", url: "/wirkstoffe" },
        { text: "Unternehmen", url: "/unternehmen" },
      ],
    },
    {
      title: "Projekt",
      links: [
        { text: "GitHub", url: "https://github.com/cvreyher/uMedical" },
        { text: "Mitwirken", url: "https://github.com/cvreyher/uMedical" },
      ],
    },
    {
      title: "Datenquellen",
      links: [
        { text: "EMA", url: "https://www.ema.europa.eu" },
      ],
    },
  ],
  copyright = `${new Date().getFullYear()} uMedical - Open Source Projekt`,
  bottomLinks = [
    { text: "Impressum", url: "/impressum" },
    { text: "Datenschutz", url: "/datenschutz" },
  ],
}: Footer2Props) => {
  return (
    <footer className={cn("bg-muted/30  rounded-t-3xl border px-10", className)}>
      <div className="container py-12 sm:py-16">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-5">
          <div className="col-span-2 mb-8 lg:mb-0">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <PillIcon className="w-6 h-6" />
              <span className="font-bold text-lg">uMedical</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              {tagline}
            </p>
          </div>
          {menuItems.map((section, sectionIdx) => (
            <div key={sectionIdx}>
              <h3 className="mb-4 font-semibold">{section.title}</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {section.links.map((link, linkIdx) => (
                  <li key={linkIdx}>
                    <Link
                      href={link.url}
                      className="hover:text-foreground transition-colors"
                      {...(link.url.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {link.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row justify-between gap-4 text-sm text-muted-foreground">
          <p>{copyright}</p>
          <ul className="flex gap-4">
            {bottomLinks.map((link, linkIdx) => (
              <li key={linkIdx}>
                <Link href={link.url} className="hover:text-foreground transition-colors">
                  {link.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
};

export { Footer2 };
