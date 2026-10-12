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
	// Enqueue Google Fonts: Raleway (primary) + Open Sans (secondary) per brandbook.
	wp_enqueue_style(
		'prime-odontologia-fonts',
		'https://fonts.googleapis.com/css2?family=Raleway:wght@600;700;800&family=Open+Sans:wght@400;500;600;700&display=swap',
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

/**
 * Shorten the front-page document title for cleaner SERP display (~57 chars).
 *
 * @param string $title The full document title.
 * @return string
 */
function prime_odontologia_shorten_title( $title ) {
	if ( is_front_page() ) {
		return 'Prime Odontologia – Odontologia Digital e Invisalign em BH';
	}
	return $title;
}
add_filter( 'document_title', 'prime_odontologia_shorten_title' );

/**
 * Emit meta description and Open Graph / Twitter Card social tags.
 * A per-page description can be set with the custom field 'meta_description'.
 */
function prime_odontologia_seo_head() {
	$site_name = get_bloginfo( 'name' );
	$title     = wp_get_document_title();

	$description = get_post_meta( get_queried_object_id(), 'meta_description', true );
	if ( empty( $description ) ) {
		$description = 'Tratamento ortodôntico de alta previsibilidade com alinhadores transparentes em Belo Horizonte. Odontologia digital e cuidado humanizado no bairro Lourdes.';
	}

	global $wp;
	$url = is_singular() ? get_permalink() : home_url( add_query_arg( array(), $wp->request ) );
	$url = trailingslashit( $url );

	$image = get_template_directory_uri() . '/assets/images/hero.jpg';

	echo "\n<!-- SEO meta (Prime Odontologia theme) -->\n";
	echo '<meta name="description" content="' . esc_attr( $description ) . '">' . "\n";

	// Open Graph.
	echo '<meta property="og:type" content="website">' . "\n";
	echo '<meta property="og:site_name" content="' . esc_attr( $site_name ) . '">' . "\n";
	echo '<meta property="og:title" content="' . esc_attr( $title ) . '">' . "\n";
	echo '<meta property="og:description" content="' . esc_attr( $description ) . '">' . "\n";
	echo '<meta property="og:url" content="' . esc_url( $url ) . '">' . "\n";
	echo '<meta property="og:image" content="' . esc_url( $image ) . '">' . "\n";

	// Twitter Card.
	echo '<meta name="twitter:card" content="summary_large_image">' . "\n";
	echo '<meta name="twitter:title" content="' . esc_attr( $title ) . '">' . "\n";
	echo '<meta name="twitter:description" content="' . esc_attr( $description ) . '">' . "\n";
	echo '<meta name="twitter:image" content="' . esc_url( $image ) . '">' . "\n";
}
add_action( 'wp_head', 'prime_odontologia_seo_head', 5 );

/**
 * Emit JSON-LD structured data for a single-location dental practice.
 */
function prime_odontologia_json_ld() {
	$site_name = get_bloginfo( 'name' );
	$home      = home_url( '/' );
	$image     = get_template_directory_uri() . '/assets/images/hero.jpg';
	?>
	<script type="application/ld+json">
	{
	  "@context": "https://schema.org",
	  "@graph": [
	    {
	      "@type": "Organization",
	      "@id": "<?php echo esc_url( $home ); ?>#organization",
	      "name": "<?php echo esc_js( $site_name ); ?>",
	      "url": "<?php echo esc_url( $home ); ?>",
	      "logo": "<?php echo esc_url( $image ); ?>",
	      "sameAs": ["https://wa.me/5531992893060"]
	    },
	    {
	      "@type": "WebSite",
	      "@id": "<?php echo esc_url( $home ); ?>#website",
	      "url": "<?php echo esc_url( $home ); ?>",
	      "name": "<?php echo esc_js( $site_name ); ?>",
	      "publisher": { "@id": "<?php echo esc_url( $home ); ?>#organization" }
	    },
	    {
	      "@type": "Dentist",
	      "@id": "<?php echo esc_url( $home ); ?>#dentist",
	      "name": "<?php echo esc_js( $site_name ); ?>",
	      "url": "<?php echo esc_url( $home ); ?>",
	      "telephone": "+55-31-99289-3060",
	      "image": "<?php echo esc_url( $image ); ?>",
	      "priceRange": "$$",
	      "medicalSpecialty": "Dentistry",
	      "address": {
	        "@type": "PostalAddress",
	        "addressLocality": "Belo Horizonte",
	        "addressRegion": "MG",
	        "addressCountry": "BR"
	      },
	      "areaServed": "Belo Horizonte",
	      "parentOrganization": { "@id": "<?php echo esc_url( $home ); ?>#organization" }
	    }
	  ]
	}
	</script>
	<?php
}
add_action( 'wp_head', 'prime_odontologia_json_ld', 6 );

/**
 * Automatically ensure ads.txt contains the verified Google AdSense publisher ID.
 */
function prime_odontologia_ensure_ads_txt() {
	$target_entry = "google.com, pub-3413556435934115, DIRECT, f08c47fec0942fa0\n";
	$paths = array(
		'/srv/htdocs/ads.txt',
		ABSPATH . 'ads.txt',
	);
	foreach ( $paths as $path ) {
		if ( file_exists( $path ) ) {
			$current = @file_get_contents( $path );
			if ( $current !== false && strpos( $current, 'pub-3413556435934115' ) === false ) {
				@file_put_contents( $path, $target_entry );
			}
		}
	}
}
add_action( 'init', 'prime_odontologia_ensure_ads_txt' );


