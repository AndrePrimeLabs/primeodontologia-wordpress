<?php
/**
 * Big Sky Chrome Management
 *
 * Injects the chrome (layout modifications around the main admin area) CSS
 * that easy mode needs in the site editor.
 *
 * @package BigSky
 */

if ( ! class_exists( 'Big_Sky_Chrome' ) ) {
	/**
	 * Class Big_Sky_Chrome
	 *
	 * Chrome CSS for easy mode.
	 */
	class Big_Sky_Chrome {

		/**
		 * Easy-mode lockdown: hide the core site-editor chrome that the easy-mode
		 * topbar replaces, and reserve the top strip for it.
		 *
		 * DRIFT CANARY. Every selector below targets core Gutenberg markup. If the
		 * easy-mode E2E spec starts failing on "core chrome visible", a selector
		 * here has drifted against Gutenberg trunk — .wp-env runs Gutenberg
		 * nightly, so that spec is the early-warning system.
		 *
		 * The WordPress admin bar is deliberately KEPT — easy mode locks down the
		 * editor's chrome, not the surrounding admin. The easy-mode topbar sits
		 * directly beneath it.
		 *
		 * Targeted core selectors:
		 * - html.wp-toolbar                        admin-bar spacing (literal 32px in core)
		 * - .interface-interface-skeleton          the editor's outer frame, offset below
		 * - .interface-interface-skeleton__header  header region (removes its 64px)
		 * - .interface-interface-skeleton__sidebar settings sidebar (complementary area)
		 * - .is-distraction-free                   set on the skeleton; changes how core
		 *                                          positions it, so the offset branches
		 * - .editor-header                         top bar, incl. distraction-free hover reveal
		 * - .edit-site-save-hub                    save flow (rendered conditionally)
		 * - .editor-save-publish-panels            save flow (rendered conditionally)
		 * - .edit-site-layout.is-full-canvas       canvas mode: edit rather than design view
		 *
		 * TWO SCOPES.
		 *
		 * `body.big-sky-easy-mode` selects the AI Editor for this document.
		 * Only the edit canvas receives the replacement chrome: the portal hosts
		 * do not exist in core's navigation view. Chat visibility is independent.
		 *
		 * @see Big_Sky_Easy_Mode::is_active()
		 */
		public static function inject_easy_mode_chrome_css() {
			?>
			<style id="big-sky-easy-mode-chrome">
			/* Hide the server-rendered entry before Agents Manager mounts. */
			body.big-sky-easy-mode #wpadminbar #wp-toolbar #wp-admin-bar-top-secondary #wp-admin-bar-agents-manager-ai-chat {
				display: none !important;
			}

			/*
			 * Easy mode's two fixed heights. Declared on <html> so they are in
			 * scope for its own padding as well as for everything inside <body>.
			 * The admin-bar value mirrors the literal core uses for
			 * html.wp-toolbar's padding, including at the 782px breakpoint.
			 */
			html.wp-toolbar:has(body.big-sky-easy-mode) {
				--big-sky-easy-mode-admin-bar-height: 32px;
				/*
				 * Matches the site editor's own header, measured on
				 * .interface-interface-skeleton__header. Easy mode replaces that
				 * header's contents but keeps its box, so the two editors have to
				 * agree on the height or the canvas starts at a different line in
				 * each.
				 */
				--big-sky-easy-mode-topbar-height: 64px;
			}

			/* Core switches the admin bar to 46px below this breakpoint. */
			@media screen and (max-width: 782px) {
				html.wp-toolbar:has(body.big-sky-easy-mode) {
					--big-sky-easy-mode-admin-bar-height: 46px;
				}
			}

			/*
			 * Easy mode keeps the admin bar, but core's fullscreen mode hides it
			 * and takes the editor to the top of the viewport. Put both back: show
			 * the bar, and start the editor below it.
			 *
			 * Only the admin bar is offset here. The easy-mode topbar is NOT
			 * offset against the viewport — it renders inside the editor's own
			 * header region, which is already sized and positioned correctly
			 * (notably, inset for the docked chat).
			 */
			body.big-sky-easy-mode.is-fullscreen-mode #wpadminbar {
				display: block !important;
			}

			/*
			 * The offset has to branch, because the two states measure `top`
			 * against different things.
			 *
			 * Ordinarily the skeleton is in normal flow, and html.wp-toolbar's
			 * padding has already cleared the admin bar — so any `top` here is
			 * added to that and shows as a strip of canvas above the topbar.
			 *
			 * Distraction-free instead pins the skeleton past that padding, so
			 * there the admin bar has to be cleared explicitly. Easy mode does not
			 * turn distraction-free on (see src/easy-mode/preferences.ts), but the
			 * user may have it on from their own use of the editor, so both states
			 * have to land in the same place.
			 */
			body.big-sky-easy-mode.is-fullscreen-mode .interface-interface-skeleton {
				top: 0 !important;
				height: calc(
					100vh - var(--big-sky-easy-mode-admin-bar-height)
				) !important;
				min-height: 0 !important;
				max-height: none !important;
			}

			body.big-sky-easy-mode.is-fullscreen-mode
				.interface-interface-skeleton.is-distraction-free {
				top: var(--big-sky-easy-mode-admin-bar-height) !important;
			}

				/*
				 * The on-screen scope — AI Editor canvas in edit mode —
				 * entered once rather than repeated on every rule, so indentation
				 * alone says which rules are gated.
				 *
				 * `&` resolves to :is(<parent>), so with a single parent selector
				 * each nested rule has the specificity it would have had flat.
				 */
			body.big-sky-easy-mode:has(
					.edit-site-layout.is-full-canvas
				) {
				/*
				 * Hide core's header CONTENT but keep the header region, which
				 * is where the easy-mode topbar mounts.
				 *
				 * Hidden, never removed: core's header stays mounted and fully
				 * functional underneath while the AI Editor supplies its own header.
				 */
				& .editor-header {
					display: none !important;
				}

				/*
				 * :has(.editor-header) is load-bearing. The site editor nests
				 * interface skeletons, so the bare class matches two elements
				 * and sizing both stacks an empty second header above the
				 * canvas.
				 */
				& .interface-interface-skeleton__header:has(.editor-header) {
					border-bottom: 0 !important;
					height: var(--big-sky-easy-mode-topbar-height) !important;
					/*
					 * Distraction-free sets opacity:0 on this region and reveals
					 * it on hover/:focus-within. Easy mode does not turn
					 * distraction-free on, but a user may already have it on —
					 * and the topbar is permanent chrome either way, so pin it
					 * visible.
					 */
					opacity: 1 !important;
				}

				/* Same reason: distraction-free slides the region's children in. */
				& .big-sky-easy-mode__topbar-host {
					transform: none !important;
				}

				& .edit-site-save-hub,
				& .editor-save-publish-panels {
					display: none !important;
				}

				/*
				 * The settings sidebar (Page / Block inspector). Easy mode offers
				 * no way to open one — the header holding the toggle is hidden
				 * above — so it is hidden outright rather than closed.
				 *
				 * Hidden here rather than closed through the interface store,
				 * because both disableComplementaryArea and
				 * enableComplementaryArea write
				 * `core`/`isComplementaryAreaVisible`, and that scope persists to
				 * user meta and localStorage (see src/easy-mode/preferences.ts) —
				 * so it would follow the user into the full site editor, the post
				 * editor, and any tab already open on either. A rule scoped to the
				 * body class retires with the class instead.
				 *
				 * Every complementary area goes, not just core's inspector: Big Sky
				 * registers one of its own (big-sky/pages-sidebar), and easy mode
				 * replaces page switching with a topbar control.
				 *
				 * Core sizes the region with `width: auto`, so hiding it hands the
				 * space back to the canvas without leaving a gap.
				 */
				& .interface-interface-skeleton__sidebar {
					display: none !important;
				}
			}
			</style>
			<?php
		}
	}
}
