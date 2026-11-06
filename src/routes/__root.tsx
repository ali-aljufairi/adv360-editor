import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { ThemeProvider } from '../lib/theme/ThemeProvider'
import { customStorageKey, parsePreference, resolvePreference } from '../lib/theme/runtime'
import appCss from '../styles.css?url'

const getTheme = createServerFn({ method: 'GET' }).handler(() => parsePreference(getCookie('theme-preference')))
export const Route = createRootRoute({ beforeLoad: async () => ({ theme: await getTheme() }), head: () => ({ links: [{ rel: 'stylesheet', href: appCss }] }), component: Root })
function Root() {
 const {theme}=Route.useRouteContext()
 const light=resolvePreference(theme,'light'), dark=resolvePreference(theme,'dark')
 const style=Object.fromEntries(Object.entries(light.tokens).map(([key,value])=>[`--${key}`,value]))
 const payload=JSON.stringify({light,dark,preference:theme,key:customStorageKey}).replace(/</g,'\\u003c')
 const script=`(()=>{const p=${payload},m=p.preference.mode==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p.preference.mode,t=m==='dark'?p.dark:p.light,r=document.documentElement;let tokens=t.tokens;try{const entries=JSON.parse(localStorage.getItem(p.key)||'[]'),entry=entries.find(e=>e.theme.id===p.preference[m]);if(entry&&p.preference.hash){let h=2166136261;for(const c of JSON.stringify(entry.theme))h=Math.imul(h^c.charCodeAt(0),16777619);if((h>>>0).toString(36)===p.preference.hash&&entry.hash===p.preference.hash&&entry.tokens?.[m])tokens=entry.tokens[m]}}catch{}r.dataset.theme=m;r.style.colorScheme=m;for(const [k,v] of Object.entries(tokens))r.style.setProperty('--'+k,v)})()`
 return <html lang="en" data-theme={light.mode} style={style} suppressHydrationWarning><head><meta charSet="utf-8" /><script dangerouslySetInnerHTML={{__html:script}} /><HeadContent /></head><body><ThemeProvider initial={theme}><Outlet /></ThemeProvider><Scripts /></body></html>
}
