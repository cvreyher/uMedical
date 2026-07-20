export const appPaths = {
  home: {
    getHref: () => '/',
  },
  medikamente: {
    getHref: () => '/medikamente',
    detail: {
      getHref: (slug: string) => `/medikamente/${slug}`,
    },
  },
  wirkstoffe: {
    getHref: () => '/wirkstoffe',
    detail: {
      getHref: (slug: string) => `/wirkstoffe/${slug}`,
    },
  },
  unternehmen: {
    getHref: () => '/unternehmen',
    detail: {
      getHref: (slug: string) => `/unternehmen/${slug}`,
    },
  },
  statistiken: {
    getHref: () => '/statistiken',
  },
} as const
