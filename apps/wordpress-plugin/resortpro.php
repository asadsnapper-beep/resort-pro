<?php
/**
 * Plugin Name:       ResortPro Embed
 * Plugin URI:        https://resortpro.app
 * Description:       Add ResortPro booking forms, room listings, availability calendar, food menu, and a floating CTA to any page using shortcodes or Gutenberg blocks.
 * Version:           1.0.0
 * Requires at least: 5.5
 * Requires PHP:      7.4
 * Author:            ResortPro
 * Author URI:        https://resortpro.app
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       resortpro-embed
 * Domain Path:       /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Do not execute outside of WordPress.
}

// ─── Constants ───────────────────────────────────────────────────────────────

define( 'RESORTPRO_VERSION', '1.0.0' );
define( 'RESORTPRO_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'RESORTPRO_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'RESORTPRO_CDN_SCRIPT', 'https://cdn.resortpro.app/embed.js' );
define( 'RESORTPRO_OPTION_KEY', 'resortpro_settings' );

// ─── Includes ─────────────────────────────────────────────────────────────────

require_once RESORTPRO_PLUGIN_DIR . 'includes/class-shortcodes.php';
require_once RESORTPRO_PLUGIN_DIR . 'includes/class-blocks.php';

// ─── Main Plugin Class ────────────────────────────────────────────────────────

/**
 * Class ResortPro_Plugin
 *
 * Singleton controller. Bootstraps shortcodes, Gutenberg blocks, admin UI,
 * and conditional CDN script enqueue.
 */
final class ResortPro_Plugin {

	/**
	 * Singleton instance.
	 *
	 * @var ResortPro_Plugin|null
	 */
	private static $instance = null;

	/**
	 * Whether the CDN embed script needs to be printed.
	 * Set to true by shortcodes and blocks when they render a widget.
	 *
	 * @var bool
	 */
	public $needs_script = false;

	/**
	 * Shortcodes handler.
	 *
	 * @var ResortPro_Shortcodes
	 */
	private $shortcodes;

	/**
	 * Blocks handler.
	 *
	 * @var ResortPro_Blocks
	 */
	private $blocks;

	/**
	 * Private constructor — use instance().
	 */
	private function __construct() {}

	/**
	 * Returns the single plugin instance.
	 *
	 * @return ResortPro_Plugin
	 */
	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Hook everything up.
	 * Called once on 'plugins_loaded'.
	 */
	public function init(): void {
		// Register shortcodes on the 'init' hook so they are available early.
		add_action( 'init', array( $this, 'register_shortcodes' ) );

		// Register Gutenberg blocks on the 'init' hook.
		add_action( 'init', array( $this, 'register_blocks' ) );

		// Print the CDN script in the footer — only when a widget is on the page.
		add_action( 'wp_footer', array( $this, 'enqueue_script' ), 20 );

		// Admin: settings page.
		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );

		// Admin: register settings with Settings API.
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	// ─── Shortcodes ──────────────────────────────────────────────────────────

	/**
	 * Instantiate and register all shortcodes.
	 */
	public function register_shortcodes(): void {
		$this->shortcodes = new ResortPro_Shortcodes( $this );
		$this->shortcodes->register();
	}

	// ─── Blocks ──────────────────────────────────────────────────────────────

	/**
	 * Instantiate and register all Gutenberg blocks.
	 */
	public function register_blocks(): void {
		if ( function_exists( 'register_block_type' ) ) {
			$this->blocks = new ResortPro_Blocks( $this );
			$this->blocks->register();
		}
	}

	// ─── Script Enqueue ───────────────────────────────────────────────────────

	/**
	 * Print the ResortPro CDN embed script in the footer.
	 * Only fires when $this->needs_script is true (set by widgets that rendered).
	 */
	public function enqueue_script(): void {
		if ( ! $this->needs_script ) {
			return;
		}

		$settings = $this->get_settings();

		// Build a nonce-less, deferred script tag.
		// phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedScript
		echo '<script src="' . esc_url( RESORTPRO_CDN_SCRIPT ) . '" defer data-resortpro-version="' . esc_attr( RESORTPRO_VERSION ) . '"';

		if ( ! empty( $settings['color'] ) ) {
			echo ' data-resortpro-color="' . esc_attr( $settings['color'] ) . '"';
		}
		if ( ! empty( $settings['currency'] ) ) {
			echo ' data-resortpro-currency="' . esc_attr( $settings['currency'] ) . '"';
		}

		echo '></script>' . "\n";
	}

	// ─── Admin ───────────────────────────────────────────────────────────────

	/**
	 * Add ResortPro menu entry under Settings.
	 */
	public function add_admin_menu(): void {
		add_options_page(
			esc_html__( 'ResortPro Embed Settings', 'resortpro-embed' ),
			esc_html__( 'ResortPro Embed', 'resortpro-embed' ),
			'manage_options',
			'resortpro-embed',
			'resortpro_render_settings_page'
		);
	}

	/**
	 * Register the plugin option with the Settings API.
	 */
	public function register_settings(): void {
		register_setting(
			'resortpro_settings_group',
			RESORTPRO_OPTION_KEY,
			array(
				'sanitize_callback' => array( $this, 'sanitize_settings' ),
				'default'           => array(
					'slug'      => '',
					'color'     => '#1a6b5e',
					'currency'  => '',
					'whatsapp'  => '',
				),
			)
		);

		add_settings_section(
			'resortpro_general_section',
			esc_html__( 'General Settings', 'resortpro-embed' ),
			'__return_false',
			'resortpro-embed'
		);

		$fields = array(
			'slug'     => esc_html__( 'Resort Slug', 'resortpro-embed' ),
			'color'    => esc_html__( 'Brand Color', 'resortpro-embed' ),
			'currency' => esc_html__( 'Currency Override', 'resortpro-embed' ),
			'whatsapp' => esc_html__( 'WhatsApp Number', 'resortpro-embed' ),
		);

		foreach ( $fields as $key => $label ) {
			add_settings_field(
				'resortpro_field_' . $key,
				$label,
				array( $this, 'render_field_' . $key ),
				'resortpro-embed',
				'resortpro_general_section'
			);
		}
	}

	/**
	 * Sanitize the settings array before saving.
	 *
	 * @param  mixed $raw Raw input from the form.
	 * @return array      Sanitized settings.
	 */
	public function sanitize_settings( $raw ): array {
		$clean = array();

		$clean['slug']     = isset( $raw['slug'] ) ? sanitize_text_field( $raw['slug'] ) : '';
		$clean['color']    = isset( $raw['color'] ) ? sanitize_hex_color( $raw['color'] ) ?? '#1a6b5e' : '#1a6b5e';
		$clean['currency'] = isset( $raw['currency'] ) ? sanitize_text_field( $raw['currency'] ) : '';
		$clean['whatsapp'] = isset( $raw['whatsapp'] ) ? sanitize_text_field( $raw['whatsapp'] ) : '';

		return $clean;
	}

	// Field render callbacks — each outputs the relevant <input> element.

	public function render_field_slug(): void {
		$v = esc_attr( $this->get_settings()['slug'] ?? '' );
		echo '<input type="text" name="resortpro_settings[slug]" value="' . $v . '" class="regular-text" placeholder="palm-paradise" />';
		echo '<p class="description">' . esc_html__( 'The unique slug for your resort on ResortPro (e.g. palm-paradise).', 'resortpro-embed' ) . '</p>';
	}

	public function render_field_color(): void {
		$v = esc_attr( $this->get_settings()['color'] ?? '#1a6b5e' );
		echo '<input type="color" name="resortpro_settings[color]" value="' . $v . '" />';
		echo ' <input type="text" name="resortpro_settings[color]" value="' . $v . '" class="small-text" pattern="#[0-9a-fA-F]{6}" placeholder="#1a6b5e" />';
		echo '<p class="description">' . esc_html__( 'Primary brand color used in embed widgets.', 'resortpro-embed' ) . '</p>';
	}

	public function render_field_currency(): void {
		$v = esc_attr( $this->get_settings()['currency'] ?? '' );
		echo '<input type="text" name="resortpro_settings[currency]" value="' . $v . '" class="small-text" placeholder="USD" maxlength="3" />';
		echo '<p class="description">' . esc_html__( 'Optional 3-letter ISO currency code (e.g. USD, EUR, BDT). Leave blank to use your ResortPro account default.', 'resortpro-embed' ) . '</p>';
	}

	public function render_field_whatsapp(): void {
		$v = esc_attr( $this->get_settings()['whatsapp'] ?? '' );
		echo '<input type="text" name="resortpro_settings[whatsapp]" value="' . $v . '" class="regular-text" placeholder="+8801700000000" />';
		echo '<p class="description">' . esc_html__( 'WhatsApp number (with country code) shown in the floating CTA widget.', 'resortpro-embed' ) . '</p>';
	}

	// ─── Helpers ─────────────────────────────────────────────────────────────

	/**
	 * Retrieve the plugin settings, with safe defaults.
	 *
	 * @return array{slug:string,color:string,currency:string,whatsapp:string}
	 */
	public function get_settings(): array {
		$defaults = array(
			'slug'     => '',
			'color'    => '#1a6b5e',
			'currency' => '',
			'whatsapp' => '',
		);
		$stored   = get_option( RESORTPRO_OPTION_KEY, array() );
		return wp_parse_args( is_array( $stored ) ? $stored : array(), $defaults );
	}
}

// ─── Activation Hook ──────────────────────────────────────────────────────────

/**
 * On first activation, write default option values so the settings page
 * always has something sensible to display.
 */
register_activation_hook(
	__FILE__,
	function () {
		if ( false === get_option( RESORTPRO_OPTION_KEY ) ) {
			add_option(
				RESORTPRO_OPTION_KEY,
				array(
					'slug'     => '',
					'color'    => '#1a6b5e',
					'currency' => '',
					'whatsapp' => '',
				)
			);
		}
	}
);

// ─── Deactivation / Uninstall ─────────────────────────────────────────────────

register_deactivation_hook(
	__FILE__,
	function () {
		// Nothing to do on deactivation — leave settings intact.
	}
);

// Uninstall cleanup is handled in uninstall.php (not shipped in this scaffold).

// ─── Boot ─────────────────────────────────────────────────────────────────────

/**
 * Require the admin settings page renderer (safe to load on every request;
 * the function itself only runs when WP invokes the menu callback).
 */
add_action(
	'plugins_loaded',
	function () {
		// Load admin UI file — the function inside is only called by WP on demand.
		if ( is_admin() ) {
			require_once RESORTPRO_PLUGIN_DIR . 'admin/settings-page.php';
		}

		ResortPro_Plugin::instance()->init();
	}
);
