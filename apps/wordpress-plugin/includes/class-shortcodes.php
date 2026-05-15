<?php
/**
 * ResortPro Embed — Shortcodes
 *
 * Registers and handles all [resortpro_*] shortcodes.
 * Output follows the pattern:
 *   <div data-resortpro="{widget}" data-slug="{slug}" [data-color=…] [data-currency=…]></div>
 *
 * @package ResortPro_Embed
 * @since   1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class ResortPro_Shortcodes
 *
 * All shortcodes share a common base render method. Each shortcode maps
 * to a widget name recognised by embed.js.
 */
class ResortPro_Shortcodes {

	/**
	 * Reference to the main plugin instance (used to flip needs_script flag
	 * and to read global settings).
	 *
	 * @var ResortPro_Plugin
	 */
	private ResortPro_Plugin $plugin;

	/**
	 * Map of shortcode tag → widget name passed to data-resortpro attribute.
	 *
	 * @var array<string,string>
	 */
	private array $shortcode_map = array(
		'resortpro_booking'  => 'booking',
		'resortpro_rooms'    => 'rooms',
		'resortpro_calendar' => 'calendar',
		'resortpro_menu'     => 'menu',
		'resortpro_cta'      => 'cta',
	);

	/**
	 * Constructor.
	 *
	 * @param ResortPro_Plugin $plugin Main plugin instance.
	 */
	public function __construct( ResortPro_Plugin $plugin ) {
		$this->plugin = $plugin;
	}

	/**
	 * Register all shortcodes with WordPress.
	 */
	public function register(): void {
		foreach ( $this->shortcode_map as $tag => $widget ) {
			add_shortcode( $tag, array( $this, 'render_shortcode' ) );
		}
	}

	// ─── Render Callback ─────────────────────────────────────────────────────

	/**
	 * Unified shortcode render callback.
	 *
	 * WordPress passes the registered shortcode tag as $shortcode_tag to
	 * add_shortcode callbacks when using the same handler for multiple tags,
	 * but the cleanest approach is to read it from $atts['resortpro_tag'] which
	 * we inject via individual closures. Since we use one method, we retrieve
	 * the widget name from the third argument (the shortcode tag).
	 *
	 * @param  array|string $atts    Shortcode attributes.
	 * @param  string|null  $content Enclosed content (unused).
	 * @param  string       $tag     The shortcode tag that was used.
	 * @return string                HTML output.
	 */
	public function render_shortcode( $atts, ?string $content, string $tag ): string {
		$widget = $this->shortcode_map[ $tag ] ?? 'booking';

		$settings = $this->plugin->get_settings();

		// Merge shortcode attributes with global defaults.
		// Individual attributes override global settings.
		$atts = shortcode_atts(
			array(
				'slug'      => $settings['slug'],
				'color'     => $settings['color'],
				'currency'  => $settings['currency'],
				'whatsapp'  => $settings['whatsapp'],
			),
			$atts,
			$tag
		);

		// Validate that we have at least a slug before rendering.
		if ( empty( $atts['slug'] ) ) {
			if ( current_user_can( 'manage_options' ) ) {
				return '<p style="color:red;font-size:13px;">' .
					esc_html__( '[ResortPro] No resort slug configured. Please visit Settings → ResortPro Embed.', 'resortpro-embed' ) .
					'</p>';
			}
			return '<!-- ResortPro: slug not configured -->';
		}

		// Flag that the CDN script should be printed in the footer.
		$this->plugin->needs_script = true;

		return $this->build_widget_html( $widget, $atts );
	}

	// ─── HTML Builder ─────────────────────────────────────────────────────────

	/**
	 * Build the <div> element that embed.js will hydrate into the widget.
	 *
	 * @param  string $widget  Widget identifier (booking | rooms | calendar | menu | cta).
	 * @param  array  $atts    Merged attribute array.
	 * @return string          Safe HTML string.
	 */
	private function build_widget_html( string $widget, array $atts ): string {
		$html = '<div';
		$html .= ' data-resortpro="' . esc_attr( $widget ) . '"';
		$html .= ' data-slug="' . esc_attr( $atts['slug'] ) . '"';

		if ( ! empty( $atts['color'] ) ) {
			$html .= ' data-color="' . esc_attr( $atts['color'] ) . '"';
		}

		if ( ! empty( $atts['currency'] ) ) {
			$html .= ' data-currency="' . esc_attr( strtoupper( $atts['currency'] ) ) . '"';
		}

		// The whatsapp attribute is only meaningful for the CTA widget,
		// but we output it unconditionally so embed.js can decide.
		if ( ! empty( $atts['whatsapp'] ) ) {
			$html .= ' data-whatsapp="' . esc_attr( $atts['whatsapp'] ) . '"';
		}

		$html .= '></div>';

		return $html;
	}
}
