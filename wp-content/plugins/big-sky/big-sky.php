<?php

/**
 * Plugin Name: WordPress Agent
 * Plugin URI: https://wordpress.com/support/ai/wordpress-agent/
 * Update URI: https://github.com/Automattic/big-sky-plugin
 * Description: Your WordPress.com AI agent that helps with site setup, content, design, and more.
 * Version: 7.9.23
 * Author: Automattic, Inc.
 * Author URI: https://automattic.com/
 * Text Domain: big-sky
 * Domain Path: /languages
 * License: GPL2
 */

use Automattic\Jetpack\Agents_Manager\Agents_Manager;

/**
 * Absolute path to the plugin's entry file.
 *
 * Classes under lib/ and includes/ cannot use __FILE__ to build plugin URLs,
 * so they resolve asset paths against this instead.
 */
if ( ! defined( 'BIG_SKY__PLUGIN_FILE' ) ) {
	define( 'BIG_SKY__PLUGIN_FILE', __FILE__ );
}

require_once __DIR__ . '/lib/wpcom-rest-api-v2-endpoints.php';

if ( file_exists( __DIR__ . '/vendor/wordpress/abilities-api/abilities-api.php' ) ) {
	require_once __DIR__ . '/vendor/wordpress/abilities-api/abilities-api.php';
}

require_once __DIR__ . '/includes/class-big-sky-chrome.php';
require_once __DIR__ . '/lib/class-big-sky-easy-mode.php';
require_once __DIR__ . '/lib/class-big-sky-easy-mode-preview.php';

if ( ! class_exists( 'Big_Sky' ) ) {

	class Big_Sky {
		public const ENABLE_OPTION_NAME = 'big_sky_enable';
		public const SUPPORTED_LOCALES  = [
			// Keys are WP.org and WP.com locale slugs.
			// Values are the English name of the language.
			'ar'    => 'Arabic',
			'de'    => 'German',
			'de_DE' => 'German',
			'es'    => 'Spanish (Spain)',
			'es_ES' => 'Spanish (Spain)',
			'fr'    => 'French (France)',
			'fr_FR' => 'French (France)',
			'he'    => 'Hebrew',
			'he_IL' => 'Hebrew',
			'id'    => 'Indonesian',
			'id_ID' => 'Indonesian',
			'it'    => 'Italian',
			'it_IT' => 'Italian',
			'ja'    => 'Japanese',
			'ko'    => 'Korean',
			'ko_KR' => 'Korean',
			'nl'    => 'Dutch',
			'nl_NL' => 'Dutch',
			'pt-br' => 'Portuguese (Brazil)',
			'pt_BR' => 'Portuguese (Brazil)',
			'ru'    => 'Russian',
			'ru_RU' => 'Russian',
			'sv'    => 'Swedish',
			'sv_SE' => 'Swedish',
			'tr'    => 'Turkish',
			'tr_TR' => 'Turkish',
			'zh-cn' => 'Chinese (China)',
			'zh_CN' => 'Chinese (China)',
			'zh-tw' => 'Chinese (Taiwan)',
			'zh_TW' => 'Chinese (Taiwan)',
		];
		public static $enabled          = '1';

		public const AGENTS_MANAGER_EDITOR_AGENT_ID = 'wp-orchestrator';

		// Versioned base URL for the lazy-loaded site-spec bundle (with trailing slash)
		public const SITE_SPEC_BASE_URL = 'https://widgets.wp.com/site-spec/v1.20.0/';

		public static function init() {
			self::$enabled = get_option( self::ENABLE_OPTION_NAME, '1' );

			add_action( 'init', array( 'Big_Sky', 'load_textdomain' ) );

			add_action( 'wp_abilities_api_categories_init', array( 'Big_Sky', 'register_ability_categories' ) );

			// Easy mode and its front-end preview iframe.
			Big_Sky_Easy_Mode::init();
			Big_Sky_Easy_Mode_Preview::init();

			add_action( 'enqueue_block_editor_assets', array( 'Big_Sky', 'enqueue_assets' ) );

			add_action( 'admin_init', array( 'Big_Sky', 'register_big_sky_enable' ) );
			add_action( 'admin_init', array( 'Big_Sky', 'register_big_sky_metadata_setting' ) );
			add_action( 'admin_init', array( 'Big_Sky', 'maybe_redirect_legacy_easy_site_editor' ), 0 );
			add_action( 'current_screen', array( 'Big_Sky', 'redirect_to_front_page' ) );
			add_filter( 'woocommerce_prevent_automatic_wizard_redirect', array( 'Big_Sky', 'maybe_prevent_woocommerce_wizard_redirect' ) );
			add_action( 'rest_api_init', array( 'Big_Sky', 'register_big_sky_metadata_setting' ) );
			add_action( 'rest_api_init', array( 'Big_Sky', 'register_big_sky_rest_fields' ) );
			add_action( 'rest_api_init', array( 'Big_Sky_Easy_Mode_Preview', 'register_routes' ) );
			add_action( 'delete_post', array( 'Big_Sky', 'handle_post_deletion' ) );
			add_action( 'wp_trash_post', array( 'Big_Sky', 'handle_post_deletion' ) );
			add_action( 'admin_menu', array( 'Big_Sky', 'add_ai_editor_menu' ) );

			// Hook Big Sky into Agents Manager: its provider module, the agent it
			// uses, and the flag that tells it Big Sky is enabled.
			add_filter( 'agents_manager_agent_providers', array( 'Big_Sky', 'register_agent_manager_provider' ), 10, 1 );
			add_filter( 'agents_manager_agent_id', array( 'Big_Sky', 'maybe_use_orchestrator_for_agents_manager' ), 10, 1 );
			add_filter( 'jetpack_ai_sidebar_agents_manager_data', array( 'Big_Sky', 'flag_big_sky_for_agents_manager' ) );

			// This will show a notice when in dev mode when requirements for Big Sky are not met.
			add_action( 'admin_notices', array( 'Big_Sky', 'admin_notices' ) );
			add_action( 'plugins_loaded', array( 'Big_Sky', 'maybe_disable_idc_validation' ) );

			// use the filter jetpack_options_whitelist to allow the big_sky_site_metadata option to be synced
			add_filter(
				'jetpack_options_whitelist',
				function ( $whitelist ) {
					$whitelist[] = 'big_sky_site_metadata';
					return $whitelist;
				}
			);

			// When an AI generated logo is edited, mark the new image as an AI generated logo as well.
			add_filter( 'wp_edited_image_metadata', array( 'Big_Sky', 'set_big_sky_generated_logo_for_edited_images' ), 10, 3 );

			$logger = self::get_logger();

			// Register the endpoints.
			new WPCOM_REST_API_V2_Endpoint_Big_Sky_Plugin( $logger );
			self::init_site_health();
		}

		/**
		 * Enables "Development" features that should be accessible only for admins.
		 */
		public static function is_dev_mode() {
			// Known local environments.
			$domain = parse_url( get_site_url(), PHP_URL_HOST );
			if (
				$domain === 'localhost' ||
				'.jurassic.tube' === stristr( $domain, '.jurassic.tube' ) ||
				'.jurassic.ninja' === stristr( $domain, '.jurassic.ninja' )
			) {
				return true;
			}

			// A8C development.
			if ( self::is_wpcom() && is_proxied_automattician() ) {
				return true;
			}
			if ( defined( 'AT_PROXIED_REQUEST' ) && AT_PROXIED_REQUEST && defined( 'ATOMIC_CLIENT_ID' ) ) {
				switch ( ATOMIC_CLIENT_ID ) {
					case 1: // Internal testing pool
					case 2: // WordPress.com on Atomic (WoA)
					case 3: // Pressable
					case 32: // Jurassic.ninja
					case 118: // Commerce garden client (ciab)
						return true;
						break;
				}
			}

			return false;
		}

		/**
		 * Whether the current request is the easy-mode front-end preview iframe.
		 *
		 * @return bool
		 */
		public static function is_easy_site_editor_preview() {
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Preview is a read-only iframe display mode.
			return isset( $_GET['easy-site-editor-preview'] ) && '1' === sanitize_text_field( wp_unslash( $_GET['easy-site-editor-preview'] ) );
		}

		/**
		 * Shared gate for whether easy mode is available to this user.
		 *
		 * Deliberately says nothing about the front page: with a static one easy
		 * mode opens it, and without one it opens the home template — the post
		 * list — which is equally editable. Relies on the current user being
		 * established, so it must not run earlier than `init`.
		 *
		 * Big Sky only loads on WordPress.com Simple and Atomic sites, and both
		 * are supported here. Atomic sites authenticate the wpcom agent and JWT
		 * requests through their Jetpack connection, which is present by default.
		 *
		 * Public so Big_Sky_Easy_Mode can compose it.
		 *
		 * @return bool
		 */
		public static function is_easy_mode_enabled() {
			return (bool) self::$enabled && current_user_can( 'edit_theme_options' );
		}

		/**
		 * Register ability categories for Big Sky
		 */
		public static function register_ability_categories() {
			wp_register_ability_category(
				'big-sky',
				array(
					'label'       => __( 'Big Sky', 'big-sky' ),
					'description' => __( 'AI-powered site building and navigation abilities.', 'big-sky' ),
				)
			);
		}

		private static function get_logger() {
			if ( self::is_wpcom() ) {
				require_once __DIR__ . '/lib/wpcom-big-sky-logger.php';
				return new WPCOM_Big_Sky_Logger();
			} else {
				require_once __DIR__ . '/lib/jetpack-big-sky-logger.php';
				return new Jetpack_Big_Sky_Logger();
			}
		}

		public static function is_wpcom() {
			return defined( 'IS_WPCOM' ) && IS_WPCOM;
		}

		/**
		 * The page acting as the site's front page, if one is.
		 *
		 * Both options matter: `page_on_front` outlives a switch back to "your
		 * latest posts", so a bare id is not evidence of a static front page.
		 *
		 * Public so easy mode can route to it without repeating that rule.
		 *
		 * @return int Page id, or 0 when the front page shows posts.
		 */
		public static function get_static_home_page_id() {
			if ( 'page' !== get_option( 'show_on_front' ) ) {
				return 0;
			}

			return (int) get_option( 'page_on_front' );
		}

		public static function load_textdomain() {
			load_plugin_textdomain( 'big-sky', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
		}

		public static function enable_setting_html() {
			?>
			<label for="<?php echo esc_attr( self::ENABLE_OPTION_NAME ); ?>">
				<input name="<?php echo esc_attr( self::ENABLE_OPTION_NAME ); ?>" id="<?php echo esc_attr( self::ENABLE_OPTION_NAME ); ?>" <?php echo checked( self::$enabled, true, false ); ?> type="checkbox" value="1" />
				<?php esc_html_e( 'Enable AI-powered site building experience', 'big-sky' ); ?>
			</label>
			<?php
		}

		public static function register_big_sky_enable() {
			add_settings_field(
				self::ENABLE_OPTION_NAME,
				'<span>' . __( 'AI Features', 'big-sky' ) . '</span>',
				array( 'Big_Sky', 'enable_setting_html' ),
				'writing'
			);
			register_setting(
				'writing',
				self::ENABLE_OPTION_NAME,
				'intval'
			);
		}

		public static function redirect_to_front_page() {
			// Big Sky is disabled no action needed.
			$checks = self::do_checks();
			if ( 'critical' === $checks['status'] || ! self::$enabled ) {
				return;
			}

			if ( ! static::show_site_spec() ) {
				return; // Don't redirect if we are not showing the site spec.
			}

			$current_screen = get_current_screen();
			if ( 'site-editor' === $current_screen->base ) {
				$page_on_front = get_option( 'page_on_front' );

				// Use page_on_front if it's valid, otherwise fall back to root path (/)
				// This handles cases where reading settings are set to "Latest Posts" (page_on_front = 0)
				$p = $page_on_front && $page_on_front !== '0' ? '/page/' . $page_on_front : '/';
				if (
					( ! isset( $_GET['p'] ) || $_GET['p'] !== $p )
				) {
					$base_url   = admin_url( 'site-editor.php' );
					$query_args = array(
						'p'        => urlencode( $p ),
						'canvas'   => isset( $_GET['canvas'] ) ? sanitize_text_field( wp_unslash( $_GET['canvas'] ) ) : 'edit',
						'ai-step'  => isset( $_GET['ai-step'] ) ? sanitize_text_field( wp_unslash( $_GET['ai-step'] ) ) : '',
						'source'   => isset( $_GET['source'] ) ? sanitize_text_field( wp_unslash( $_GET['source'] ) ) : '',
						'referrer' => isset( $_GET['referrer'] ) ? sanitize_text_field( wp_unslash( $_GET['referrer'] ) ) : '',
					);

					if ( isset( $_GET['spec_id'] ) ) {
						$query_args['spec_id'] = sanitize_text_field( wp_unslash( $_GET['spec_id'] ) );
					} elseif ( isset( $_GET['prompt'] ) ) {
						$query_args['prompt'] = urlencode( sanitize_text_field( wp_unslash( $_GET['prompt'] ) ) );
					}

					wp_redirect( add_query_arg( $query_args, $base_url ) );
					exit;
				}
			}
		}

		public static function register_big_sky_metadata_setting() {
			register_post_meta(
				'attachment',
				'big_sky_generated_logo',
				[
					'type'          => 'integer',
					'description'   => 'If this attachment is a logo generated by Big Sky, the ID of the base/uncolorized generated logo or -1 if the attachment is the base/uncolorized generated logo. 0 if this attachment is not a logo generated by Big Sky.',
					'single'        => true,
					'default'       => 0,
					'show_in_rest'  => current_user_can( 'edit_theme_options' ),
					'auth_callback' => fn () => current_user_can( 'edit_theme_options' ),
				]
			);

			$args = array(
				'type'              => 'string',
				'sanitize_callback' => 'sanitize_text_field',
				'description'       => 'Settings for the Big Sky assembler',
				'show_in_rest'      => [
					'schema' => [
						'title' => __( 'Site Design Settings' ),
					],
				],
			);
			register_setting( 'options', 'big_sky_site_metadata', $args );
			register_post_meta(
				'page',
				'big_sky_generated',
				array(
					'show_in_rest' => true,
					'single'       => true,
					'type'         => 'boolean',
					'description'  => 'Whether the page is generated by Big Sky',
				)
			);
			if ( self::is_dev_mode() ) {
				register_setting(
					'options',
					'big_sky_last_site_design_payload',
					[
						'type'              => 'string',
						'sanitize_callback' => 'sanitize_text_field',
						'description'       => 'Last site design payload for debugging.',
						'show_in_rest'      => true,
					]
				);
			}
		}

		public static function register_big_sky_rest_fields() {
			add_filter( 'rest_request_after_callbacks', [ 'Big_Sky', 'add_big_sky_meta_to_global_styles' ], 10, 3 );
		}

		public static function add_big_sky_meta_to_global_styles( $response, $handler, WP_REST_Request $request ) {
			if ( ! $response instanceof WP_REST_Response ) {
				return $response;
			}

			if ( ! class_exists( 'WP_Theme_JSON_Resolver_Gutenberg' ) ) {
				return $response;
			}

			$theme_slug = get_option( 'stylesheet' );

			if ( ! str_contains( $request->get_route(), sprintf( 'global-styles/themes/%s/variations', $theme_slug ) ) ) {
				return $response;
			}

			if ( $response->is_error() ) {
				return $response;
			}

			$data     = $response->get_data();
			$raw_data = [];

			// Try reflection first
			try {
				$raw_files = new ReflectionProperty( 'WP_Theme_JSON_Resolver_Gutenberg', 'theme_json_file_cache' );
				$raw_files->setAccessible( true );
				foreach ( $raw_files->getValue() as $file => $file_data ) {
					$title              = $file_data['title'] ?? basename( $file, '.json' );
					$raw_data[ $title ] = $file_data;
				}
			} catch ( Exception $e ) {
				// If reflection fails, try reading theme files directly
				$theme_dir  = get_stylesheet_directory();
				$styles_dir = $theme_dir . '/styles';
				if ( is_dir( $styles_dir ) ) {
					foreach ( glob( $styles_dir . '/*.json' ) as $file ) {
						$file_data = json_decode( file_get_contents( $file ), true );
						if ( isset( $file_data['title'] ) ) {
							$raw_data[ $file_data['title'] ] = $file_data;
						}
					}
				}
			}

			foreach ( $data as &$variation ) {
				if ( isset( $variation['title'] ) ) {
					$variation['x-big-sky-meta'] = [
						'keywords'    => $raw_data[ $variation['title'] ]['keywords'] ?? [],
						'personality' => $raw_data[ $variation['title'] ]['personality'] ?? [],
					];
				}
			}

			$response->set_data( $data );

			return $response;
		}

		public static function init_site_health() {
			add_filter(
				'site_status_tests',
				function ( $tests ) {
					$tests['direct']['big_sky_checks'] = array(
						'name'  => __( 'Big Sky checks', 'big-sky' ),
						'label' => __( 'Big Sky checks', 'big-sky' ),
						'group' => 'direct',
						'test'  => array( __CLASS__, 'do_checks' ),
					);
					return $tests;
				}
			);
		}

		/**
		 * Do site-health page checks
		 *
		 * @access public
		 * @return array
		 */
		public static function do_checks() {
			$failures    = [];
			$passes      = [];
			$critical    = false;
			$is_e2e_test = ! empty( $_SERVER['SERVER_PORT'] ) && $_SERVER['SERVER_PORT'] === '8889'; // e2e run on 8889 port, less checking for that.
			/**
			 * Default, no issues found
			 */
			$result = array(
				'label'       => __( 'Big Sky Checks', 'big-sky' ),
				'status'      => 'good',
				'badge'       => array(
					'label' => __( 'Big Sky', 'big-sky' ),
					'color' => 'blue',
				),
				'description' => sprintf(
					'<p>%s</p>',
					__( 'Big Sky did not find any known issues with your site.', 'big-sky' )
				),
				'actions'     => '',
				'test'        => 'big_sky_checks',
			);

			if ( ! wp_is_block_theme() ) {
				$critical   = true;
				$failures[] = sprintf(
					'<p>%s</p>',
					__( 'The current theme is not a block theme. Big Sky requires a block theme to be active.', 'big-sky' )
				);
			} else {
				$theme_name = wp_get_theme()->get( 'Name' );
				$passes[]   = sprintf(
					'<p>%s</p>',
					// translators: %s is the theme name.
					sprintf( __( 'The current theme (%s) is a block theme.', 'big-sky' ), esc_html( $theme_name ) )
				);
			}

			// check that Jetpack is installed and active
			if ( ! self::is_wpcom() && ! class_exists( 'Jetpack' ) ) {
				$critical   = true;
				$failures[] = sprintf(
					'<p>%s</p>',
					__( 'Jetpack is not installed. Big Sky requires Jetpack to be installed and active.', 'big-sky' )
				);
			} else {
				$passes[] = sprintf(
					'<p>%s</p>',
					__( 'Jetpack is installed.', 'big-sky' )
				);
			}

			$check_jetpack_connection = apply_filters( 'big_sky_check_jetpack_connection', true );

			// check that Jetpack is connected
			if ( $check_jetpack_connection && ! self::is_wpcom() && class_exists( 'Jetpack' ) && ! Jetpack::connection()->is_connected() ) {
				$critical   = $is_e2e_test ? false : true; // not critical for e2e tests
				$failures[] = sprintf(
					'<p>%s</p>',
					__( 'Jetpack is not connected. Big Sky requires Jetpack to be connected.', 'big-sky' )
				);
			} else {
				$passes[] = sprintf(
					'<p>%s</p>',
					__( 'Jetpack is connected.', 'big-sky' )
				);
			}

			// do the same for Jetpack::connection()->has_connected_admin()
			if ( $check_jetpack_connection && ! self::is_wpcom() && class_exists( 'Jetpack' ) && ! Jetpack::connection()->has_connected_admin() ) {
				$critical   = $is_e2e_test ? false : true; // not critical for e2e tests
				$failures[] = sprintf(
					'<p>%s</p>',
					__( 'Jetpack does not have a connected admin. Big Sky requires Jetpack to be connected to an admin.', 'big-sky' )
				);
			} else {
				$passes[] = sprintf(
					'<p>%s</p>',
					__( 'Jetpack is connected to an admin.', 'big-sky' )
				);
			}

			// check that Jetpack_Options::get_option('mapbox_api_key') is set
			if ( ! self::is_wpcom() && class_exists( 'Jetpack_Mapbox_Helper' ) && ! Jetpack_Mapbox_Helper::get_access_token() ) {
				$failures[] = sprintf(
					'<p>%s</p>',
					__( 'Mapbox API key is not set. Big Sky requires a Mapbox API key to be set.', 'big-sky' )
				);
			} else {
				$passes[] = sprintf(
					'<p>%s</p>',
					__( 'Mapbox API key is set.', 'big-sky' )
				);
			}

			/**
			 * If issues found.
			 */
			if ( count( $failures ) > 0 ) {
				$result['status'] = $critical ? 'critical' : 'red';
				/* translators: $d is the number of performance issues found. */
				$result['label']       = sprintf( _n( 'Big Sky is affected by %d issue', 'Big Sky is affected by %d issues', count( $failures ), 'big-sky' ), count( $failures ) );
				$result['description'] = __( 'Big Sky detected the following issues with your site:', 'big-sky' );

				foreach ( $failures as $issue ) {
					$result['description'] .= '<p>';
					$result['description'] .= "<span class='dashicons dashicons-warning' style='color: crimson;'></span> &nbsp;";
					$result['description'] .= wp_kses( $issue, array( 'a' => array( 'href' => array() ) ) ); // Only allow a href HTML tags.
					$result['description'] .= '</p>';
				}
			}

			/**
			 * Add passes
			 */
			if ( count( $passes ) > 0 ) {
				$result['description'] .= __( 'These checks passed:', 'big-sky' );

				foreach ( $passes as $pass ) {
					$result['description'] .= '<p>';
					$result['description'] .= "<span class='dashicons dashicons-yes' style='color: green;'></span> &nbsp;";
					$result['description'] .= wp_kses( $pass, array( 'a' => array( 'href' => array() ) ) ); // Only allow a href HTML tags.
					$result['description'] .= '</p>';
				}
			}

			return $result;
		}

		public static function enqueue_assets() {
			if ( ! self::$enabled ) {
				return;
			}

			$current_screen = get_current_screen();
			if ( ! ( $current_screen instanceof \WP_Screen ) ) {
				return;
			}

			// Site editor or post/page editor.
			$is_supported_screen = 'site-editor' === $current_screen->base ||
				( 'post' === $current_screen->base && in_array( $current_screen->post_type, array( 'page', 'post' ), true ) );

			if ( ! $is_supported_screen ) {
				return;
			}

			$checks = self::do_checks();
			if ( 'critical' === $checks['status'] ) {
				return;
			}

			wp_enqueue_script(
				'big-sky-assembler',
				plugins_url( 'build/index.js', __FILE__ ),
				[ 'wp-edit-site', 'wp-abilities' ],
				filemtime( plugin_dir_path( __FILE__ ) . 'build/index.js' )
			);

			wp_set_script_translations(
				'big-sky-assembler',
				'big-sky',
				plugin_dir_path( __FILE__ ) . 'languages'
			);

			wp_enqueue_style(
				'big-sky-assembler',
				plugins_url( 'build/style-index.css', __FILE__ ),
				[ 'wp-edit-site' ],
				filemtime( plugin_dir_path( __FILE__ ) . 'build/style-index.css' )
			);

			// Stylesheets extracted from the main bundle.
			wp_enqueue_style(
				'big-sky-agentui',
				plugins_url( 'build/index.css', __FILE__ ),
				[ 'big-sky-assembler' ],
				filemtime( plugin_dir_path( __FILE__ ) . 'build/index.css' )
			);

			// Expose the versioned site-spec asset URLs. This is lazy-loaded by
			// the SiteSpecLanding component only when site-spec mode is entered
			wp_add_inline_script(
				'big-sky-assembler',
				'window.bigSkySiteSpecAssets = ' . wp_json_encode(
					array(
						'script' => self::SITE_SPEC_BASE_URL . 'index.js',
						'style'  => self::SITE_SPEC_BASE_URL . 'style.css',
					)
				) . ';',
				'before'
			);

			$user_locale = get_user_locale();
			if ( isset( static::SUPPORTED_LOCALES[ $user_locale ] ) ) {
				$user_language = static::SUPPORTED_LOCALES[ $user_locale ];
			} else {
				$user_locale   = 'en_US';
				$user_language = 'English (United States)';
			}

			wp_localize_script(
				'big-sky-assembler',
				'bigSkyInitialState',
				[
					'isDevMode'     => self::is_dev_mode(),
					'isLocalGraph'  => false, // Change this to use local graph
					'launchStatus'  => get_option( 'launch-status' ),
					'userLocale'    => $user_locale,
					'userLanguage'  => $user_language,
					'isComingSoon'  => self::is_coming_soon(),
					'isBlogPrivate' => self::is_blog_private(),
					'siteMetadata'  => json_decode( get_option( 'big_sky_site_metadata' ), true ),
					'siteIntent'    => get_option( 'site_intent', '' ),
					'siteGoals'     => get_option( 'site_goals', [] ),
					'currentScreen' => [
						'screen'   => $current_screen->base,
						'postType' => $current_screen->post_type,
					],
					'bigSkyVersion' => get_plugin_data( __FILE__ )['Version'] ?? '0',
					'woocommerce'   => self::is_woocommerce_active(),
				]
			);
		}

		/**
		 * Check if current context is Site Editor
		 *
		 * @return bool True if in Site Editor context
		 */
		private static function is_site_editor_context() {
			global $pagenow;
			return 'site-editor.php' === $pagenow;
		}

		/**
		 * Check if current context is Block Editor (post.php or post-new.php)
		 *
		 * @return bool True if in Block Editor context
		 */
		private static function is_block_editor_context() {
			global $pagenow;
			return in_array( $pagenow, array( 'post.php', 'post-new.php' ), true );
		}

		/**
		 * Check if current context is Post Editor (Block Editor with post type 'post')
		 * This excludes Page Editor (BigSky) which has post type 'page'
		 *
		 * @return bool True if in Post Editor context
		 */
		private static function is_post_editor_context() {
			if ( ! self::is_block_editor_context() ) {
				return false;
			}

			$current_screen = get_current_screen();
			if ( ! ( $current_screen instanceof \WP_Screen ) ) {
				return false;
			}

			return 'post' === $current_screen->post_type;
		}

		/**
		 * Check if current context is Page Editor.
		 *
		 * @return bool True if in Page Editor context
		 */
		private static function is_page_editor_context() {
			if ( ! self::is_block_editor_context() ) {
				return false;
			}

			$current_screen = get_current_screen();
			if ( $current_screen instanceof \WP_Screen && 'page' === $current_screen->post_type ) {
				return true;
			}

			$post_id = isset( $_GET['post'] ) ? absint( wp_unslash( $_GET['post'] ) ) : 0;
			if ( $post_id ) {
				return 'page' === get_post_type( $post_id );
			}

			return isset( $_GET['post_type'] ) && 'page' === sanitize_text_field( wp_unslash( $_GET['post_type'] ) );
		}

		/**
		 * Select the WP Orchestrator agent for Agents Manager on the Big Sky editor path.
		 *
		 * Its `wpcom-editor` route gives it the editor abilities.
		 *
		 * @param string|null $agent_id Existing agent ID from earlier filters.
		 * @return string|null Agent ID for Agents Manager.
		 */
		public static function maybe_use_orchestrator_for_agents_manager( $agent_id ) {
			if ( $agent_id || ! self::$enabled ) {
				return $agent_id;
			}

			if ( self::is_agents_manager_enabled_in_editor() && self::is_big_sky_agents_manager_editor_context() ) {
				return self::AGENTS_MANAGER_EDITOR_AGENT_ID;
			}

			return $agent_id;
		}

		/**
		 * Check if Agents Manager is enabled in the editor rollout.
		 *
		 * The Agents Manager editor experience is on wherever Big Sky is enabled.
		 *
		 * @return bool True if Agents Manager is enabled in the editor rollout.
		 */
		public static function is_agents_manager_enabled_in_editor() {
			return (bool) self::$enabled;
		}

		/**
		 * Tell the Agents Manager frontend that Big Sky is enabled, so it sends
		 * Big Sky's page context and shows its own editor suggestions.
		 *
		 * @param array $data Data encoded into `agentsManagerData`.
		 * @return array The data, flagged where Big Sky is enabled.
		 */
		public static function flag_big_sky_for_agents_manager( $data ) {
			if ( is_array( $data ) && self::$enabled ) {
				$data['bigSkyEnabled'] = true;
			}

			return $data;
		}

		/**
		 * Check whether the current editor should use Agents Manager with Big Sky's orchestrator agent.
		 *
		 * @return bool True when the Big Sky Agents Manager editor rollout is active.
		 */
		private static function is_big_sky_agents_manager_editor_context() {
			return self::$enabled &&
				( self::is_site_editor_context() || self::is_page_editor_context() );
		}

		/**
		 * Whether the site is currently unlaunched or not.
		 * On WordPress.com and WoA, sites can be marked as "coming soon", aka unlaunched.
		 *
		 * See Jetpack_Status::is_coming_soon()
		 * https://github.com/Automattic/jetpack/blob/trunk/projects/packages/status/src/class-status.php
		 */
		public static function is_coming_soon() {
			return ( new \Automattic\Jetpack\Status() )->is_coming_soon();
		}

		/**
		 * See Jetpack_Status::is_private_site()
		 * https://github.com/Automattic/jetpack/blob/trunk/projects/packages/status/src/class-status.php
		 */
		public static function is_blog_private() {
			return ( new \Automattic\Jetpack\Status() )->is_private_site();
		}

		/**
		 * Displays admin notices.
		 */
		public static function maybe_disable_idc_validation() {
			if ( ! self::is_dev_mode() ) {
				return;
			}

			add_filter( 'jetpack_sync_error_idc_validation', '__return_false' );
		}

		/**
		 * Displays admin notices.
		 */
		public static function admin_notices() {
			if ( ! self::is_dev_mode() ) {
				return;
			}

			$checks = self::do_checks();

			if ( 'good' === $checks['status'] ) {
				return;
			}

			wp_admin_notice(
				$checks['description'],
				array(
					'type'        => 'error',
					'dismissible' => true,
				)
			);
		}

		/**
				 * If the original image was marked as an AI generated image, mark the new one as one as well.
				 */
		public static function set_big_sky_generated_logo_for_edited_images( $new_image_meta, $new_attachment_id, $attachment_id ) {
			$original = get_post_meta( $attachment_id, 'big_sky_generated_logo', true );
			if ( $original ) {
				add_post_meta( $new_attachment_id, 'big_sky_generated_logo', -1, true );
			}
			return $new_image_meta;
		}

		/**
		 * Handle post deletion by removing associated patterns from site metadata
		 *
		 * @param int $post_id The ID of the post being deleted
		 */
		public static function handle_post_deletion( $post_id ) {
			try {
				// Only process pages
				if ( 'page' !== get_post_type( $post_id ) ) {
					return;
				}

				// Get current site metadata
				$site_metadata = json_decode( get_option( 'big_sky_site_metadata' ), true );

				// If no patterns exist or patterns is not an object, return early
				if ( empty( $site_metadata['patterns'] ) || ! is_array( $site_metadata['patterns'] ) ) {
					return;
				}

				if ( ! isset( $site_metadata['patterns'][ $post_id ] ) ) {
					return;
				}

				// Remove patterns for the deleted post
				unset( $site_metadata['patterns'][ $post_id ] );

				// Update the site metadata
				update_option( 'big_sky_site_metadata', json_encode( $site_metadata ) );
			} catch ( Exception $e ) {
				// no big deal
				return;
			}
		}

		/**
		 * Check if the current theme is Assembler.
		 */
		protected static function is_assembler_theme() {
			return 'Assembler' === wp_get_theme()->get( 'Name' );
		}

		/**
		 * Check if WooCommerce plugin is installed and active
		 */
		protected static function is_woocommerce_active() {
			return (
				(
					class_exists( 'WooCommerce' ) && function_exists( 'WC' ) // This should work regardless of the way we load Woo.
				) ||
				(
					class_exists( 'WC_Dependencies' ) && WC_Dependencies::woocommerce_active_check() // Original check from woocommerce-subscriptions
				)
			);
		}

		/**
		 * Register Big Sky as an agent provider for Agents Manager, which loads
		 * the module for the site build's setup and chat rendering.
		 *
		 * @param array $providers Existing agent provider URLs.
		 * @return array Modified array of agent provider URLs.
		 */
		public static function register_agent_manager_provider( $providers ) {
			if ( ! is_array( $providers ) ) {
				$providers = array();
			}

			// Only register if Big Sky is enabled
			if ( ! self::$enabled ) {
				return $providers;
			}

			$build_path = plugin_dir_path( __FILE__ ) . 'build/calypso-agent-provider/';
			$build_url  = plugins_url( 'build/calypso-agent-provider/', __FILE__ );
			$asset_file = $build_path . 'index.asset.php';

			// Check if the provider build exists
			if ( ! file_exists( $build_path . 'index.js' ) ) {
				return $providers;
			}

			$asset   = file_exists( $asset_file ) ? require $asset_file : array( 'version' => '1.0.0' );
			$version = $asset['version'] ?? '1.0.0';

			// Enqueue dependencies that the provider module needs
			// These must be loaded before the dynamic import happens
			$dependencies = $asset['dependencies'] ?? array();
			foreach ( $dependencies as $dep ) {
				if ( wp_script_is( $dep, 'registered' ) ) {
					wp_enqueue_script( $dep );
				}
			}

			// Styles of the components it imports: the site build's progress and block feedback.
			if ( file_exists( $build_path . 'style-main.css' ) ) {
				wp_enqueue_style(
					'big-sky-calypso-agent-provider-components',
					$build_url . 'style-main.css',
					array(),
					$version
				);
			}

			// Return the full URL to the provider module for dynamic import
			// Include version for cache busting
			$providers[] = $build_url . 'index.js?ver=' . $version;

			return $providers;
		}

		/**
		 * Show site spec
		 * This is used to determine whether to show the site spec in the site editor.
		 * If the site is not onboarded and the theme is Assembler, we show the site spec.
		 * If the site is onboarded or the theme is not Assembler, we do not show the site spec.
		 *
		 * @return bool True if the site spec should be shown, false otherwise.
		 */
		protected static function show_site_spec() {
			$ai_step = isset( $_GET['ai-step'] ) ? sanitize_text_field( wp_unslash( $_GET['ai-step'] ) ) : false;
			if ( 'spec' === $ai_step ) {
				return true;
			}
			return false;
		}

		/**
		 * Keep WooCommerce's setup wizard redirect off the site spec hand-off.
		 *
		 * For 30 seconds after a fresh install, WooCommerce sends the first wp-admin
		 * page load to its own Home screen. A Commerce purchase installs WooCommerce
		 * while the site moves to Atomic, so the post-checkout hand-off to the site
		 * spec is that first load, and the customer lands in WooCommerce instead.
		 *
		 * @param bool $prevent Whether the redirect is already prevented.
		 * @return bool True on the site spec hand-off, the incoming value otherwise.
		 */
		public static function maybe_prevent_woocommerce_wizard_redirect( $prevent ) {
			global $pagenow;

			if ( 'site-editor.php' === $pagenow && static::show_site_spec() ) {
				return true;
			}

			return $prevent;
		}

		/**
		 * Add AI Editor menu item to WordPress admin
		 *
		 * Sits under Appearance, directly above core's Editor link, and opens the
		 * site editor in easy mode. The Easy Site Editor this used to point at
		 * (`admin.php?page=easy-site-editor`) is deprecated in favour of easy mode.
		 *
		 * @return void
		 */
		public static function add_ai_editor_menu() {
			// Only show if Big Sky is enabled and checks pass
			$checks = self::do_checks();
			if ( 'critical' === $checks['status'] || ! self::$enabled ) {
				return;
			}

			add_submenu_page(
				'themes.php',
				__( 'AI Editor', 'big-sky' ),
				__( 'AI Editor', 'big-sky' ),
				'edit_theme_options',
				// esc_url() because a URL-shaped submenu slug is echoed into the
				// href unescaped by menu-header.php, as core's Customize link is.
				esc_url( self::get_ai_editor_url() ),
				'',
				self::get_appearance_position_before_editor()
			);
		}

		/**
		 * The site editor URL the AI Editor menu opens.
		 *
		 * `easy-mode=true` selects the AI Editor for this document; the
		 * edit canvas is where easy mode appears at all (it stands down on the
		 * design view). With a static front page the URL names it, so the user
		 * lands on something they can edit. Without one there is no page to name,
		 * and the site editor's default `/` route opens the home template — the
		 * post list — which is the right thing to edit on such a site.
		 *
		 * @return string
		 */
		private static function get_ai_editor_url() {
			$query_args = array( 'canvas' => 'edit' );

			$front_page_id = self::get_static_home_page_id();
			if ( $front_page_id > 0 ) {
				$query_args['p'] = '/page/' . $front_page_id;
			}

			$query_args['easy-mode'] = 'true';
			$query_args['ai-open']   = 'true';

			// http_build_query() rather than add_query_arg(): the latter does not
			// URL-encode, which would emit `p=/page/12` instead of the
			// `p=%2Fpage%2F12` form the site editor's routing contract documents.
			return admin_url( 'site-editor.php' ) . '?' . http_build_query( $query_args, '', '&', PHP_QUERY_RFC3986 );
		}

		/**
		 * Redirect the deprecated standalone Easy Site Editor route to easy mode.
		 *
		 * This remains in the top-level plugin so old bookmarks and external links
		 * keep working after the standalone editor's removal.
		 *
		 * @return void
		 */
		public static function maybe_redirect_legacy_easy_site_editor() {
			global $pagenow;

			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- This only identifies an admin navigation request.
			$page = isset( $_GET['page'] ) && is_string( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';

			if ( 'admin.php' !== $pagenow || 'easy-site-editor' !== $page ) {
				return;
			}

			if ( wp_safe_redirect( self::get_ai_editor_url() ) ) {
				exit;
			}
		}

		/**
		 * Where in the Appearance submenu the AI Editor goes.
		 *
		 * Directly above core's Editor link — the AI editor is the one we want
		 * reached first, and core's is the way past it. The position
		 * add_submenu_page() takes is an offset into the submenu array, not one of
		 * the numeric keys `wp-admin/menu.php` registers with — anything
		 * `>= count()` is silently appended to the bottom — so the offset is
		 * looked up rather than guessed. Items at and after it shift down, which
		 * is what puts this one above Editor. Core registers Editor as
		 * `site-editor.php`, or `site-editor.php?p=/pattern` on a classic theme,
		 * hence the prefix match.
		 *
		 * @return int|null Offset to insert at, or null to append.
		 */
		private static function get_appearance_position_before_editor() {
			global $submenu;

			if ( empty( $submenu['themes.php'] ) ) {
				return null;
			}

			foreach ( array_values( $submenu['themes.php'] ) as $index => $item ) {
				if ( isset( $item[2] ) && 0 === strpos( $item[2], 'site-editor.php' ) ) {
					return $index;
				}
			}

			return null;
		}

		/**
		 * Plugin activation handler
		 * Enables Big Sky when the plugin is activated
		 *
		 * @return void
		 */
		public static function activate() {
			update_option( self::ENABLE_OPTION_NAME, '1' );
		}

		/**
		 * Plugin deactivation handler
		 * Disables Big Sky when the plugin is deactivated
		 *
		 * @return void
		 */
		public static function deactivate() {
			update_option( self::ENABLE_OPTION_NAME, '0' );
		}

		/**
		 * Plugin uninstall handler
		 * Cleans up all Big Sky data when the plugin is deleted
		 *
		 * @return void
		 */
		public static function uninstall() {
			// Delete Big Sky options
			delete_option( self::ENABLE_OPTION_NAME );
		}
	}
} // close class_exists check

Big_Sky::init();

// Register plugin lifecycle hooks
register_activation_hook( __FILE__, array( 'Big_Sky', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Big_Sky', 'deactivate' ) );
register_uninstall_hook( __FILE__, array( 'Big_Sky', 'uninstall' ) );
