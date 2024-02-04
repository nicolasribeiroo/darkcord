import { Outlet } from "react-router-dom";
import { DocsSidebarNav } from "~/components/sidebar-nav";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { ScrollArea } from "~/components/ui/scroll-area";

export default function DocsItemLayout() {
	return (
		<div className="min-h-screen bg-background font-sans antialiased">
			<div className="relative flex min-h-screen flex-col bg-background">
				<SiteHeader />
				<main className="flex-1">
					<div className="border-b">
						<div className="container flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
							<aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block">
								<ScrollArea className="h-full py-6 pr-6 lg:py-8">
									<DocsSidebarNav />
								</ScrollArea>
							</aside>
							<Outlet />
						</div>
					</div>
				</main>
				<SiteFooter />
			</div>
		</div>
	);
}
