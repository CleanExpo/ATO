import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/share/'],
    },
    sitemap: 'https://ato-ai.app/sitemap.xml',
  }
}
