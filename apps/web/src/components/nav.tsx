'use client'

import { Header } from '@/components/layouts'
import { ThemeToggle } from '@/components/theme-toggle'
import { Logo } from '@/components/logo'
import { Button } from '@workspace/ui/components/ui/button'
import { GithubIcon, MenuIcon } from 'lucide-react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@workspace/ui/components/ui/sheet'

const navLinks = [
  { href: '/medikamente', label: 'Medicines' },
  { href: '/wirkstoffe', label: 'Substances' },
  { href: '/unternehmen', label: 'Companies' },
  { href: '/statistiken', label: 'Statistics' },
]

const Nav = () => {
  return (
    <Header className="absolute top-0 border-b border-r border-l rounded-b-2xl py-10 sticky" variant="sticky">
      <Logo />

      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-6 ml-8">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-2">
        <ThemeToggle />
        <Link href="https://github.com/cvreyher/uMedical" target="_blank" className="hidden sm:block">
          <Button variant="secondary" size="sm">
            <GithubIcon className="w-4 h-4" />
            GitHub
          </Button>
        </Link>

        {/* Mobile Navigation */}
        <Sheet>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <MenuIcon className="w-5 h-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <nav className="flex flex-col gap-4 mt-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-lg font-medium hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <hr className="my-4" />
              <Link href="https://github.com/cvreyher/uMedical" target="_blank">
                <Button variant="outline" className="w-full">
                  <GithubIcon className="w-4 h-4 mr-2" />
                  GitHub
                </Button>
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </Header>
  )
}

export { Nav }
