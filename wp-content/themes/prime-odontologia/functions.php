<?php
/**
 * Prime Odontologia functions and definitions
 *
 * @package Prime_Odontologia
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Disable the front-end emoji script and styles. The site does not rely on
 * the emoji JS/CSS, and removing it saves ~15 KB of JavaScript per page load.
 */
remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
remove_action( 'wp_print_styles', 'print_emoji_styles' );

/**
 * Enqueue theme styles, scripts, and fonts.
 */
function prime_odontologia_scripts() {
	// Enqueue Google Fonts Public Sans
	wp_enqueue_style(
		'prime-odontologia-fonts',
		'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap',
		array(),
		null
	);

	// Enqueue custom CSS for tilted reels, button hovers, and components
	wp_enqueue_style(
		'prime-odontologia-custom',
		get_template_directory_uri() . '/assets/css/custom.css',
		array(),
		'1.0.0'
	);
}
add_action( 'wp_enqueue_scripts', 'prime_odontologia_scripts' );

/**
 * Register block pattern categories.
 */
function prime_odontologia_register_pattern_categories() {
	register_block_pattern_category(
		'prime-odontologia',
		array(
			'label'       => __( 'Prime Odontologia', 'prime-odontologia' ),
			'description' => __( 'Padrões de blocos oficiais para a clínica Prime Odontologia.', 'prime-odontologia' ),
		)
	);
}
add_action( 'init', 'prime_odontologia_register_pattern_categories' );

/**
 * Add Google Tag (gtag.js) for Google Ads (AW-5199335510) and conversion tracking.
 */
function prime_odontologia_google_tag() {
	?>
	<!-- Google tag (gtag.js) - Google Ads: 519-933-5510 -->
	<script async src="https://www.googletagmanager.com/gtag/js?id=AW-5199335510"></script>
	<script>
	  window.dataLayer = window.dataLayer || [];
	  function gtag(){dataLayer.push(arguments);}
	  gtag('js', new Date());

	  gtag('config', 'AW-5199335510');

	  // Track WhatsApp consultation booking clicks as conversions
	  document.addEventListener('DOMContentLoaded', function() {
	    document.querySelectorAll('a[href*="wa.me"]').forEach(function(link) {
	      link.addEventListener('click', function() {
	        if (typeof gtag === 'function') {
	          gtag('event', 'conversion', {
	            'send_to': 'AW-5199335510',
	            'event_category': 'Contact',
	            'event_label': 'WhatsApp Appointment Click'
	          });
	        }
	      });
	    });
	  });
	</script>
	<?php
}
add_action( 'wp_head', 'prime_odontologia_google_tag', 1 );

/**
 * Preload the LCP hero image and preconnect to font origins to improve
 * Largest Contentful Paint on the front page.
 */
function prime_odontologia_resource_hints() {
	// Preconnect to Google Fonts origins to cut render-blocking handshake time.
	echo '<link rel="preconnect" href="https://fonts.googleapis.com">' . "\n";
	echo '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' . "\n";

	// Preload the hero (LCP) cover image on the front page so it starts early.
	if ( is_front_page() ) {
		echo '<link rel="preload" as="image" href="' . esc_url( get_template_directory_uri() . '/assets/images/hero.jpg' ) . '" fetchpriority="high">' . "\n";
	}
}
add_action( 'wp_head', 'prime_odontologia_resource_hints', 0 );

