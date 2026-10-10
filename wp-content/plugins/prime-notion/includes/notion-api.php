<?php
/**
 * Minimal Notion REST API client (v1).
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const PRIME_NOTION_API = 'https://api.notion.com/v1';

/**
 * Return a remote GET with the required Notion headers.
 *
 * @return array|\WP_Error
 */
function prime_notion_request( $token, $path, $args = array() ) {
	$url = PRIME_NOTION_API . $path;
	$headers = array(
		'Authorization'   => 'Bearer ' . $token,
		'Notion-Version'  => '2022-06-28',
		'Content-Type'    => 'application/json',
	);
	$resp = wp_remote_get( $url, array(
		'headers'  => $headers,
		'timeout'  => 30,
	) + $args );
	if ( is_wp_error( $resp ) ) {
		return $resp;
	}
	$code = wp_remote_retrieve_response_code( $resp );
	$body = json_decode( wp_remote_retrieve_body( $resp ), true );
	if ( $code >= 400 ) {
		$msg = isset( $body['message'] ) ? $body['message'] : "HTTP $code";
		return new WP_Error( 'notion_' . $code, $msg );
	}
	return $body;
}

/**
 * Fetch a page: resolve its title + all block children (paginated).
 *
 * @return array{title:string,blocks:array}|\WP_Error
 */
function prime_notion_get_page( $token, $id ) {
	// Page metadata.
	$meta = prime_notion_request( $token, '/pages/' . $id );
	if ( is_wp_error( $meta ) ) {
		return $meta;
	}

	$title = prime_notion_page_title( $meta );

	// Block children, paginated.
	$blocks = array();
	$cursor = null;
	do {
		$path = '/blocks/' . $id . '/children?page_size=100';
		if ( $cursor ) {
			$path .= '&start_cursor=' . rawurlencode( $cursor );
		}
		$resp = prime_notion_request( $token, $path );
		if ( is_wp_error( $resp ) ) {
			return $resp;
		}
		foreach ( (array) $resp['results'] as $b ) {
			$blocks[] = $b;
		}
		$cursor = isset( $resp['has_more'] ) && $resp['has_more'] ? $resp['next_cursor'] : null;
	} while ( $cursor );

	return array( 'title' => $title, 'blocks' => $blocks );
}

/**
 * Extract the page title from a page object (property-based, with fallbacks).
 */
function prime_notion_page_title( $page ) {
	if ( isset( $page['properties']['title']['title'][0]['plain_text'] ) ) {
		return $page['properties']['title']['title'][0]['plain_text'];
	}
	if ( isset( $page['properties']['Name']['title'][0]['plain_text'] ) ) {
		return $page['properties']['Name']['title'][0]['plain_text'];
	}
	return 'Página Notion ' . substr( (string) $page['id'], 0, 8 );
}
