<?php
/**
 * Plugin Name:       Prime Notion → WordPress
 * Description:       Pull pipeline importing Notion pages as editable WordPress pages, mapped into the site's design system (DESIGN.md) block language.
 * Version:           1.0.0
 * Author:            Studio Code
 * Text Domain:       prime-notion
 * Requires at least: 6.3
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'PRIME_NOTION_VERSION', '1.0.0' );
define( 'PRIME_NOTION_DIR', plugin_dir_path( __FILE__ ) );
define( 'PRIME_NOTION_URL', plugin_dir_url( __FILE__ ) );

require_once PRIME_NOTION_DIR . 'includes/notion-api.php';
require_once PRIME_NOTION_DIR . 'includes/block-mapper.php';

/**
 * Add an admin menu + settings page for the importer.
 */
function prime_notion_admin_menu() {
	add_menu_page(
		'Prime Notion',
		'Prime Notion',
		'manage_options',
		'prime-notion',
		'prime_notion_admin_page',
		'dashicons-cloud-upload',
		58
	);
	add_submenu_page(
		'prime-notion',
		'Configuração',
		'Configuração',
		'manage_options',
		'prime-notion',
		'prime_notion_admin_page'
	);
	add_submenu_page(
		'prime-notion',
		'Importar',
		'Importar do Notion',
		'manage_options',
		'prime-notion-import',
		'prime_notion_import_page'
	);
}
add_action( 'admin_menu', 'prime_notion_admin_menu' );

/**
 * Settings: store Notion integration token + page (URL or ID) list.
 */
function prime_notion_register_settings() {
	register_setting( 'prime_notion', 'prime_notion_token', array( 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ) );
	register_setting( 'prime_notion', 'prime_notion_pages', array( 'type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field' ) );
	register_setting( 'prime_notion', 'prime_notion_status', array( 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ) );
}
add_action( 'admin_init', 'prime_notion_register_settings' );

/**
 * Render the settings screen.
 */
function prime_notion_admin_page() {
	?>
	<div class="wrap">
		<h1>Prime Notion → WordPress</h1>
		<p>Cole seu <strong>integration token</strong> do Notion e a lista de páginas (uma por linha — ID ou URL pública) a importar como <em>páginas</em> do site.</p>

		<h2>Como obter o token</h2>
		<ol>
			<li>Crie/abra um <strong>Integration</strong> em <code>notion.so/my-integrations</code>.</li>
			<li>Copie o <strong>Internal Integration Secret</strong> (token <code>secret_…</code>).</li>
			<li>No Notion, compartilhe cada página com a sua integração (Share → invite the integration, com permissão de edição).</li>
		</ol>

		<form method="post" action="options.php">
			<?php settings_fields( 'prime_notion' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="prime_notion_token">Notion Integration Token</label></th>
					<td>
						<input id="prime_notion_token" name="prime_notion_token" type="password" class="regular-text" value="<?php echo esc_attr( get_option( 'prime_notion_token' ) ); ?>" autocomplete="off" />
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="prime_notion_pages">Páginas do Notion (uma por linha)</label></th>
					<td>
						<textarea id="prime_notion_pages" name="prime_notion_pages" class="large-text" rows="6" placeholder="https://www.notion.so/Meu-Servico-abc123…"><?php echo esc_textarea( get_option( 'prime_notion_pages' ) ); ?></textarea>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="prime_notion_status">Status padrão</label></th>
					<td>
						<select id="prime_notion_status" name="prime_notion_status">
							<?php $st = get_option( 'prime_notion_status', 'draft' ); ?>
							<option value="publish" <?php selected( $st, 'publish' ); ?>>Publicada</option>
							<option value="draft" <?php selected( $st, 'draft' ); ?>>Rascunho</option>
						</select>
					</td>
				</tr>
			</table>
			<?php submit_button( 'Salvar configuração' ); ?>
		</form>
	</div>
	<?php
}

/**
 * Render the import screen (also handles the manual import action).
 */
function prime_notion_import_page() {
	$token = get_option( 'prime_notion_token' );
	if ( empty( $token ) ) {
		echo '<div class="wrap"><h1>Importar do Notion</h1><div class="notice notice-warning"><p>Configure seu token de integração na aba <strong>Configuração</strong> primeiro.</p></div></div>';
		return;
	}

	$ids = prime_notion_parse_page_list( get_option( 'prime_notion_pages' ) );
	if ( empty( $ids ) ) {
		echo '<div class="wrap"><h1>Importar do Notion</h1><div class="notice notice-warning"><p>Adicione ao menos uma página do Notion na aba <strong>Configuração</strong>.</p></div></div>';
		return;
	}

	echo '<div class="wrap"><h1>Importar do Notion</h1><p>Páginas configuradas: <strong>' . esc_html( count( $ids ) ) . '</strong>.</p>';
	echo '<form method="post"><input type="hidden" name="prime_notion_do_import" value="1" />';
	wp_nonce_field( 'prime_notion_import', 'prime_notion_nonce' );
	submit_button( 'Importar agora' );
	echo '</form></div>';

	if ( isset( $_POST['prime_notion_do_import'], $_POST['prime_notion_nonce'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['prime_notion_nonce'] ) ), 'prime_notion_import' ) ) {
		prime_notion_run_import( $token, $ids );
	}
}

/**
 * Normalize the page list into Notion page IDs.
 */
function prime_notion_parse_page_list( $raw ) {
	$ids = array();
	foreach ( preg_split( '/\r\n|\r|\n/', (string) $raw ) as $line ) {
		$line = trim( $line );
		if ( $line === '' ) {
			continue;
		}
		$id = prime_notion_extract_id( $line );
		if ( $id ) {
			$ids[] = $id;
		}
	}
	return array_unique( $ids );
}

/**
 * Pull a 32-char hex Notion id out of a URL or bare id.
 */
function prime_notion_extract_id( $value ) {
	if ( preg_match( '/[0-9a-f]{32}/i', $value, $m ) ) {
		return strtolower( $m[0] );
	}
	return null;
}

/**
 * Run the import: for each page id, fetch blocks, map to WP blocks, upsert page.
 */
function prime_notion_run_import( $token, $ids ) {
	$status     = get_option( 'prime_notion_status', 'draft' );
	$did        = 0;
	$failed     = 0;
	$reports    = array();

	echo '<div class="wrap"><h2>Resultado</h2>';

	foreach ( $ids as $id ) {
		$page = prime_notion_get_page( $token, $id );
		if ( is_wp_error( $page ) ) {
			$failed++;
			$reports[] = "<p>❌ <code>$id</code> — " . esc_html( $page->get_error_message() ) . '</p>';
			continue;
		}

		$title = $page['title'];
		$blocks = $page['blocks'];
		$markup = prime_notion_blocks_to_wp( $blocks );

		// Upsert page by Notion id stored in meta.
		$existing = get_posts( array(
			'post_type'      => 'page',
			'post_status'    => array( 'publish', 'draft', 'private' ),
			'meta_key'       => '_prime_notion_id',
			'meta_value'     => $id,
			'posts_per_page' => 1,
			'fields'         => 'ids',
		) );

		$slug = sanitize_title( $title );
		$args = array(
			'post_type'    => 'page',
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_status'  => $status,
			'post_content' => $markup,
		);

		if ( ! empty( $existing ) ) {
			$args['ID'] = $existing[0];
			$pid = wp_update_post( $args );
		} else {
			$pid = wp_insert_post( $args );
		}

		if ( is_wp_error( $pid ) ) {
			$failed++;
			$reports[] = "<p>❌ <code>$title</code> — " . esc_html( $pid->get_error_message() ) . '</p>';
			continue;
		}

		update_post_meta( $pid, '_prime_notion_id', $id );
		$did++;
		$reports[] = '<p>✅ Importada: <a href="' . esc_url( get_permalink( $pid ) ) . '">' . esc_html( $title ) . '</a> <span class="description">(' . count( $blocks ) . ' blocos)</span></p>';
	}

	echo implode( '', $reports );
	echo '<p><strong>Total:</strong> ' . $did . ' importadas, ' . $failed . ' com erro.</p></div>';
}
