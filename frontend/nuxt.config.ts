import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // URL de l'API NestJS (mots du jour). Surchargée en déploiement via
      // NUXT_PUBLIC_API_BASE ; en dev l'API écoute sur :3001 (cf. api/.env.example).
      apiBase: 'http://localhost:3001'
    }
  },
  app: {
    head: {
      title: 'Undercover Infinite',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0a0e15' },
        {
          name: 'description',
          content: 'Undercover Infinite — jeu de déduction sociale en pass-and-play. Un seul téléphone, un agent double.'
        }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo-mark.png' },
        // Les tokens de main.css déclarent Oswald / Inter / Courier Prime : sans
        // ces feuilles, font-display et font-mono retombent sur les fallbacks.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Inter:wght@400..700&family=Oswald:wght@400..700&display=swap'
        }
      ]
    }
  },
  vite: {
    plugins: [tailwindcss()]
  },
  components: [
    { path: '~/components/auth', pathPrefix: false },
    { path: '~/components/core', pathPrefix: false },
    { path: '~/components/data-display', pathPrefix: false },
    { path: '~/components/feedback', pathPrefix: false },
    { path: '~/components/game', pathPrefix: false }
  ]
})
