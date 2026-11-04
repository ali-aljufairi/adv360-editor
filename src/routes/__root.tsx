import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import appCss from '../styles.css?url'
export const Route = createRootRoute({ head: () => ({ links: [{ rel: 'stylesheet', href: appCss }] }), component: Root })
function Root() { return <html lang="en"><head><meta charSet="utf-8" /><HeadContent /></head><body><Outlet /><Scripts /></body></html> }
