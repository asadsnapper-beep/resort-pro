<?php
/**
 * ResortPro Embed — Gutenberg Blocks
 *
 * Registers 5 server-side Gutenberg blocks using register_block_type() with
 * render_callback. No block.json required — attributes and metadata are
 * declared inline.
 *
 * Blocks registered:
 *   resortpro/booking
 *   resortpro/rooms
 *   resortpro/calendar
 *   resortpro/menu
 *   resortpro/cta
 *
 * @package ResortPro_Embed
 * @since   1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class ResortPro_Blocks
 */
class ResortPro_Blocks {

	/**
	 * @var ResortPro_Plugin
	 */
	private ResortPro_Plugin $plugin;

	/**
	 * Block definitions: name → label.
	 * The cta block adds an extra 'whatsapp' attribute.
	 *
	 * @var array<string,string>
	 */
	private array $blocks = array(
		'booking'  => 'Booking Form',
		'rooms'    => 'Room Listings',
		'calendar' => 'Availability Calendar',
		'menu'     => 'Food & Beverage Menu',
		'cta'      => 'Floating CTA',
	);

	/**
	 * @param ResortPro_Plugin $plugin
	 */
	public function __construct( ResortPro_Plugin $plugin ) {
		$this->plugin = $plugin;
	}

	/**
	 * Register all blocks and their editor script.
	 */
	public function register(): void {
		// Register a lightweight editor script that makes the blocks selectable
		// in the block inserter with a placeholder preview.
		$this->register_editor_script();

		foreach ( $this->blocks as $widget => $label ) {
			$this->register_block( $widget, $label );
		}
	}

	// ─── Editor Script ────────────────────────────────────────────────────────

	/**
	 * Register the Gutenberg editor script that provides the JS block definitions.
	 * The script is inlined to avoid needing a build step.
	 */
	private function register_editor_script(): void {
		$script_handle = 'resortpro-blocks-editor';

		// Build the inline JS that registers each block in the editor.
		$js = $this->build_editor_script();

		wp_register_script(
			$script_handle,
			'', // Empty src — we use wp_add_inline_script below.
			array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
			RESORTPRO_VERSION,
			true
		);

		wp_add_inline_script( $script_handle, $js );
	}

	/**
	 * Build the editor JS string that registers all blocks via @wordpress/blocks.
	 *
	 * @return string JavaScript source.
	 */
	private function build_editor_script(): string {
		$blocks_js = array();

		foreach ( $this->blocks as $widget => $label ) {
			$has_whatsapp = ( 'cta' === $widget ) ? 'true' : 'false';
			$icon         = $this->get_block_icon( $widget );

			$blocks_js[] = <<<JS
(function() {
	var __ = wp.i18n.__;
	var el = wp.element.createElement;
	var TextControl = wp.components.TextControl;
	var PanelBody = wp.components.PanelBody;
	var InspectorControls = wp.blockEditor.InspectorControls;

	wp.blocks.registerBlockType( 'resortpro/{$widget}', {
		title: __( 'ResortPro: {$label}', 'resortpro-embed' ),
		description: __( 'Embeds the ResortPro {$label} widget.', 'resortpro-embed' ),
		category: 'embed',
		icon: '{$icon}',
		keywords: [ 'resortpro', '{$widget}', 'hotel', 'resort' ],
		supports: { html: false },
		attributes: {
			slug:      { type: 'string', default: '' },
			color:     { type: 'string', default: '' },
			currency:  { type: 'string', default: '' },
			whatsapp:  { type: 'string', default: '' }
		},
		edit: function( props ) {
			var atts  = props.attributes;
			var setAttr = props.setAttributes;
			var hasWhatsapp = {$has_whatsapp};

			var controls = el(
				InspectorControls,
				null,
				el( PanelBody, { title: __( 'ResortPro Settings', 'resortpro-embed' ), initialOpen: true },
					el( TextControl, {
						label: __( 'Resort Slug', 'resortpro-embed' ),
						value: atts.slug,
						placeholder: 'palm-paradise',
						onChange: function(v) { setAttr({ slug: v }); }
					} ),
					el( TextControl, {
						label: __( 'Brand Color', 'resortpro-embed' ),
						value: atts.color,
						placeholder: '#1a6b5e',
						onChange: function(v) { setAttr({ color: v }); }
					} ),
					el( TextControl, {
						label: __( 'Currency', 'resortpro-embed' ),
						value: atts.currency,
						placeholder: 'USD',
						onChange: function(v) { setAttr({ currency: v }); }
					} ),
					hasWhatsapp ? el( TextControl, {
						label: __( 'WhatsApp Number', 'resortpro-embed' ),
						value: atts.whatsapp,
						placeholder: '+1234567890',
						onChange: function(v) { setAttr({ whatsapp: v }); }
					} ) : null
				)
			);

			var preview = el(
				'div',
				{
					style: {
						border: '2px dashed #1a6b5e',
						borderRadius: '6px',
						padding: '20px',
						textAlign: 'center',
						background: '#f0f9f7',
						color: '#1a6b5e',
						fontFamily: 'sans-serif'
					}
				},
				el( 'strong', null, 'ResortPro — {$label}' ),
				el( 'br' ),
				el( 'small', { style: { color: '#555' } }, atts.slug ? 'Slug: ' + atts.slug : 'Configure slug in the sidebar ›' )
			);

			return el( wp.element.Fragment, null, controls, preview );
		},
		save: function() {
			// Server-side render — return null so WP renders via render_callback.
			return null;
		}
	} );
})();
JS;
		}

		return implode( "\n\n", $blocks_js );
	}

	// ─── Block Registration ───────────────────────────────────────────────────

	/**
	 * Register a single block type.
	 *
	 * @param string $widget  Widget slug (e.g. 'booking').
	 * @param string $label   Human-readable label.
	 */
	private function register_block( string $widget, string $label ): void {
		$attributes = array(
			'slug'     => array(
				'type'    => 'string',
				'default' => '',
			),
			'color'    => array(
				'type'    => 'string',
				'default' => '',
			),
			'currency' => array(
				'type'    => 'string',
				'default' => '',
			),
		);

		// The CTA block also exposes a WhatsApp field.
		if ( 'cta' === $widget ) {
			$attributes['whatsapp'] = array(
				'type'    => 'string',
				'default' => '',
			);
		}

		register_block_type(
			'resortpro/' . $widget,
			array(
				'api_version'     => 2,
				'title'           => sprintf( 'ResortPro: %s', $label ),
				'description'     => sprintf( 'Embeds the ResortPro %s widget.', $label ),
				'category'        => 'embed',
				'editor_script'   => 'resortpro-blocks-editor',
				'attributes'      => $attributes,
				'render_callback' => function ( array $block_atts ) use ( $widget ) {
					return $this->render_block( $widget, $block_atts );
				},
			)
		);
	}

	// ─── Server-Side Render ───────────────────────────────────────────────────

	/**
	 * Render callback for all blocks.
	 * Merges block attributes with global settings, flags the CDN script,
	 * and returns the embed <div>.
	 *
	 * @param  string $widget      Widget identifier.
	 * @param  array  $block_atts  Block attributes from the editor.
	 * @return string              HTML.
	 */
	private function render_block( string $widget, array $block_atts ): string {
		$settings = $this->plugin->get_settings();

		// Prefer per-block attributes; fall back to global settings.
		$slug     = ! empty( $block_atts['slug'] )     ? $block_atts['slug']     : $settings['slug'];
		$color    = ! empty( $block_atts['color'] )    ? $block_atts['color']    : $settings['color'];
		$currency = ! empty( $block_atts['currency'] ) ? $block_atts['currency'] : $settings['currency'];
		$whatsapp = ! empty( $block_atts['whatsapp'] ) ? $block_atts['whatsapp'] : $settings['whatsapp'];

		if ( empty( $slug ) ) {
			if ( current_user_can( 'manage_options' ) ) {
				return '<p style="color:red;font-size:13px;">[ResortPro] No resort slug configured. Please visit Settings → ResortPro Embed.</p>';
			}
			return '<!-- ResortPro: slug not configured -->';
		}

		// Signal that the CDN script should be printed.
		$this->plugin->needs_script = true;

		// Build the embed div.
		$html  = '<div';
		$html .= ' data-resortpro="' . esc_attr( $widget ) . '"';
		$html .= ' data-slug="' . esc_attr( $slug ) . '"';

		if ( ! empty( $color ) ) {
			$html .= ' data-color="' . esc_attr( $color ) . '"';
		}
		if ( ! empty( $currency ) ) {
			$html .= ' data-currency="' . esc_attr( strtoupper( $currency ) ) . '"';
		}
		if ( ! empty( $whatsapp ) ) {
			$html .= ' data-whatsapp="' . esc_attr( $whatsapp ) . '"';
		}

		$html .= '></div>';

		return $html;
	}

	// ─── Icons ───────────────────────────────────────────────────────────────

	/**
	 * Return a Dashicon slug appropriate for each widget type.
	 *
	 * @param  string $widget Widget slug.
	 * @return string         Dashicon name.
	 */
	private function get_block_icon( string $widget ): string {
		$icons = array(
			'booking'  => 'tickets-alt',
			'rooms'    => 'building',
			'calendar' => 'calendar-alt',
			'menu'     => 'food',
			'cta'      => 'phone',
		);

		return $icons[ $widget ] ?? 'admin-home';
	}
}
