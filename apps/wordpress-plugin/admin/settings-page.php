<?php
/**
 * ResortPro Embed — Admin Settings Page
 *
 * Renders the plugin settings page registered under Settings → ResortPro Embed.
 * Uses the WordPress Settings API. This file is included by the main plugin
 * class only on admin requests.
 *
 * @package ResortPro_Embed
 * @since   1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Render the full settings page HTML.
 *
 * This function is passed as the page callback to add_options_page().
 * WordPress handles the nonce / options save via Settings API before this
 * function is called on GET requests.
 */
function resortpro_render_settings_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'You do not have permission to access this page.', 'resortpro-embed' ) );
	}

	$settings = ResortPro_Plugin::instance()->get_settings();
	$slug      = $settings['slug'];
	$color     = $settings['color'];
	$currency  = $settings['currency'];
	$whatsapp  = $settings['whatsapp'];

	// Admin notice for missing slug.
	$show_slug_warning = empty( $slug );

	?>
	<div class="wrap" id="resortpro-settings-wrap">

		<!-- ── Page Header ──────────────────────────────────────────────── -->
		<div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
			<svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<rect width="36" height="36" rx="8" fill="#1a6b5e"/>
				<path d="M8 28V14l10-6 10 6v14H22v-7h-8v7H8Z" fill="#d4a853"/>
				<rect x="15" y="21" width="6" height="7" fill="#1a6b5e"/>
			</svg>
			<h1 style="margin:0;font-size:22px;color:#1a6b5e;">
				<?php esc_html_e( 'ResortPro Embed', 'resortpro-embed' ); ?>
				<span style="font-size:13px;font-weight:400;color:#777;margin-left:8px;">v<?php echo esc_html( RESORTPRO_VERSION ); ?></span>
			</h1>
		</div>
		<p style="color:#555;max-width:640px;">
			<?php esc_html_e( 'Connect your WordPress site to your ResortPro account. Once configured, use shortcodes or Gutenberg blocks to embed booking forms, room listings, availability calendars, menus, and a floating CTA anywhere on your site.', 'resortpro-embed' ); ?>
		</p>

		<?php if ( $show_slug_warning ) : ?>
		<div class="notice notice-warning inline" style="max-width:640px;">
			<p>
				<strong><?php esc_html_e( 'Action required:', 'resortpro-embed' ); ?></strong>
				<?php esc_html_e( 'Enter your resort slug below to activate the embed widgets.', 'resortpro-embed' ); ?>
			</p>
		</div>
		<?php endif; ?>

		<hr style="margin:16px 0 24px;">

		<!-- ── Two-column layout: Settings | Quickstart ─────────────────── -->
		<div style="display:grid;grid-template-columns:minmax(340px,560px) 1fr;gap:32px;max-width:1024px;align-items:start;">

			<!-- ── Settings Form ──────────────────────────────────────────── -->
			<div>
				<form method="post" action="options.php" novalidate>
					<?php settings_fields( 'resortpro_settings_group' ); ?>

					<table class="form-table" role="presentation">

						<!-- Resort Slug -->
						<tr>
							<th scope="row">
								<label for="resortpro-slug"><?php esc_html_e( 'Resort Slug', 'resortpro-embed' ); ?></label>
							</th>
							<td>
								<input
									type="text"
									id="resortpro-slug"
									name="resortpro_settings[slug]"
									value="<?php echo esc_attr( $slug ); ?>"
									class="regular-text"
									placeholder="palm-paradise"
									autocomplete="off"
								/>
								<p class="description">
									<?php esc_html_e( 'The unique slug for your resort on ResortPro (e.g.', 'resortpro-embed' ); ?>
									<code>palm-paradise</code>).
									<?php
									printf(
										'<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>',
										esc_url( 'https://resortpro.app/dashboard/settings' ),
										esc_html__( 'Find it in your dashboard →', 'resortpro-embed' )
									);
									?>
								</p>
							</td>
						</tr>

						<!-- Brand Color -->
						<tr>
							<th scope="row">
								<label for="resortpro-color"><?php esc_html_e( 'Brand Color', 'resortpro-embed' ); ?></label>
							</th>
							<td>
								<div style="display:flex;align-items:center;gap:8px;">
									<input
										type="color"
										id="resortpro-color-picker"
										value="<?php echo esc_attr( $color ); ?>"
										style="height:36px;width:48px;padding:2px;border-radius:4px;cursor:pointer;"
										oninput="document.getElementById('resortpro-color').value=this.value;updatePreviewColor(this.value);"
									/>
									<input
										type="text"
										id="resortpro-color"
										name="resortpro_settings[color]"
										value="<?php echo esc_attr( $color ); ?>"
										class="small-text"
										pattern="^#[0-9a-fA-F]{6}$"
										placeholder="#1a6b5e"
										maxlength="7"
										oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value)){document.getElementById('resortpro-color-picker').value=this.value;updatePreviewColor(this.value);}"
									/>
								</div>
								<p class="description"><?php esc_html_e( 'Primary brand color applied to all embedded widgets.', 'resortpro-embed' ); ?></p>
							</td>
						</tr>

						<!-- Currency -->
						<tr>
							<th scope="row">
								<label for="resortpro-currency"><?php esc_html_e( 'Currency Override', 'resortpro-embed' ); ?></label>
							</th>
							<td>
								<input
									type="text"
									id="resortpro-currency"
									name="resortpro_settings[currency]"
									value="<?php echo esc_attr( $currency ); ?>"
									class="small-text"
									placeholder="USD"
									maxlength="3"
									style="text-transform:uppercase;"
								/>
								<p class="description"><?php esc_html_e( 'Optional 3-letter ISO 4217 currency code (e.g. USD, EUR, BDT). Leave blank to use your ResortPro account default.', 'resortpro-embed' ); ?></p>
							</td>
						</tr>

						<!-- WhatsApp -->
						<tr>
							<th scope="row">
								<label for="resortpro-whatsapp"><?php esc_html_e( 'WhatsApp Number', 'resortpro-embed' ); ?></label>
							</th>
							<td>
								<input
									type="tel"
									id="resortpro-whatsapp"
									name="resortpro_settings[whatsapp]"
									value="<?php echo esc_attr( $whatsapp ); ?>"
									class="regular-text"
									placeholder="+8801700000000"
								/>
								<p class="description"><?php esc_html_e( 'Phone number (with country code) shown in the floating CTA widget. Only used by [resortpro_cta].', 'resortpro-embed' ); ?></p>
							</td>
						</tr>

					</table>

					<?php submit_button( esc_html__( 'Save Settings', 'resortpro-embed' ) ); ?>
				</form>
			</div>

			<!-- ── Quick-start & Shortcode Reference ──────────────────────── -->
			<div>
				<div style="background:#f9fafb;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;">
					<h2 style="margin-top:0;font-size:15px;color:#1a6b5e;"><?php esc_html_e( 'Shortcode Reference', 'resortpro-embed' ); ?></h2>
					<p style="font-size:13px;color:#555;margin-top:0;">
						<?php esc_html_e( 'Paste any of these into a post or page. All shortcodes accept optional', 'resortpro-embed' ); ?>
						<code>slug</code>, <code>color</code>, <code>currency</code> <?php esc_html_e( 'attributes to override the global settings above.', 'resortpro-embed' ); ?>
					</p>
					<table style="width:100%;font-size:13px;border-collapse:collapse;">
						<thead>
							<tr style="border-bottom:1px solid #e2e8f0;">
								<th style="text-align:left;padding:6px 8px;color:#374151;"><?php esc_html_e( 'Shortcode', 'resortpro-embed' ); ?></th>
								<th style="text-align:left;padding:6px 8px;color:#374151;"><?php esc_html_e( 'Widget', 'resortpro-embed' ); ?></th>
							</tr>
						</thead>
						<tbody>
							<?php
							$shortcodes = array(
								array( '[resortpro_booking]', esc_html__( 'Booking form', 'resortpro-embed' ) ),
								array( '[resortpro_rooms]', esc_html__( 'Room listings', 'resortpro-embed' ) ),
								array( '[resortpro_calendar]', esc_html__( 'Availability calendar', 'resortpro-embed' ) ),
								array( '[resortpro_menu]', esc_html__( 'Food & beverage menu', 'resortpro-embed' ) ),
								array( '[resortpro_cta whatsapp="+1234"]', esc_html__( 'Floating CTA button', 'resortpro-embed' ) ),
							);
							foreach ( $shortcodes as $i => $row ) {
								$bg = 0 === $i % 2 ? '#fff' : '#f9fafb';
								echo '<tr style="background:' . esc_attr( $bg ) . ';">';
								echo '<td style="padding:6px 8px;"><code>' . esc_html( $row[0] ) . '</code></td>';
								echo '<td style="padding:6px 8px;color:#555;">' . esc_html( $row[1] ) . '</td>';
								echo '</tr>';
							}
							?>
						</tbody>
					</table>
				</div>

				<!-- ── Widget Preview ───────────────────────────────────────── -->
				<div style="margin-top:24px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;">
					<h2 style="margin-top:0;font-size:15px;color:#1a6b5e;"><?php esc_html_e( 'Widget Preview', 'resortpro-embed' ); ?></h2>
					<p style="font-size:13px;color:#555;margin-top:0;">
						<?php esc_html_e( 'A live preview of how each widget appears on your site (requires your slug to be saved above).', 'resortpro-embed' ); ?>
					</p>

					<?php if ( empty( $slug ) ) : ?>
					<p style="color:#b45309;font-size:13px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;">
						<?php esc_html_e( 'Save a resort slug above to enable the preview.', 'resortpro-embed' ); ?>
					</p>
					<?php else : ?>

					<div id="resortpro-preview-area">
						<?php
						$widgets = array( 'booking', 'rooms', 'calendar', 'menu', 'cta' );
						foreach ( $widgets as $w ) {
							echo '<div style="margin-bottom:12px;">';
							echo '<p style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;margin:0 0 4px;">' . esc_html( ucfirst( $w ) ) . '</p>';
							echo '<div';
							echo ' data-resortpro="' . esc_attr( $w ) . '"';
							echo ' data-slug="' . esc_attr( $slug ) . '"';
							echo ' data-color="' . esc_attr( $color ) . '"';
							if ( ! empty( $currency ) ) {
								echo ' data-currency="' . esc_attr( strtoupper( $currency ) ) . '"';
							}
							if ( 'cta' === $w && ! empty( $whatsapp ) ) {
								echo ' data-whatsapp="' . esc_attr( $whatsapp ) . '"';
							}
							echo ' data-preview="true"';
							echo '></div>';
							echo '</div>';
						}
						?>
					</div>

					<!-- Load CDN script for preview (admin only). -->
					<script src="<?php echo esc_url( RESORTPRO_CDN_SCRIPT ); ?>" defer data-resortpro-version="<?php echo esc_attr( RESORTPRO_VERSION ); ?>"></script>

					<?php endif; ?>
				</div>

				<!-- ── Connection Status ─────────────────────────────────────── -->
				<div style="margin-top:24px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;">
					<h2 style="margin-top:0;font-size:15px;color:#1a6b5e;"><?php esc_html_e( 'Connection Status', 'resortpro-embed' ); ?></h2>

					<?php if ( empty( $slug ) ) : ?>
					<p style="color:#b45309;font-size:13px;">
						&#9888; <?php esc_html_e( 'No slug configured — widgets will not render.', 'resortpro-embed' ); ?>
					</p>
					<?php else : ?>
					<table style="font-size:13px;border-collapse:collapse;width:100%;">
						<tr>
							<td style="padding:4px 0;color:#555;width:120px;"><?php esc_html_e( 'Slug', 'resortpro-embed' ); ?></td>
							<td style="padding:4px 0;"><code><?php echo esc_html( $slug ); ?></code></td>
						</tr>
						<tr>
							<td style="padding:4px 0;color:#555;"><?php esc_html_e( 'Brand Color', 'resortpro-embed' ); ?></td>
							<td style="padding:4px 0;">
								<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:<?php echo esc_attr( $color ); ?>;vertical-align:middle;margin-right:6px;border:1px solid #e2e8f0;"></span>
								<code><?php echo esc_html( $color ); ?></code>
							</td>
						</tr>
						<?php if ( ! empty( $currency ) ) : ?>
						<tr>
							<td style="padding:4px 0;color:#555;"><?php esc_html_e( 'Currency', 'resortpro-embed' ); ?></td>
							<td style="padding:4px 0;"><code><?php echo esc_html( strtoupper( $currency ) ); ?></code></td>
						</tr>
						<?php endif; ?>
						<?php if ( ! empty( $whatsapp ) ) : ?>
						<tr>
							<td style="padding:4px 0;color:#555;"><?php esc_html_e( 'WhatsApp', 'resortpro-embed' ); ?></td>
							<td style="padding:4px 0;"><code><?php echo esc_html( $whatsapp ); ?></code></td>
						</tr>
						<?php endif; ?>
						<tr>
							<td style="padding:4px 0;color:#555;"><?php esc_html_e( 'CDN Script', 'resortpro-embed' ); ?></td>
							<td style="padding:4px 0;">
								<a href="<?php echo esc_url( RESORTPRO_CDN_SCRIPT ); ?>" target="_blank" rel="noopener noreferrer" style="font-size:12px;">
									<?php echo esc_html( RESORTPRO_CDN_SCRIPT ); ?>
								</a>
							</td>
						</tr>
					</table>

					<p style="margin-top:16px;margin-bottom:0;">
						<a href="<?php echo esc_url( 'https://resortpro.app/dashboard' ); ?>" target="_blank" rel="noopener noreferrer" class="button button-secondary">
							<?php esc_html_e( 'Open ResortPro Dashboard ↗', 'resortpro-embed' ); ?>
						</a>
					</p>
					<?php endif; ?>
				</div>

			</div><!-- /.right-column -->
		</div><!-- /.grid -->

	</div><!-- /#resortpro-settings-wrap -->

	<style>
	#resortpro-settings-wrap code {
		background: #f3f4f6;
		padding: 2px 5px;
		border-radius: 4px;
		font-size: 12px;
	}
	#resortpro-settings-wrap .form-table th {
		width: 160px;
		padding-top: 18px;
	}
	</style>

	<script>
	function updatePreviewColor( hex ) {
		// Sync the text input and color picker when either changes.
		var picker = document.getElementById( 'resortpro-color-picker' );
		var text   = document.getElementById( 'resortpro-color' );
		if ( picker && /^#[0-9a-fA-F]{6}$/.test( hex ) ) {
			picker.value = hex;
		}
		if ( text ) {
			text.value = hex;
		}
	}
	</script>
	<?php
}
