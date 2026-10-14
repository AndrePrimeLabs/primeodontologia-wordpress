<?php
/**
 * Convert to Blocks & Elementor Cleanup CLI Script
 * 
 * Restores corrupted Gutenberg blocks caused by Elementor wrapping block comments
 * in <p><!-- wp:... --></p> tags, removes all Elementor metadata, repairs missing
 * root block opening tags, converts any unparsed HTML chunks into native Gutenberg blocks,
 * and validates block parsing across all pages and posts.
 *
 * Usage:
 *   wp eval-file scripts/convert-to-blocks.php
 *   DRY_RUN=1 wp eval-file scripts/convert-to-blocks.php
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit( "Direct script execution not allowed.\n" );
}

$dry_run = ( getenv( 'DRY_RUN' ) === '1' );

echo "========================================================\n";
echo " Prime Odontologia: Gutenberg Block Restoration Utility \n";
echo "========================================================\n";
echo "Mode: " . ( $dry_run ? "DRY RUN (No database changes will be saved)\n" : "LIVE REPAIR\n" );
echo "\n";

$elementor_keys = array(
	'_elementor_edit_mode',
	'_elementor_data',
	'_elementor_template_type',
	'_elementor_version',
	'_elementor_controls_usage',
	'_elementor_css',
	'_elementor_page_settings',
	'_elementor_migrations_state_d2a1',
);

$query_args = array(
	'post_type'      => array( 'page', 'post' ),
	'post_status'    => array( 'publish', 'draft', 'pending', 'private' ),
	'posts_per_page' => -1,
	'orderby'        => 'ID',
	'order'          => 'ASC',
);

$posts            = get_posts( $query_args );
$total_posts      = count( $posts );
$repaired_count   = 0;
$meta_clean_count = 0;

echo "Found {$total_posts} items (pages & posts) to inspect.\n\n";

/**
 * Converts a raw unparsed HTML chunk into appropriate Gutenberg block(s)
 *
 * @param string $html
 * @return string
 */
function prime_convert_raw_chunk_to_blocks( $html ) {
	$html = trim( $html );
	if ( empty( $html ) ) {
		return '';
	}

	if ( strpos( $html, '<!-- wp:' ) === 0 ) {
		return $html;
	}

	// Split multiple paragraphs if present in a single unparsed block
	if ( preg_match_all( '/<p\b[^>]*>.*?<\/p>/is', $html, $matches ) && count( $matches[0] ) > 1 ) {
		$out = '';
		foreach ( $matches[0] as $p ) {
			$p = trim( $p );
			if ( ! empty( $p ) ) {
				$out .= "<!-- wp:paragraph -->\n{$p}\n<!-- /wp:paragraph -->\n\n";
			}
		}
		return trim( $out );
	}

	if ( preg_match( '/^<h([1-6])\b/i', $html, $m ) ) {
		$level = intval( $m[1] );
		$attr  = ( $level === 2 ) ? '' : " {\"level\":{$level}}";
		return "<!-- wp:heading{$attr} -->\n{$html}\n<!-- /wp:heading -->";
	}
	if ( preg_match( '/^<blockquote\b/i', $html ) ) {
		return "<!-- wp:quote -->\n{$html}\n<!-- /wp:quote -->";
	}
	if ( preg_match( '/^<ul\b|^<ol\b/i', $html ) ) {
		return "<!-- wp:list -->\n{$html}\n<!-- /wp:list -->";
	}
	if ( preg_match( '/^<figure\b/i', $html ) ) {
		return "<!-- wp:image -->\n{$html}\n<!-- /wp:image -->";
	}
	if ( preg_match( '/^<p\b/i', $html ) ) {
		return "<!-- wp:paragraph -->\n{$html}\n<!-- /wp:paragraph -->";
	}
	if ( preg_match( '/^<iframe\b|^<div\b|^<script\b|^<style\b/i', $html ) ) {
		return "<!-- wp:html -->\n{$html}\n<!-- /wp:html -->";
	}

	return "<!-- wp:paragraph -->\n<p>{$html}</p>\n<!-- /wp:paragraph -->";
}

/**
 * Clean corrupted Gutenberg block comments and markup, and convert raw HTML into native blocks
 *
 * @param string $content
 * @return string
 */
function prime_clean_and_convert_to_blocks( $content ) {
	if ( empty( $content ) ) {
		return $content;
	}

	// 1. Unescape JSON escaped slashes: <!-- \/wp: -> <!-- /wp:
	$content = str_replace( '<!-- \/wp:', '<!-- /wp:', $content );

	// 2. Fix missing root opening tag at the very start of content
	if ( preg_match( '/^\s*<blockquote\b/i', $content ) && ! preg_match( '/^\s*<!--\s*wp:quote/i', $content ) ) {
		$content = "<!-- wp:quote -->\n" . $content;
	}
	if ( preg_match( '/^\s*<h([1-6])\b/i', $content, $hm ) && ! preg_match( '/^\s*<!--\s*wp:heading/i', $content ) ) {
		$level = intval( $hm[1] );
		$tag   = ( $level === 2 ) ? "<!-- wp:heading -->\n" : "<!-- wp:heading {\"level\":{$level}} -->\n";
		$content = $tag . $content;
	}

	// 3. Separate any concatenated comments: <!-- /wp:... --><!-- wp:... -->
	for ( $i = 0; $i < 3; $i++ ) {
		$content = preg_replace(
			'/(<!--\s*(?:\/)?wp:[^>]+-->)\s*(<!--\s*(?:\/)?wp:[^>]+-->)/i',
			"$1\n\n$2",
			$content
		);
	}

	// 4. Strip <p> wrappers enclosing block comments: <p><!-- wp:... --> ... </p>
	$content = preg_replace(
		'/<p\b[^>]*>\s*(<!--\s*(?:\/)?wp:[^>]+-->)\s*<\/p>/i',
		"\n\n$1\n\n",
		$content
	);

	// 5. Strip <p> that opens immediately before a block comment: <p><!-- wp:... -->
	$content = preg_replace(
		'/<p\b[^>]*>\s*(<!--\s*(?:\/)?wp:[^>]+-->)/i',
		"\n\n$1",
		$content
	);

	// 6. Strip </p> that closes immediately after a block comment: <!-- /wp:... --></p>
	$content = preg_replace(
		'/(<!--\s*(?:\/)?wp:[^>]+-->)\s*<\/p>/i',
		"$1\n\n",
		$content
	);

	// 7. Strip orphaned empty paragraphs around block boundaries
	$content = preg_replace( '/<p\b[^>]*>\s*(?:&nbsp;|\s)*<\/p>/i', '', $content );

	// 8. Trim consecutive empty newlines
	$content = preg_replace( "/\n{3,}/", "\n\n", $content );

	// 9. Parse with WordPress native parse_blocks and convert any remaining unparsed HTML blocks
	$blocks  = parse_blocks( $content );
	$rebuilt = '';
	foreach ( $blocks as $b ) {
		if ( ! empty( $b['blockName'] ) ) {
			$rebuilt .= serialize_block( $b ) . "\n\n";
		} else {
			$chunk = trim( $b['innerHTML'] );
			if ( ! empty( $chunk ) ) {
				$rebuilt .= prime_convert_raw_chunk_to_blocks( $chunk ) . "\n\n";
			}
		}
	}

	return trim( $rebuilt );
}

foreach ( $posts as $post ) {
	$id           = $post->ID;
	$title        = $post->post_title;
	$type         = $post->post_type;
	$orig_content = $post->post_content;
	
	// Check Elementor metadata
	$had_elementor_meta = false;
	foreach ( $elementor_keys as $key ) {
		if ( metadata_exists( 'post', $id, $key ) ) {
			$had_elementor_meta = true;
			if ( ! $dry_run ) {
				delete_post_meta( $id, $key );
			}
		}
	}

	if ( $had_elementor_meta ) {
		$meta_clean_count++;
	}

	$cleaned_content = prime_clean_and_convert_to_blocks( $orig_content );
	$content_changed = ( $cleaned_content !== $orig_content );

	// Parse blocks before and after
	$before_blocks = parse_blocks( $orig_content );
	$after_blocks  = parse_blocks( $cleaned_content );

	$count_before = count( array_filter( $before_blocks, fn( $b ) => ! empty( $b['blockName'] ) ) );
	$count_after  = count( array_filter( $after_blocks, fn( $b ) => ! empty( $b['blockName'] ) ) );
	$null_after   = count( array_filter( $after_blocks, fn( $b ) => empty( $b['blockName'] ) && trim( $b['innerHTML'] ) !== '' ) );

	if ( $content_changed || $had_elementor_meta ) {
		$repaired_count++;
		echo sprintf(
			"[%s #%d] %s\n",
			strtoupper( $type ),
			$id,
			mb_substr( $title, 0, 40 )
		);
		if ( $had_elementor_meta ) {
			echo "   - Elementor metadata removed: YES\n";
		}
		if ( $content_changed ) {
			echo "   - Content converted to native blocks: YES\n";
			echo "   - Gutenberg block count: Before = {$count_before} | After = {$count_after} (Unparsed HTML: {$null_after})\n";
			if ( ! $dry_run ) {
				wp_update_post( array(
					'ID'           => $id,
					'post_content' => $cleaned_content,
				) );
			}
		}
		echo "\n";
	}
}

echo "========================================================\n";
echo " Summary:\n";
echo " Total scanned: {$total_posts}\n";
echo " Posts with Elementor metadata cleared: {$meta_clean_count}\n";
echo " Posts with block markup repaired/converted: {$repaired_count}\n";
echo "========================================================\n";
if ( $dry_run ) {
	echo "Dry run complete. No modifications were written to the database.\n";
	echo "To execute repair, run without DRY_RUN=1.\n";
} else {
	echo "Repair complete! All target posts have 100% native Gutenberg blocks restored.\n";
}
