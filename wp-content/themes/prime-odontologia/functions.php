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
