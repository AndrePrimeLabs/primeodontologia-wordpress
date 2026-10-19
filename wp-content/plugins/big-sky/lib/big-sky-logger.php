<?php
declare( strict_types = 1 );

abstract class Big_Sky_Logger {
	abstract public function log_session( $session_uuid, $name, $date, $is_test = false, $big_sky_version = '0' );
	abstract public function log_action( $session_uuid, $message_role, $message_id, $content, $date, $parent_message_id, $is_test = false, $phase = null, $editor = null, $big_sky_version = '0' );
	abstract public function log_metadata( $session_uuid, $metadata );
}
