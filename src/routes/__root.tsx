import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { ThemeProvider } from '../lib/theme/ThemeProvider'
import { parsePreference, resolvePreference } from '../lib/theme/runtime'
import appCss from '../styles.css?url'

const getTheme = createServerFn({ method: 'GET' }).handler(() => parsePreference(getCookie('theme-preference')))
export const Route = createRootRoute({ beforeLoad: async () => ({ theme: await getTheme() }), head: () => ({ links: [{ rel: 'stylesheet', href: appCss }] }), component: Root })
function Root() {
 const {theme}=Route.useRouteContext()
 const light=resolvePreference(theme,'light'), dark=resolvePreference(theme,'dark')
 const style=Object.fromEntries(Object.entries(light.tokens).map(([key,value])=>[`--${key}`,value]))
 const payload=JSON.stringify({light,dark,system:theme.mode==='system'}).replace(/</g,'\\u003c')
 const script=`(()=>{const p=${payload};const t=p.system&&matchMedia('(prefers-color-scheme: dark)').matches?p.dark:p.light;const r=document.documentElement;r.dataset.theme=t.mode;r.style.colorScheme=t.mode;for(const [k,v] of Object.entries(t.tokens))r.style.setProperty('--'+k,v)})()`
 return <html lang="en" data-theme={light.mode} style={style} suppressHydrationWarning><head><meta charSet="utf-8" /><script dangerouslySetInnerHTML={{__html:script}} /><HeadContent /></head><body><ThemeProvider initial={theme}><Outlet /></ThemeProvider><Scripts /></body></html>
}
