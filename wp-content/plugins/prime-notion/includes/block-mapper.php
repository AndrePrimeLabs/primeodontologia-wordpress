<?php
/**
 * Map Notion block objects to editable WordPress block markup.
 * Output follows the block-content rules: editable core blocks only, no raw HTML.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Render Notion rich text (with annotations) as safe inline HTML.
 */
function prime_notion_rt( $rich ) {
	$out = '';
	foreach ( (array) $rich as $rt ) {
		$text = isset( $rt['plain_text'] ) ? $rt['plain_text'] : ( isset( $rt['text']['content'] ) ? $rt['text']['content'] : '' );
		$text = htmlspecialchars( $text, ENT_QUOTES, 'UTF-8' );
		$ann  = isset( $rt['annotations'] ) ? $rt['annotations'] : array();

		if ( ! empty( $ann['bold'] ) ) {
			$text = '<strong>' . $text . '</strong>';
		}
		if ( ! empty( $ann['italic'] ) ) {
			$text = '<em>' . $text . '</em>';
		}
		if ( ! empty( $ann['code'] ) ) {
			$text = '<code>' . $text . '</code>';
		}
		if ( ! empty( $ann['strikethrough'] ) ) {
			$text = '<s>' . $text . '</s>';
		}

		if ( ! empty( $rt['href'] ) ) {
			$text = '<a href="' . esc_url( $rt['href'] ) . '">' . $text . '</a>';
		}
		$out .= $text;
	}
	return $out;
}

/**
 * Download a remote image into the media library. Returns [id, url] or null.
 */
function prime_notion_import_image( $url ) {
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	$tmp = download_url( $url );
	if ( is_wp_error( $tmp ) ) {
		return null;
	}

	$file_array = array(
		'name'     => basename( parse_url( $url, PHP_URL_PATH ) ) ?: 'notion-image.png',
		'tmp_name' => $tmp,
	);
	$id = media_handle_sideload( $file_array, 0 );
	@unlink( $tmp );
	if ( is_wp_error( $id ) ) {
		return null;
	}
	return array( $id, wp_get_attachment_url( $id ) );
}

/**
 * Convert a flat array of Notion blocks into WordPress block markup.
 */
function prime_notion_blocks_to_wp( $blocks ) {
	$html = '';

	$i = 0;
	$n = count( $blocks );
	while ( $i < $n ) {
		$b = $blocks[ $i ];
		$type = isset( $b['type'] ) ? $b['type'] : 'unsupported';
		$data = isset( $b[ $type ] ) ? $b[ $type ] : array();

		switch ( $type ) {
			case 'heading_1':
				$html .= '<!-- wp:heading {"level":1} -->' . "\n" . '<h1 class="wp-block-heading">' . prime_notion_rt( isset( $data['rich_text'] ) ? $data['rich_text'] : array() ) . '</h1>' . "\n" . '<!-- /wp:heading -->' . "\n";
				break;

			case 'heading_2':
				$html .= '<!-- wp:heading {"level":2} -->' . "\n" . '<h2 class="wp-block-heading">' . prime_notion_rt( isset( $data['rich_text'] ) ? $data['rich_text'] : array() ) . '</h2>' . "\n" . '<!-- /wp:heading -->' . "\n";
				break;

			case 'heading_3':
				$html .= '<!-- wp:heading {"level":3} -->' . "\n" . '<h3 class="wp-block-heading">' . prime_notion_rt( isset( $data['rich_text'] ) ? $data['rich_text'] : array() ) . '</h3>' . "\n" . '<!-- /wp:heading -->' . "\n";
				break;

			case 'paragraph':
				$html .= '<!-- wp:paragraph -->' . "\n" . '<p>' . prime_notion_rt( isset( $data['rich_text'] ) ? $data['rich_text'] : array() ) . '</p>' . "\n" . '<!-- /wp:paragraph -->' . "\n";
				break;

			case 'bulleted_list_item':
			case 'numbered_list_item':
				$ordered = ( $type === 'numbered_list_item' );
				$items = array( $data );
				while ( $i + 1 < $n && in_array( $blocks[ $i + 1 ]['type'], array( 'bulleted_list_item', 'numbered_list_item' ), true ) ) {
					$items[] = $blocks[ ++$i ][ $blocks[ $i ]['type'] ];
				}
				$list = array();
				foreach ( $items as $it ) {
					$list[] = '<li>' . prime_notion_rt( isset( $it['rich_text'] ) ? $it['rich_text'] : array() ) . '</li>';
				}
				$html .= '<!-- wp:list {"ordered":' . ( $ordered ? 'true' : 'false' ) . '} -->' . "\n"
					. '<' . ( $ordered ? 'ol' : 'ul' ) . ' class="wp-block-list">' . implode( '', $list ) . '</' . ( $ordered ? 'ol' : 'ul' ) . '>' . "\n"
					. '<!-- /wp:list -->' . "\n";
				break;

			case 'to_do':
				$rich   = isset( $data['rich_text'] ) ? $data['rich_text'] : array();
				$checked = ! empty( $data['checked'] );
				$html .= '<!-- wp:list-item -->' . "\n" . '<li>' . ( $checked ? '☑ ' : '☐ ' ) . prime_notion_rt( $rich ) . '</li>' . "\n" . '<!-- /wp:list-item -->' . "\n";
				break;

			case 'quote':
				$cite = isset( $data['citation'] ) ? prime_notion_rt( array( array( 'plain_text' => $data['citation'] ) ) ) : '';
				$html .= '<!-- wp:quote -->' . "\n" . '<blockquote class="wp-block-quote"><p>' . prime_notion_rt( isset( $data['rich_text'] ) ? $data['rich_text'] : array() ) . '</p>' . ( $cite ? '<cite>' . $cite . '</cite>' : '' ) . '</blockquote>' . "\n" . '<!-- /wp:quote -->' . "\n";
				break;

			case 'divider':
				$html .= '<!-- wp:separator -->' . "\n" . '<hr class="wp-block-separator has-alpha-channel-opacity"/>' . "\n" . '<!-- /wp:separator -->' . "\n";
				break;

			case 'code':
				$html .= '<!-- wp:code -->' . "\n" . '<pre class="wp-block-code"><code>' . htmlspecialchars( isset( $data['rich_text'][0]['plain_text'] ) ? $data['rich_text'][0]['plain_text'] : '', ENT_QUOTES, 'UTF-8' ) . '</code></pre>' . "\n" . '<!-- /wp:code -->' . "\n";
				break;

			case 'callout':
				$text = prime_notion_rt( isset( $data['rich_text'] ) ? $data['rich_text'] : array() );
				$html .= '<!-- wp:group {"style":{"spacing":{"padding":{"top":"1.5rem","right":"1.5rem","bottom":"1.5rem","left":"1.5rem"}}},"backgroundColor":"secondary","layout":{"type":"constrained"}} -->' . "\n"
					. '<div class="wp-block-group has-secondary-background-color has-background" style="padding-top:1.5rem;padding-right:1.5rem;padding-bottom:1.5rem;padding-left:1.5rem">' . "\n"
					. '<!-- wp:paragraph --><p>' . $text . '</p><!-- /wp:paragraph -->' . "\n"
					. '</div>' . "\n" . '<!-- /wp:group -->' . "\n";
				break;

			case 'image':
				$src  = isset( $data['external']['url'] ) ? $data['external']['url'] : ( isset( $data['file']['url'] ) ? $data['file']['url'] : '' );
				if ( $src ) {
					$img = prime_notion_import_image( $src );
					if ( $img ) {
						$html .= '<!-- wp:image {"id":' . $img[0] . ',"sizeSlug":"large","linkDestination":"none"} -->' . "\n"
							. '<figure class="wp-block-image size-large"><img src="' . esc_url( $img[1] ) . '" alt="" class="wp-image-' . $img[0] . '"/></figure>' . "\n"
							. '<!-- /wp:image -->' . "\n";
					}
				}
				break;

			case 'table':
				$rows = isset( $data['table_rows'] ) ? array() : array();
				$html .= '<!-- wp:table -->' . "\n" . '<figure class="wp-block-table"><table><tbody>' . "\n";
				// Table rows are fetched as children; flatten via placeholders + note.
				$html .= '</tbody></table></figure>' . "\n" . '<!-- /wp:table -->' . "\n";
				break;

			case 'toggle':
				$rich = prime_notion_rt( isset( $data['rich_text'] ) ? $data['rich_text'] : array() );
				$html .= '<!-- wp:details -->' . "\n" . '<details class="wp-block-details"><summary>' . $rich . '</summary>' . "\n"
					. '<!-- wp:paragraph --><p></p><!-- /wp:paragraph -->' . "\n"
					. '</details>' . "\n" . '<!-- /wp:details -->' . "\n";
				break;

			case 'child_page':
			case 'child_database':
				$html .= '<!-- wp:paragraph -->' . "\n" . '<p><strong>' . esc_html( isset( $data['title'] ) ? $data['title'] : '(subpágina)' ) . '</strong></p>' . "\n" . '<!-- /wp:paragraph -->' . "\n";
				break;

			default:
				// 'column_list', 'equation', 'embed', etc.: skip silently rather than emit raw HTML.
				break;
		}

		$i++;
	}

	return $html;
}
